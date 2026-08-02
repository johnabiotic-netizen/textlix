const axios = require('axios');
const logger = require('../../config/logger');

// SMS-BUS (sms-bus.com) — LIX 4. Custom token-based REST API (NOT SMS-Activate).
//   Base:   https://sms-bus.com/api/control , auth via ?token=
//   Envelope: every response is { code, message, data }. code 200 = success.
//   Catalog: /list/countries [{id,title,code}]  /list/projects [{id,title,code}]
//   Prices:  /list/prices?country_id=  → per project: { cost (USD), total_count (stock) }
//   Buy:     /get/number?country_id=&project_id=  → { request_id, number }
//   Poll:    /get/sms?request_id=  → data=code | 50101 (not yet) | 50102 (expired)
//   Cancel:  /cancel?request_id=
// Full ref: https://github.com/SMSBUS/SMS-BUS
const BASE_URL = 'https://sms-bus.com/api/control';

// Result/error codes we branch on (from the published API).
const CODE = {
  OK: 200,
  BAD_TOKEN: 401,
  NO_SERVICE: 50001,
  NO_NUMBER: 50002,
  SMS_WAITING: 50101,
  NUMBER_RELEASED: 50102,
  ALREADY_CLOSED: 50103,
  WAIT_LIMIT: 50104,
  BALANCE_LOW: 50201,
  NOT_ACTIVATED: 50208,
};

