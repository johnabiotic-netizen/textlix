const axios = require('axios');
const logger = require('../../config/logger');

const BASE_URL = 'https://api.grizzlysms.com/stubs/handler_api.php';

// Supported rental durations in days → hours (GrizzlySMS rent_time is in hours)
const RENT_DAYS = { 1: 24, 7: 168, 28: 672 };

// Map our 5sim-style slugs to GrizzlySMS/SMS-Activate service codes
const SLUG_TO_CODE = {
  whatsapp: 'wa',
  telegram: 'tg',
  google: 'go',
  instagram: 'ig',
  facebook: 'fb',
  twitter: 'tw',
  tiktok: 'tiktok',
  discord: 'ds',
  snapchat: 'sc',
  amazon: 'am',
  netflix: 'nf',
  uber: 'ub',
  linkedin: 'li',
  paypal: 'pp',
  microsoft: 'ms',
  viber: 'vi',
  steam: 'st',
  spotify: 'sp',
  yahoo: 'ya',
  apple: 'ap',
  line: 'ln',
};

const toCode = (slug) => SLUG_TO_CODE[slug] || slug;

// ISO-2 → GrizzlySMS numeric country ID (compatible with SMS-Activate ID system)
const ISO_TO_COUNTRY_ID = {
  US: 187, GB: 16,  IN: 22,  BR: 73,  UA: 1,   RU: 0,   PH: 12,  ID: 68,
  VN: 56,  TH: 166, MY: 130, KZ: 6,   CN: 2,   DE: 43,  FR: 78,  IT: 65,
  NG: 31,  KE: 39,  GH: 36,  ZA: 60,  EG: 86,  PK: 162, BD: 10,  MX: 44,
  CO: 28,  AR: 4,   TR: 169, PL: 15,  RO: 54,  NL: 134, SE: 156, NO: 135,
  DK: 57,  FI: 102, BE: 21,  AT: 38,  CH: 196, ES: 26,  PT: 103, GR: 30,
  CZ: 56,  HU: 32,  SK: 143, HR: 58,  BG: 33,  RS: 193, IE: 33,  LT: 44,
  LV: 44,  EE: 45,  SA: 155, IL: 34,  NG: 31,  TZ: 207, UG: 208, CM: 209,
};

// Reverse map: GrizzlySMS numeric country ID → ISO-2
const COUNTRY_ID_TO_ISO = Object.fromEntries(
  Object.entries(ISO_TO_COUNTRY_ID).map(([iso, id]) => [String(id), iso])
);

const call = async (params) => {
  const { data } = await axios.get(BASE_URL, {
    params: { api_key: process.env.GRIZZLYSMS_API_KEY, ...params },
    timeout: 15000,
  });
  if (data?.status === 'error') {
    throw new Error(`GrizzlySMS: ${data.message || JSON.stringify(data)}`);
  }
  return data;
};

/**
 * Fetch rental prices for all countries for a given number of days.
 * Returns { [ISO_CODE]: { cost (USD total for period), count } }
 */
const getRentPrices = async (days = 1) => {
  const rent_time = RENT_DAYS[days] || RENT_DAYS[1];
  const data = await call({ action: 'getRentPrices', service: 'full', rent_time });
  const result = {};
  for (const [country, services] of Object.entries(data.values || {})) {
    const full = services?.full;
    if (full?.count > 0) result[country] = { cost: full.cost, count: full.count };
  }
  return result;
};

/**
 * Buy a rental number for any service in the given country.
 * Returns { id, phone, endDate }
 */
const getRentNumber = async (countryCode, days = 1) => {
  const rent_time = RENT_DAYS[days] || RENT_DAYS[1];
  const data = await call({
    action: 'getRentNumber',
    service: 'full',
    country: countryCode,
    rent_time,
  });
  if (data.status !== 'success' || !data.phone) {
    throw new Error(`GrizzlySMS getRentNumber failed: ${JSON.stringify(data)}`);
  }
  return {
    id: String(data.phone.id),
    phone: String(data.phone.number),
    endDate: data.phone.endDate,
  };
};

/**
 * Poll for SMS messages received on a rental number.
 * Returns array of { phoneFrom, text, service, date } — empty array when no SMS yet.
 */
const getRentStatus = async (rentId) => {
  const data = await call({ action: 'getRentStatus', id: rentId });
  if (data.status === 'error') return []; // NO_SMS or other non-fatal error
  const messages = [];
  for (const sms of Object.values(data.values || {})) {
    if (sms.text) messages.push({ phoneFrom: sms.phoneFrom, text: sms.text, service: sms.service, date: sms.date });
  }
  return messages;
};

/**
 * Finish or cancel a rental.
 * status=1 → finish (end early, no refund)
 * status=2 → cancel (refund, only within first 20 min with no SMS)
 */
const setRentStatus = async (rentId, status = 1) => {
  try {
    await call({ action: 'setRentStatus', id: rentId, status });
  } catch (err) {
    logger.warn(`GrizzlySMS setRentStatus failed (${rentId}):`, err.message);
  }
};

// ─── OTP pricing ─────────────────────────────────────────────────────────────

/**
 * Fetch OTP pricing for a service across all countries.
 * Returns { [numericCountryId]: { cost (USD), count } } or null if API unsupported.
 */
const getOtpPrices = async (service) => {
  const code = toCode(service);
  const data = await call({ action: 'getPrices', service: code });
  if (typeof data === 'string') return null;
  // GrizzlySMS returns { [countryId]: { [serviceCode]: { count, cost, retry } } }
  // Reshape to { [countryId]: { count, cost } } to match downstream expectations
  const result = {};
  for (const [countryId, services] of Object.entries(data || {})) {
    const svc = services[code];
    if (svc) result[countryId] = svc;
  }
  return Object.keys(result).length > 0 ? result : null;
};

// ─── OTP activation methods ───────────────────────────────────────────────────

/**
 * Buy a one-time activation number for a specific service and country.
 * countryIso: 2-letter ISO code (e.g. 'US', 'GB'). Falls back to any country (0) if unmapped.
 * Returns { id, phone }
 */
const getNumber = async (service, countryIso) => {
  const country = ISO_TO_COUNTRY_ID[countryIso?.toUpperCase()] ?? 0;
  const data = await call({ action: 'getNumber', service: toCode(service), country });
  if (typeof data !== 'string' || !data.startsWith('ACCESS_NUMBER')) {
    throw new Error(`GrizzlySMS getNumber: ${data}`);
  }
  const [, id, phone] = data.split(':');
  return { id, phone };
};

/**
 * Poll status of an OTP activation.
 * Returns raw status string: STATUS_WAIT_CODE, STATUS_OK:<code>, STATUS_CANCEL, etc.
 */
const getStatus = async (id) => {
  const data = await call({ action: 'getStatus', id });
  return typeof data === 'string' ? data : JSON.stringify(data);
};

/**
 * Change activation status.
 * status=1  → request another SMS
 * status=6  → confirm SMS received (finish)
 * status=8  → cancel activation (triggers refund on provider side)
 */
const setStatus = async (id, status) => {
  try {
    await call({ action: 'setStatus', id, status });
  } catch (err) {
    logger.warn(`GrizzlySMS setStatus failed (${id}):`, err.message);
  }
};

module.exports = { getRentPrices, getRentNumber, getRentStatus, setRentStatus, getNumber, getStatus, setStatus, getOtpPrices, COUNTRY_ID_TO_ISO, RENT_DAYS };
