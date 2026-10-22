'use strict';
const {authorized,publicDraft}=require('../lib/draft-auth');
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'GET required.'})}
  const id=new URL(req.url||'/', 'https://warpvio.example').searchParams.get('id');
  try{
    const draft=await authorized(req,id);
    if(!draft)return res.status(404).json({ok:false,error:'Project not found, expired or inaccessible.'});
    return res.status(200).json({ok:true,draft:publicDraft(draft)});
  }catch{
    return res.status(503).json({ok:false,error:'Project status is temporarily unavailable.'});
  }
};
