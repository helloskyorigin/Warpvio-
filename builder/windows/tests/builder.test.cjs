'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  validateWebsiteUrl,validateAppName,validateAccent,validateSize,
  isAllowedNavigation,makeAppId
}=require('../app/security.cjs');
const {createPng,isValidPng256,pngToIco}=require('../scripts/icon.cjs');
const {parseArgs,projectConfiguration}=require('../scripts/prepare.cjs');

test('requires HTTPS public domain and blocks local/IP hosts',()=>{
  assert.equal(validateWebsiteUrl('https://example.com/docs#frag'),'https://example.com/docs');
  assert.equal(validateWebsiteUrl('https://example.com/'),'https://example.com/');
  for(const url of [
    'http://example.com/',
    'https://127.0.0.1/',
    'https://192.168.1.5/',
    'https://[::1]/',
    'https://localhost/',
    'https://internal.local/',
    'https://somewhere.onion/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://foo.test/',
    'https://example.com:8443/',
    'https://user:pass@example.com/',
    'https://bad.localhost/'
  ])assert.throws(()=>validateWebsiteUrl(url),{message:/HTTPS|valid/});
});

test('app name and appearance are validated before build',()=>{
  assert.equal(validateAppName('  My  Sample  App '),'My Sample App');
  assert.equal(validateAccent('violet'),'#825df5');
  assert.deepEqual(validateSize('compact'),{width:960,height:700});
  for(const name of ['','A','Bad/Name','Bad:Name','Bad<>Name','Name.','A'.repeat(37)]){
    assert.throws(()=>validateAppName(name));
  }
  assert.throws(()=>validateAccent('#000000'));
  assert.throws(()=>validateSize('fullscreen'));
});

test('desktop navigation stays on the same HTTPS origin',()=>{
  const base='https://example.com/any';
  for(const good of ['https://example.com','https://example.com/page','https://example.com/?q=1']){
    assert.equal(isAllowedNavigation(good,base),true);
  }
  for(const bad of [
    'http://example.com/','https://evil.com/',
    'https://example.com.evil.net/', 'file:///etc/passwd',
    'javascript:alert(1)','https://sub.example.com/'
  ])assert.equal(isAllowedNavigation(bad,base),false);
});

test('app ID is deterministic per website origin',()=>{
  const a=makeAppId('https://example.com/');
  assert.match(a,/^com\.warpvio\.apps\.site[a-z0-9]+\.a[a-f0-9]{12}$/);
  assert.equal(a,makeAppId('https://example.com/other'));
  assert.notEqual(a,makeAppId('https://different.com/'));
});

test('generated brand PNG and ICO are real image headers',()=>{
  const png=createPng('#3478f6','W');
  const ico=pngToIco(png);
  assert.equal(isValidPng256(png),true);
  assert.equal(png.readUInt32BE(16),256);
  assert.equal(png.readUInt32BE(20),256);
  assert.equal(ico.readUInt16LE(2),1);
  assert.equal(ico.readUInt16LE(4),1);
  assert.equal(ico.readUInt32LE(14),png.length);
  assert.equal(ico.subarray(22).equals(png),true);
});

test('preparing a QA app writes a buildable config and brand image',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'warpvio-win-'));
  try{
    const prepared=projectConfiguration({
      url:'https://example.com/demo',
      name:'My Example App',
      accent:'mint',
      size:'compact'
    },dir);
    assert.equal(prepared.config.appName,'My Example App');
    assert.equal(prepared.config.websiteUrl,'https://example.com/demo');
    assert.deepEqual(prepared.config.windowSize,{width:960,height:700});
    assert.equal(prepared.config.accentColor,'#168f91');
    assert.equal(prepared.builderConfig.win.target[0].target,'nsis');
    assert.equal(prepared.builderConfig.productName,'My Example App');
    assert.equal(prepared.builderConfig.nsis.oneClick,false);
    const png=fs.readFileSync(path.join(dir,'assets','icon.png'));
    assert.ok(isValidPng256(png));
    const ico=fs.readFileSync(path.join(dir,'assets','icon.ico'));
    assert.equal(ico.readUInt16LE(2),1);
    const file=JSON.parse(fs.readFileSync(path.join(dir,'app','generated-config.json'),'utf8'));
    assert.equal(file.websiteUrl,'https://example.com/demo');
    const output=JSON.parse(fs.readFileSync(path.join(dir,'build-config.json'),'utf8'));
    assert.ok(output.files.includes('app/main.cjs'));
    assert.ok(output.files.includes('app/offline.html'));
    assert.ok(output.files.includes('app/generated-config.json'));
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('custom PNG file may be passed explicitly for QA builds',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'warpvio-win-icon-'));
  try{
    const iconFile=path.join(dir,'custom.png');
    fs.writeFileSync(iconFile,createPng('#825df5','S'));
    projectConfiguration({
      url:'https://example.com/',name:'Sample',accent:'blue',size:'standard',icon:iconFile
    },dir);
    assert.equal(fs.readFileSync(path.join(dir,'assets','icon.png')).equals(fs.readFileSync(iconFile)),true);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('CLI input rejects unknown flags and duplicates',()=>{
  assert.deepEqual(parseArgs(['--url','https://example.com/','--name','Sample']),{
    url:'https://example.com/',name:'Sample'
  });
  assert.throws(()=>parseArgs(['--unknown','value']));
  assert.throws(()=>parseArgs(['--url','a','--url','b']));
  assert.throws(()=>parseArgs(['--url']));
});

test('remote Electron shell has no privileged site integration',()=>{
  const shell=fs.readFileSync(path.join(__dirname,'..','app','main.cjs'),'utf8');
  assert.ok(shell.includes('nodeIntegration: false'));
  assert.ok(shell.includes('contextIsolation: true'));
  assert.ok(shell.includes('sandbox: true'));
  assert.ok(shell.includes('webSecurity: true'));
  assert.ok(shell.includes("setWindowOpenHandler(() => ({ action: 'deny' }))"));
  assert.ok(shell.includes('setPermissionRequestHandler'));
  assert.ok(shell.includes('setPermissionCheckHandler'));
  assert.equal(shell.includes('contextBridge.exposeInMainWorld'),false);
});
