const axios = require('axios');
const crypto = require('crypto');

const api = axios.create({
  baseURL: 'https://api.0xprocessing.com/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

const createInvoice = async ({ invoiceId, amountUSD, currency, callbackUrl, successUrl, failUrl }) => {
  try {
    const res = await api.post('/invoice/create', {
      api_key: process.env.OXPROCESSING_API_KEY,
      order_id: invoiceId,
      amount: amountUSD,
      currency: currency || 'USDT',
      description: 'VerifyNow Credits',
      callback_url: callbackUrl,
      success_url: successUrl,
      fail_url: failUrl,
    });
    return res.data;
  } catch (err) {
    const providerMsg = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    throw new Error(`0xProcessing error [${err.response?.status}]: ${providerMsg}`);
  }
};

// 0xProcessing signs webhook payloads with HMAC-SHA256 using the API key
const verifyWebhookSignature = (rawBody, signature) => {
  const expected = crypto
    .createHmac('sha256', process.env.OXPROCESSING_API_KEY || '')
    .update(rawBody)
    .digest('hex');
  return expected === signature;
};

module.exports = { createInvoice, verifyWebhookSignature };
