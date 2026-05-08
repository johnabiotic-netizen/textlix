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

const verifyWebhookSignature = (rawBody, signature) => {
  const encKey = process.env.KORAPAY_ENCRYPTION_KEY || '';
  const secKey = process.env.KORAPAY_SECRET_KEY || '';
  return hmac(encKey, rawBody) === signature || hmac(secKey, rawBody) === signature;
};

module.exports = { initializeCharge, verifyCharge, verifyWebhookSignature };
