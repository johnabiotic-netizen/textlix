const axios = require('axios');
const logger = require('../../config/logger');

const BASE_URL = 'https://onlinesim.io/api/rent';

// ISO 3166-1 alpha-2 → E.164 calling code (OnlineSim uses calling codes for country param)
const ISO_TO_CALLING = {
  US: 1,   GB: 44,  IN: 91,  NG: 234, GH: 233, DE: 49,  FR: 33,  RU: 7,
  UA: 380, PL: 48,  SE: 46,  NL: 31,  ES: 34,  IT: 39,  BR: 55,  MX: 52,
  AU: 61,  CA: 1,   ZA: 27,  EG: 20,  KE: 254, TR: 90,  SA: 966, ID: 62,
  PH: 63,  VN: 84,  TH: 66,  MY: 60,  KZ: 7,   BY: 375, MD: 373, AM: 374,
  AZ: 994, GE: 995, PT: 351, BE: 32,  AT: 43,  CH: 41,  RO: 40,  CZ: 420,
  HU: 36,  SK: 421, HR: 385, BG: 359, GR: 30,  IL: 972, LT: 370, LV: 371,
  EE: 372, RS: 381, DK: 45,  FI: 358, NO: 47,  IE: 353, CN: 86,  JP: 81,
  KR: 82,  TW: 886, HK: 852, AR: 54,  CO: 57,  CL: 56,  PE: 51,
};

const call = async (endpoint, params = {}) => {
  const { data } = await axios.get(`${BASE_URL}/${endpoint}.php`, {
    params: { apikey: process.env.ONLINESIM_API_KEY, lang: 'en', ...params },
    timeout: 15000,
  });
  return data;
};

/**
 * Returns pricing for all available rental countries.
 * Shape: { [ISO_CODE]: { costPerDay (USD) } }
 */
const getTariffs = async () => {
  const data = await call('tariffsRent');
  if (!Array.isArray(data)) return {};
  const callingToISO = {};
  for (const [iso, calling] of Object.entries(ISO_TO_CALLING)) {
    callingToISO[calling] = iso;
  }
  const result = {};
  for (const item of data) {
    if (!item.country || !item.cost) continue;
    const iso = callingToISO[item.country];
    if (iso) result[iso] = { costPerDay: Number(item.cost) };
  }
  return result;
};

/**
 * Rent a number for any-service SMS in the given country for the given number of days.
 * Returns { id (tzid), phone }
 */
const getRentNum = async (isoCode, days) => {
  const callingCode = ISO_TO_CALLING[isoCode];
  if (!callingCode) throw new Error(`OnlineSim: unsupported country ${isoCode}`);
  const data = await call('getRentNum', { country: callingCode, days });
  if (data.response !== 1 || !data.item) {
    throw new Error(`OnlineSim getRentNum failed: ${JSON.stringify(data)}`);
  }
  return {
    id: String(data.item.tzid),
    phone: String(data.item.number),
  };
};

/**
 * Poll for SMS messages received on a rented number.
 * Returns array of { text, date } — empty array when no SMS yet.
 */
const getRentState = async (tzid) => {
  const data = await call('getRentState', { tzid });
  if (data.response !== 1 || !data.item) return [];
  const msgs = data.item.messages;
  if (!msgs || Object.keys(msgs).length === 0) return [];
  return Object.values(msgs).map((m) => ({
    text: String(m.text || m.msg || ''),
    date: String(m.time || m.date || ''),
  }));
};

/**
 * Release a rented number early.
 */
const closeRentNum = async (tzid) => {
  try {
    await call('closeRentNum', { tzid });
  } catch (err) {
    logger.warn(`OnlineSim closeRentNum failed (${tzid}):`, err.message);
  }
};

module.exports = { getTariffs, getRentNum, getRentState, closeRentNum, ISO_TO_CALLING };