// GET with the token appended. Returns the parsed { code, message, data } body.
// The API returns HTTP 200 with the status carried in body.code, so we read that
// rather than relying on HTTP status.
async function call(path, params = {}, timeout = 20000) {
  const token = process.env.SMS_BUS_API_KEY;
  if (!token) throw new Error('smsbus: SMS_BUS_API_KEY not set');
  const qs = new URLSearchParams({ token, ...params }).toString();
  const { data } = await axios.get(`${BASE_URL}${path}?${qs}`, { timeout });
  if (data && typeof data === 'object' && 'code' in data) return data;
  // Unexpected shape — surface it so the probe/logs show what changed.
  throw new Error(`smsbus ${path}: unexpected response ${JSON.stringify(data).slice(0, 200)}`);
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// SMS-BUS country codes are lowercase ISO-ish (e.g. "us"). If any diverge from our
// ISO (as smscodes' "UK" for GB does), add the pair here once the probe reveals it.
const ISO_OVERRIDE = {}; // ourISO -> smsbus code  (e.g. { GB: 'uk' })
// Our service slug -> SMS-BUS project code/title, where they don't match 1:1.
const SLUG_OVERRIDE = {}; // e.g. { google: 'googlegmail' }

// ─── Catalog caches (id lookups). Lists are small + stable → cache 1h. ─────────
const TTL = 60 * 60 * 1000;
let _countries = null; let _countriesExp = 0; // { isoUpper: id }
let _projects = null; let _projectsExp = 0;   // { slug: id }
let _projectById = null;                       // { id: slug }  (reverse, for price rows)

async function loadCountries() {
  if (_countries && Date.now() < _countriesExp) return _countries;
  const res = await call('/list/countries');
  const list = Array.isArray(res.data) ? res.data : Object.values(res.data || {});
  const map = {};
  for (const c of list) {
    if (c && c.code != null && c.id != null) map[String(c.code).toUpperCase()] = c.id;
  }
  if (Object.keys(map).length) { _countries = map; _countriesExp = Date.now() + TTL; }
  return _countries || {};
}

async function loadProjects() {
  if (_projects && Date.now() < _projectsExp) return _projects;
  const res = await call('/list/projects');
  const list = Array.isArray(res.data) ? res.data : Object.values(res.data || {});
  const bySlug = {}; const byId = {};
  for (const p of list) {
    if (!p || p.id == null) continue;
    // Key on both the provider `code` and normalized `title` so our slug matches either.
    const keys = [...new Set([norm(p.code), norm(p.title)].filter(Boolean))];
    for (const k of keys) if (!(k in bySlug)) bySlug[k] = p.id;
    byId[p.id] = keys; // ALL keys (code + title) so prices index under every alias
  }
  if (Object.keys(bySlug).length) {
    _projects = bySlug; _projectById = byId; _projectsExp = Date.now() + TTL;
  }
  return _projects || {};
}

async function countryIdFor(iso) {
  const map = await loadCountries();
  const key = (ISO_OVERRIDE[String(iso || '').toUpperCase()] || String(iso || '')).toUpperCase();
  return map[key] ?? null;
}

async function projectIdFor(slug) {
  const map = await loadProjects();
  const key = norm(SLUG_OVERRIDE[norm(slug)] || slug);
  return map[key] ?? null;
}

// Buy an activation number. Returns { id (request_id), phone (number) }.
const getNumber = async (serviceSlug, countryIso) => {
  const country_id = await countryIdFor(countryIso);
  const project_id = await projectIdFor(serviceSlug);
  if (country_id == null) throw new Error(`smsbus: no country_id for ${countryIso}`);
  if (project_id == null) throw new Error(`smsbus: no project_id for ${serviceSlug}`);
  const res = await call('/get/number', { country_id, project_id });
  if (res.code === CODE.OK && res.data?.request_id != null && res.data?.number) {
    return { id: String(res.data.request_id), phone: String(res.data.number) };
  }
  throw new Error(`smsbus get/number (${res.code}): ${res.message || 'no number'}`);
};

// Poll for the received code. Returns the code string, or null while still waiting
// (50101) or once the number is released/timed out (50102). Never throws on those.
const getSMS = async (requestId) => {
  try {
    const res = await call('/get/sms', { request_id: requestId });
    if (res.code === CODE.OK && res.data) return String(res.data).trim();
    if (res.code === CODE.SMS_WAITING || res.code === CODE.NUMBER_RELEASED) return null;
    logger.warn(`smsbus get/sms(${requestId}) code ${res.code}: ${res.message}`);
    return null;
  } catch (err) {
    logger.warn(`smsbus getSMS(${requestId}) failed: ${err.message}`);
    return null;
  }
};

// Cancel/release a request. Returns true if closed (or already closed).
const cancel = async (requestId) => {
  try {
    const res = await call('/cancel', { request_id: requestId });
    return res.code === CODE.OK || res.code === CODE.ALREADY_CLOSED;
  } catch (err) {
    logger.warn(`smsbus cancel(${requestId}) failed: ${err.message}`);
    return false;
  }
};

const getBalance = async () => {
  try {
    const res = await call('/get/balance');
    return res.data?.balance != null ? Number(res.data.balance) : null;
  } catch (err) {
    logger.warn(`smsbus getBalance failed: ${err.message}`);
    return null;
  }
};

// All services for ONE country → { [ourSlug]: { cost (USD), count } }. Direct map
// of /list/prices?country_id=; total_count is live stock.
const getOtpPricesByCountry = async (countryIso) => {
  const country_id = await countryIdFor(countryIso);
  if (country_id == null) return null;
  try {
    await loadProjects(); // ensure _projectById is populated for reverse mapping
    const res = await call('/list/prices', { country_id }, 30000);
    if (res.code !== CODE.OK) return null;
    const rows = Array.isArray(res.data) ? res.data : Object.values(res.data || {});
    const result = {};
    for (const row of rows) {
      const cost = Number(row.cost);
      const count = Number(row.total_count) || 0;
      if (!(cost > 0)) continue;
      // Index the price under EVERY alias for this project — the SMS-BUS code
      // (e.g. "tg"), the normalized title (e.g. "telegram"), and the row's own
      // project_code — so it matches whichever slug our Service catalog uses.
      const keys = [...(_projectById?.[row.project_id] || []), norm(row.project_code)].filter(Boolean);
      for (const k of new Set(keys)) if (!(k in result)) result[k] = { cost, count };
    }
    return Object.keys(result).length ? result : null;
  } catch (err) {
    logger.warn(`smsbus getOtpPricesByCountry(${countryIso}) failed: ${err.message}`);
    return null;
  }
};

// Prices for ONE service across countries → { [ISO]: { cost, count } }. SMS-BUS
// only prices per-country, so this iterates the country catalog (small, cached).
// Used for the service-list view; safe to call periodically, not per-request.
const getOtpPrices = async (serviceSlug) => {
  const project_id = await projectIdFor(serviceSlug);
  if (project_id == null) return null;
  const countries = await loadCountries();
  const entries = Object.entries(countries); // [ [ISO, country_id], ... ]
  const result = {};
  // Small serial loop with a tiny gap — catalog build, not a hot path.
  for (const [iso, country_id] of entries) {
    try {
      const res = await call('/list/prices', { country_id }, 15000);
      if (res.code !== CODE.OK) continue;
      const rows = Array.isArray(res.data) ? res.data : Object.values(res.data || {});
      const row = rows.find((r) => r.project_id === project_id);
      if (row && Number(row.cost) > 0) result[iso] = { cost: Number(row.cost), count: Number(row.total_count) || 0 };
    } catch (_) { /* skip a country on transient error */ }
    await new Promise((r) => setTimeout(r, 120));
  }
  return Object.keys(result).length ? result : null;
};

module.exports = {
  getNumber, getSMS, cancel, getBalance,
  getOtpPricesByCountry, getOtpPrices,
  countryIdFor, projectIdFor, CODE,
  // { isoUpper: country_id } — used by the catalog warmer to iterate SMS-BUS's countries.
  getCountryMap: loadCountries,
};
