const axios = require('axios');
const logger = require('../../config/logger');

// SMSPVA Rent API v1 — https://docs.smspva.com (#tag/rent_fast_start)
// GET-only, apikey query param, responses: { status: 1|0, msg?, data }.
// Rentals are service-specific (like our get-sms rentals) and must be
// ACTIVATED after creation before they can receive SMS.
const BASE_URL = 'https://smspva.com/api/rent.php';

// Same escape hatch as get-sms: if SMSPVA ever blocks our datacenter egress IP,
// set SMSPVA_PROXY_URL (http://user:pass@host:port) to route through the
// residential proxy. Unset → direct.
const { HttpsProxyAgent } = require('https-proxy-agent');
const _proxyAgent = process.env.SMSPVA_PROXY_URL ? new HttpsProxyAgent(process.env.SMSPVA_PROXY_URL) : null;

// Rent API durations are week/month only (min 7, max 90 days)
const DURATION_MAP = {
  7:  { dtype: 'week',  dcount: 1 },
  14: { dtype: 'week',  dcount: 2 },
  21: { dtype: 'week',  dcount: 3 },
  30: { dtype: 'month', dcount: 1 },
};

// SMSPVA uses UK for United Kingdom; everything else observed is ISO.
const COUNTRY_CODE_MAP = { GB: 'UK' };
const toProviderCountry = (iso) => COUNTRY_CODE_MAP[iso] || iso;

// Slugify an SMSPVA service display name to match our service slugs
// (same normalization rules as the get-sms catalog slugs).
const slugify = (name) => {
  return String(name)
    .replace(/\([^)]*\)/g, '')
    .replace(/\s*[&+|/].*$/, '')
    .replace(/\.[a-z]{2,4}$/i, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .trim();
};

const _doCall = async (params) => {
  let data;
  try {
    ({ data } = await axios.get(BASE_URL, {
      params: { apikey: process.env.SMSPVA_API_KEY, ...params },
      timeout: 30000,
      ...(_proxyAgent ? { httpsAgent: _proxyAgent, proxy: false } : {}),
    }));
  } catch (e) {
    logger.warn(`SMSPVA call(${params.method}) transport error: httpStatus=${e.response?.status} code=${e.code} msg=${e.message}`);
    throw e;
  }
  if (!data || data.status !== 1) {
    throw new Error(`SMSPVA: ${data?.msg || 'unknown error'}`);
  }
  return data;
};

// Serialize all SMSPVA requests — their docs mandate 4-5s between queries
// (40 connections/min on the v1 API). Same two-level priority queue as the
// get-sms provider: user-facing calls (pricing, ordering) jump ahead of
// background SMS polls so active rentals can't starve a visitor's request.
const MIN_GAP_MS = 4200;
const _queue = [];
let _draining = false;
let _lastAt = 0;

async function _drain() {
  if (_draining) return;
  _draining = true;
  try {
    while (_queue.length) {
      const item = _queue.shift();
      const gap = MIN_GAP_MS - (Date.now() - _lastAt);
      if (gap > 0) await new Promise((r) => setTimeout(r, gap));
      _lastAt = Date.now();
      try { item.resolve(await _doCall(item.params)); }
      catch (err) { item.reject(err); }
    }
  } finally {
    _draining = false;
  }
}

const call = (params, opts = {}) => new Promise((resolve, reject) => {
  const item = { params, bg: !!opts.background, resolve, reject };
  if (item.bg) {
    _queue.push(item);
  } else {
    const i = _queue.findIndex((q) => q.bg);
    if (i === -1) _queue.push(item);
    else _queue.splice(i, 0, item);
  }
  _drain();
});

// ─── Supported rental countries (dynamic, cached 1h) ─────────────────────────
let _countriesCache = null;
let _countriesExpires = 0;
const COUNTRIES_TTL = 60 * 60 * 1000;

const getSupportedCountries = async () => {
  if (_countriesCache && Date.now() < _countriesExpires) return _countriesCache;
  try {
    const raw = await call({ method: 'getcountries' });
    if (!Array.isArray(raw?.data)) return _countriesCache || new Set();
    const REVERSE_MAP = Object.fromEntries(Object.entries(COUNTRY_CODE_MAP).map(([iso, prov]) => [prov, iso]));
    const isoCodes = new Set(raw.data.map((c) => REVERSE_MAP[c.code] || c.code));
    _countriesCache = isoCodes;
    _countriesExpires = Date.now() + COUNTRIES_TTL;
    return isoCodes;
  } catch (err) {
    logger.warn(`SMSPVA getSupportedCountries: ${err.message}`);
    return _countriesCache || new Set();
  }
};

// ─── Per-country service data (method=getdata) ───────────────────────────────
// getdata requires a duration; per-day price can carry bulk discounts per
// duration TYPE, so we fetch week×1 (covers 7/14/21) and month×1 (covers 30).
// Cache: `${iso}/${dtype}` → [{ name, service: 'optN', price_day, count }]
// Success 30 min | failure 60s so transient errors self-recover.
const _dataCache = new Map();
const _inflight = new Map();
const SUCCESS_TTL = 30 * 60 * 1000;
const FAILURE_TTL = 60 * 1000;

