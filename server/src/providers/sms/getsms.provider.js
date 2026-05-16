const axios = require('axios');
const logger = require('../../config/logger');

const BASE_URL = 'https://get-sms.com/api/v2/rent/';

// Duration options → Get-SMS type/period params
const DURATION_MAP = {
  3:  { type: 'day',   period: 3 },
  7:  { type: 'week',  period: 1 },
  14: { type: 'week',  period: 2 },
  30: { type: 'month', period: 1 },
};

// ISO-2 → Get-SMS country name (lowercase English)
const ISO_TO_COUNTRY = {
  US: 'usa',      GB: 'england',     IN: 'india',       CA: 'canada',
  DE: 'germany',  FR: 'france',      BR: 'brazil',      AU: 'australia',
  PH: 'philippines', ID: 'indonesia', VN: 'vietnam',    TH: 'thailand',
  MY: 'malaysia', PK: 'pakistan',    BD: 'bangladesh',  NG: 'nigeria',
  KE: 'kenya',    ZA: 'southafrica', EG: 'egypt',       UA: 'ukraine',
  RU: 'russia',   PL: 'poland',      RO: 'romania',     KZ: 'kazakhstan',
  MX: 'mexico',   AR: 'argentina',   CO: 'colombia',    TR: 'turkey',
  ES: 'spain',    IT: 'italy',       NL: 'netherlands', SE: 'sweden',
  NO: 'norway',   DK: 'denmark',     FI: 'finland',     BE: 'belgium',
  AT: 'austria',  CH: 'switzerland', PT: 'portugal',    GR: 'greece',
  CZ: 'czech',    HU: 'hungary',     SK: 'slovakia',    HR: 'croatia',
  RS: 'serbia',   BG: 'bulgaria',    LT: 'lithuania',   LV: 'latvia',
  EE: 'estonia',  IE: 'ireland',     IL: 'israel',      SA: 'saudiarabia',
  AE: 'uae',      TW: 'taiwan',      HK: 'hongkong',    JP: 'japan',
  KR: 'southkorea', SG: 'singapore', CN: 'china',       UZ: 'uzbekistan',
  AZ: 'azerbaijan', GE: 'georgia',   AM: 'armenia',     KG: 'kyrgyzstan',
  ET: 'ethiopia', TZ: 'tanzania',    UG: 'uganda',      CM: 'cameroon',
  GH: 'ghana',    MA: 'morocco',     TN: 'tunisia',     DZ: 'algeria',
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
  if (data && typeof data === 'object' && data.error) {
    throw new Error(`GetSMS: ${data.error}`);
  }
  return data;
};

// Get pricing for a country + service across all durations
const getPrices = async (countryIso, serviceSlug) => {
  const country = ISO_TO_COUNTRY[countryIso?.toUpperCase()];
  if (!country) return null;
  try {
    const data = await call({ method: 'getcountprices', country, service: toServiceCode(serviceSlug) });
    return data;
  } catch (err) {
    logger.warn(`GetSMS getPrices failed (${countryIso}/${serviceSlug}):`, err.message);
    return null;
  }
};

// Rent a number for X days (3, 7, 14, or 30)
const getNumber = async (countryIso, serviceSlug, days) => {
  const country = ISO_TO_COUNTRY[countryIso?.toUpperCase()];
  const duration = DURATION_MAP[days];
  if (!country) throw new Error(`GetSMS: unsupported country ${countryIso}`);
  if (!duration) throw new Error(`GetSMS: unsupported duration ${days} days`);

  const data = await call({
    method: 'getnumber',
    country,
    service: toServiceCode(serviceSlug),
    type: duration.type,
    period: duration.period,
  });

  if (!data || !data.phone) throw new Error(`GetSMS getNumber failed: ${JSON.stringify(data)}`);

  return {
    id: String(data.order_id),
    phone: String(data.phone),
    expiresAt: data.end_time_timestamp ? new Date(data.end_time_timestamp * 1000) : new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  };
};

// Poll all SMS received on a rented number
const getSMS = async (rentId) => {
  try {
    const data = await call({ method: 'getcode', rentid: rentId });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    logger.warn(`GetSMS getSMS failed for ${rentId}:`, err.message);
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
