const axios = require('axios');
const logger = require('../../config/logger');

// Updated API base URL (changed per Get-SMS docs update)
const BASE_URL = 'https://get-sms.com/api/v2/rent/rent_number.php';

// get-sms.com blocks our datacenter (Railway) egress IP on its order/SMS endpoints
// while the catalog endpoint still works. Route get-sms requests through an outbound
// proxy with a clean/residential IP when GETSMS_PROXY_URL is set
// (e.g. http://user:pass@host:port). Unset → direct (no behavior change).
const { HttpsProxyAgent } = require('https-proxy-agent');
const _getsmsProxyAgent = process.env.GETSMS_PROXY_URL ? new HttpsProxyAgent(process.env.GETSMS_PROXY_URL) : null;
logger.info(`GetSMS init: proxy ${_getsmsProxyAgent ? 'ENABLED via ' + String(process.env.GETSMS_PROXY_URL).split('@').pop() : 'DISABLED (direct)'}`);

// Rental durations: minimum is 1 week (API only supports week/month)
const DURATION_MAP = {
  7:  { type: 'week',  period: 1 },
  14: { type: 'week',  period: 2 },
  21: { type: 'week',  period: 3 },
  30: { type: 'month', period: 1 },
};

// Service slug → Get-SMS rental service ID
// Curated overrides ensure clean URL slugs for the most common services
// (the dynamic catalog below provides full coverage for everything else)
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

// Reverse map: numeric id → preferred slug (so the catalog uses our clean slug)
const ID_TO_SLUG = Object.fromEntries(
  Object.entries(SERVICE_ID).filter(([slug, id]) => slug !== 'ebay').map(([slug, id]) => [id, slug])
);

// Generate a URL-safe slug from a raw Get-SMS service name.
// Strips parens content, truncates at &/+/| (multi-service bundles), and lowercases.
const slugify = (name) => {
  return String(name)
    .replace(/\([^)]*\)/g, '')      // remove parens content e.g. "Google (GMail, ...)"
    .replace(/\s*[&+|/].*$/, '')     // truncate at +, &, |, /
    .replace(/\.[a-z]{2,4}$/i, '')   // strip TLD like .com .ai .io
    .replace(/[^a-zA-Z0-9]/g, '')    // alphanumeric only
    .toLowerCase()
    .trim();
};

// Prettify a Get-SMS service name for display (just strip parens content)
const prettifyName = (name) => {
  return String(name).replace(/\([^)]*\)/g, '').trim();
};

// ─── Supported rental countries (dynamic, cached) ────────────────────────────
let _countriesCache = null;
let _countriesExpires = 0;
const COUNTRIES_TTL = 60 * 60 * 1000;

const getSupportedCountries = async () => {
  if (_countriesCache && Date.now() < _countriesExpires) return _countriesCache;
  try {
    const raw = await call({ method: 'countries' });
    const list = raw?.data?.countries;
    if (!Array.isArray(list)) return _countriesCache || new Set();
    // Convert provider-specific code back to ISO (e.g. UK → GB)
    const REVERSE_MAP = Object.fromEntries(Object.entries(COUNTRY_CODE_MAP).map(([iso, prov]) => [prov, iso]));
    const isoCodes = new Set(list.map((c) => REVERSE_MAP[c.code] || c.code));
    _countriesCache = isoCodes;
    _countriesExpires = Date.now() + COUNTRIES_TTL;
    return isoCodes;
  } catch (err) {
    logger.warn(`GetSMS getSupportedCountries: ${err.message}`);
    return _countriesCache || new Set();
  }
};

// ─── Service catalog (dynamic, cached) ────────────────────────────────────────
// Pulled from Get-SMS UK (largest service list — 120+ services).
// Cached for 1 hour. Slug → numeric ID map is built alongside.
let _catalogCache = null;
let _slugToIdCache = null;
let _catalogExpires = 0;
const CATALOG_TTL = 60 * 60 * 1000;

