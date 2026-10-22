'use strict';

/*
 * Warpvio one-time export commerce contract.
 * Payment is never enabled in live mode until fulfillment and durable orders exist.
 * Sandbox test checkout is available only with an explicit opt-in environment variable.
 */
const { randomUUID } = require('node:crypto');

const PRICE_USD = Object.freeze({ Windows: 15, Android: 19, macOS: 19 });
const PLATFORM_ORDER = Object.freeze(['Windows','Android','macOS']);
const BUNDLE_USD = 39;

function inputError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function normalizePlatforms(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    throw inputError('INVALID_PLATFORMS', 'Choose between one and three platforms.');
  }
  if (value.some(x => typeof x !== 'string' || !PLATFORM_ORDER.includes(x))) {
    throw inputError('INVALID_PLATFORMS', 'Unsupported export platform.');
  }
  const unique = PLATFORM_ORDER.filter(x => value.includes(x));
  if (unique.length !== value.length) {
    throw inputError('INVALID_PLATFORMS', 'Repeated platforms are not allowed.');
  }
  return unique;
}

function quote(value) {
  const platforms = normalizePlatforms(value);
  const bundle = platforms.length === 3;
  const items = bundle
    ? [{ key: 'bundle', name: 'All three platforms', priceUSD: BUNDLE_USD }]
    : platforms.map(key => ({ key, name: key + ' app export', priceUSD: PRICE_USD[key] }));
  return {
    currency: 'USD',
    platforms,
    items,
    totalUSD: items.reduce((sum, item) => sum + item.priceUSD, 0),
    oneTime: true,
    readyToBuy: false,
    promise: 'One website, one build per purchased platform; no free exports.'
  };
}

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    throw inputError('INVALID_EMAIL', 'Enter a valid email address.');
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(email)) {
    throw inputError('INVALID_EMAIL', 'Enter a valid email address.');
  }
  return email;
}

function testCheckoutAllowed(env = process.env) {
  return env.DODO_PAYMENTS_ENVIRONMENT === 'test_mode' &&
    env.WARPVIO_TEST_CHECKOUT_ENABLED === 'true' &&
    typeof env.DODO_PAYMENTS_API_KEY === 'string' &&
    env.DODO_PAYMENTS_API_KEY.length > 10;
}

function productCart(platforms, env = process.env) {
  const names = platforms.length === 3
    ? ['bundle']
    : platforms;
  const config = {
    Windows: env.DODO_PRODUCT_WINDOWS,
    Android: env.DODO_PRODUCT_ANDROID,
    macOS: env.DODO_PRODUCT_MACOS,
    bundle: env.DODO_PRODUCT_BUNDLE
  };
  return names.map(name => {
    const productId = config[name];
    if (!productId || typeof productId !== 'string' || !productId.startsWith('pdt_')) {
      throw inputError('PRODUCT_NOT_CONFIGURED', 'Test checkout product is not configured.', 503);
    }
    return { product_id: productId, quantity: 1 };
  });
}

function returnUrl(env = process.env) {
  const origin = env.WARPVIO_PUBLIC_ORIGIN;
  let parsed;
  try { parsed = new URL(origin); } catch {}
  if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw inputError('PUBLIC_ORIGIN_MISSING', 'Public origin is not securely configured.', 503);
  }
  return parsed.origin + '/payment-return.html';
}

/*
 * Only for test-mode QA until native export workers, durable purchases,
 * ownership checks, and secure delivery are implemented.
 */
async function createSandboxCheckout({ platforms: choices, email, env = process.env, fetchImpl = globalThis.fetch }) {
  if (!testCheckoutAllowed(env)) {
    throw inputError('EXPORTS_NOT_READY', 'Paid exports are not available yet.', 503);
  }
  const normalized = normalizePlatforms(choices);
  const customerEmail = normalizeEmail(email);
  const cart = productCart(normalized, env);
  const orderId = randomUUID();
  const response = await fetchImpl('https://test.dodopayments.com/checkouts', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.DODO_PAYMENTS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      product_cart: cart,
      customer: { email: customerEmail },
      return_url: returnUrl(env),
      metadata: {
        warpvio_test_order_id: orderId,
        warpvio_platforms: normalized.join(','),
        warpvio_stage: 'sandbox_checkout_no_entitlement'
      }
    }),
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) {
    throw inputError('CHECKOUT_PROVIDER_ERROR', 'Test checkout could not be created. Check product IDs and Dodo configuration.', 502);
  }
  let payload;
  try { payload = await response.json(); } catch {}
  if (!payload || typeof payload.checkout_url !== 'string' ||
      !/^https:\/\/[a-z0-9.-]*dodopayments\.com\//i.test(payload.checkout_url)) {
    throw inputError('CHECKOUT_PROVIDER_ERROR', 'Provider returned an invalid checkout URL.', 502);
  }
  return {
    testMode: true,
    orderId,
    checkoutUrl: payload.checkout_url,
    quote: quote(normalized)
  };
}

module.exports = {
  PRICE_USD,
  PLATFORM_ORDER,
  BUNDLE_USD,
  inputError,
  normalizePlatforms,
  normalizeEmail,
  quote,
  testCheckoutAllowed,
  productCart,
  returnUrl,
  createSandboxCheckout
};
