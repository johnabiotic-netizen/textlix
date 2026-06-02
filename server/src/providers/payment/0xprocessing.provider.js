const crypto = require('crypto');

// 0xProcessing uses a browser form POST, not a server-to-server API. This
// builds the form fields the frontend submits directly to their payment page.
//
// Field names + casing per:
// https://docs.0xprocessing.com/0xprocessing-api/deposits/payment-form-with-fixed-amount
//
// Notes:
// - `Currency` and `Email` are PascalCase per docs. Lowercase variants got
//   silently dropped, causing the hosted page to default to ERC20 USDT.
// - `BillingID` is capital-ID per docs. This is how the webhook echoes our
//   Payment._id back to us — wrong casing breaks correlation.
// - `AutoReturn=true` makes 0xProcessing redirect to SuccessUrl after on-chain
//   confirmation instead of showing a "Back to website" button the user has
//   to click manually.
const buildPaymentForm = ({ orderId, amountUSD, currency, email, clientId, successUrl, cancelUrl }) => ({
  AmountUSD: String(amountUSD),
  Currency: currency || 'USDT',
  Email: email,
  MerchantId: process.env.OXPROCESSING_MERCHANT_ID || process.env.OXPROCESSING_API_KEY,
  ClientId: clientId,
  BillingID: orderId,
  SuccessUrl: successUrl,
  CancelUrl: cancelUrl,
  AutoReturn: 'true',
});

// Timing-safe hex compare. Never use === on signatures.
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const A = Buffer.from(a.toLowerCase(), 'utf8');
  const B = Buffer.from(b.toLowerCase(), 'utf8');
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
};

// 0xProcessing webhook signature verification.
//
// Per https://docs.0xprocessing.com/0xprocessing-api/webhooks the signature
// is carried INSIDE the JSON body as field `Signature`, not in an HTTP header.
// It is the MD5 of the colon-joined string:
//   `${PaymentId}:${MerchantID}:${Email}:${Currency}:${Password}`
// where Password is the per-merchant webhook password configured in the
// 0xProcessing dashboard, mirrored here as OXPROCESSING_WEBHOOK_PASSWORD.
//
// Returns true iff the payload was signed by 0xProcessing with our password.
const verifyWebhookSignature = (payload) => {
  if (!payload || typeof payload !== 'object') return false;

  const password = process.env.OXPROCESSING_WEBHOOK_PASSWORD;
  if (!password) {
    // No password configured — every webhook is unverified. Bail closed.
    return false;
  }

  const { PaymentId, MerchantId, Email, Currency, Signature } = payload;
  if (PaymentId == null || !MerchantId || !Email || !Currency || !Signature) {
    return false;
  }

  // The docs show the field as `MerchantID` in the signature input but
  // `MerchantId` in the JSON payload — same value, just different casing for
  // the string concatenation. Use the value we received.
  const input = `${PaymentId}:${MerchantId}:${Email}:${Currency}:${password}`;
  const expected = crypto.createHash('md5').update(input).digest('hex');

  return safeEqual(expected, Signature);
};

module.exports = { buildPaymentForm, verifyWebhookSignature };
