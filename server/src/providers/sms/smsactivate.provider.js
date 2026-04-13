const axios = require('axios');
const logger = require('../../config/logger');

const BASE_URL = 'https://api.sms-activate.org/stubs/handler_api.php';

const call = async (params) => {
  const res = await axios.get(BASE_URL, {
    params: { api_key: process.env.SMSACTIVATE_API_KEY, ...params },
    timeout: 15000,
  });
  return res.data;
};

// status: 1=waiting, 2=received, 3=cancelled, 4=refunded
const getNumber = async (service, country) => {
  const data = await call({ action: 'getNumber', service, country });
  if (!data.startsWith('ACCESS_NUMBER')) {
    throw new Error(`SMSActivate error: ${data}`);
  }
  const [, id, phone] = data.split(':');
  return { id, phone };
};

const getStatus = async (id) => {
  const data = await call({ action: 'getStatus', id });
  return data;
};

const setStatus = async (id, status) => {
  const data = await call({ action: 'setStatus', id, status });
  return data;
};

module.exports = { getNumber, getStatus, setStatus };
