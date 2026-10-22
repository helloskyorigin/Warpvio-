'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validate}=require('../api/order');
const store=require('../lib/draft-store');
const {matches}=require('../api/verify-domain');
const fs=require('node:fs');
const path=require('node:path');

const example={
  site:'https://example.com/',
  name:'Example App',
  platforms:['Windows','macOS'],
  accent:'blue',theme:'system',windowsSize:'compact',
  macSize:'standard',androidOrientation:'auto',customIcon:false
};

test('server rejects client-provided pricing, products and unsupported sites',()=>{
  const v=validate(example);
  assert.equal(v.quote.totalUSD,34);
  assert.equal(v.quote.readyToBuy,false);
  assert.deepEqual(v.platforms,['Windows','macOS']);
  assert.throws(()=>validate({...example,price:0}));
  assert.throws(()=>validate({...example,site:'http://localhost'}));
  assert.throws(()=>validate({...example,site:'http://example.com'}));
  assert.throws(()=>validate({...example,platforms:['Android','Android']}));
  assert.throws(()=>validate({...example,windowsSize:'giant'}));
  assert.throws(()=>validate({...example,customIcon:'notbool'}));
});

test('separate domain challenge is unpredictable, never equivalent to a payment entitlement',()=>{
  const a=store.newCredentials(),b=store.newCredentials();
  assert.notEqual(a.id,b.id);
  assert.notEqual(a.accessToken,b.accessToken);
  assert.match(a.challenge,/^warpvio-verification=[0-9a-f]{36}$/);
  assert.equal(a.accessToken.length,43);
  assert.equal(store.equalSecret(store.fingerprint(a.accessToken),store.fingerprint(a.accessToken)),true);
  assert.equal(store.equalSecret(store.fingerprint(a.accessToken),store.fingerprint(b.accessToken)),false);
});

test('DNS verification requires exact TXT record; chunked TXT record supported',async()=>{
  const secret='warpvio-verification=abc';
  assert.equal(await matches('_warpvio.example.com',secret,{
    resolveTxt:async()=>[['warpvio-','verification=abc'],['other']]
  }),true);
  assert.equal(await matches('_warpvio.example.com',secret,{
    resolveTxt:async()=>[['warpvio-verification=wrong']]
  }),false);
  assert.equal(await matches('_warpvio.example.com',secret,{
    resolveTxt:async()=>{throw Error('ENODATA')}
  }),false);
});

test('Upstash client uses HTTPS authenticated JSON Redis commands',async()=>{
  const actions=[];
  const fake=async(url,opts)=>{
    assert.equal(url,'https://unit-test.upstash.io');
    assert.equal(opts.method,'POST');
    assert.equal(opts.headers.Authorization,'Bearer example-test-token-012345678901234567');
    const command=JSON.parse(opts.body);
    actions.push(command);
    if(command[0]==='GET')return {ok:true,json:async()=>({result:null})};
    if(command[0]==='SET')return {ok:true,json:async()=>({result:'OK'})};
    return {ok:true,json:async()=>({result:1})};
  };
  const env={
    UPSTASH_REDIS_REST_URL:'https://unit-test.upstash.io',
    UPSTASH_REDIS_REST_TOKEN:'example-test-token-012345678901234567'
  };
  const o=store.newCredentials();
  await store.createDraft({id:o.id},env,fake);
  const loaded=await store.loadDraft(o.id,env,fake);
  assert.equal(loaded,null);
  assert.equal(actions[0][0],'SET');
  assert.deepEqual(actions[0].slice(-3),['NX','EX',86400]);
  assert.equal(actions[1][0],'GET');
  assert.throws(()=>store.config({
    UPSTASH_REDIS_REST_URL:'http://localhost:3000',
    UPSTASH_REDIS_REST_TOKEN:env.UPSTASH_REDIS_REST_TOKEN
  }));
});

test('frontend project page never enables payments or downloads',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','project.html'),'utf8');
  const js=fs.readFileSync(path.join(__dirname,'..','project.js'),'utf8');
  assert.match(html,/domain ownership/i);
  assert.match(html,/no live checkout/i);
  assert.match(js,/warpvio_v1_draft_secret/);
  assert.match(js,/sessionStorage/);
  assert.equal(js.includes('payment.succeeded'),false);
});
