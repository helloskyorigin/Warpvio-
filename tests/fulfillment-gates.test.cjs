'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildPlan,canDispatch,workerConfig}=require('../lib/build-queue');
const {bucketConfig,artifactKey,iconKey}=require('../lib/private-artifacts');
const download=require('../api/download');
const iconUpload=require('../api/icon-upload');
const fs=require('node:fs');
const path=require('node:path');

function sample(){
  return {
    version:1,id:'123e4567-e89b-42d3-a456-426614174000',
    site:'https://example.com/',name:'Example App',
    platforms:['Windows','Android','macOS'],
    quote:{totalUSD:39},accent:'blue',
    windowsSize:'standard',macSize:'compact',androidOrientation:'auto',
    verifiedAt:null,status:'pending_domain_verification',
    paymentState:'not_started',customIconNotTransferred:false,
    exports:[]
  };
}
function res(){
  return {statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}};
}
test('platform build plans are deterministic and never imply paid release',()=>{
  const p=buildPlan(sample());
  assert.deepEqual(p.map(x=>x.file),['windows-qa.yml','android-qa.yml','macos-qa.yml']);
  assert.equal(p[0].inputs.window_size,'standard');
  assert.equal(p[1].inputs.orientation,'auto');
  assert.equal(p[2].inputs.window_size,'compact');
  assert.ok(p.every(x=>x.qaOnly===true));
});

test('worker dispatch requires every exact order and payment claim',()=>{
  const draft=sample();
  assert.equal(canDispatch(draft),false);
  draft.verifiedAt='2026-10-22T10:00:00Z';
  draft.status='paid_verified';
  draft.paymentState='paid_verified';
  draft.paymentId='pay_abc';
  draft.amountVerifiedCents=3900;
  draft.currency='USD';
  assert.equal(canDispatch(draft),true);
  draft.amountVerifiedCents=3899;
  assert.equal(canDispatch(draft),false);
});

test('a private repository, not the public Warpvio repo, is required for paid worker',()=>{
  assert.throws(()=>workerConfig({
    WARPVIO_PRIVATE_WORKER_REPO:'helloskyorigin/Warpvio',
    WARPVIO_WORKER_GITHUB_TOKEN:'abcdefghijklmnopqrstuvwxyz123456'
  }));
  assert.deepEqual(workerConfig({
    WARPVIO_PRIVATE_WORKER_REPO:'team/private-workers',
    WARPVIO_WORKER_GITHUB_TOKEN:'abcdefghijklmnopqrstuvwxyz123456'
  }).repo,'team/private-workers');
});

test('R2 private keys enforce exact per-order object paths',()=>{
  const id=sample().id;
  assert.equal(artifactKey(id,'Windows'),'exports/'+id+'/windows/app.exe');
  assert.equal(artifactKey(id,'Android'),'exports/'+id+'/android/app.apk');
  assert.equal(artifactKey(id,'macOS'),'exports/'+id+'/macos/app.dmg');
  assert.equal(iconKey(id),'icons/'+id+'/source.png');
  for(const p of ['Linux','../secret','iOS'])assert.throws(()=>artifactKey(id,p));
  assert.throws(()=>bucketConfig({
    R2_ACCOUNT_ID:'bad',
    R2_ACCESS_KEY_ID:'key',
    R2_SECRET_ACCESS_KEY:'secret',R2_BUCKET:'public'
  }));
});

test('no bearer cannot obtain download or icon upload',async()=>{
  const id=sample().id;
  const a=res();
  await download({method:'GET',url:'/api/download?id='+id+'&platform=Windows',headers:{}},a);
  assert.equal(a.statusCode,404);
  const b=res();
  await iconUpload({method:'POST',body:{id,bytes:1024},headers:{}},b);
  assert.equal(b.statusCode,404);
});

test('API design never returns a public artifact listing or disables payment guard',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','api','download.js'),'utf8');
  const gate=fs.readFileSync(path.join(__dirname,'..','api','checkout.js'),'utf8');
  assert.ok(source.includes("order.paymentState!=='paid_verified'"));
  assert.ok(source.includes("order.status!=='fulfilled'"));
  assert.ok(source.includes("signedDownload(expected,filename)"));
  assert.ok(gate.includes('EXPORTS_NOT_READY'));
  const html=fs.readFileSync(path.join(__dirname,'..','checkout.html'),'utf8');
  assert.match(html,/disabled aria-disabled="true"/);
});
