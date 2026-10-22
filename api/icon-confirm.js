'use strict';
const {authorized,publicDraft}=require('../lib/draft-auth');
const {updateDraft}=require('../lib/draft-store');
const {iconMetadata,iconKey}=require('../lib/private-artifacts');
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'POST required.'})}
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body.id!=='string'||Object.keys(body).some(k=>k!=='id'))
      return res.status(400).json({ok:false,error:'Invalid confirmation request.'});
    const draft=await authorized(req,body.id);
    if(!draft)return res.status(404).json({ok:false,error:'Private project access denied.'});
    if(!draft.verifiedAt||!draft.customIconNotTransferred)
      return res.status(403).json({ok:false,error:'Icon upload is not pending.'});
    const obj=await iconMetadata(draft.id);
    if(typeof obj.ContentLength!=='number'||obj.ContentLength<100||obj.ContentLength>1_200_000||obj.ContentLength!==draft.iconBytesExpected||
      !/^image\/png(?:$|;)/i.test(obj.ContentType||'')){
      return res.status(422).json({ok:false,error:'Stored icon is not an acceptable PNG (1.2 MB maximum).'});
    }
    // HEAD verifies size and content type, not PNG decoding or malware.
    // The future private builder must re-parse and validate the file.
    draft.iconObjectKey=iconKey(draft.id);
    draft.iconSizeBytes=obj.ContentLength;
    delete draft.iconBytesExpected;
    draft.customIconNotTransferred=false;
    draft.updatedAt=new Date().toISOString();
    await updateDraft(draft);
    return res.status(200).json({ok:true,draft:publicDraft(draft)});
  }catch{
    return res.status(503).json({ok:false,error:'Icon confirmation is currently unavailable.'});
  }
};
