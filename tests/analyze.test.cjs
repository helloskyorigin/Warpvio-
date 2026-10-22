'use strict';
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const { PassThrough } = require('node:stream');
const dns = require('node:dns');
const http = require('node:http');
const https = require('node:https');
const handler = require('../api/analyze');

const original = { lookup: dns.promises.lookup, https: https.request, http: http.request };
afterEach(() => {
  dns.promises.lookup = original.lookup;
  https.request = original.https;
  http.request = original.http;
});

function res() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; }
  };
}

function req(url = 'https://example.com', platforms = ['Windows']) {
  return {
    method: 'POST',
    body: { url, platforms },
    headers: { 'x-forwarded-for': 'test-' + Math.random().toString(36).slice(2) },
    socket: {}
  };
}

function mockPage(html, opts = {}) {
  dns.promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
  const fake = (url, config, callback) => {
    assert.equal(typeof config.lookup, 'function');
    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.destroy = err => request.emit('error', err);
    request.end = () => {
      Promise.resolve().then(() => {
        const response = new PassThrough();
        response.statusCode = opts.status || 200;
        response.headers = opts.headers || { 'content-type': 'text/html; charset=utf-8' };
        callback(response);
        response.end(html);
      });
    };
    return request;
  };
  https.request = fake;
  http.request = fake;
}

test('rejects local/private URLs without network access', async () => {
  for (const url of ['http://127.0.0.1', 'http://10.1.2.3', 'http://169.254.169.254', 'http://192.168.1.3', 'http://localhost']) {
    const output = res();
    await handler(req(url), output);
    assert.equal(output.statusCode, 422);
    assert.equal(output.payload.ok, false);
  }
});

test('rejects missing platform', async () => {
  const output = res();
  await handler(req('https://example.com', []), output);
  assert.equal(output.statusCode, 422);
  assert.equal(output.payload.code, 'NO_PLATFORM');
});

test('returns real HTML metadata without claiming native build verification', async () => {
  mockPage('<!doctype html><html><head><title>Sample &amp; Co</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/icon.png"></head><body>Hello</body></html>');
  const output = res();
  await handler(req('https://example.com', ['Android', 'Windows']), output);
  assert.equal(output.statusCode, 200, JSON.stringify(output.payload));
  assert.equal(output.payload.ok, true);
  const result = output.payload.result;
  assert.equal(result.title, 'Sample & Co');
  assert.equal(result.finalUrl, 'https://example.com/');
  assert.equal(result.warnings, 0);
  assert.deepEqual(result.platforms, ['Android', 'Windows']);
  assert.match(result.checks.find(x => x.id === 'viewport').detail, /not yet verified/);
  assert.ok(result.unverified.some(x => x.includes('payments')));
});

test('flags missing viewport instead of inventing responsiveness results', async () => {
  mockPage('<html><head><title>Hello</title></head><body>Welcome</body></html>');
  const output = res();
  await handler(req(), output);
  assert.equal(output.statusCode, 200);
  assert.equal(output.payload.result.checks.find(x => x.id === 'viewport').status, 'warning');
  assert.ok(output.payload.result.warnings >= 1);
});

test('blocks redirects to private hosts', async () => {
  mockPage('', { status: 302, headers: { location: 'http://127.0.0.1/admin' } });
  const output = res();
  await handler(req(), output);
  assert.equal(output.statusCode, 422);
  assert.equal(output.payload.code, 'UNSAFE_URL');
});

test('rejects non-HTML responses', async () => {
  mockPage('not html', { headers: { 'content-type': 'application/json' } });
  const output = res();
  await handler(req(), output);
  assert.equal(output.statusCode, 422);
  assert.equal(output.payload.code, 'NOT_HTML');
});

test('only POST method is allowed', async () => {
  const output = res();
  await handler({ method: 'GET', headers: {}, socket: {} }, output);
  assert.equal(output.statusCode, 405);
  assert.equal(output.headers.Allow, 'POST');
});
