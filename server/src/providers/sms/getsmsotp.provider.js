const axios = require('axios');
const logger = require('../../config/logger');

const BASE_URL = 'https://get-sms.com/stubs/handler_api.php';

// ISO-2 → Get-SMS OTP country ID (from their docs)
const ISO_TO_COUNTRY_ID = {
  UA: 1,   KZ: 2,   CN: 3,   PH: 4,   MM: 5,
  ID: 6,   MY: 7,   KE: 8,   TZ: 9,   VN: 10,
  KG: 11,  IL: 13,  HK: 14,  PL: 15,  GB: 16,
  CD: 18,  NG: 19,  EG: 21,  IN: 22,  IE: 23,
  KH: 24,  LA: 25,  HT: 26,  CI: 27,  GM: 28,
  RS: 29,  YE: 30,  ZA: 31,  RO: 32,  CO: 33,
  EE: 34,  CA: 36,  MA: 37,  GH: 38,  AR: 39,
  UZ: 40,  CM: 41,  TD: 42,  DE: 43,  LT: 44,
  HR: 45,  SE: 46,  IQ: 47,  NL: 48,  LV: 49,
  AT: 50,  BY: 51,  SA: 53,  MX: 54,  TW: 55,
  ES: 56,  IR: 57,  DZ: 58,  SI: 59,  BD: 60,
  SN: 61,  TR: 62,  CZ: 63,  LK: 64,  PE: 65,
  PK: 66,  NZ: 67,  GN: 68,  ML: 69,  VE: 70,
  MN: 72,  BR: 73,  AF: 74,  UG: 75,  AO: 76,
  CY: 77,  FR: 78,  PG: 79,  MZ: 80,  NP: 81,
  BG: 83,  HU: 84,  MD: 85,  IT: 86,  PY: 87,
  HN: 88,  TN: 89,  NI: 90,  BO: 92,  AE: 95,
  ZW: 96,  SD: 98,  SV: 101, LY: 102, JM: 103,
  TT: 104, EC: 105, DO: 109, SY: 110, JO: 116,
  PT: 117, BW: 123, GE: 128, GR: 129, GY: 131,
  LR: 135, TJ: 143, RE: 146, AM: 148, CL: 151,
  BF: 152, LB: 153, GA: 154, MU: 157, BT: 158,
  MV: 159, TM: 161, FI: 163, DK: 172, NO: 174,
  AW: 179, KR: 190, US: 187,
};

const COUNTRY_ID_TO_ISO = Object.fromEntries(
  Object.entries(ISO_TO_COUNTRY_ID).map(([iso, id]) => [String(id), iso])
);

// Service slug → Get-SMS OTP service code
const SERVICE_CODE = {
  whatsapp:   'wa',
  telegram:   'tg',
  google:     'go',
  instagram:  'ig',
  facebook:   'fb',
  twitter:    'tw',
  tiktok:     'lf',
  discord:    'ds',
  snapchat:   'fu',
  amazon:     'am',
  netflix:    'nf',
  uber:       'ub',
  linkedin:   'tn',
  paypal:     'ts',
  viber:      'vi',
  fiverr:     'cn',
  tinder:     'oi',
  signal:     'bw',
  ebay:       'dh',
  wechat:     'wb',
  weibo:      'kf',
  tencentqq:  'qq',
  naver:      'nv',
  zalo:       'mj',
  line:       'me',
  lyft:       'tu',
  airbnb:     'uk',
  doordash:   'ac',
  kwai:       'vp',
  grindr:     'yw',
  twitch:     'hb',
  bilibili:   'zs',
  iqiyi:      'es',
  kakaotalk:  'kt',
  microsoft:  'mm',
};

const toServiceCode = (slug) => SERVICE_CODE[slug] || null;

const call = async (params) => {
  const { data } = await axios.get(BASE_URL, {
    params: { api_key: process.env.GETSMS_API_KEY, ...params },
    timeout: 15000,
  });
  return data;
};

