'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {
  quote,normalizePlatforms,normalizeEmail,productCart,
  testCheckoutAllowed,createSandboxCheckout
}=require('../lib/commerce');
const { verifySignature }=require('../lib/dodo-webhook');

test('prices are derived from server plan, never from client amount',()=>{
  assert.equal(quote(['Windows']).totalUSD,15);
  assert.equal(quote(['Android']).totalUSD,19);
  assert.equal(quote(['Windows','Android']).totalUSD,34);
  assert.equal(quote(['Windows','macOS']).totalUSD,34);
  assert.equal(quote(['Android','macOS']).totalUSD,38);
  assert.equal(quote(['Windows','Android','macOS']).totalUSD,39);
  assert.equal(quote(['macOS','Android','Windows']).items.length,1);
  assert.equal(quote(['Windows']).oneTime,true);
  assert.equal(quote(['Windows']).readyToBuy,false);
});

test('invalid platform sets are rejected',()=>{
  for(const value of [[],['iOS'],['Windows','Windows'],['macOS','Linux'],null,'Windows']){
    assert.throws(()=>normalizePlatforms(value),{code:'INVALID_PLATFORMS'});
  }
});

test('email is trimmed and validated',()=>{
  assert.equal(normalizeEmail('  Test+Demo@Example.COM  '),'test+demo@example.com');
  for(const email of ['','broken','bad@no-domain','a@\r\nexample.com',null]){
    assert.throws(()=>normalizeEmail(email),{code:'INVALID_EMAIL'});
  }
});

test('live credentials alone cannot turn checkout on',()=>{
  const live={DODO_PAYMENTS_ENVIRONMENT:'live_mode',
    WARPVIO_TEST_CHECKOUT_ENABLED:'true',DODO_PAYMENTS_API_KEY:'live-secret-value'};
  assert.equal(testCheckoutAllowed(live),false);
  assert.equal(testCheckoutAllowed({
    ...live,DODO_PAYMENTS_ENVIRONMENT:'test_mode',
    WARPVIO_TEST_CHECKOUT_ENABLED:'false'
  }),false);
});

test('sandbox cart maps to allowlisted Dodo product IDs',()=>{
  const env={
    DODO_PRODUCT_WINDOWS:'pdt_win',
    DODO_PRODUCT_ANDROID:'pdt_android',
    DODO_PRODUCT_MACOS:'pdt_mac',
    DODO_PRODUCT_BUNDLE:'pdt_bundle'
  };
  assert.deepEqual(productCart(['Windows','Android'],env),[
    {product_id:'pdt_win',quantity:1},{product_id:'pdt_android',quantity:1}
  ]);
  assert.deepEqual(productCart(['Windows','Android','macOS'],env),[
    {product_id:'pdt_bundle',quantity:1}
  ]);
});

test('test-mode checkout calls Dodo sessions API without trusting client price',async()=>{
  const env={
    DODO_PAYMENTS_ENVIRONMENT:'test_mode',
    WARPVIO_TEST_CHECKOUT_ENABLED:'true',
    DODO_PAYMENTS_API_KEY:'test-secret-long-enough',
    WARPVIO_PUBLIC_ORIGIN:'https://warpvio.example',
    DODO_PRODUCT_WINDOWS:'pdt_windows',
    DODO_PRODUCT_ANDROID:'pdt_android',
    DODO_PRODUCT_MACOS:'pdt_mac',
    DODO_PRODUCT_BUNDLE:'pdt_bundle'
  };
  let called=false;
  const fetchImpl=async(url,options)=>{
    called=true;
    assert.equal(url,'https://test.dodopayments.com/checkouts');
    assert.equal(options.method,'POST');
    assert.equal(options.headers.Authorization,'Bearer test-secret-long-enough');
    const sent=JSON.parse(options.body);
    assert.deepEqual(sent.product_cart,[{product_id:'pdt_windows',quantity:1}]);
    assert.equal(sent.customer.email,'test@example.com');
    assert.equal(sent.return_url,'https://warpvio.example/payment-return.html');
    assert.equal(sent.metadata.warpvio_stage,'sandbox_checkout_no_entitlement');
    return {ok:true,json:async()=>({
      checkout_url:'https://checkout.dodopayments.com/session/test'
    })};
  };
  const result=await createSandboxCheckout({
    platforms:['Windows'],
    email:'Test@example.com',
    env,fetchImpl
  });
  assert.equal(called,true);
  assert.equal(result.testMode,true);
  assert.equal(result.quote.totalUSD,15);
});

test('unconfigured sandbox refuses before provider request',async()=>{
  await assert.rejects(createSandboxCheckout({
    platforms:['Android'],
    email:'one@example.com',
    env:{DODO_PAYMENTS_ENVIRONMENT:'live_mode',DODO_PAYMENTS_API_KEY:'live-long-secret',
      WARPVIO_TEST_CHECKOUT_ENABLED:'true'},
    fetchImpl:async()=>{throw Error('should not call Dodo');}
  }),{code:'EXPORTS_NOT_READY'});
});

test('Dodo webhook verifier requires exact signed raw bytes',()=>{
  const secret='whsec_'+Buffer.from('sample-signing-key-should-be-long').toString('base64');
  const body=Buffer.from(JSON.stringify({type:'payment.succeeded',data:{payment_id:'pay_test'}}));
  const time=1700000000;
  const id='evt_test1234';
  const signature=crypto.createHmac('sha256',Buffer.from(secret.slice(6),'base64'))
    .update(Buffer.concat([Buffer.from(id+'.'+time+'.'),body])).digest('base64');
  const headers={'webhook-id':id,'webhook-timestamp':String(time),
    'webhook-signature':'v1,'+signature};
  const actual=verifySignature(body,headers,secret,time*1000);
  assert.equal(actual.webhookId,id);
  assert.throws(()=>verifySignature(Buffer.from(body.toString()+' '),headers,secret,time*1000));
  assert.throws(()=>verifySignature(body,headers,secret,(time+400)*1000));
  assert.throws(()=>verifySignature(body,{...headers,'webhook-signature':'v1,wrong'},secret,time*1000));
});
