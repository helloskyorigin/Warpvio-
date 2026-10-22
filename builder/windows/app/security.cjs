'use strict';

const net = require('node:net');
const crypto = require('node:crypto');

const ACCENTS = Object.freeze({
  blue: '#3478f6',
  violet: '#825df5',
  mint: '#168f91',
  rose: '#d85f89'
});
const WINDOW_SIZES = Object.freeze({
  standard: { width: 1200, height: 800 },
  compact: { width: 960, height: 700 }
});

/**
 * Validate an app's remote URL. The current QA builder intentionally supports
 * HTTPS domain names only, not IP literals, local hosts or custom ports.
 * This prevents accidentally packaging localhost and intranet targets.
 *
 * Ownership of the domain MUST be verified by a later public build service.
 */
function validateWebsiteUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) {
    throw new Error('Enter a public HTTPS website URL under 2048 characters.');
  }
  let url;
  try { url = new URL(raw.trim()); }
  catch { throw new Error('Enter a valid website URL, including https://.'); }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' ||
      url.username || url.password ||
      url.port || net.isIP(host) || !host.includes('.') ||
      host.endsWith('.') ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|onion|arpa)$/i.test(host) ||
      /[\s\\]/.test(raw)) {
    throw new Error('The Windows QA builder supports public HTTPS domain names only.');
  }
  url.hash = '';
  return url.href;
}

function validateAppName(raw) {
  if (typeof raw !== 'string') throw new Error('App name must be text.');
  const normalized = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 36 ||
      !/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(normalized) ||
      /[. ]$/.test(normalized)) {
    throw new Error('App name must be 2–36 letters/numbers with spaces, dots, hyphens or underscores.');
  }
  return normalized;
}

function validateAccent(accent) {
  if (!Object.hasOwn(ACCENTS,accent)) {
    throw new Error('Choose blue, violet, mint or rose accent.');
  }
  return ACCENTS[accent];
}

function validateSize(size) {
  if (!Object.hasOwn(WINDOW_SIZES,size)) {
    throw new Error('Choose standard or compact starting window size.');
  }
  return WINDOW_SIZES[size];
}

function makeAppId(url) {
  const u = new URL(validateWebsiteUrl(url));
  const name = u.hostname.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,25);
  const digest = crypto.createHash('sha256').update(u.origin).digest('hex').slice(0,12);
  return 'com.warpvio.apps.site' + name + '.a' + digest;
}

function isAllowedNavigation(destination,siteUrl) {
  try {
    const dest = new URL(destination);
    const initial = new URL(siteUrl);
    return dest.protocol === 'https:' && dest.origin === initial.origin;
  } catch { return false; }
}

module.exports = {
  ACCENTS, WINDOW_SIZES, validateWebsiteUrl, validateAppName,
  validateAccent, validateSize, makeAppId, isAllowedNavigation
};
