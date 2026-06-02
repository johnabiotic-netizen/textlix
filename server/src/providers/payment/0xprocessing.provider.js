const crypto = require('crypto');

// 0xProcessing uses a browser form POST, not a server-to-server API.
// This builds the form fields the frontend submits directly to their payment page.
// Field names match the casing in https://docs.0xprocessing.com/0xprocessing-api/deposits/payment-form-with-fixed-amount
// — `Currency` and `Email` are documented as PascalCase. Sending `currency`
// (lowercase) caused their hosted page to fall back to default-chain USDT
// regardless of what the user picked.
const buildPaymentForm = ({ orderId, amountUSD, currency, email, clientId, successUrl, cancelUrl }) => ({
  AmountUSD: String(amountUSD),
  Currency: currency || 'USDT',
  Email: email,
  MerchantId: process.env.OXPROCESSING_MERCHANT_ID || process.env.OXPROCESSING_API_KEY,
  ClientId: clientId,
  BillingId: orderId,
  SuccessUrl: successUrl,
  CancelUrl: cancelUrl,
});

// Timing-safe hex compare. Never use === on signatures.
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const A = Buffer.from(a, 'utf8');
  const B = Buffer.from(b, 'utf8');
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
};

// Webhook signature verification.
// Preferred:  HMAC-SHA256(secret, rawBody) if OXPROCESSING_WEBHOOK_SECRET is set.
// Fallback:   MD5(rawBody) — unkeyed, only as last resort, intentionally weak.
//             (0xProcessing's docs use plain MD5; request a webhook secret
//             from them and set OXPROCESSING_WEBHOOK_SECRET to harden.)
const verifyWebhookSignature = (rawBody, signature) => {
  if (!signature) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  const secret = process.env.OXPROCESSING_WEBHOOK_SECRET;
  if (secret) {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return safeEqual(expected, signature);
  }
  const md5 = crypto.createHash('md5').update(body).digest('hex');
  return safeEqual(md5, signature);
};

module.exports = { buildPaymentForm, verifyWebhookSignature };
