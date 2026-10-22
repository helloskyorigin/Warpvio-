'use strict';
const { createHmac, timingSafeEqual } = require('node:crypto');

class WebhookError extends Error {
  constructor(message){super(message);this.name='WebhookError';}
}
function signingKey(secret) {
  if (typeof secret !== 'string' || !secret.startsWith('whsec_')) {
    throw new WebhookError('Missing or invalid webhook secret.');
  }
  const encoded=secret.slice(6);
  if (!encoded || !/^[a-zA-Z0-9+/_=-]+$/.test(encoded)) {
    throw new WebhookError('Invalid webhook signing secret.');
  }
  const key=Buffer.from(encoded.replace(/-/g,'+').replace(/_/g,'/'),'base64');
  if(key.length<16)throw new WebhookError('Webhook signing key too short.');
  return key;
}
function verifySignature(raw, headers, secret, clock=Date.now()) {
  if (!Buffer.isBuffer(raw) || raw.length===0 || raw.length>65536) {
    throw new WebhookError('Invalid webhook payload size.');
  }
  const id=headers['webhook-id'];
  const timestamp=headers['webhook-timestamp'];
  const provided=headers['webhook-signature'];
  if (typeof id !== 'string' || id.length<4 || id.length>256 ||
      typeof timestamp !== 'string' || !/^\d{10,13}$/.test(timestamp) ||
      typeof provided !== 'string' || provided.length>2000) {
    throw new WebhookError('Missing webhook signature headers.');
  }
  const eventMs=Number(timestamp)*1000;
  if (!Number.isFinite(eventMs) || Math.abs(clock-eventMs)>5*60*1000) {
    throw new WebhookError('Expired or future webhook timestamp.');
  }
  const signed=Buffer.concat([
    Buffer.from(id+'.'+timestamp+'.','utf8'),
    raw
  ]);
  const expected=createHmac('sha256',signingKey(secret)).update(signed).digest();
  let matched=false;
  for(const item of provided.trim().split(/\s+/)){
    if(!item.startsWith('v1,'))continue;
    const signature=item.slice(3);
    if(!/^[a-zA-Z0-9+/]+={0,2}$/.test(signature))continue;
    const supplied=Buffer.from(signature,'base64');
    if(supplied.length===expected.length && timingSafeEqual(supplied,expected))matched=true;
  }
  if(!matched)throw new WebhookError('Invalid webhook signature.');
  return { webhookId:id, timestamp:Number(timestamp) };
}
async function receiveRawBody(req,maxBytes=65536) {
  let length=0;
  const parts=[];
  for await(const part of req){
    const bytes=Buffer.isBuffer(part)?part:Buffer.from(part);
    length+=bytes.length;
    if(length>maxBytes)throw new WebhookError('Webhook body too large.');
    parts.push(bytes);
  }
  return Buffer.concat(parts);
}
module.exports={WebhookError,signingKey,verifySignature,receiveRawBody};
