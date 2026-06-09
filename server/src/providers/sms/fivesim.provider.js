const axios = require('axios');
const logger = require('../../config/logger');

const BASE_URL = 'https://5sim.net/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${(process.env.FIVESIM_API_KEY || '').trim()}`,
    Accept: 'application/json',
  },
  timeout: 15000,
});

const getCountries = async () => {
  const res = await api.get('/guest/countries');
  return res.data;
};

const getProducts = async (country, operator = 'any') => {
  const res = await api.get(`/guest/products/${country}/${operator}`);
  return res.data;
};

// Returns all operator prices for a product across all countries
// Shape: { [product]: { [country]: { [operator]: { cost, count } } } }
const getPrices = async (product) => {
  const res = await api.get(`/guest/prices?product=${product}`);
  return res.data;
};

// Returns every product for ONE country in a single call (replaces N per-product
// calls when building a country's service list).
// Shape: { [country]: { [product]: { [operator]: { cost, count, rate } } } }
const getPricesByCountry = async (country) => {
  const res = await api.get(`/guest/prices?country=${country}`);
  return res.data;
};

const buyNumber = async (country, operator, product) => {
  const res = await api.get(`/user/buy/activation/${country}/${operator}/${product}`);
  return res.data;
};

// Long-term rental (hosting) — same response shape as buyNumber
const buyHostingNumber = async (country, operator, product) => {
  const res = await api.get(`/user/buy/hosting/${country}/${operator}/${product}`);
  return res.data;
};

// Hosting prices — shape: { [product]: { [country]: { [operator]: { cost, count } } } }
const getHostingPrices = async (product) => {
  const res = await api.get(`/guest/prices?product=${product}&type=hosting`);
  return res.data;
};

const checkOrder = async (orderId) => {
  const res = await api.get(`/user/check/${orderId}`);
  return res.data;
};

const cancelOrder = async (orderId) => {
  try {
    const res = await api.get(`/user/cancel/${orderId}`);
    return res.data;
  } catch (err) {
    logger.warn(`Failed to cancel 5sim order ${orderId}: ${err.message}`);
  }
};

const finishOrder = async (orderId) => {
  try {
    const res = await api.get(`/user/finish/${orderId}`);
    return res.data;
  } catch (err) {
    logger.warn(`Failed to finish 5sim order ${orderId}: ${err.message}`);
  }
};

const getProfile = async () => {
  const res = await api.get('/user/profile');
  return res.data;
};

// Retrieve all SMS messages received on a hosting (rental) number.
// Only works for hosting orders; returns [] for activation orders.
const getHostingInbox = async (orderId) => {
  try {
    const res = await api.get(`/user/sms/inbox/${orderId}`);
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    logger.warn(`getHostingInbox failed for order ${orderId}: ${err.message}`);
    return [];
  }
};

module.exports = { getCountries, getProducts, getPrices, getPricesByCountry, buyNumber, buyHostingNumber, getHostingPrices, getHostingInbox, checkOrder, cancelOrder, finishOrder, getProfile };