const getServiceCatalog = async () => {
  if (_catalogCache && Date.now() < _catalogExpires) return _catalogCache;
  try {
    const services = await getCountryData('GB'); // GB → UK via COUNTRY_CODE_MAP
    if (!services || services.length === 0) return _catalogCache || [];

    const catalog = [];
    const slugMap = {};
    const seenSlugs = new Set();

    // Seed slug map with curated overrides first (so they win on collisions)
    for (const [slug, id] of Object.entries(SERVICE_ID)) {
      slugMap[slug] = id;
    }

    for (const s of services) {
      const rawName = s.name;
      const id = Number(s.id);
      // Prefer curated slug if we have one for this ID, else derive from name
      const slug = ID_TO_SLUG[id] || slugify(rawName);
      if (!slug || slug === 'anyother') continue;
      if (seenSlugs.has(slug)) continue;

      seenSlugs.add(slug);
      catalog.push({
        id,
        slug,
        name: prettifyName(rawName),
      });
      if (!slugMap[slug]) slugMap[slug] = id;
    }

    _catalogCache = catalog;
    _slugToIdCache = slugMap;
    _catalogExpires = Date.now() + CATALOG_TTL;
    return catalog;
  } catch (err) {
    logger.warn(`GetSMS getServiceCatalog: ${err.message}`);
    return _catalogCache || [];
  }
};

// Slug → numeric ID lookup. Async because it may need to load the catalog.
const toServiceId = async (slug) => {
  if (!slug) return null;
  // Try curated static map first (instant)
  if (SERVICE_ID[slug]) return SERVICE_ID[slug];
  // Fall back to dynamic catalog
  if (!_slugToIdCache || Date.now() >= _catalogExpires) {
    await getServiceCatalog();
  }
  return _slugToIdCache?.[slug] || null;
};

// Get-SMS uses non-standard ISO codes for some countries (e.g. UK instead of GB).
// Translate our ISO codes (DB) to what Get-SMS expects on the wire.
const COUNTRY_CODE_MAP = {
  GB: 'UK',
};
const toProviderCountry = (iso) => COUNTRY_CODE_MAP[iso] || iso;

const _doCall = async (params) => {
  let data;
  try {
    ({ data } = await axios.get(BASE_URL, {
      params: { userkey: process.env.GETSMS_API_KEY, ...params },
      timeout: 30000,
      ...(_getsmsProxyAgent ? { httpsAgent: _getsmsProxyAgent, proxy: false } : {}),
    }));
  } catch (e) {
    logger.warn(`GetSMS call(${params.method}) transport error: proxied=${!!_getsmsProxyAgent} httpStatus=${e.response?.status} code=${e.code} msg=${e.message}`);
    throw e;
  }
  if (data?.status && data.status >= 400) {
    throw new Error(`GetSMS: ${data.data?.msg || data.status}`);
  }
  return data;
};

// Serialize ALL get-sms requests with a minimum gap. get-sms (behind Cloudflare)
// rate-limits bursts from a single IP — and since we now egress through one proxy
// IP, the poller's concurrent polls + retries would burst and get 403'd. Spacing
// requests ~1.8s apart keeps us under the limit (verified: spaced calls return 200,
// bursts return 403). Same queue pattern as the smscodes adapter.
const GETSMS_MIN_GAP_MS = 1800;
let _getsmsChain = Promise.resolve();
let _getsmsLastAt = 0;

const call = (params) => {
  const run = _getsmsChain.then(async () => {
    const gap = GETSMS_MIN_GAP_MS - (Date.now() - _getsmsLastAt);
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
    _getsmsLastAt = Date.now();
    return _doCall(params);
  });
  _getsmsChain = run.then(() => {}, () => {}); // keep the queue alive regardless of outcome
  return run;
};

// Cache country data (services + prices) per ISO code
// Success: 30 min TTL  |  Failure: 60s TTL so transient errors self-recover
const _countryCache = new Map();
const _inflight = new Map();
const SUCCESS_TTL = 30 * 60 * 1000;
const FAILURE_TTL = 60 * 1000;

const getCountryData = async (countryIso) => {
  const providerCode = toProviderCountry(countryIso);
  const cached = _countryCache.get(countryIso);
  if (cached && Date.now() < cached.expires) return cached.services;

  // Single-flight: if a request is already in flight for this country, await it
  if (_inflight.has(countryIso)) return _inflight.get(countryIso);

  const promise = (async () => {
    try {
      const raw = await call({ method: 'getdatacountry', country: providerCode });
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
  const serviceId = await toServiceId(serviceSlug);
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
  const serviceId = await toServiceId(serviceSlug);
  const duration = DURATION_MAP[days];
  if (!serviceId) throw new Error(`GetSMS: unsupported service ${serviceSlug}`);
  if (!duration) throw new Error(`GetSMS: unsupported duration ${days} days`);

  const raw = await call({
    method: 'createorder',
    country: toProviderCountry(countryIso),
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
  getServiceCatalog,
  getSupportedCountries,
  COUNTRY_CODE_MAP,
};
