const axios = require('axios');
const logger = require('../config/logger');

let _cachedRate = null;
let _cacheExpiry = 0;

const getUsdToNgnRate = async () => {
  if (_cachedRate && Date.now() < _cacheExpiry) return _cachedRate;

  try {
    const { data } = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 8000 });
    const rate = data?.rates?.NGN;
    if (rate && rate > 0) {
      _cachedRate = rate;
      _cacheExpiry = Date.now() + 60 * 60 * 1000; // cache 1 hour
      logger.info(`USD/NGN rate refreshed: ${rate}`);
      return rate;
    }
  } catch (err) {
    logger.warn(`Exchange rate fetch failed: ${err.message}`);
  }

  // Fallback to last known rate or a safe default
  return _cachedRate || 1600;
};

module.exports = { getUsdToNgnRate };
