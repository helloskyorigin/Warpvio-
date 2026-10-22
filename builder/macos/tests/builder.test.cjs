'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {parseArgs,prepareApp}=require('../scripts/prepare.cjs');
const {SIZES}=require('../scripts/make-icns.cjs');
const {isValidPng256}=require('../../windows/scripts/icon.cjs');

test('macOS builder generates a real, validated, sandboxed Electron app manifest',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'warpvio-mac-test-'));
  try{
    const result=prepareApp({url:'https://example.com/launch',name:'Demo Desktop',accent:'rose',size:'compact'},dir);
    assert.equal(result.config.websiteUrl,'https://example.com/launch');
    assert.equal(result.config.appName,'Demo Desktop');
    assert.deepEqual(result.config.windowSize,{width:960,height:700});
    assert.equal(result.manifest.mac.icon,'assets/icon.icns');
    assert.equal(result.manifest.mac.identity,null);
    assert.equal(result.manifest.mac.hardenedRuntime,false);
    assert.equal(result.manifest.mac.target[0],'dmg');
    assert.equal(result.manifest.dmg.sign,false);
    assert.ok(result.manifest.artifactName.includes('QA'));
    const img=fs.readFileSync(path.join(dir,'assets','icon.png'));
    assert.equal(isValidPng256(img),true);
    const main=fs.readFileSync(path.join(dir,'app','main.cjs'),'utf8');
    assert.ok(main.includes('nodeIntegration: false'));
    assert.ok(main.includes('contextIsolation: true'));
    assert.ok(main.includes('sandbox: true'));
    assert.ok(main.includes('webSecurity: true'));
    assert.ok(main.includes("setWindowOpenHandler(() => ({ action: 'deny' }))"));
    assert.ok(fs.readFileSync(path.join(dir,'app','offline.html'),'utf8').includes('</html>'));
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('builder disallows local URLs and malformed application names',()=>{
  assert.throws(()=>prepareApp({url:'http://example.com/',name:'Test App'}));
  assert.throws(()=>prepareApp({url:'https://127.0.0.1/',name:'Test App'}));
  assert.throws(()=>prepareApp({url:'https://example.com/',name:'A'}));
  assert.deepEqual(parseArgs(['--url','https://example.com/','--name','Test App']),{url:'https://example.com/',name:'Test App'});
  assert.throws(()=>parseArgs(['--url']));
  assert.throws(()=>parseArgs(['--unknown','value']));
});

test('ICNS conversion references Retina image variants for both Apple Silicon and Intel',()=>{
  assert.equal(SIZES.length,10);
  assert.ok(SIZES.some(s=>s[0]==='icon_512x512@2x.png'&&s[1]===1024));
  assert.ok(SIZES.some(s=>s[0]==='icon_16x16@2x.png'&&s[1]===32));
});
