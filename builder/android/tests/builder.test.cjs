'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  validateUrl,validateName,validateAccent,validateOrientation,
  applicationIdFor,parseCli,propertiesEscape,generate
}=require('../scripts/prepare.cjs');
const { createPng, isValidPng256 }=require('../../windows/scripts/icon.cjs');

test('only public HTTPS domain URLs are accepted for APK QA',()=>{
  assert.equal(validateUrl('https://example.com/a?b=1#fragment'),'https://example.com/a?b=1');
  for(const input of [
    '', 'http://example.com', 'file:///secret', 'javascript:alert(1)',
    'https://localhost', 'https://somewhere.local', 'https://10.0.0.8',
    'https://127.0.0.1', 'https://192.168.1.1', 'https://[::1]',
    'https://service.internal', 'https://example.com:8080',
    'https://person:secret@example.com', 'https://hidden.onion',
    'https://somewhere.test', 'https://host.lan'
  ])assert.throws(()=>validateUrl(input));
});

test('app name, accents and orientation are strictly validated',()=>{
  assert.equal(validateName('  Demo  Website   App  '),'Demo Website App');
  assert.equal(validateAccent('blue'),'#3478f6');
  assert.equal(validateAccent('mint'),'#168f91');
  assert.equal(validateOrientation('auto'),'unspecified');
  assert.equal(validateOrientation('portrait'),'portrait');
  for(const name of ['', 'X', '<script>', 'Bad/Name', 'Two\nLines', 'A'.repeat(37), 'Name.']){
    assert.throws(()=>validateName(name));
  }
  assert.throws(()=>validateAccent('#000000'));
  assert.throws(()=>validateOrientation('landscape'));
});

test('Android application ID is safe and deterministic for an origin',()=>{
  const a=applicationIdFor('https://example.com/some/path');
  assert.match(a,/^com\.warpvio\.qa\.s[a-f0-9]{20}$/);
  assert.equal(a,applicationIdFor('https://example.com/'));
  assert.notEqual(a,applicationIdFor('https://another-domain.com/'));
});

test('CLI parser rejects unknown/duplicate/missing args',()=>{
  assert.deepEqual(parseCli(['--url','https://example.com/','--name','Sample']),{
    url:'https://example.com/',name:'Sample'
  });
  assert.throws(()=>parseCli(['--unknown','yes']));
  assert.throws(()=>parseCli(['--url','first','--url','second']));
  assert.throws(()=>parseCli(['--url']));
  assert.throws(()=>propertiesEscape('sample\nanotherProperty=evil'));
});

test('actual generated APK inputs, manifest resource and icon are produced',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'warpvio-android-'));
  try{
    const result=generate({
      url:'https://example.com/start?ref=qa',
      name:'Test Companion',
      accent:'violet',
      orientation:'portrait'
    },directory);
    assert.equal(result.appName,'Test Companion');
    assert.equal(result.websiteUrl,'https://example.com/start?ref=qa');
    assert.equal(result.accentColor,'#825df5');
    assert.equal(result.orientation,'portrait');
    assert.match(result.applicationId,/^com\.warpvio\.qa\.s[a-f0-9]{20}$/);
    const properties=fs.readFileSync(path.join(directory,'generated','app.properties'),'utf8');
    assert.match(properties,/appName=Test Companion/);
    assert.match(properties,/orientation=portrait/);
    assert.match(properties,/siteUrl=https:\/\/example\.com\/start\?ref=qa/);
    const png=fs.readFileSync(path.join(directory,'app','src','main','res','drawable-nodpi','warpvio_icon.png'));
    assert.equal(isValidPng256(png),true);
    assert.ok(png.length>100);
  }finally{fs.rmSync(directory,{recursive:true,force:true})}
});

test('manual PNG can be copied into the generated Android resources',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'warpvio-android-icon-'));
  try{
    const original=createPng('#168f91','W');
    const source=path.join(directory,'custom.png');
    fs.writeFileSync(source,original);
    generate({
      url:'https://example.com/',name:'Brand App',
      accent:'blue',orientation:'auto',icon:source
    },directory);
    const output=fs.readFileSync(path.join(directory,'app','src','main','res','drawable-nodpi','warpvio_icon.png'));
    assert.equal(output.equals(original),true);
  }finally{fs.rmSync(directory,{recursive:true,force:true})}
});

test('WebView is sandboxed by platform controls, with no native bridge',()=>{
  const main=fs.readFileSync(path.join(__dirname,'..','app','src','main','java','com','warpvio','shell','MainActivity.java'),'utf8');
  for(const expected of [
    'setJavaScriptEnabled(true)',
    'setDomStorageEnabled(true)',
    'setAllowFileAccess(false)',
    'setAllowContentAccess(false)',
    'setAllowUniversalAccessFromFileURLs(false)',
    'setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW)',
    'setJavaScriptCanOpenWindowsAutomatically(false)',
    'setSupportMultipleWindows(false)',
    'setWebContentsDebuggingEnabled(false)',
    'callback.backToSafety(true)',
    'handler.cancel()',
    'request.isForMainFrame()',
    'equalsIgnoreCase(next.getHost())'
  ])assert.ok(main.includes(expected),'Expected WebView guard: '+expected);
  assert.equal(main.includes('addJavascriptInterface('),false);
});

test('Android manifest only requests internet and prevents cleartext/backup',()=>{
  const manifest=fs.readFileSync(path.join(__dirname,'..','app','src','main','AndroidManifest.xml'),'utf8');
  assert.match(manifest,/android\.permission\.INTERNET/);
  assert.equal((manifest.match(/<uses-permission /g)||[]).length,1);
  assert.match(manifest,/android:allowBackup="false"/);
  assert.match(manifest,/android:usesCleartextTraffic="false"/);
  assert.match(manifest,/android:exported="true"/);
  assert.match(manifest,/WebView\.EnableSafeBrowsing/);
});

test('Gradle is configured for real debug APK compilation, not invented export links',()=>{
  const build=fs.readFileSync(path.join(__dirname,'..','app','build.gradle'),'utf8');
  const root=fs.readFileSync(path.join(__dirname,'..','build.gradle'),'utf8');
  assert.match(root,/8\.13\.2/);
  assert.match(build,/compileSdk 35/);
  assert.match(build,/targetSdk 35/);
  assert.match(build,/applicationId values\.getProperty/);
  assert.match(build,/buildConfigField 'String', 'SITE_URL'/);
  assert.match(build,/manifestPlaceholders/);
});
