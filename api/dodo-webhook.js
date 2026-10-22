'use strict';
const { verifySignature, receiveRawBody } = require('../lib/dodo-webhook');

// Vercel's default JSON parser changes the signed body. Disable it here.
async function webhookHandler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({ok:false,error:'POST required.'});
  }

  // Test webhooks only. Live orders require a persistent store, idempotency,
  // fulfillment and refund/revocation support that will be added with exporters.
  if(process.env.DODO_PAYMENTS_ENVIRONMENT!=='test_mode'){
    return res.status(503).json({ok:false,error:'Live payment fulfillment is unavailable.'});
  }
  if(!process.env.DODO_PAYMENTS_WEBHOOK_KEY){
    return res.status(503).json({ok:false,error:'Webhook secret is not configured.'});
  }

  let raw;
  try{
    raw=await receiveRawBody(req);
  }catch{
    return res.status(413).json({ok:false,error:'Invalid webhook body.'});
  }

  try{
    const verified=verifySignature(raw,req.headers,process.env.DODO_PAYMENTS_WEBHOOK_KEY);
    const event=JSON.parse(raw.toString('utf8'));
    if(!event||typeof event.type!=='string'||typeof event.data!=='object'){
      return res.status(400).json({ok:false,error:'Unexpected webhook payload.'});
    }
    // No real entitlement is granted here. This endpoint can be used for
    // signature/transport testing only, before production builds exist.
    // Never infer payment state from the browser return URL.
    return res.status(200).json({
      ok:true,received:true,testOnly:true,
      webhookId:verified.webhookId,
      // This intentionally does not expose customer or payment data.
      entitlementGranted:false
    });
  }catch{
    return res.status(401).json({ok:false,error:'Webhook signature verification failed.'});
  }
}

// Retain this property on the exported function so Vercel skips JSON parsing.
webhookHandler.config={api:{bodyParser:false}};
module.exports=webhookHandler;
