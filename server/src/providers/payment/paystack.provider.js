const axios = require('axios');

const api = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

const initializeTransaction = async ({ email, amountKobo, reference, callbackUrl, metadata }) => {
  const res = await api.post('/transaction/initialize', {
    email,
    amount: amountKobo,
    reference,
    callback_url: callbackUrl,
    metadata,
  });
  return res.data.data;
};

const verifyTransaction = async (reference) => {
  const res = await api.get(`/transaction/verify/${reference}`);
  return res.data.data;
};

module.exports = { initializeTransaction, verifyTransaction };
