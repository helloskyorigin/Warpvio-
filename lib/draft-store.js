'use strict';

/* Upstash REST store for website-ownership challenge and an unpaid build draft.
 * This is NOT a payment ledger or production entitlement store.
 * The API uses Upstash HTTPS + bearer auth; never expose it in a browser.
 */
const {createHash,timingSafeEqual,randomBytes,randomUUID}=require('node:crypto');

const PREFIX='warpvio:v1:draft:';
const TTL_SECONDS=60*60*24;
class StoreError extends Error{
  constructor(message='Order storage temporarily unavailable.',status=503){
    super(message);this.status=status;this.code='STORE_UNAVAILABLE';
  }
}
function config(env=process.env){
  const root=env.UPSTASH_REDIS_REST_URL,token=env.UPSTASH_REDIS_REST_TOKEN;
  let u;
  try{u=new URL(root);}catch{}
  if(!u||u.protocol!=='https:'||u.username||u.password||u.search||u.hash||
     typeof token!=='string'||token.length<20)throw new StoreError();
  return {root:u.origin,token};
}
async function command(args,env=process.env,fetcher=globalThis.fetch){
  const c=config(env);
  const ac=new AbortController();
  const timer=setTimeout(()=>ac.abort(),6500);
  try{
    const r=await fetcher(c.root,{
      method:'POST',headers:{
        'Authorization':'Bearer '+c.token,
        'Content-Type':'application/json',
        'Accept':'application/json'
      },
      body:JSON.stringify(args),cache:'no-store',signal:ac.signal
    });
    if(!r.ok)throw new StoreError();
    const json=await r.json();
    if(json?.error)throw new StoreError();
    return json?.result;
  }catch(e){throw e instanceof StoreError?e:new StoreError()}
  finally{clearTimeout(timer)}
}
function fingerprint(token){return createHash('sha256').update(token).digest('hex')}
function equalSecret(a,b){
  if(typeof a!=='string'||typeof b!=='string'||a.length!==64||b.length!==64)return false;
  return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
function newCredentials(){
  const id=randomUUID();
  return {id,accessToken:randomBytes(32).toString('base64url'),challenge:'warpvio-verification='+randomBytes(18).toString('hex')};
}
function key(id){
  if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw Object.assign(new Error('Invalid order ID.'),{status:400,code:'INVALID_ORDER'});
  return PREFIX+id;
}
async function createDraft(order,env,fetcher){
  const saved=await command(['SET',key(order.id),JSON.stringify(order),'NX','EX',TTL_SECONDS],env,fetcher);
  if(saved!=='OK')throw new StoreError('Unable to save the draft. Try again.');
  return order;
}
async function loadDraft(id,env,fetcher){
  const value=await command(['GET',key(id)],env,fetcher);
  if(!value)return null;
  try{return JSON.parse(value)}catch{throw new StoreError()}
}
async function updateDraft(order,env,fetcher){
  // Drafts only: this is not a concurrency-safe payment state machine.
  await command(['SET',key(order.id),JSON.stringify(order),'XX','KEEPTTL'],env,fetcher);
  return order;
}
async function checkLimit(identity,limit=8,period=3600,env,fetcher){
  const id=fingerprint(identity).slice(0,24);
  const limiter='warpvio:v1:limit:'+id;
  const count=Number(await command(['INCR',limiter],env,fetcher));
  if(count===1)await command(['EXPIRE',limiter,period],env,fetcher);
  return count<=limit;
}
module.exports={
  TTL_SECONDS,StoreError,config,command,fingerprint,equalSecret,newCredentials,key,
  createDraft,loadDraft,updateDraft,checkLimit
};
