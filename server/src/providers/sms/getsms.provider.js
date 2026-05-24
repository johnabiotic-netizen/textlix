const axios = require('axios');
const logger = require('../../config/logger');

// Updated API base URL (changed per Get-SMS docs update)
const BASE_URL = 'https://get-sms.com/api/v2/rent/rent_number.php';

// Rental durations: minimum is 1 week (API only supports week/month)
const DURATION_MAP = {
  7:  { type: 'week',  period: 1 },
  14: { type: 'week',  period: 2 },
  21: { type: 'week',  period: 3 },
  30: { type: 'month', period: 1 },
};

// Service slug → Get-SMS rental service ID
// IDs confirmed from getdatacountry endpoint
const SERVICE_ID = {
  airbnb:     2,
  amazon:     6,
  discord:    32,
  facebook:   36,
  fiverr:     38,
  google:     43,
  instagram:  51,
  line:       59,
  linkedin:   60,
  microsoft:  64,
  netflix:    76,
  paypal:     88,
  signal:     107,
  telegram:   113,
  tiktok:     115,
  tinder:     116,
  viber:      125,
  whatsapp:   137,
  twitter:    142,
  ebay:       88, // bundled with PayPal
};

const toServiceId = (slug) => SERVICE_ID[slug] || null;

const call = async (params) => {
  const { data } = await axios.get(BASE_URL, {
    params: { userkey: process.env.GETSMS_API_KEY, ...params },
    timeout: 30000,
  });
  if (data?.status && data.status >= 400) {
    throw new Error(`GetSMS: ${data.data?.msg || data.status}`);
  }
  return data;
};

// Cache country data (services + prices) per ISO code
// Success: 30 min TTL  |  Failure: 60s TTL so transient errors self-recover
const _countryCache = new Map();
const _inflight = new Map();
const SUCCESS_TTL = 30 * 60 * 1000;
const FAILURE_TTL = 60 * 1000;

const getCountryData = async (countryIso) => {
  const cached = _countryCache.get(countryIso);
  if (cached && Date.now() < cached.expires) return cached.services;

  // Single-flight: if a request is already in flight for this country, await it
  if (_inflight.has(countryIso)) return _inflight.get(countryIso);

  const promise = (async () => {
    try {
      const raw = await call({ method: 'getdatacountry', country: countryIso });
      if (!raw?.data?.services) {
        _countryCache.set(countryIso, { expires: Date.now() + FAILURE_TTL, services: null });
        return null;
      }
      _countryCache.set(countryIso, {
        expires: Date.now() + SUCCESS_TTL,
        services: raw.data.services,
      });
      return raw.data.services;
    } catch (err) {
      logger.warn(`GetSMS getCountryData(${countryIso}): ${err.message}`);
      _countryCache.set(countryIso, { expires: Date.now() + FAILURE_TTL, services: null });
      return null;
    } finally {
      _inflight.delete(countryIso);
    }
  })();

  _inflight.set(countryIso, promise);
  return promise;
};

// Get rental pricing for a country + service.
// Returns: { count: N, prices: { 7: X, 14: X, 30: X } } with USD prices
const getPrices = async (countryIso, serviceSlug) => {
  const serviceId = toServiceId(serviceSlug);
  if (!serviceId) return null;
  try {
    const services = await getCountryData(countryIso);
    if (!services) return null;
    const svc = services.find(s => s.id === serviceId);
    if (!svc || !svc.price_day || Number(svc.qty) <= 0) return null;

    const pricePerDay = Number(svc.price_day);
    const prices = {};
    for (const [days, { type, period }] of Object.entries(DURATION_MAP)) {
      const totalDays = type === 'month' ? 30 : period * 7;
      prices[Number(days)] = pricePerDay * totalDays;
    }
    return { count: Number(svc.qty), prices };
  } catch (err) {
    logger.warn(`GetSMS getPrices failed (${countryIso}/${serviceSlug}): ${err.message}`);
    return null;
  }
};

// Rent a number. days must be one of [7, 14, 30]
const getNumber = async (countryIso, serviceSlug, days) => {
  const serviceId = toServiceId(serviceSlug);
  const duration = DURATION_MAP[days];
  if (!serviceId) throw new Error(`GetSMS: unsupported service ${serviceSlug}`);
  if (!duration) throw new Error(`GetSMS: unsupported duration ${days} days`);

  const raw = await call({
    method: 'createorder',
    country: countryIso,
    services: serviceId,
    type: duration.type,
    period: duration.period,
  });

  const data = raw?.data;
  if (!data?.phone) throw new Error(`GetSMS createorder failed: ${JSON.stringify(raw)}`);

  return {
    id: String(data.order_id),
    phone: String(data.phone),
    expiresAt: data.end_time_timestamp
      ? new Date(data.end_time_timestamp * 1000)
      : new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  };
};

// Poll SMS received on a rented number
// Response: { status:200, data: { sms_list: [{date, text}], status_rent } }
const getSMS = async (rentId) => {
  try {
    const raw = await call({ method: 'getsms', rentid: rentId });
    const smsList = raw?.data?.sms_list;
    return Array.isArray(smsList) ? smsList : [];
  } catch (err) {
    logger.warn(`GetSMS getSMS failed for ${rentId}: ${err.message}`);
    return [];
  }
};

// No cancel endpoint in updated API — rentals expire naturally
const cancel = async (rentId) => {
  logger.info(`GetSMS rental ${rentId}: no cancel available, expires naturally`);
};

module.exports = {
  getPrices,
  getNumber,
  getSMS,
  cancel,
  DURATION_MAP,
  SERVICE_ID,
  toServiceId,
};