// Cache: full price map { [iso]: { [serviceCode]: { cost, count } } }
// API now requires country param — we batch per country and cache 10 min
let _priceCache = null;
let _priceCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;
const BATCH_SIZE = 8;

const buildFullPriceMap = async () => {
  const entries = Object.entries(ISO_TO_COUNTRY_ID);
  const result = {};

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const responses = await Promise.allSettled(
      batch.map(([iso, id]) =>
        call({ action: 'getPrices', country: id })
          .then(raw => {
            if (!raw || typeof raw !== 'object') return null;
            const countryData = raw[String(id)];
            if (!countryData || typeof countryData !== 'object') return null;
            const services = {};
            for (const [code, priceMap] of Object.entries(countryData)) {
              if (typeof priceMap !== 'object') continue;
              const [priceStr, count] = Object.entries(priceMap)[0] || [];
              const cost = Number(priceStr);
              const cnt = Number(count);
              if (cost > 0 && cnt > 0) services[code] = { cost, count: cnt };
            }
            return { iso, services };
          })
      )
    );
    for (const r of responses) {
      if (r.status === 'fulfilled' && r.value) {
        result[r.value.iso] = r.value.services;
      }
    }
  }
  return result;
};

const getFullPrices = async () => {
  if (_priceCache && Date.now() - _priceCacheTime < CACHE_TTL) return _priceCache;
  try {
    _priceCache = await buildFullPriceMap();
    _priceCacheTime = Date.now();
  } catch (err) {
    logger.warn(`GetSMS OTP buildFullPriceMap failed: ${err.message}`);
    if (!_priceCache) _priceCache = {};
  }
  return _priceCache;
};

// Get prices for a service across all countries.
// Returns: { [countryIso]: { cost: number (USD), count: number } }
const getOtpPrices = async (serviceSlug) => {
  const code = toServiceCode(serviceSlug);
  if (!code) return null;
  try {
    const fullData = await getFullPrices();
    const result = {};
    for (const [iso, services] of Object.entries(fullData)) {
      const svc = services[code];
      if (svc) result[iso] = svc;
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch (err) {
    logger.warn(`GetSMS OTP getOtpPrices(${serviceSlug}) failed: ${err.message}`);
    return null;
  }
};

// Buy an OTP number. Returns: { id, phone }
const getNumber = async (serviceSlug, countryIso) => {
  const code = toServiceCode(serviceSlug);
  const countryId = ISO_TO_COUNTRY_ID[countryIso?.toUpperCase()];
  if (!code) throw new Error(`GetSMS OTP: no code for service ${serviceSlug}`);
  if (!countryId) throw new Error(`GetSMS OTP: unsupported country ${countryIso}`);

  const data = await call({ action: 'getNumber', service: code, country: countryId });

  if (typeof data === 'string') {
    if (data.startsWith('ACCESS_NUMBER:')) {
      const parts = data.split(':');
      return { id: parts[1], phone: parts[2] };
    }
    throw new Error(`GetSMS OTP getNumber: ${data}`);
  }
  throw new Error(`GetSMS OTP unexpected response: ${JSON.stringify(data)}`);
};

// Check order status. Returns status string
const getStatus = async (orderId) => {
  const data = await call({ action: 'getStatus', id: orderId });
  return typeof data === 'string' ? data.trim() : String(data);
};

// Cancel order (status 8)
const setStatus = async (orderId, status) => {
  try {
    await call({ action: 'setStatus', id: orderId, status });
  } catch (err) {
    logger.warn(`GetSMS OTP setStatus(${orderId}, ${status}) failed: ${err.message}`);
  }
};

module.exports = { getOtpPrices, getNumber, getStatus, setStatus, ISO_TO_COUNTRY_ID, COUNTRY_ID_TO_ISO, SERVICE_CODE, toServiceCode };