const getCountryData = async (countryIso, dtype) => {
  const key = `${countryIso}/${dtype}`;
  const cached = _dataCache.get(key);
  if (cached && Date.now() < cached.expires) return cached.services;
  if (_inflight.has(key)) return _inflight.get(key);

  const promise = (async () => {
    try {
      const raw = await call({
        method: 'getdata',
        country: toProviderCountry(countryIso),
        dtype,
        dcount: 1,
      });
      // Live API nests the list under data.services (the published spec says
      // data[] — handle both shapes defensively).
      const services = Array.isArray(raw?.data?.services)
        ? raw.data.services
        : (Array.isArray(raw?.data) ? raw.data : null);
      _dataCache.set(key, {
        expires: Date.now() + (services ? SUCCESS_TTL : FAILURE_TTL),
        services,
      });
      return services;
    } catch (err) {
      logger.warn(`SMSPVA getCountryData(${countryIso}/${dtype}): ${err.message}`);
      _dataCache.set(key, { expires: Date.now() + FAILURE_TTL, services: null });
      return null;
    } finally {
      _inflight.delete(key);
    }
  })();

  _inflight.set(key, promise);
  return promise;
};

// Find a service entry in a country's list by our slug (matched on name).
const findService = (services, serviceSlug) => {
  if (!Array.isArray(services)) return null;
  return services.find((s) => slugify(s.name) === serviceSlug) || null;
};

// Get rental pricing for a country + service.
// Returns: { count: N, prices: { 7: usd, 14: usd, 21: usd, 30: usd } } or null.
const getPrices = async (countryIso, serviceSlug) => {
  try {
    const weekData = await getCountryData(countryIso, 'week');
    const weekSvc = findService(weekData, serviceSlug);
    if (!weekSvc || !Number(weekSvc.price_day) || Number(weekSvc.count) <= 0) return null;

    const prices = {};
    for (const [days, { dtype }] of Object.entries(DURATION_MAP)) {
      if (dtype === 'week') prices[Number(days)] = Number(weekSvc.price_day) * Number(days);
    }

    // Month price from the month list; fall back to week per-day × 30 if absent
    const monthData = await getCountryData(countryIso, 'month');
    const monthSvc = findService(monthData, serviceSlug);
    const monthPerDay = Number(monthSvc?.price_day) || Number(weekSvc.price_day);
    if (Number(monthSvc?.count ?? weekSvc.count) > 0) prices[30] = monthPerDay * 30;

    return { count: Number(weekSvc.count), prices };
  } catch (err) {
    logger.warn(`SMSPVA getPrices failed (${countryIso}/${serviceSlug}): ${err.message}`);
    return null;
  }
};

// Rent a number. days must be one of [7, 14, 21, 30].
// create → activate (numbers must be activated before they receive SMS).
const getNumber = async (countryIso, serviceSlug, days) => {
  const duration = DURATION_MAP[days];
  if (!duration) throw new Error(`SMSPVA: unsupported duration ${days} days`);

  // Resolve our slug to SMSPVA's service code (e.g. 'opt16') for this country
  const services = await getCountryData(countryIso, duration.dtype);
  const svc = findService(services, serviceSlug);
  if (!svc) throw new Error(`SMSPVA: unsupported service ${serviceSlug} in ${countryIso}`);

  const raw = await call({
    method: 'create',
    country: toProviderCountry(countryIso),
    service: svc.service,
    dtype: duration.dtype,
    dcount: duration.dcount,
  });

  const data = Array.isArray(raw?.data) ? raw.data[0] : raw?.data;
  if (!data?.id || !data?.pnumber) throw new Error(`SMSPVA create failed: ${JSON.stringify(raw)}`);

  // Activate so the number starts receiving. If activation errors we still
  // return the order — the user owns it and SMSPVA activates lazily on retry.
  try {
    await call({ method: 'activate', id: data.id });
  } catch (err) {
    logger.warn(`SMSPVA activate(${data.id}) failed (will retry via poll): ${err.message}`);
  }

  const ccode = String(data.ccode || '').replace(/[^\d+]/g, '');
  return {
    id: String(data.id),
    phone: `${ccode.startsWith('+') ? ccode : '+' + ccode}${data.pnumber}`,
    expiresAt: data.until
      ? new Date(Number(data.until) * 1000)
      : new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  };
};

// Poll SMS received on a rental. Returns [{ text, date }] (date = unix seconds,
// only used as part of the dedup hash). Includes OtherSms (messages from other
// senders to the same number) — extra value for the renter, dedup keeps it safe.
const getSMS = async (rentId) => {
  try {
    const raw = await call({ method: 'sms', id: rentId }, { background: true });
    const main = Array.isArray(raw?.data?.SmsList) ? raw.data.SmsList : [];
    const other = Array.isArray(raw?.data?.OtherSms) ? raw.data.OtherSms : [];
    return [...main, ...other].map((m) => ({ text: m.text, date: m.date }));
  } catch (err) {
    // Terminal: order no longer exists at SMSPVA — tell the poller to stop
    // (dead rentals polling forever is what saturates serialized queues).
    if (/order not found|incorrect order/i.test(err.message || '')) {
      const gone = new Error('SMSPVA_RENTAL_GONE');
      gone.code = 'SMSPVA_RENTAL_GONE';
      throw gone;
    }
    logger.warn(`SMSPVA getSMS failed for ${rentId}: ${err.message}`);
    return [];
  }
};

// Remove a rental order (frees it at SMSPVA; no refund semantics assumed).
const cancel = async (rentId) => {
  try {
    await call({ method: 'delete', id: rentId });
  } catch (err) {
    logger.warn(`SMSPVA cancel(${rentId}): ${err.message}`);
  }
};

module.exports = {
  getPrices,
  getNumber,
  getSMS,
  cancel,
  getSupportedCountries,
  getCountryData,
  DURATION_MAP,
  COUNTRY_CODE_MAP,
};
