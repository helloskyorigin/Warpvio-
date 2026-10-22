'use strict';
const { timingSafeEqual } = require('node:crypto');
const { quote, createSandboxCheckout, testCheckoutAllowed } = require('../lib/commerce');

// IMPORTANT: This endpoint cannot create live checkout sessions.
// Native builders and durable fulfillment do not exist yet.
// Sandbox testing requires an additional private QA token.
function errorResponse(res, status, code, message) {
  return res.status(status).json({ ok: false, code, error: message });
}
function equalPrivateToken(provided, expected) {
  if (!provided || !expected || typeof provided !== 'string' ||
      typeof expected !== 'string' || expected.length < 20) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
module.exports = async function checkoutHandler(req, res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      readyToBuy: false,
      reason: 'Native app builders and paid delivery are not connected yet.',
      pricing: {
        Windows: 15,
        Android: 19,
        macOS: 19,
        allThree: 39,
        currency: 'USD',
        billing: 'one_time'
      },
      exportsFree: false
    });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow','GET, POST');
    return errorResponse(res,405,'METHOD_NOT_ALLOWED','Use GET or POST.');
  }
  const env = process.env;
  const token = req.headers?.['x-warpvio-qa-token'];
  if (!testCheckoutAllowed(env) || !equalPrivateToken(token,env.WARPVIO_TEST_CHECKOUT_TOKEN)) {
    return errorResponse(res,503,'EXPORTS_NOT_READY','Checkout is not available until app exports can be delivered.');
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return errorResponse(res,400,'INVALID_BODY','Invalid JSON request.');
  }
  try {
    const { platforms, email } = req.body;
    // Reject any client-supplied price, amount, or arbitrary product identifiers.
    const keys = Object.keys(req.body);
    if(keys.some(k => !['platforms','email'].includes(k))) {
      return errorResponse(res,400,'INVALID_BODY','Unexpected fields in checkout request.');
    }
    const q = quote(platforms);
    const session = await createSandboxCheckout({
      platforms: q.platforms,
      email,
      env
    });
    return res.status(200).json({
      ok: true,
      testMode: true,
      checkoutUrl: session.checkoutUrl,
      orderId: session.orderId,
      quote: session.quote,
      notice: 'Sandbox test only. No export delivery or entitlement is created.'
    });
  } catch(e) {
    const status = Number.isInteger(e.status) ? e.status : 502;
    const message = e.status ? e.message : 'Test checkout could not be started.';
    return errorResponse(res,status,e.code || 'CHECKOUT_ERROR',message);
  }
};
