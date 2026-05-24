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

const verifyWebhookSignature = (rawBody, signature) => {
  if (!signature) return false;
  const encKey = process.env.KORAPAY_ENCRYPTION_KEY || '';
  const secKey = process.env.KORAPAY_SECRET_KEY || '';
  if (!encKey && !secKey) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  if (encKey && safeEqual(hmac(encKey, body), signature)) return true;
  if (secKey && safeEqual(hmac(secKey, body), signature)) return true;
  return false;
};

module.exports = { initializeCharge, verifyCharge, verifyWebhookSignature };
