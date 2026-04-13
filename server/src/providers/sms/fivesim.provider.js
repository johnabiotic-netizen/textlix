const axios = require('axios');
const logger = require('../../config/logger');

const BASE_URL = 'https://5sim.net/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.FIVESIM_API_KEY}`,
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

const buyNumber = async (country, operator, product) => {
  const res = await api.get(`/user/buy/activation/${country}/${operator}/${product}`);
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
    logger.warn(`Failed to cancel 5sim order ${orderId}:`, err.message);
  }
};

const finishOrder = async (orderId) => {
  try {
    const res = await api.get(`/user/finish/${orderId}`);
    return res.data;
  } catch (err) {
    logger.warn(`Failed to finish 5sim order ${orderId}:`, err.message);
  }
};

const getProfile = async () => {
  const res = await api.get('/user/profile');
  return res.data;
};

module.exports = { getCountries, getProducts, buyNumber, checkOrder, cancelOrder, finishOrder, getProfile };
