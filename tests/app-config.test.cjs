'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function fixture(){
  const store=new Map();
  const sessionStorage={
    getItem:key=>store.has(key)?store.get(key):null,
    setItem:(key,value)=>store.set(key,String(value)),
    removeItem:key=>store.delete(key)
  };
  const window={};
  const source=fs.readFileSync(require.resolve('../app-config.js'),'utf8');
  vm.runInNewContext(source,{window,URL,sessionStorage,Object});
  const api=window.WarpvioConfig;
  const result={
    version:1,checks:[{id:'reachable',status:'passed'}],
    finalUrl:'https://example.com/',title:'My Sample App | Hello World',
    favicon:'https://example.com/icon.png',platforms:['Windows','Android','macOS']
  };
  sessionStorage.setItem('warpvio_v1_result',JSON.stringify(result));
  return {api,result,sessionStorage};
}

test('reads validated analysis and preserves selected export platforms',()=>{
  const {api}=fixture();
  assert.equal(api.result().finalUrl,'https://example.com/');
  assert.equal(Array.from(api.result().platforms).join(','),'Windows,Android,macOS');
});

test('generates a clean initial app name from the website title',()=>{
  const {api,result}=fixture();
  assert.equal(api.fresh(result).name,'My Sample App');
  assert.equal(api.fresh(result).accent,'blue');
  assert.equal(api.fresh(result).activePlatform,'Windows');
});

test('browser tab storage preserves customized brand settings',()=>{
  const {api,result}=fixture();
  const draft=api.fresh(result);
  draft.name='Example Studio';
  draft.accent='mint';
  draft.theme='dark';
  draft.androidOrientation='portrait';
  api.save(draft,result);
  const loaded=api.load(result);
  assert.equal(loaded.name,'Example Studio');
  assert.equal(loaded.accent,'mint');
  assert.equal(loaded.theme,'dark');
  assert.equal(loaded.androidOrientation,'portrait');
});

test('rejects unrecognized platform settings, colors and arbitrary icon URLs',()=>{
  const {api,result}=fixture();
  const loaded=api.normalize({
    version:1,site:result.finalUrl,
    name:'X'.repeat(150),accent:'unknown',theme:'invisible',
    activePlatform:'iOS',windowsSize:'giant',macSize:'invalid',
    androidOrientation:'landscape',iconData:'javascript:alert(1)'
  },result);
  assert.equal(loaded.name.length,36);
  assert.equal(loaded.accent,'blue');
  assert.equal(loaded.theme,'system');
  assert.equal(loaded.activePlatform,'Windows');
  assert.equal(loaded.iconData,null);
  assert.equal(loaded.windowsSize,'standard');
  assert.equal(loaded.androidOrientation,'auto');
});

test('resets customization if the scanned website changes',()=>{
  const {api,result,sessionStorage}=fixture();
  const draft=api.fresh(result);
  draft.name='First Website';
  api.save(draft,result);
  const changed={...result,finalUrl:'https://another-domain.com/',title:'Different'};
  sessionStorage.setItem('warpvio_v1_result',JSON.stringify(changed));
  assert.equal(api.load(api.result()).name,'Different');
});

test('one-time price estimates match selected packages',()=>{
  const {api}=fixture();
  assert.equal(api.price(['Windows']),15);
  assert.equal(api.price(['Android']),19);
  assert.equal(api.price(['macOS']),19);
  assert.equal(api.price(['Windows','Android']),34);
  assert.equal(api.price(['Windows','Android','macOS']),39);
});

test('malformed analysis data does not permit editing',()=>{
  const {api,sessionStorage}=fixture();
  sessionStorage.setItem('warpvio_v1_result',JSON.stringify({version:1,finalUrl:'file:///secret',checks:[],platforms:['Windows']}));
  assert.equal(api.result(),null);
});
