const axios = require('axios');
const logger = require('../../config/logger');

const BASE_URL = 'https://api.smspool.net';

const call = async (path, params = {}) => {
  const res = await axios.get(`${BASE_URL}${path}`, {
    params: { key: process.env.SMSPOOL_API_KEY, ...params },
    timeout: 15000,
  });
  return res.data;
};

// Get all extendable rental listings (no auth needed).
// Returns [{ id, name, region, pricing: { '1': usd, '7': usd, '28': usd, ... } }]
const getRentals = async () => {
  const res = await axios.get(`${BASE_URL}/rental/retrieve_all`, {
    params: { type: 1 },
    timeout: 15000,
  });
  return Array.isArray(res.data) ? res.data : [];
};

// Purchase a rental number.
// rentalId: id from getRentals (e.g. 11 for US)
// days: 1, 7, 28, 30, etc.
// Returns { success, phonenumber, days, rental_code, expiry (unix timestamp) }
const purchaseRental = async (rentalId, days) => {
  const data = await call('/purchase/rental', { id: rentalId, days });
  if (!data || !data.success) {
    throw new Error(`SMSPool purchaseRental failed: ${JSON.stringify(data)}`);
  }
  return data;
};

// Get all SMS messages received on a rented number.
// Returns array of message objects (empty array if none yet)
const getRentalMessages = async (rentalCode) => {
  const data = await call('/rental/retrieve_messages', { rental_code: rentalCode });
  return Array.isArray(data) ? data : [];
};

// Refund/cancel a rental early.
const refundRental = async (rentalCode) => {
  try {
    return await call('/rental/refund.php', { rental_code: rentalCode });
  } catch (err) {
    logger.warn(`SMSPool refundRental failed for ${rentalCode}:`, err.message);
  }
};

module.exports = { getRentals, purchaseRental, getRentalMessages, refundRental };
