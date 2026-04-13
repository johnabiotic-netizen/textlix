const axios = require('axios');

const getBaseUrl = () =>
  process.env.COINGATE_ENVIRONMENT === 'live'
    ? 'https://api.coingate.com/v2'
    : 'https://api-sandbox.coingate.com/v2';

const createOrder = async ({ orderId, priceAmount, priceCurrency, title, description, callbackUrl, successUrl, cancelUrl }) => {
  const api = axios.create({
    baseURL: getBaseUrl(),
    headers: {
      Authorization: `Token ${process.env.COINGATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  const res = await api.post('/orders', {
    order_id: orderId,
    price_amount: priceAmount,
    price_currency: priceCurrency || 'USD',
    receive_currency: 'USD',
    title,
    description,
    callback_url: callbackUrl,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return res.data;
};

module.exports = { createOrder };
