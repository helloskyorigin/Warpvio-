'use strict';
const {authorized}=require('../lib/draft-auth');
const {artifactKey,signedDownload}=require('../lib/private-artifacts');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'GET required.'})}
  const u=new URL(req.url||'/', 'https://warpvio.example');
  const id=u.searchParams.get('id'),platform=u.searchParams.get('platform');
  try{
    const order=await authorized(req,id);
    if(!order)return res.status(404).json({ok:false,error:'Order not found or access denied.'});
    if(!order.verifiedAt||order.paymentState!=='paid_verified'||
      order.status!=='fulfilled'||!order.currency||order.currency!=='USD'||
      !order.paymentId||!order.amountVerifiedCents||
      order.amountVerifiedCents!==order.quote.totalUSD*100||
      order.revokedAt||order.refundedAt){
      return res.status(403).json({ok:false,error:'A verified completed paid order is required for downloads.'});
    }
    const expected=artifactKey(id,platform);
    const e=Array.isArray(order.exports)?
      order.exports.find(item=>item.platform===platform&&item.status==='ready'&&item.objectKey===expected):null;
    if(!e||!e.sha256||!/^[a-f0-9]{64}$/i.test(e.sha256))
      return res.status(404).json({ok:false,error:'This export is not available.'});
    if(!Number.isFinite(e.sizeBytes)||e.sizeBytes<1_000_000)
      return res.status(404).json({ok:false,error:'Export has not passed artifact verification.'});
    const filename=(order.name||'Warpvio-App')+'-'+platform+'.'+expected.split('.').pop();
    const url=await signedDownload(expected,filename);
    return res.status(200).json({ok:true,url,expiresInSeconds:120,platform});
  }catch{
    return res.status(503).json({ok:false,error:'Download service is currently unavailable.'});
  }
};
