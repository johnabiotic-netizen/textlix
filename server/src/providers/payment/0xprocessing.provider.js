const axios = require('axios');
const crypto = require('crypto');

const createPayment = async ({ orderId, amountUSD, currency, email, clientId, successUrl, cancelUrl }) => {
  try {
    const params = new URLSearchParams({
      email,
      amountUSD: String(amountUSD),
      currency: currency || 'USDT',
      MerchantId: process.env.OXPROCESSING_MERCHANT_ID,
      ClientId: clientId,
      BillingId: orderId,
      SuccessUrl: successUrl,
      CancelUrl: cancelUrl,
      ReturnUrl: 'true',
    });

    const res = await axios.post('https://app.0xprocessing.com/Payment', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    return res.data;
  } catch (err) {
    const providerMsg = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    throw new Error(`0xProcessing error [${err.response?.status}]: ${providerMsg}`);
  }
};

// 0xProcessing webhook signature uses MD5
const verifyWebhookSignature = (rawBody, signature) => {
  const expected = crypto
    .createHash('md5')
    .update(rawBody)
    .digest('hex');
  return expected === signature;
};

module.exports = { createPayment, verifyWebhookSignature };
