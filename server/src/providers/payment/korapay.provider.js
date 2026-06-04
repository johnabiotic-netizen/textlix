const axios = require('axios');
const crypto = require('crypto');

const api = axios.create({
  baseURL: 'https://api.korapay.com/merchant/api/v1',
  headers: {
    Authorization: `Bearer ${process.env.KORAPAY_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

const initializeCharge = async ({ reference, amountNGN, email, name, redirectUrl, notificationUrl }) => {
  const res = await api.post('/charges/initialize', {
    reference,
    amount: amountNGN,
    currency: 'NGN',
    customer: { email, name },
    channels: ['card', 'bank_transfer'],
    redirect_url: redirectUrl,
    notification_url: notificationUrl,
    merchant_bears_cost: false,
  });
  return res.data.data;
};

const verifyCharge = async (reference) => {
  const res = await api.get(`/charges/${reference}`);
  return res.data.data;
};

const hmac = (key, body) =>
  crypto.createHmac('sha256', key).update(body).digest('hex');

// Timing-safe comparison — never use === on signatures.
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const A = Buffer.from(a, 'utf8');
  const B = Buffer.from(b, 'utf8');
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
};

// KoraPay computes `x-korapay-signature` as an HMAC-SHA256 of ONLY the `data`
// object of the payload (JSON-stringified), signed with the SECRET key — NOT
// the whole request body, and NOT the encryption key. Signing the whole body
// (our previous behaviour) never matches, so every webhook was rejected and
// payments only ever completed via the redirect-verify path.
// Ref: https://developers.korapay.com/docs/webhooks
const verifyWebhookSignature = (data, signature) => {
  if (!signature) return false;
  const secKey = process.env.KORAPAY_SECRET_KEY || '';
  if (!secKey) return false;
  const serialized = Buffer.from(JSON.stringify(data ?? {}), 'utf8');
  return safeEqual(hmac(secKey, serialized), signature);
};

module.exports = { initializeCharge, verifyCharge, verifyWebhookSignature };
