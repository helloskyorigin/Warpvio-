'use strict';
const {loadDraft,fingerprint,equalSecret}=require('./draft-store');
function tokenFrom(req){
  const header=req.headers?.authorization||'';
  const value=typeof header==='string'&&header.startsWith('Bearer ')?header.slice(7):'';
  return /^[a-zA-Z0-9_-]{43}$/.test(value)?value:null;
}
async function authorized(req,id){
  const token=tokenFrom(req);
  if(!token)return null;
  const draft=await loadDraft(id);
  if(!draft||!equalSecret(fingerprint(token),draft.accessHash))return null;
  return draft;
}
function publicDraft(o){
  return {
    id:o.id,status:o.status,createdAt:o.createdAt,updatedAt:o.updatedAt,
    site:o.site,name:o.name,platforms:o.platforms,quote:o.quote,
    accent:o.accent,theme:o.theme,windowsSize:o.windowsSize,
    macSize:o.macSize,androidOrientation:o.androidOrientation,
    customIconNotTransferred:o.customIconNotTransferred,
    verification:o.verifiedAt?{verified:true,verifiedAt:o.verifiedAt}:
      {verified:false,type:'TXT',host:o.verificationHost,value:o.ownershipChallenge},
    paymentState:o.paymentState,
    exports:[] // This milestone never grants download rights.
  };
}
module.exports={tokenFrom,authorized,publicDraft};
