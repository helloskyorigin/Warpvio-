'use strict';
const dns=require('node:dns').promises;
const {authorized,publicDraft}=require('../lib/draft-auth');
const {updateDraft,checkLimit}=require('../lib/draft-store');

async function matches(host,expected,resolver=dns){
  let records;
  try{
    records=await Promise.race([
      resolver.resolveTxt(host),
      new Promise((_,reject)=>setTimeout(()=>reject(Error('DNS_TIMEOUT')),6000))
    ]);
  }catch{return false;}
  if(!Array.isArray(records))return false;
  return records.some(parts=>Array.isArray(parts)&&parts.join('')===expected);
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'POST required.'})}
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body.id!=='string'||Object.keys(body).some(k=>k!=='id'))
      return res.status(400).json({ok:false,error:'Invalid verification request.'});
    const draft=await authorized(req,body.id);
    if(!draft)return res.status(404).json({ok:false,error:'Project not found, expired or inaccessible.'});
    if(draft.verifiedAt)return res.status(200).json({ok:true,verified:true,draft:publicDraft(draft)});
    if(!await checkLimit('verify:'+draft.id,10,3600))
      return res.status(429).json({ok:false,error:'Too many DNS checks; try again later.'});
    const found=await matches(draft.verificationHost,draft.ownershipChallenge);
    if(!found)return res.status(202).json({ok:true,verified:false,message:'TXT record not found yet. DNS may take time to propagate.'});
    draft.verifiedAt=new Date().toISOString();
    draft.status='domain_verified_unpaid';
    draft.updatedAt=draft.verifiedAt;
    await updateDraft(draft);
    return res.status(200).json({ok:true,verified:true,draft:publicDraft(draft)});
  }catch{
    return res.status(503).json({ok:false,error:'Unable to check domain ownership right now.'});
  }
};
module.exports.matches=matches;
