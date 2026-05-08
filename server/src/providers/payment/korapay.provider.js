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

// KoraPay signs webhook payloads with HMAC-SHA256 using the encryption key
const computeSignature = (rawBody) =>
  crypto
    .createHmac('sha256', process.env.KORAPAY_ENCRYPTION_KEY || '')
    .update(rawBody)
    .digest('hex');

const verifyWebhookSignature = (rawBody, signature) =>
  computeSignature(rawBody) === signature;

const getKeyInfo = () => {
  const key = process.env.KORAPAY_ENCRYPTION_KEY || '';
  return { len: key.length, start: key.slice(0, 4), end: key.slice(-4) };
};

module.exports = { initializeCharge, verifyCharge, verifyWebhookSignature, computeSignature, getKeyInfo };
