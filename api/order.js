'use strict';
const {quote}=require('../lib/commerce');
const {validateWebsiteUrl,validateAppName,validateAccent,validateSize}=require('../builder/windows/app/security.cjs');
const {newCredentials,fingerprint,createDraft,checkLimit,StoreError,TTL_SECONDS}=require('../lib/draft-store');

const ACCENTS=['blue','violet','mint','rose'];
function ipOf(req){
  // Header is not itself a security boundary. Add a deployment WAF before
  // enabling large public traffic; this reduces accidental overload only.
  return String(req.headers?.['x-real-ip']||req.socket?.remoteAddress||'unknown').slice(0,120);
}
function validate(body) {
  if(!body||typeof body!=='object'||Array.isArray(body))throw Object.assign(new Error('Invalid project.'),{status:400});
  const allowed=['site','name','platforms','accent','theme','windowsSize','macSize','androidOrientation','customIcon'];
  if(Object.keys(body).some(k=>!allowed.includes(k)))throw Object.assign(new Error('Unexpected project fields.'),{status:400});
  const site=validateWebsiteUrl(body.site);
  const name=validateAppName(body.name);
  const q=quote(body.platforms);
  if(q.platforms.includes('Android')&&!/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(name)){
    throw Object.assign(new Error('Android app names must use ASCII letters, numbers, spaces, dots, hyphens or underscores.'),{status:400});
  }
  const accent=body.accent||'blue';
  validateAccent(accent);
  const theme=['light','dark','system'].includes(body.theme)?body.theme:'system';
  const windowsSize=body.windowsSize||'standard',macSize=body.macSize||'standard';
  validateSize(windowsSize);validateSize(macSize);
  const androidOrientation=body.androidOrientation||'auto';
  if(!['auto','portrait'].includes(androidOrientation))throw Object.assign(new Error('Invalid Android orientation.'),{status:400});
  if(typeof body.customIcon!=='boolean')throw Object.assign(new Error('Icon flag must be boolean.'),{status:400});
  return {site,name,platforms:q.platforms,quote:q,accent,theme,windowsSize,macSize,androidOrientation,customIcon:body.customIcon};
}
async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({ok:false,error:'POST required.'});
  }
  try{
    const data=validate(typeof req.body==='string'?JSON.parse(req.body):req.body);
    if(!await checkLimit('order:'+ipOf(req),6,3600))return res.status(429).json({ok:false,error:'Too many saved projects. Try again later.'});
    const {id,accessToken,challenge}=newCredentials();
    const now=new Date().toISOString();
    const order={
      version:1,id,accessHash:fingerprint(accessToken),
      ownershipChallenge:challenge,
      verificationHost:'_warpvio.'+new URL(data.site).hostname,
      status:'pending_domain_verification',
      createdAt:now,updatedAt:now,verifiedAt:null,
      site:data.site,name:data.name,
      platforms:data.platforms,
      quote:data.quote,accent:data.accent,theme:data.theme,
      windowsSize:data.windowsSize,macSize:data.macSize,
      androidOrientation:data.androidOrientation,
      customIconNotTransferred:data.customIcon,
      paymentState:'not_started',exports:[]
    };
    await createDraft(order);
    return res.status(201).json({
      ok:true,id,accessToken,
      status:order.status,
      verification:{type:'TXT',host:order.verificationHost,value:challenge},
      expiresInSeconds:TTL_SECONDS,
      note:'Unpaid draft only. No checkout, builds or export entitlement.'
    });
  }catch(e){
    const status=e.status|| (e instanceof StoreError?503:400);
    return res.status(status).json({ok:false,error:status>=500?'Project storage is unavailable. Try again later.':e.message});
  }
}
module.exports=handler;
module.exports.validate=validate;
