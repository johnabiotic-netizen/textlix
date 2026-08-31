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

const CATALOG_COUNTRIES = ['US', 'DE', 'FR', 'GB']; // high-stock; unioned so one empty country can't blank the list
const getServiceCatalog = async () => {
  if (_catalogCache && Date.now() < _catalogExpires) return _catalogCache;
  try {
    // Union services across a few high-stock countries. Sampling a single
    // country (e.g. UK, which can sit at 0 available numbers → empty services)
    // used to blank the entire rental catalog.
    const lists = await Promise.all(CATALOG_COUNTRIES.map((c) => getCountryData(c).catch(() => null)));
    const services = [];
    const seenId = new Set();
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const s of list) {
        const id = Number(s.id);
        if (!seenId.has(id)) { seenId.add(id); services.push(s); }
      }
    }
    if (services.length === 0) return _catalogCache || [];

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
// rate-limits bursts from a single IP — and since we egress through one proxy IP,
// concurrent polls + retries would burst and get 403'd. Spacing requests ~1.8s
// apart keeps us under the limit (verified: spaced calls return 200, bursts 403).
//
// Two-level PRIORITY queue: user-facing calls (pricing, catalog, renting a number)
// jump ahead of background SMS polls. Without this, a handful of active rentals
// polling every few seconds saturates the 1.8s-spaced queue and a real visitor's
// price request waits behind the whole backlog forever. Pile-up is bounded upstream
// too — the poller skips a tick when an order's previous poll hasn't drained yet.
const GETSMS_MIN_GAP_MS = 1800;
const _gsQueue = [];        // pending items: { params, bg, resolve, reject }
let _gsDraining = false;
let _gsLastAt = 0;

async function _gsDrain() {
  if (_gsDraining) return;
  _gsDraining = true;
  try {
    while (_gsQueue.length) {
      const item = _gsQueue.shift();
      const gap = GETSMS_MIN_GAP_MS - (Date.now() - _gsLastAt);
      if (gap > 0) await new Promise((r) => setTimeout(r, gap));
      _gsLastAt = Date.now();
      try { item.resolve(await _doCall(item.params)); }
      catch (err) { item.reject(err); }
    }
  } finally {
    _gsDraining = false;
  }
}

// opts.background=true → low priority (SMS polling). Default → high priority
// (user-facing). High-priority items insert ahead of the first background item;
// FIFO is preserved within each level (the queue is always [high…, bg…]).
const call = (params, opts = {}) => new Promise((resolve, reject) => {
  const item = { params, bg: !!opts.background, resolve, reject };
  if (item.bg) {
    _gsQueue.push(item);
  } else {
    const i = _gsQueue.findIndex((q) => q.bg);
    if (i === -1) _gsQueue.push(item);
    else _gsQueue.splice(i, 0, item);
  }
  _gsDrain();
});

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
    // background:true → this poll yields to user-facing pricing/catalog/order calls.
    const raw = await call({ method: 'getsms', rentid: rentId }, { background: true });
    const smsList = raw?.data?.sms_list;
    return Array.isArray(smsList) ? smsList : [];
  } catch (err) {
    // Terminal: get-sms no longer has this rental ("Rental order not found").
    // Signal the poller to STOP — a pile of dead rentals polling forever is exactly
    // what saturated this queue and froze pricing. Transient errors (403/timeout)
    // still return [] so polling continues.
    if (/order not found/i.test(err.message || '')) {
      const gone = new Error('GETSMS_RENTAL_GONE');
      gone.code = 'GETSMS_RENTAL_GONE';
      throw gone;
    }
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
