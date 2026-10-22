'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const checkout=require('../api/checkout');
const webhook=require('../api/dodo-webhook');

function response(){
  return {
    statusCode:200,headers:{},body:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(v){this.statusCode=v;return this;},
    json(v){this.body=v;return this;}
  };
}
async function envTest(changes,run){
  const keys=Object.keys(changes);
  const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  for(const [key,value] of Object.entries(changes)){
    if(value===null)delete process.env[key];
    else process.env[key]=value;
  }
  try{await run();}
  finally{
    for(const key of keys){
      if(before[key]===undefined)delete process.env[key];
      else process.env[key]=before[key];
    }
  }
}

test('GET checkout returns quote schedule with disabled buy state',async()=>{
  const res=response();
  await checkout({method:'GET',headers:{}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.ok,true);
  assert.equal(res.body.readyToBuy,false);
  assert.equal(res.body.pricing.Windows,15);
  assert.equal(res.body.pricing.Android,19);
  assert.equal(res.body.pricing.macOS,19);
  assert.equal(res.body.pricing.allThree,39);
  assert.equal(res.body.exportsFree,false);
});

test('POST cannot charge in live mode even if test enable flag was set',async()=>{
  await envTest({
    DODO_PAYMENTS_ENVIRONMENT:'live_mode',
    WARPVIO_TEST_CHECKOUT_ENABLED:'true',
    DODO_PAYMENTS_API_KEY:'live-credential-example',
    WARPVIO_TEST_CHECKOUT_TOKEN:'very-long-private-qa-token'
  },async()=>{
    const res=response();
    await checkout({
      method:'POST',
      headers:{'x-warpvio-qa-token':'very-long-private-qa-token'},
      body:{platforms:['Windows'],email:'test@example.com'}
    },res);
    assert.equal(res.statusCode,503);
    assert.equal(res.body.code,'EXPORTS_NOT_READY');
  });
});

test('POST cannot charge when sandbox environment is unconfigured',async()=>{
  await envTest({
    DODO_PAYMENTS_ENVIRONMENT:'test_mode',
    WARPVIO_TEST_CHECKOUT_ENABLED:'false',
    DODO_PAYMENTS_API_KEY:null,
    WARPVIO_TEST_CHECKOUT_TOKEN:null
  },async()=>{
    const res=response();
    await checkout({method:'POST',headers:{},
      body:{platforms:['Android'],email:'test@example.com'}},res);
    assert.equal(res.statusCode,503);
  });
});

test('webhook keeps raw-body parser disabled for signed payload verification',()=>{
  assert.deepEqual(webhook.config,{api:{bodyParser:false}});
});

test('live webhook cannot grant entitlements',async()=>{
  await envTest({DODO_PAYMENTS_ENVIRONMENT:'live_mode'},async()=>{
    const res=response();
    await webhook({method:'POST',headers:{}},res);
    assert.equal(res.statusCode,503);
    assert.equal(res.body.ok,false);
  });
});
