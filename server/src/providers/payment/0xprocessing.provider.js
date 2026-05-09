const crypto = require('crypto');

// 0xProcessing uses a browser form POST, not a server-to-server API.
// This builds the form fields the frontend submits directly to their payment page.
const buildPaymentForm = ({ orderId, amountUSD, currency, email, clientId, successUrl, cancelUrl }) => ({
  AmountUSD: String(amountUSD),
  currency: currency || 'USDT',
  email,
  MerchantId: process.env.OXPROCESSING_MERCHANT_ID || process.env.OXPROCESSING_API_KEY,
  ClientId: clientId,
  BillingId: orderId,
  SuccessUrl: successUrl,
  CancelUrl: cancelUrl,
});

// Webhook signature: MD5 of raw body
const verifyWebhookSignature = (rawBody, signature) => {
  const expected = crypto.createHash('md5').update(rawBody).digest('hex');
  return expected === signature;
};

module.exports = { buildPaymentForm, verifyWebhookSignature };
