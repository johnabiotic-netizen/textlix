const axios = require('axios');
const logger = require('../../config/logger');

const BASE_URL = 'https://get-sms.com/api/v2/rent/';

// Duration options → Get-SMS type/period params (API supports max 7 days)
const DURATION_MAP = {
  1: { type: 'day',  period: 1 },
  3: { type: 'day',  period: 3 },
  7: { type: 'week', period: 1 },
};

// ISO-2 → Get-SMS country name (exact names from their live API)
const ISO_TO_COUNTRY = {
  US: 'ssha',             GB: 'england',          CA: 'canada',
  DE: 'germany',          FR: 'france',           BR: 'brazil',
  EE: 'estonia',          KZ: 'kazakhstan',       ID: 'indonesia',
  KG: 'kyrgyzstan',       LA: 'laos',             LT: 'lithuania',
  NL: 'netherlands',      PL: 'poland',           RO: 'romania',
  SE: 'sweden',           IN: 'indiia',           MY: 'malaiziia',
  VN: 'vetnam',           PH: 'filippiny',        TR: 'turtsiia',
  MD: 'moldova',          UZ: 'uzbekistan',       GE: 'gruziia',
  IE: 'irlandiia',        PT: 'portugaliia',      ES: 'ispaniia',
  CZ: 'chekhiia',         BD: 'bangladesh',       HK: 'gonkong',
  TH: 'tailand',          MX: 'meksika',          LV: 'latviia',
  PK: 'pakistan',         GR: 'gretsiia',         NI: 'nikaragua',
  AR: 'argentina',        HT: 'gaiti',            UA: 'ukr',
  MN: 'mongoliia',        IL: 'izrail',           EG: 'egipet',
  GT: 'gvatemala',        LY: 'liviia',           IR: 'iran',
  YE: 'iemen',            TJ: 'tadzhikistan',     CN: 'kitai',
  LK: 'shrilanka',        SY: 'siriia',           LB: 'livan',
  BO: 'boliviia',         RS: 'serbiia',          CO: 'kolumbiia',
  AT: 'avstriia',         DZ: 'alzhir',           PE: 'peru',
  HN: 'gonduras',         MA: 'marokko',          VE: 'venesuela',
  NG: 'nigeriia',         SV: 'salvador',         PY: 'paragvai',
  NP: 'nepal',            IQ: 'irak',             MM: 'mianma',
  KH: 'kambodzha',        BY: 'belarus',          CI: 'kotdivuar',
  SA: 'saudaraviia',      AE: 'oae',              HR: 'khorvatiia',
  TZ: 'tanzaniia',        DK: 'daniia',           DO: 'dominikanskaiarespublika',
  EC: 'ekvador',          AF: 'afganistan',       NZ: 'novaiazelandiia',
  TW: 'taivan',           CY: 'kipr',             CL: 'chili',
  FI: 'finliandiia',      IT: 'italiia',          BG: 'bolgariia',
  HU: 'vengriia',         SI: 'sloveniia',
};

// Service slug → Get-SMS service code (SMS-Activate format)
const SERVICE_CODE = {
  whatsapp: 'wa', telegram: 'tg',  google: 'go',  instagram: 'ig',
  facebook: 'fb', twitter: 'tw',   tiktok: 'tt',  discord: 'ds',
  snapchat: 'sc', amazon: 'am',    netflix: 'nf', uber: 'ub',
  linkedin: 'li', paypal: 'pp',    viber: 'vi',   fiverr: 'fi',
  tinder: 'ti',   signal: 'si',    ebay: 'eb',    wechat: 'wc',
  weibo: 'wb',    tencentqq: 'qq', naver: 'nv',   zalo: 'zl',
  spotify: 'sp',  line: 'ln',      lyft: 'lf',    airbnb: 'ai',
  doordash: 'dp', kwai: 'kw',      grindr: 'gr',  badoo: 'bd',
  twitch: 'tv',   bilibili: 'bi',  iqiyi: 'iq',   kakaotalk: 'ka',
  aol: 'aol',     microsoft: 'ms',
};

const toServiceCode = (slug) => SERVICE_CODE[slug] || slug;

const call = async (params) => {
  const { data } = await axios.get(BASE_URL, {
    params: { userkey: process.env.GETSMS_API_KEY, ...params },
    timeout: 15000,
  });
  // Error envelope: { status: 4xx, data: { msg: '...' } }
  if (data && typeof data === 'object') {
    if (data.error) throw new Error(`GetSMS: ${data.error}`);
    if (data.status && data.status >= 400) throw new Error(`GetSMS: ${data.data?.msg || data.status}`);
  }
  return data;
};

// Get rental pricing for a country + service.
// Response: { status:200, data: { [serviceCode]: { count: N, price: { "1day": X, "3day": X, "7day": X, ... } } } }
// Returns: { count: N, prices: { 1: X, 3: X, 7: X } } with USD prices
const getPrices = async (countryIso, serviceSlug) => {
  const country = ISO_TO_COUNTRY[countryIso?.toUpperCase()];
  if (!country) return null;
  try {
    const raw = await call({ method: 'getcountprices', country });
    if (!raw?.data || typeof raw.data !== 'object') return null;
    const code = toServiceCode(serviceSlug);
    const svcData = raw.data[code];
    if (!svcData?.price) return null;
    // Map "Nday" keys to day numbers: { "1day": 2.5 } → { 1: 2.5 }
    const prices = {};
    for (const [key, price] of Object.entries(svcData.price)) {
      const days = parseInt(key, 10);
      if (!isNaN(days) && Number(price) > 0) prices[days] = Number(price);
    }
    return { count: Number(svcData.count) || 0, prices };
  } catch (err) {
    logger.warn(`GetSMS getPrices failed (${countryIso}/${serviceSlug}): ${err.message}`);
    return null;
  }
};

// Rent a number for X days (3, 7, 14, or 30)
const getNumber = async (countryIso, serviceSlug, days) => {
  const country = ISO_TO_COUNTRY[countryIso?.toUpperCase()];
  const duration = DURATION_MAP[days];
  if (!country) throw new Error(`GetSMS: unsupported country ${countryIso}`);
  if (!duration) throw new Error(`GetSMS: unsupported duration ${days} days`);

  const raw = await call({
    method: 'getnumber',
    country,
    service: toServiceCode(serviceSlug),
    type: duration.type,
    period: duration.period,
  });

  const data = raw?.data;
  if (!data || !data.phone) throw new Error(`GetSMS getNumber failed: ${JSON.stringify(raw)}`);

  return {
    id: String(data.order_id),
    phone: String(data.phone),
    expiresAt: data.end_time_timestamp ? new Date(data.end_time_timestamp * 1000) : new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  };
};

// Poll all SMS received on a rented number
// Response: { status:200, data: { msg: "...", sms_list: [{ date, text }] } }
const getSMS = async (rentId) => {
  try {
    const raw = await call({ method: 'getcode', rentid: rentId });
    const smsList = raw?.data?.sms_list;
    return Array.isArray(smsList) ? smsList : [];
  } catch (err) {
    logger.warn(`GetSMS getSMS failed for ${rentId}: ${err.message}`);
    return [];
  }
};

// Cancel/refund rental (refund available within 20 minutes of ordering)
const cancel = async (rentId) => {
  try {
    await call({ method: 'refuse', rentid: rentId });
  } catch (err) {
    logger.warn(`GetSMS cancel failed for ${rentId}:`, err.message);
  }
};

module.exports = { getPrices, getNumber, getSMS, cancel, DURATION_MAP, ISO_TO_COUNTRY, SERVICE_CODE, toServiceCode };
