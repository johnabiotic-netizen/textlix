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
const verifyWebhookSignature = (rawBody, signature) => {
  const expected = crypto
    .createHmac('sha256', process.env.KORAPAY_ENCRYPTION_KEY || '')
    .update(rawBody)
    .digest('hex');
  return expected === signature;
};

module.exports = { initializeCharge, verifyCharge, verifyWebhookSignature };
