const mongoose = require('mongoose');
const Country = require('../models/Country');
const Service = require('../models/Service');
const NumberPricing = require('../models/NumberPricing');
const NumberOrder = require('../models/NumberOrder');
const User = require('../models/User');
const { spendCredits, refundCredits } = require('../services/credit.service');
const smsPoller = require('../services/sms-poller.service');
const fivesim = require('../providers/sms/fivesim.provider');
const grizzlysms = require('../providers/sms/grizzlysms.provider');
const smspool = require('../providers/sms/smspool.provider');
const getsms = require('../providers/sms/getsms.provider');
const getsmsotp = require('../providers/sms/getsmsotp.provider');
const smscodes = require('../providers/sms/smscodes.provider');
const smspva = require('../providers/sms/smspva.provider');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const { getSettingNum } = require('../utils/settings');
const logger = require('../config/logger');

// Fallback ISO → 5sim slug map for countries where fivesimSlug isn't set in DB yet
const ISO_TO_SLUG = {
  US:'usa',GB:'england',IN:'india',NG:'nigeria',RU:'russia',BR:'brazil',
  DE:'germany',FR:'france',CA:'canada',AU:'australia',ID:'indonesia',
  PH:'philippines',VN:'vietnam',MX:'mexico',PK:'pakistan',BD:'bangladesh',
  KE:'kenya',GH:'ghana',ZA:'southafrica',UA:'ukraine',ES:'spain',IT:'italy',
  NL:'netherlands',PL:'poland',SE:'sweden',NO:'norway',DK:'denmark',
  FI:'finland',PT:'portugal',BE:'belgium',AT:'austria',CH:'switzerland',
  GR:'greece',RO:'romania',CZ:'czech',HU:'hungary',SK:'slovakia',HR:'croatia',
  BG:'bulgaria',RS:'serbia',IE:'ireland',LT:'lithuania',LV:'latvia',EE:'estonia',
  MD:'moldova',BY:'belarus',AL:'albania',MK:'northmacedonia',BA:'bih',
  ME:'montenegro',SI:'slovenia',CY:'cyprus',LU:'luxembourg',SA:'saudiarabia',
  EG:'egypt',MA:'morocco',TN:'tunisia',DZ:'algeria',IL:'israel',JO:'jordan',
  KW:'kuwait',OM:'oman',BH:'bahrain',LB:'lebanon',IQ:'iraq',LY:'libya',
  TH:'thailand',MY:'malaysia',TW:'taiwan',HK:'hongkong',KH:'cambodia',
  LA:'laos',LK:'srilanka',NP:'nepal',MN:'mongolia',MM:'myanmar',
  KZ:'kazakhstan',UZ:'uzbekistan',AZ:'azerbaijan',GE:'georgia',AM:'armenia',
  KG:'kyrgyzstan',TJ:'tajikistan',TM:'turkmenistan',AR:'argentina',
  CO:'colombia',CL:'chile',PE:'peru',VE:'venezuela',EC:'ecuador',BO:'bolivia',
  PY:'paraguay',UY:'uruguay',GT:'guatemala',CR:'costarica',PA:'panama',
  DO:'dominicana',HN:'honduras',SV:'salvador',NI:'nicaragua',PR:'puertorico',
  JM:'jamaica',HT:'haiti',GY:'guyana',BB:'barbados',TT:'trinidad',
  ET:'ethiopia',TZ:'tanzania',UG:'uganda',CM:'cameroon',CI:'ivorycoast',
  SN:'senegal',RW:'rwanda',MZ:'mozambique',ZM:'zambia',MW:'malawi',
  NA:'namibia',BW:'botswana',MG:'madagascar',SL:'sierraleone',LR:'liberia',
  GN:'guinea',BJ:'benin',TG:'togo',BF:'burkinafaso',ML:'mali',NE:'niger',
  TD:'chad',AO:'angola',GA:'gabon',CG:'congo',CD:'drc',BI:'burundi',
  DJ:'djibouti',GM:'gambia',GW:'guineabissau',CV:'capeverde',MR:'mauritania',
  MU:'mauritius',SC:'seychelles',KM:'comoros',LS:'lesotho',GQ:'equatorialguinea',
  ZW:'zimbabwe',SD:'sudan',MV:'maldives',TL:'easttimor',PG:'papuanewguinea',
  NZ:'newzealand',TR:'turkey',CN:'china',JP:'japan',KR:'southkorea',
};

// Live profit margin (fraction), sourced from the `default_margin_percent`
// platform setting (default 60%). Cached in-process so the synchronous price
// builders can read it via margin(); refreshed in the background when stale, so
// admin changes to the setting take effect within ~1 minute without a restart.
let _marginFraction = 0.60;
let _marginExpiry = 0;
const MARGIN_TTL_MS = 60 * 1000;
async function refreshMargin() {
  _marginExpiry = Date.now() + MARGIN_TTL_MS; // set first so concurrent calls don't stampede the DB
  try {
    const pct = await getSettingNum('default_margin_percent', 60);
    if (Number.isFinite(pct) && pct >= 0) _marginFraction = pct / 100;
  } catch (_) { /* keep last good value */ }
}
function margin() {
  if (Date.now() > _marginExpiry) refreshMargin(); // fire-and-forget refresh; use cached value now
  return _marginFraction;
}
refreshMargin(); // warm on startup
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Cache: serviceSlug → { countrySlug → { maxPrice, bestRate, totalCount } }
const serviceMaxPriceCache = new Map();

/**
 * Returns price + rate data for a service across all countries/operators.
 * Shape: { countrySlug → { maxPrice (USD), bestRate (0-1), totalCount } }
 */
// Negative-cache TTL: upstream failures (5sim doesn't have the service) get
// cached as null for 5 min so dead-end services don't get retried on every
// browse. Without this, ~150+ services with no 5sim coverage block the
// per-country fan-out by 15s each on cold cache.
const NEGATIVE_CACHE_TTL = 5 * 60 * 1000;

async function getMaxPrices(serviceSlug) {
  const cached = serviceMaxPriceCache.get(serviceSlug);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const raw = await fivesim.getPrices(serviceSlug);
    const byCountry = raw[serviceSlug] || {};
    const result = {};

    for (const [countrySlug, operators] of Object.entries(byCountry)) {
      let maxPrice = 0;
      let bestRate = 0;
      let totalCount = 0;
      for (const opData of Object.values(operators)) {
        if (opData.cost > maxPrice) maxPrice = opData.cost;
        const rawRate = opData.rate || 0;
        const normRate = rawRate > 1 ? rawRate / 100 : rawRate;
        if (normRate > bestRate) bestRate = normRate;
        totalCount += opData.count || 0;
      }
      if (maxPrice > 0) result[countrySlug] = { maxPrice, bestRate, totalCount };
    }

    serviceMaxPriceCache.set(serviceSlug, { data: result, expiresAt: Date.now() + CACHE_TTL });
    setImmediate(() => syncPricesToDB(serviceSlug, result).catch(() => {}));

    return result;
  } catch (err) {
    logger.warn(`getMaxPrices failed for ${serviceSlug}:`, err.message);
    serviceMaxPriceCache.set(serviceSlug, { data: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL });
    return null;
  }
}

/** Warm price caches on server startup so early users skip the cold fan-out */
const TOP_SERVICES = ['whatsapp', 'telegram', 'google'];
// 5sim slug + ISO for the busiest country pages, warmed by country.
const TOP_COUNTRIES = [['usa', 'US'], ['england', 'GB'], ['germany', 'DE'], ['india', 'IN'], ['russia', 'RU']];
exports.warmPriceCache = async function warmPriceCache() {
  for (const slug of TOP_SERVICES) {
    try {
      await getMaxPrices(slug);
      await new Promise((r) => setTimeout(r, 300)); // small delay to avoid hammering 5sim
    } catch (_) {}
  }
  // Warm smscodes (LIX 3) stock in the background so the first country/service page
  // doesn't trigger its ~25s rebuild in the request path. (Dropped the old
  // getsmsotp warm — that provider is retired, takes ~55s and returns nothing.)
  try { await getSmsCodesStock(); } catch (_) {}
  for (const [slug, iso] of TOP_COUNTRIES) {
    try { await get5simCountryPrices(slug); } catch (_) {}
    try { await getGrizzlyCountryPrices(iso); } catch (_) {}
    // Kick the slow smscodes (LIX 3) price fetch so its cache is warm before a
    // real visitor arrives — otherwise the 2s request-path cap always wins and
    // LIX 3 shows blank. The call self-populates the cache when it completes.
    try { await getSmsCodesCountryPrices(iso); } catch (_) {}
    await new Promise((r) => setTimeout(r, 300));
  }
};

/** Writes max-operator prices back to NumberPricing so the DB stays in sync */
async function syncPricesToDB(serviceSlug, maxPrices) {
  const svc = await Service.findOne({ slug: serviceSlug });
  if (!svc) return;

  // Build a map of fivesimSlug → countryDoc for fast lookup
  const countries = await Country.find({});
  const slugToCountry = {};
  for (const c of countries) {
    const slug = c.fivesimSlug || ISO_TO_SLUG[c.code];
    if (slug) slugToCountry[slug] = c;
  }

  const ops = [];
  for (const [countrySlug, data] of Object.entries(maxPrices)) {
    const country = slugToCountry[countrySlug];
    if (!country) continue;
    const providerCost = Math.ceil(data.maxPrice * 100);
    const finalPrice   = Math.ceil(providerCost * (1 + margin()));
    ops.push({
      updateOne: {
        filter: { countryId: country._id, serviceId: svc._id },
        update: { $set: { providerCost, finalPrice, marginPercent: Math.round(margin() * 100), isAvailable: true } },
        upsert: true,
      },
    });
  }
  if (ops.length) await NumberPricing.bulkWrite(ops);
}

/** Returns max-operator charge in credits for a country+service combo */
async function getChargeCredits(country5simSlug, serviceSlug, fallbackCredits) {
  const prices = await getMaxPrices(serviceSlug);
  const data = prices?.[country5simSlug];
  if (!data) return fallbackCredits;
  return Math.ceil(Math.ceil(data.maxPrice * 100) * (1 + margin()));
}

/**
 * Rank 5sim operators for a combo by live success rate (best first), keeping
 * only those with stock. Buying from the highest-rate operator instead of the
 * cheapest-by-default 'any' is the single biggest lever on delivery success.
 * Returns operator names, best first; empty array on any failure (caller then
 * falls back to 'any').
 */
async function rankFiveSimOperators(country5simSlug, serviceSlug) {
  try {
    const data = await fivesim.getPricesByCountry(country5simSlug);
    const operators = data?.[country5simSlug]?.[serviceSlug];
    if (!operators || typeof operators !== 'object') return [];
    return Object.entries(operators)
      .map(([name, op]) => ({ name, rate: Number(op?.rate) || 0, count: Number(op?.count) || 0 }))
      .filter((o) => o.count > 0)
      .sort((a, b) => (b.rate - a.rate) || (b.count - a.count))
      .map((o) => o.name);
  } catch (err) {
    logger.warn(`rankFiveSimOperators(${country5simSlug}/${serviceSlug}) failed: ${err.message}`);
    return [];
  }
}

// ─── Public platform stats (cached 5 min) ────────────────────────────────────
let _statsCache = null;
let _statsCacheExpiry = 0;

exports.getPublicStats = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=300');
    if (_statsCache && Date.now() < _statsCacheExpiry) {
      return success(res, _statsCache);
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [completedToday, failedToday, activeNow, allTimeCompleted, deliveryAgg] = await Promise.all([
      NumberOrder.countDocuments({ status: 'COMPLETED', smsReceivedAt: { $gte: since24h } }),
      NumberOrder.countDocuments({ status: { $in: ['EXPIRED', 'REFUNDED'] }, createdAt: { $gte: since24h } }),
      NumberOrder.countDocuments({ status: 'ACTIVE' }),
      NumberOrder.countDocuments({ status: 'COMPLETED' }),
      NumberOrder.aggregate([
        { $match: { status: 'COMPLETED', smsReceivedAt: { $gte: since24h } } },
        { $project: { ms: { $subtract: ['$smsReceivedAt', '$createdAt'] } } },
        { $group: { _id: null, avg: { $avg: '$ms' } } },
      ]),
    ]);

    const total24h = completedToday + failedToday;
    const successRate = total24h >= 10
      ? Math.round((completedToday / total24h) * 1000) / 10
      : 98.5; // default when not enough data yet

    const avgDeliverySeconds = deliveryAgg[0]?.avg
      ? Math.round(deliveryAgg[0].avg / 100) / 10
      : 4.2;

    _statsCache = { successRate, totalCompletions: allTimeCompleted, avgDeliverySeconds, activeNow };
    _statsCacheExpiry = Date.now() + 5 * 60 * 1000;

    success(res, _statsCache);
  } catch (err) {
    next(err);
  }
};

// ─── Per-service success rate cache (30 min) ─────────────────────────────────
let _serviceStatsCache = null;
let _serviceStatsCacheExpiry = 0;

async function getServiceSuccessRates() {
  if (_serviceStatsCache && Date.now() < _serviceStatsCacheExpiry) return _serviceStatsCache;

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const agg = await NumberOrder.aggregate([
    { $match: { serviceId: { $ne: null }, createdAt: { $gte: since7d }, status: { $in: ['COMPLETED', 'EXPIRED', 'REFUNDED'] } } },
    { $group: { _id: '$serviceId', completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } }, total: { $sum: 1 } } },
  ]);

  const rates = {};
  for (const row of agg) {
    if (row.total >= 5) {
      rates[row._id.toString()] = Math.round((row.completed / row.total) * 1000) / 10;
    }
  }

  _serviceStatsCache = rates;
  _serviceStatsCacheExpiry = Date.now() + 30 * 60 * 1000;
  return rates;
}

// ─── Per-provider success rate cache (30 min) ────────────────────────────────
let _providerRatesCache = null;
let _providerRatesCacheExpiry = 0;

async function getServiceRatesByProvider() {
  if (_providerRatesCache && Date.now() < _providerRatesCacheExpiry) return _providerRatesCache;

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const agg = await NumberOrder.aggregate([
    {
      $match: {
        serviceId: { $ne: null },
        createdAt: { $gte: since7d },
        status: { $in: ['COMPLETED', 'EXPIRED', 'REFUNDED'] },
        orderType: { $ne: 'RENTAL' },
      },
    },
    {
      $group: {
        _id: { serviceId: '$serviceId', provider: '$provider' },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ]);

  const rates = {};
  for (const row of agg) {
    if (row.total >= 5) {
      const svcId = row._id.serviceId.toString();
      const provider = row._id.provider || 'fivesim';
      if (!rates[svcId]) rates[svcId] = {};
      rates[svcId][provider] = Math.round((row.completed / row.total) * 1000) / 10;
    }
  }

  _providerRatesCache = rates;
  _providerRatesCacheExpiry = Date.now() + 30 * 60 * 1000;
  return rates;
}

// ─── 5sim hosting price cache (rental, service-specific, 1-day) ──────────────
// Key: serviceSlug → { expiresAt, data: { [5simCountrySlug]: creditCost } }
const hostingPriceCache = new Map();

async function get5simHostingPrices(serviceSlug) {
  const cached = hostingPriceCache.get(serviceSlug);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const raw = await fivesim.getHostingPrices(serviceSlug);
    const byCountry = raw[serviceSlug] || {};
    const result = {};

    for (const [countrySlug, operators] of Object.entries(byCountry)) {
      let minCost = Infinity;
      let totalCount = 0;
      for (const opData of Object.values(operators)) {
        if (opData.cost < minCost && opData.count > 0) minCost = opData.cost;
        totalCount += opData.count || 0;
      }
      if (minCost !== Infinity && totalCount > 0) {
        result[countrySlug] = Math.ceil(Math.ceil(minCost * 100) * (1 + margin()));
      }
    }

    hostingPriceCache.set(serviceSlug, { data: result, expiresAt: Date.now() + CACHE_TTL });
    return result;
  } catch (err) {
    logger.warn(`get5simHostingPrices(${serviceSlug}) failed:`, err.message);
    hostingPriceCache.set(serviceSlug, { data: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL });
    return null;
  }
}

// ─── GrizzlySMS OTP price cache (LIX 2, keyed by serviceSlug → ISO → credits) ─
const grizzlyOtpPriceCache = new Map();

async function getGrizzlyOtpPrices(serviceSlug) {
  const cached = grizzlyOtpPriceCache.get(serviceSlug);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const raw = await grizzlysms.getOtpPrices(serviceSlug);
    if (!raw) return null;

    const result = {};
    for (const [countryId, data] of Object.entries(raw)) {
      const iso = grizzlysms.COUNTRY_ID_TO_ISO[countryId];
      if (iso && data.count > 0) {
        result[iso] = Math.ceil(Math.ceil(data.cost * 100) * (1 + margin()));
      }
    }
    grizzlyOtpPriceCache.set(serviceSlug, { data: result, expiresAt: Date.now() + CACHE_TTL });
    return result;
  } catch (err) {
    logger.warn(`getGrizzlyOtpPrices(${serviceSlug}) failed:`, err.message);
    grizzlyOtpPriceCache.set(serviceSlug, { data: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL });
    return null;
  }
}

// ─── GetSMS OTP price cache (LIX 3, keyed by serviceSlug → ISO → credits) ─────
const getsmsotp_PriceCache = new Map();

async function getGetSmsOtpPrices(serviceSlug) {
  const cached = getsmsotp_PriceCache.get(serviceSlug);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const raw = await getsmsotp.getOtpPrices(serviceSlug);
    if (!raw) {
      getsmsotp_PriceCache.set(serviceSlug, { data: null, expiresAt: Date.now() + 5 * 60 * 1000 });
      return null;
    }
    const result = {};
    for (const [iso, data] of Object.entries(raw)) {
      if (data.count > 0) {
        result[iso] = Math.ceil(Math.ceil(data.cost * 100) * (1 + margin()));
      }
    }
    const out = Object.keys(result).length > 0 ? result : null;
    getsmsotp_PriceCache.set(serviceSlug, { data: out, expiresAt: Date.now() + CACHE_TTL });
    return out;
  } catch (err) {
    logger.warn(`getGetSmsOtpPrices(${serviceSlug}) failed: ${err.message}`);
    return null;
  }
}

// smscodes.io (LIX 3) server-side kill-switch. smscodes aggressively blocks
// request bursts; the adapter is now throttled (serialized queue + backoff), so
// it's enabled. Flip to false to instantly pull smscodes from catalog + ordering.
const SMSCODES_ENABLED = true;

// smscodes (LIX 3) live per-country stock. GetCountryCodes only lists countries
// with numbers right now, so we keep a Set of in-stock ISOs and hide LIX 3 in the
// catalog wherever the country isn't in it — no point offering numbers that aren't
// there. Cached 5 min (stock drifts as numbers sell); fail-closed (empty Set on
// error → LIX 3 simply hidden until the next successful fetch).
let _smscodesStock = new Set();
let _smscodesStockExpiry = 0;
let _smscodesStockInflight = null;
const SMSCODES_STOCK_TTL = 5 * 60 * 1000;      // hold a good result 5 min
const SMSCODES_STOCK_RETRY = 30 * 1000;        // smscodes call failed/empty → retry soon
async function getSmsCodesStock() {
  if (!SMSCODES_ENABLED) return _smscodesStock;
  if (Date.now() < _smscodesStockExpiry) return _smscodesStock; // fresh enough — instant
  // Stale or cold: kick off a background refresh (singleflight) but DON'T block the
  // request on it. smscodes.getCountryStock() takes ~25s; awaiting it here used to
  // freeze every country/service page. Serve the last-good Set immediately instead
  // (stale-while-revalidate). Fail-closed: empty Set until the first warm completes.
  if (!_smscodesStockInflight) {
    // Push expiry forward now so we don't spawn a fresh refresh on every request
    // during the ~25s the call is in flight.
    _smscodesStockExpiry = Date.now() + SMSCODES_STOCK_RETRY;
    _smscodesStockInflight = (async () => {
      try {
        const map = await smscodes.getCountryStock();
        if (map && Object.keys(map).length) {
          const s = new Set();
          for (const [iso, qty] of Object.entries(map)) if (qty > 0) s.add(iso.toUpperCase());
          _smscodesStock = s;
          _smscodesStockExpiry = Date.now() + SMSCODES_STOCK_TTL;
        }
        // empty/error → keep last-good; expiry already set to RETRY above
      } catch (_) {
        /* keep last-good Set; retry after the RETRY window */
      } finally {
        _smscodesStockInflight = null;
      }
    })();
  }
  return _smscodesStock; // never blocks on the slow smscodes call
}

// ─── smscodes.io OTP price cache (LIX 3, keyed by serviceSlug → ISO → credits) ─
const smscodesOtpPriceCache = new Map();

async function getSmsCodesOtpPrices(serviceSlug) {
  if (!SMSCODES_ENABLED) return null;
  const cached = smscodesOtpPriceCache.get(serviceSlug);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  try {
    const raw = await smscodes.getOtpPrices(serviceSlug); // { ISO: { cost, count } }
    if (!raw) {
      smscodesOtpPriceCache.set(serviceSlug, { data: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL });
      return null;
    }
    const result = {};
    for (const [iso, data] of Object.entries(raw)) {
      if (data.count > 0) result[iso] = Math.ceil(Math.ceil(data.cost * 100) * (1 + margin()));
    }
    const out = Object.keys(result).length > 0 ? result : null;
    smscodesOtpPriceCache.set(serviceSlug, { data: out, expiresAt: Date.now() + CACHE_TTL });
    return out;
  } catch (err) {
    logger.warn(`getSmsCodesOtpPrices(${serviceSlug}) failed: ${err.message}`);
    return null;
  }
}

// ─── Tier → provider mapping ──────────────────────────────────────────────────
// Single source of truth for which upstream provider backs each LIX tier.
// Reassigning a tier is a one-line change here (the routing/labels read this).
//   LIX 1 = 5sim · LIX 2 = GrizzlySMS · LIX 3 = smscodes.io
const TIER_PROVIDER = {
  lix1: 'fivesim',
  lix2: 'grizzlysms',
  lix3: 'smscodes',
};

// Provider → user-facing server label (never leak raw provider names). Derived
// from TIER_PROVIDER, plus legacy providers kept so historical orders still
// render a sensible label.
const SERVER_LABEL = {
  fivesim: 'LIX 1',
  grizzlysms: 'LIX 2',
  smscodes: 'LIX 3',
  // rental-only provider (RENTAL_TIER_PROVIDER) — display label only, NOT an
  // OTP tier; OTP routing above is untouched
  smspva: 'LIX 2',
  // legacy / retired providers from earlier tier layouts
  smspool: 'LIX 2',
  getsms: 'LIX 1',
  getsmsotp: 'LIX 3',
};

// Convert an order doc to a client-safe shape: never expose the raw upstream
// provider name — replace it with our own LIX server label.
function formatOrder(order) {
  const o = typeof order?.toObject === 'function' ? order.toObject() : { ...order };
  o.server = SERVER_LABEL[o.provider] || 'LIX 1';
  delete o.provider;
  return o;
}

const RENTAL_DURATION_OPTIONS = [7, 14, 21, 30];
const RENTAL_DURATION_LABELS = { 7: '1 Week', 14: '2 Weeks', 21: '3 Weeks', 30: '1 Month' };

// ─── Rental tier → provider mapping (separate from the OTP tiers above) ──────
// RENT LIX 1 = get-sms (default) · RENT LIX 2 = SMSPVA (flag-gated).
// SMSPVA is rental-only — it is NOT an OTP provider and never enters
// TIER_PROVIDER / the OTP routing.
const RENTAL_TIER_PROVIDER = {
  lix1: 'getsms',
  lix2: 'smspva',
};
const RENTAL_PROVIDER_MODULE = {
  getsms,
  smspva,
};
const smspvaRentalEnabled = () => process.env.SMSPVA_RENTAL_ENABLED === 'true';

// Cache: `${provider}/${countryIso}/${serviceSlug}` → { expiresAt, data: { 7: credits, ... } }
const rentalPriceCache = new Map();

async function getRentalPrices(provider, countryIso, serviceSlug) {
  const cacheKey = `${provider}/${countryIso}/${serviceSlug}`;
  const cached = rentalPriceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const mod = RENTAL_PROVIDER_MODULE[provider];
    if (!mod) return null;
    const raw = await mod.getPrices(countryIso, serviceSlug);
    if (!raw?.prices) {
      // Short negative-cache so transient provider failures self-recover quickly
      rentalPriceCache.set(cacheKey, { data: null, expiresAt: Date.now() + 60 * 1000 });
      return null;
    }
    const result = {};
    for (const [days, usdPrice] of Object.entries(raw.prices)) {
      const numDays = Number(days);
      if (RENTAL_DURATION_OPTIONS.includes(numDays)) {
        result[numDays] = Math.ceil(usdPrice * 100 * (1 + margin()));
      }
    }
    const data = Object.keys(result).length > 0 ? result : null;
    const ttl = data ? 30 * 60 * 1000 : 60 * 1000;
    rentalPriceCache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
    return data;
  } catch (err) {
    logger.warn(`getRentalPrices(${provider}/${countryIso}/${serviceSlug}) failed: ${err.message}`);
    return null;
  }
}

/** List all enabled services with country counts */
exports.getServiceList = async (req, res, next) => {
  try {
    const { mode = 'otp' } = req.query;

    if (mode === 'rental') {
      // Dynamic catalog from Get-SMS — every service they sell is rentable
      const catalog = await getsms.getServiceCatalog();
      // Enrich with DB Service icon/displayName where one exists
      const dbServices = await Service.find({ slug: { $in: catalog.map((c) => c.slug) }, isEnabled: true });
      const dbBySlug = Object.fromEntries(dbServices.map((s) => [s.slug, s]));
      const result = catalog
        .map((c) => {
          const db = dbBySlug[c.slug];
          return {
            id: db?._id?.toString() || c.slug, // ObjectId if we have a DB record, else slug
            slug: c.slug,
            name: db?.name || c.name,
            icon: db?.icon || null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      return success(res, { services: result });
    }

    // OTP mode — query from Service + NumberPricing, enrich with per-server live prices
    const services = await Service.find({ isEnabled: true }).sort({ sortOrder: 1, name: 1 });
    const serviceIds = services.map((s) => s._id);

    const counts = await NumberPricing.aggregate([
      { $match: { serviceId: { $in: serviceIds }, isAvailable: true } },
      { $group: { _id: '$serviceId', countryCount: { $sum: 1 }, minPrice: { $min: '$finalPrice' } } },
    ]);
    const countMap = {};
    for (const c of counts) countMap[c._id.toString()] = { countryCount: c.countryCount, minPrice: c.minPrice };

    const enabledServices = services.filter((s) => countMap[s._id.toString()]?.countryCount > 0);

    // LIX 1 (5sim) uses the NumberPricing DB counts (countMap) it was synced from.
    // LIX 2 (Grizzly) is live-priced here. LIX 3 (smscodes) is omitted from the
    // service LIST on purpose — one call per service would burst its rate limit;
    // its prices surface in the per-service / per-country views.
    const grizzlyPriceMaps = await Promise.all(enabledServices.map((s) => getGrizzlyOtpPrices(s.slug)));

    const result = enabledServices.map((s, i) => {
      const gMap = grizzlyPriceMaps[i];
      const lix2Prices = gMap ? Object.values(gMap) : [];
      const cm = countMap[s._id.toString()];
      return {
        id: s._id,
        name: s.name,
        slug: s.slug,
        icon: s.icon,
        servers: {
          lix1: {
            countryCount: cm?.countryCount || 0,
            minPrice: cm?.minPrice || 0,
          },
          lix2: {
            countryCount: lix2Prices.length,
            minPrice: lix2Prices.length > 0 ? Math.min(...lix2Prices) : 0,
          },
          lix3: { countryCount: 0, minPrice: 0 }, // smscodes priced in per-service/country views
        },
      };
    });

    success(res, { services: result });
  } catch (err) {
    next(err);
  }
};

/** Top recommended countries for a service based on 5sim rate + availability score */
exports.getRecommendations = async (req, res, next) => {
  try {
    const { serviceSlug } = req.params;
    const prices = await getMaxPrices(serviceSlug);
    if (!prices) return success(res, { recommendations: [] });

    const allCountries = await Country.find({ isEnabled: true });
    const slugToCountry = {};
    for (const c of allCountries) {
      const slug = c.fivesimSlug || ISO_TO_SLUG[c.code] || c.code.toLowerCase();
      slugToCountry[slug] = c;
    }

    const scored = [];
    for (const [slug, data] of Object.entries(prices)) {
      const country = slugToCountry[slug];
      if (!country || data.totalCount < 1) continue;
      // Score = rate (0-1) * 0.7 + availability_factor * 0.3
      const availFactor = Math.min(data.totalCount / 20, 1); // caps at 20 numbers
      const score = (data.bestRate * 0.7) + (availFactor * 0.3);
      scored.push({
        id: country._id,
        name: country.name,
        flagEmoji: country.flagEmoji,
        code: country.code,
        price: Math.ceil(Math.ceil(data.maxPrice * 100) * (1 + margin())),
        successRate: Math.min(100, Math.round(data.bestRate * 1000) / 10),
        availableCount: data.totalCount,
        score,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    success(res, { recommendations: scored.slice(0, 5) });
  } catch (err) {
    next(err);
  }
};

/** Countries available for a specific service (OTP or rental) */
exports.getCountriesForService = async (req, res, next) => {
  try {
    const { serviceSlug } = req.params;
    const { mode = 'otp' } = req.query;

    if (mode === 'rental') {
      const [allCountries, supportedIso] = await Promise.all([
        Country.find({ isEnabled: true }),
        getsms.getSupportedCountries(),
      ]);
      const result = allCountries
        .filter((c) => supportedIso.size === 0 || supportedIso.has(c.code))
        .map((c) => ({ id: c._id, name: c.name, code: c.code, flagEmoji: c.flagEmoji }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return success(res, { countries: result });
    }

    // OTP mode — look up from NumberPricing, enrich with LIX 1 and LIX 2 per-server prices
    const svc = await Service.findOne({ slug: serviceSlug, isEnabled: true });
    if (!svc) throw new AppError('NOT_FOUND', 404, 'Service not found');

    const pricing = await NumberPricing.find({ serviceId: svc._id, isAvailable: true }).populate('countryId');
    const [grizzlyPrices, maxPrices, smscodesPrices, smscodesStock] = await Promise.all([
      getGrizzlyOtpPrices(serviceSlug),  // LIX 2
      getMaxPrices(serviceSlug),         // LIX 1 (5sim)
      getSmsCodesOtpPrices(serviceSlug), // LIX 3
      getSmsCodesStock(),                // LIX 3 live stock (gates availability)
    ]);

    const result = [];
    for (const p of pricing) {
      const c = p.countryId;
      if (!c || !c.isEnabled) continue;
      const slug = c.fivesimSlug || ISO_TO_SLUG[c.code] || c.code.toLowerCase();
      const liveData = maxPrices?.[slug]; // 5sim → LIX 1
      const lix1Price = liveData ? Math.ceil(Math.ceil(liveData.maxPrice * 100) * (1 + margin())) : null;
      const lix2Price = grizzlyPrices?.[c.code] ?? null;
      // LIX 3 only when smscodes actually has numbers in this country.
      const lix3Price = smscodesStock.has(c.code) ? (smscodesPrices?.[c.code] ?? null) : null;
      if (!lix1Price && !lix2Price && !lix3Price) continue;

      // Live success signal from 5sim (LIX 1) — the only tier exposing a live rate.
      const hasRate = !!(liveData && lix1Price && liveData.totalCount > 0);
      const successRate = hasRate ? Math.min(100, Math.round(liveData.bestRate * 1000) / 10) : null;
      const availableCount = hasRate ? liveData.totalCount : null;

      result.push({
        id: c._id,
        name: c.name,
        code: c.code,
        flagEmoji: c.flagEmoji,
        minPrice: Math.min(...[lix1Price, lix2Price, lix3Price].filter(Boolean)),
        successRate,
        availableCount,
        servers: {
          lix1: { available: !!lix1Price, price: lix1Price },
          lix2: { available: !!lix2Price, price: lix2Price },
          lix3: { available: !!lix3Price, price: lix3Price },
        },
      });
    }

    // Sort strictly by current success rate (highest first). Countries with a
    // live rate rank by rate — stock only breaks ties — so the order matches
    // "highest success rate". Countries without a rate fall below, alphabetically.
    result.sort((a, b) => {
      if (a.successRate != null && b.successRate != null) {
        if (b.successRate !== a.successRate) return b.successRate - a.successRate;
        return (b.availableCount || 0) - (a.availableCount || 0);
      }
      if (a.successRate != null) return -1;
      if (b.successRate != null) return 1;
      return a.name.localeCompare(b.name);
    });

    // Flag up to 5 top picks — the highest success rates with numbers in stock.
    let picks = 0;
    for (const c of result) {
      if (picks >= 5) break;
      if (c.successRate != null && c.availableCount > 0) { c.recommended = true; picks++; }
    }

    success(res, { countries: result, service: { id: svc._id, name: svc.name, slug: svc.slug, icon: svc.icon } });
  } catch (err) {
    next(err);
  }
};

exports.getCountries = async (req, res, next) => {
  try {
    const { mode = 'otp' } = req.query;
    const countries = await Country.find({ isEnabled: true }).sort({ sortOrder: 1, name: 1 });

    if (mode === 'rental') {
      const [allCountries, supportedIso] = await Promise.all([
        Country.find({ isEnabled: true }).sort({ sortOrder: 1, name: 1 }),
        getsms.getSupportedCountries(),
      ]);
      const result = allCountries
        .filter((c) => supportedIso.size === 0 || supportedIso.has(c.code))
        .map((c) => ({
          id: c._id, name: c.name, code: c.code, flagEmoji: c.flagEmoji,
        }));
      return success(res, { countries: result });
    }

    // OTP mode
    const countryIds = countries.map((c) => c._id);
    const pricingCounts = await NumberPricing.aggregate([
      { $match: { countryId: { $in: countryIds }, isAvailable: true } },
      { $group: { _id: '$countryId', count: { $sum: 1 }, minPrice: { $min: '$finalPrice' } } },
    ]);

    const pricingMap = {};
    for (const p of pricingCounts) {
      pricingMap[p._id.toString()] = { count: p.count, minPrice: p.minPrice };
    }

    const result = countries
      .filter((c) => pricingMap[c._id.toString()]?.count > 0)
      .map((c) => ({
        id: c._id,
        name: c.name,
        code: c.code,
        flagEmoji: c.flagEmoji,
        serviceCount: pricingMap[c._id.toString()]?.count || 0,
        minPrice: pricingMap[c._id.toString()]?.minPrice || 0,
      }));

    success(res, { countries: result });
  } catch (err) {
    next(err);
  }
};

// ─── Per-COUNTRY price caches ────────────────────────────────────────────────
// Building a country's service list used to make ONE provider call PER SERVICE
// (hundreds of upstream calls on a cold cache). Each provider can return every
// service for a country in a single call, so we fetch + cache per country.
const fivesimCountryCache = new Map(); // 5sim slug -> { expiresAt, data: { svcSlug: { maxPrice, bestRate, totalCount } } }
const grizzlyCountryCache = new Map(); // ISO -> { expiresAt, data: { svcSlug: { cost, count } } }
const getsmsCountryCache = new Map();  // ISO -> { expiresAt, data: { svcSlug: { cost, count } } }

async function get5simCountryPrices(countrySlug) {
  const c = fivesimCountryCache.get(countrySlug);
  if (c && c.expiresAt > Date.now()) return c.data;
  try {
    const raw = await fivesim.getPricesByCountry(countrySlug);
    const byProduct = raw?.[countrySlug] || {};
    const result = {};
    for (const [product, operators] of Object.entries(byProduct)) {
      let maxPrice = 0, bestRate = 0, totalCount = 0;
      for (const op of Object.values(operators)) {
        if (op.cost > maxPrice) maxPrice = op.cost;
        const rawRate = op.rate || 0;
        const normRate = rawRate > 1 ? rawRate / 100 : rawRate;
        if (normRate > bestRate) bestRate = normRate;
        totalCount += op.count || 0;
      }
      if (maxPrice > 0) result[product] = { maxPrice, bestRate, totalCount };
    }
    fivesimCountryCache.set(countrySlug, { data: result, expiresAt: Date.now() + CACHE_TTL });
    return result;
  } catch (err) {
    logger.warn(`get5simCountryPrices(${countrySlug}) failed: ${err.message}`);
    fivesimCountryCache.set(countrySlug, { data: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL });
    return null;
  }
}

// LIX 3 = smscodes.io. Its GetCountryPrices returns 1000+ services and is slow
// (~30-60s), so we share one in-flight call per country, cache the result for
// next time, and cap the inline wait at 2s (lix3 just shows unavailable on the
// first cold load, then populates).
const smscodesCountryCache = new Map();
const smscodesCountryInflight = new Map();
async function getSmsCodesCountryPrices(iso) {
  if (!SMSCODES_ENABLED) return null;
  const c = smscodesCountryCache.get(iso);
  if (c && c.expiresAt > Date.now()) return c.data;
  if (!smscodesCountryInflight.has(iso)) {
    const promise = smscodes.getOtpPricesByCountry(iso)
      .then((data) => { smscodesCountryCache.set(iso, { data, expiresAt: Date.now() + CACHE_TTL }); return data; })
      .catch((err) => {
        logger.warn(`getSmsCodesCountryPrices(${iso}) failed: ${err.message}`);
        smscodesCountryCache.set(iso, { data: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL });
        return null;
      })
      .finally(() => smscodesCountryInflight.delete(iso));
    smscodesCountryInflight.set(iso, promise);
  }
  return Promise.race([
    smscodesCountryInflight.get(iso),
    new Promise((r) => setTimeout(() => r(null), 2000)),
  ]);
}

async function getGrizzlyCountryPrices(iso) {
  const c = grizzlyCountryCache.get(iso);
  if (c && c.expiresAt > Date.now()) return c.data;
  try {
    const data = await grizzlysms.getOtpPricesByCountry(iso);
    grizzlyCountryCache.set(iso, { data, expiresAt: Date.now() + CACHE_TTL });
    return data;
  } catch (err) {
    logger.warn(`getGrizzlyCountryPrices(${iso}) failed: ${err.message}`);
    grizzlyCountryCache.set(iso, { data: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL });
    return null;
  }
}

async function getGetSmsCountryPrices(iso) {
  const c = getsmsCountryCache.get(iso);
  if (c && c.expiresAt > Date.now()) return c.data;
  try {
    // GetSMS (LIX3) builds a full cross-country map on a cold cache (slow, and
    // it's the least-covered tier). Cap the wait so it never stalls the page —
    // if it's not ready, return null now; the in-flight build still populates
    // the provider cache, so the next load includes LIX3.
    const data = await Promise.race([
      getsmsotp.getOtpPricesByCountry(iso),
      new Promise((r) => setTimeout(() => r(undefined), 1500)),
    ]);
    if (data === undefined) return null; // build still in flight — don't cache
    getsmsCountryCache.set(iso, { data, expiresAt: Date.now() + CACHE_TTL });
    return data;
  } catch (err) {
    logger.warn(`getGetSmsCountryPrices(${iso}) failed: ${err.message}`);
    getsmsCountryCache.set(iso, { data: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL });
    return null;
  }
}

// Response-level cache for /numbers/countries/:countryId/services.
// Keeps repeat hits on the same country instant even between provider-cache windows.
const countryServicesResponseCache = new Map();
const COUNTRY_SERVICES_RESPONSE_TTL = 60 * 1000;

exports.getServices = async (req, res, next) => {
  try {
    const { countryId } = req.params;

    const cached = countryServicesResponseCache.get(countryId);
    if (cached && cached.expiresAt > Date.now()) {
      return success(res, cached.data);
    }

    const country = await Country.findById(countryId);
    if (!country || !country.isEnabled) throw new AppError('NOT_FOUND', 404, 'Country not found');

    const pricing = await NumberPricing.find({ countryId }).populate('serviceId');

    const fivesimSlug = country.fivesimSlug || ISO_TO_SLUG[country.code] || country.code.toLowerCase();

    // Sort first so indices stay stable when we zip with price results
    const enabledPricing = pricing
      .filter((p) => p.serviceId && p.serviceId.isEnabled)
      .sort((a, b) => a.serviceId.sortOrder - b.serviceId.sortOrder);

    // ONE call per provider for the whole country (each cached per country),
    // instead of one call per service — plus the cached success-rate aggregates.
    // Fetch the LIX 3 stock set first (fast, cached) so we can SKIP the slow
    // per-country smscodes price call (~30s cold) for countries with no stock —
    // we'd hide LIX 3 there anyway. Stock is per-country, so no stock = no LIX 3
    // for any service in it.
    const smscodesStock = await getSmsCodesStock();
    const smscodesInStock = smscodesStock.has(country.code);

    const [grizzlyMap, fivesimMap, smscodesMap, serviceRates, providerRates] = await Promise.all([
      getGrizzlyCountryPrices(country.code),   // LIX 2
      get5simCountryPrices(fivesimSlug),       // LIX 1 (5sim)
      smscodesInStock ? getSmsCodesCountryPrices(country.code) : Promise.resolve(null), // LIX 3 (skip if no stock)
      getServiceSuccessRates(),
      getServiceRatesByProvider(),
    ]);

    const services = enabledPricing.map((p) => {
      const slug = p.serviceId.slug;
      const svcId = p.serviceId._id.toString();
      const liveData = fivesimMap ? fivesimMap[slug] : undefined; // 5sim → LIX 1
      const fivesimRate = liveData?.bestRate != null ? Math.min(100, Math.round(liveData.bestRate * 1000) / 10) : null;

      // LIX 1 = 5sim (default), carries 5sim's live bestRate. The others use our
      // measured per-provider success, or none.
      const lix1Price = liveData ? Math.ceil(Math.ceil(liveData.maxPrice * 100) * (1 + margin())) : null;
      const lix2Price = grizzlyMap?.[slug] ? Math.ceil(Math.ceil(grizzlyMap[slug].cost * 100) * (1 + margin())) : null;
      const lix3Price = (smscodesInStock && smscodesMap?.[slug]) ? Math.ceil(Math.ceil(smscodesMap[slug].cost * 100) * (1 + margin())) : null;

      const lix1Rate = fivesimRate ?? providerRates[svcId]?.fivesim ?? null;
      const lix2Rate = providerRates[svcId]?.grizzlysms ?? null;
      const lix3Rate = providerRates[svcId]?.smscodes ?? null;

      // Service is orderable if any tier has stock.
      const available = !!(lix1Price || lix2Price || lix3Price);
      return {
        id: p.serviceId._id,
        name: p.serviceId.name,
        slug: p.serviceId.slug,
        icon: p.serviceId.icon,
        price: lix1Price ?? lix2Price ?? lix3Price,
        available,
        pricingId: p._id,
        // Headline rate = 5sim's live signal (LIX 1), falling back to measured.
        successRate: lix1Rate ?? lix2Rate ?? lix3Rate,
        availableCount: liveData?.totalCount ?? null,
        servers: {
          lix1: { price: lix1Price, available: !!lix1Price, successRate: lix1Rate },
          lix2: { price: lix2Price, available: !!lix2Price, successRate: lix2Rate },
          lix3: { price: lix3Price, available: !!lix3Price, successRate: lix3Rate },
        },
      };
    });

    const payload = { country: { id: country._id, name: country.name, flagEmoji: country.flagEmoji }, services };
    countryServicesResponseCache.set(countryId, { data: payload, expiresAt: Date.now() + COUNTRY_SERVICES_RESPONSE_TTL });
    success(res, payload);
  } catch (err) {
    next(err);
  }
};

exports.orderNumber = async (req, res, next) => {
  try {
    const { countryId, serviceId, server = 'lix1' } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    // Fast pre-check (non-atomic, reduces load before the expensive 5sim call)
    const preCount = await NumberOrder.countDocuments({ userId, status: 'ACTIVE' });
    if (preCount >= user.maxActiveNumbers) {
      throw new AppError('MAX_NUMBERS_REACHED', 429, `Maximum ${user.maxActiveNumbers} active numbers allowed`);
    }

    // Get pricing
    const pricing = await NumberPricing.findOne({ countryId, serviceId, isAvailable: true });
    if (!pricing) throw new AppError('NOT_FOUND', 404, 'This number is not available');

    const country = await Country.findById(countryId);
    const service = await Service.findById(serviceId);

    if (!country || !service) throw new AppError('NOT_FOUND', 404, 'Country or service not found');

    const countryName = country.fivesimSlug || ISO_TO_SLUG[country.code] || country.code.toLowerCase();

    // Determine charge based on chosen server (tier → provider via TIER_PROVIDER)
    let chargeCredits;
    if (server === 'lix2') {
      const gzPrices = await getGrizzlyOtpPrices(service.slug);
      chargeCredits = gzPrices?.[country.code] ?? pricing.finalPrice;
    } else if (server === 'lix3') {
      // LIX 3 = smscodes.io
      const scPrices = await getSmsCodesOtpPrices(service.slug);
      chargeCredits = scPrices?.[country.code] ?? pricing.finalPrice;
    } else {
      // LIX 1 (default) = 5sim
      chargeCredits = await getChargeCredits(countryName, service.slug, pricing.finalPrice);
    }

    if (user.creditBalance < chargeCredits) {
      throw new AppError('INSUFFICIENT_CREDITS', 402, `Need ${chargeCredits} credits, you have ${user.creditBalance}`);
    }

    // Buy number — route by server choice; LIX 1 silently falls back to GrizzlySMS
    let providerResponse;
    let usedProvider;

    // User-facing failure message — never leak provider/API names; the real
    // detail is logged server-side for debugging.
    const NO_NUMBER_MSG = 'No numbers are available for this service right now. Please try another service or country.';

    if (server === 'lix2') {
      const gzResult = await grizzlysms.getNumber(service.slug, country.code).catch((err) => {
        logger.warn(`LIX 2 getNumber failed (${country.code}/${service.slug}): ${err.message}`);
        throw new AppError('PROVIDER_ERROR', 502, NO_NUMBER_MSG);
      });
      providerResponse = { id: gzResult.id, phone: gzResult.phone, price: 0 };
      usedProvider = 'grizzlysms';
    } else if (server === 'lix3') {
      // LIX 3 = smscodes.io (real-SIM). No provider-side cancel — smscodes only
      // bills on code delivery. Fall back to LIX 2 on failure.
      if (!SMSCODES_ENABLED) throw new AppError('PROVIDER_ERROR', 502, NO_NUMBER_MSG);
      try {
        const sc = await smscodes.getNumber(service.slug, country.code);
        if (!sc?.id || !sc?.phone) throw new Error('empty smscodes response');
        providerResponse = { id: sc.id, phone: sc.phone, price: 0 };
        usedProvider = 'smscodes';
        logger.info(`LIX 3 (smscodes) bought for ${country.code}/${service.slug}`);
      } catch (scErr) {
        logger.warn(`LIX 3 (smscodes) failed (${country.code}/${service.slug}), retrying via LIX 2 — ${scErr.message}`);
        try {
          const gzResult = await grizzlysms.getNumber(service.slug, country.code);
          providerResponse = { id: gzResult.id, phone: gzResult.phone, price: 0 };
          usedProvider = 'grizzlysms';
        } catch (gzErr) {
          logger.error(`LIX 2 (GrizzlySMS) also failed — ${gzErr.message}`);
          throw new AppError('PROVIDER_ERROR', 502, NO_NUMBER_MSG);
        }
      }
    } else {
      // LIX 1 (default) = 5sim. Buy the best-delivery operator with stock, fall
      // through the next-best, then 'any'; finally fall back to LIX 2. Break on
      // first good number (single charge); cancel a malformed allocation so we
      // never pay twice.
      const ranked = await rankFiveSimOperators(countryName, service.slug);
      const candidates = [...ranked.slice(0, 3), 'any'];
      let lastErr = null;
      for (const op of candidates) {
        try {
          const bought = await fivesim.buyNumber(countryName, op, service.slug);
          if (bought?.phone && bought?.id) {
            providerResponse = bought;
            usedProvider = 'fivesim';
            logger.info(`LIX 1 (5sim) bought via operator '${op}' for ${countryName}/${service.slug}`);
            break;
          }
          if (bought?.id) { try { await fivesim.cancelOrder(bought.id); } catch (_) {} }
        } catch (err) {
          lastErr = err;
        }
      }
      if (!usedProvider) {
        const fivesimDetail = lastErr?.response?.data || lastErr?.message || 'no operator had stock';
        logger.warn(`LIX 1 (5sim) failed all operators, retrying via LIX 2 — ${JSON.stringify(fivesimDetail)}`);
        try {
          const gzResult = await grizzlysms.getNumber(service.slug, country.code);
          providerResponse = { id: gzResult.id, phone: gzResult.phone, price: 0 };
          usedProvider = 'grizzlysms';
        } catch (gzErr) {
          logger.error(`LIX 2 (GrizzlySMS) also failed — ${gzErr.message}`);
          throw new AppError('PROVIDER_ERROR', 502, NO_NUMBER_MSG);
        }
      }
    }

    // Safety net: a provider can return a malformed response (e.g. a number with
    // no id). Catch it BEFORE charging — otherwise providerResponse.id.toString()
    // throws mid-transaction AFTER the spend, forcing a charge-then-refund. If we
    // got a partial allocation (id but no phone, or vice versa), release it.
    if (!providerResponse?.id || !providerResponse?.phone) {
      logger.error(`Order aborted — malformed ${usedProvider} response: ${JSON.stringify(providerResponse)}`);
      try {
        if (providerResponse?.id) {
          if (usedProvider === 'grizzlysms') await grizzlysms.setStatus(String(providerResponse.id), 8);
          else if (usedProvider === 'fivesim') await fivesim.cancelOrder(String(providerResponse.id));
        }
      } catch (_) {}
      throw new AppError('PROVIDER_ERROR', 502, NO_NUMBER_MSG);
    }

    logger.info(`OTP order ${countryName}/${service.slug}: ${chargeCredits}cr via ${SERVER_LABEL[usedProvider] || usedProvider}`);

    const timeoutMinutes = await getSettingNum('number_timeout_minutes', 20);

    // Deduct credits
    await spendCredits(userId, chargeCredits, `Number rental: ${country.flagEmoji} ${country.name} - ${service.name}`);

    // Atomic order creation with re-check inside a session — prevents concurrent
    // requests that all passed the pre-check from exceeding the active number cap.
    let order;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const activeCount = await NumberOrder.countDocuments({ userId, status: 'ACTIVE' }).session(session);
        if (activeCount >= user.maxActiveNumbers) {
          throw new AppError('MAX_NUMBERS_REACHED', 429, `Maximum ${user.maxActiveNumbers} active numbers allowed`);
        }
        const [created] = await NumberOrder.create([{
          userId,
          countryId,
          serviceId,
          phoneNumber: providerResponse.phone,
          providerOrderId: providerResponse.id.toString(),
          provider: usedProvider,
          creditsCharged: chargeCredits,
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + timeoutMinutes * 60 * 1000),
        }], { session });
        order = created;
      });
    } catch (err) {
      session.endSession();
      // ANY post-spend failure must refund + release the provider order.
      // Previously only MAX_NUMBERS_REACHED was refunded — DB errors, etc.,
      // would silently swallow the user's credits.
      try {
        await refundCredits(
          userId,
          chargeCredits,
          `Refund: order creation failed (${err.code || 'INTERNAL_ERROR'}) — ${country.flagEmoji} ${country.name}`
        );
      } catch (refundErr) {
        logger.error(`CRITICAL: failed to refund ${chargeCredits}cr to user ${userId} after order failure: ${refundErr.message}`);
      }
      try {
        if (usedProvider === 'grizzlysms') {
          await grizzlysms.setStatus(providerResponse.id.toString(), 8);
        } else if (usedProvider === 'smscodes') {
          /* smscodes has no cancel endpoint — it only bills on code delivery */
        } else {
          await fivesim.cancelOrder(providerResponse.id.toString());
        }
      } catch (_) {}
      throw err;
    }
    session.endSession();

    // Start SMS polling
    smsPoller.startPolling(order);

    success(res, {
      order: {
        id: order._id,
        phoneNumber: order.phoneNumber,
        country: { name: country.name, flagEmoji: country.flagEmoji },
        service: { name: service.name, icon: service.icon },
        expiresAt: order.expiresAt,
        creditsCharged: chargeCredits,
        status: order.status,
        server: SERVER_LABEL[usedProvider] || 'LIX 1',
      },
    }, 201);
  } catch (err) {
    next(err);
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const order = await NumberOrder.findOne({ _id: req.params.orderId, userId: req.user.userId })
      .populate('countryId', 'name code flagEmoji')
      .populate('serviceId', 'name slug icon');
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
    success(res, { order: formatOrder(order) });
  } catch (err) {
    next(err);
  }
};

exports.getActiveOrders = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Return ACTIVE orders + COMPLETED orders from the last 30 min
    // The 30-min window ensures the user can always see their code even if the
    // socket event was missed — they just need to return to this page within 30 min
    const orders = await NumberOrder.find({
      userId,
      $or: [
        { status: 'ACTIVE' },
        { status: 'COMPLETED', smsReceivedAt: { $gte: thirtyMinutesAgo } },
      ],
    })
      .populate('countryId', 'name code flagEmoji')
      .populate('serviceId', 'name slug icon')
      .sort({ createdAt: -1 });

    success(res, { orders: orders.map(formatOrder) });
  } catch (err) {
    next(err);
  }
};

exports.getOrderHistory = async (req, res, next) => {
  try {
    const p = Math.max(1, parseInt(req.query.page) || 1);
    const l = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
    const skip = (p - 1) * l;
    const filter = { userId: req.user.userId, status: { $ne: 'ACTIVE' } };
    if (req.query.status) filter.status = req.query.status;

    const [orders, total] = await Promise.all([
      NumberOrder.find(filter)
        .populate('countryId', 'name code flagEmoji')
        .populate('serviceId', 'name slug icon')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(l),
      NumberOrder.countDocuments(filter),
    ]);

    success(res, { orders: orders.map(formatOrder), total, page: p, pages: Math.ceil(total / l) });
  } catch (err) {
    next(err);
  }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await NumberOrder.findOne({ _id: req.params.orderId, userId: req.user.userId });
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
    if (order.status !== 'ACTIVE') throw new AppError('VALIDATION_ERROR', 400, 'Order is not active');

    // Cancel on provider
    if (order.provider === 'smspool') {
      try { await smspool.refundRental(order.providerOrderId); } catch (_) {}
    } else if (order.provider === 'grizzlysms') {
      if (order.orderType === 'RENTAL') {
        try { await grizzlysms.setRentStatus(order.providerOrderId, 1); } catch (_) {}
      } else {
        try { await grizzlysms.setStatus(order.providerOrderId, 8); } catch (_) {}
      }
    } else if (order.provider === 'getsmsotp') {
      try { await getsmsotp.setStatus(order.providerOrderId, 8); } catch (_) {}
    } else if (order.provider === 'smscodes') {
      /* smscodes has no cancel endpoint — only billed on code delivery */
    } else if (order.provider !== 'smsactivate') {
      try { await fivesim.cancelOrder(order.providerOrderId); } catch (_) {}
    }

    smsPoller.stopPolling(order._id.toString());

    if (order.orderType === 'RENTAL') {
      // Rentals: no refund — user paid for time
      await NumberOrder.findByIdAndUpdate(order._id, { status: 'CANCELLED' });
      success(res, { refunded: false, creditsRefunded: 0 });
    } else {
      // Guard against SMS harvest: DB state may lag the 5-second poll window.
      // Do a live provider check so a user can't cancel within the polling gap,
      // get a refund, and keep the SMS code they already saw on their service.
      let hasSms = !!order.smsContent;
      if (!hasSms) {
        try {
          if (order.provider === 'grizzlysms') {
            const statusStr = await grizzlysms.getStatus(order.providerOrderId);
            if (statusStr?.startsWith('STATUS_OK')) {
              hasSms = true;
              const code = statusStr.split(':')[1] || null;
              await NumberOrder.findByIdAndUpdate(order._id, {
                smsContent: code ? `Your code: ${code}` : 'SMS received',
                smsCode: code,
                smsReceivedAt: new Date(),
                status: 'COMPLETED',
              });
            }
          } else if (order.provider !== 'smsactivate') {
            const live = await fivesim.checkOrder(order.providerOrderId);
            if (live?.sms?.length > 0) {
              hasSms = true;
              await NumberOrder.findByIdAndUpdate(order._id, {
                smsContent: live.sms[0].text,
                smsReceivedAt: new Date(),
                status: 'COMPLETED',
              });
            }
          }
        } catch (_) {
          logger.warn(`Live SMS check failed for order ${order._id} during cancel`);
        }
      }

      const refund = !hasSms;
      if (refund) {
        await refundCredits(order.userId, order.creditsCharged, `Refund: cancelled number ${order.phoneNumber}`);
        await NumberOrder.findByIdAndUpdate(order._id, { status: 'REFUNDED' });
      } else {
        await NumberOrder.findByIdAndUpdate(order._id, { status: 'CANCELLED' });
      }
      success(res, { refunded: refund, creditsRefunded: refund ? order.creditsCharged : 0 });
    }
  } catch (err) {
    next(err);
  }
};

exports.resendSMS = async (req, res, next) => {
  try {
    const order = await NumberOrder.findOne({ _id: req.params.orderId, userId: req.user.userId });
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
    if (order.status !== 'ACTIVE') throw new AppError('VALIDATION_ERROR', 400, 'Order is not active');
    // Re-start polling if stopped
    smsPoller.startPolling(order);
    success(res, { message: 'Waiting for SMS...' });
  } catch (err) {
    next(err);
  }
};

exports.getRentalPrice = async (req, res, next) => {
  try {
    const { countryId } = req.params;
    const { serviceId, serviceSlug: slugParam } = req.query;

    const country = await Country.findById(countryId);
    if (!country || !country.isEnabled) throw new AppError('NOT_FOUND', 404, 'Country not found');

    // serviceId may be a Mongo ObjectId (legacy DB-backed service) OR a raw slug
    // (dynamic catalog entry that has no DB record yet). Handle both.
    let service = null;
    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
      service = await Service.findById(serviceId);
    }
    if (!service && (slugParam || serviceId)) {
      const lookupSlug = slugParam || serviceId;
      service = await Service.findOne({ slug: lookupSlug });
    }
    const serviceSlug =
      service?.slug ||
      slugParam ||
      (serviceId && !mongoose.Types.ObjectId.isValid(serviceId) ? serviceId : null) ||
      'whatsapp';

    const toOptions = (prices) => RENTAL_DURATION_OPTIONS.map((days) => ({
      days,
      label: RENTAL_DURATION_LABELS[days],
      price: prices?.[days] ?? null,
    }));

    // LIX 1 (get-sms) always; LIX 2 (SMSPVA) only when flag-enabled — fetched
    // in parallel so the slower provider never delays the other.
    const [lix1Prices, lix2Prices] = await Promise.all([
      getRentalPrices('getsms', country.code, serviceSlug),
      smspvaRentalEnabled() ? getRentalPrices('smspva', country.code, serviceSlug) : Promise.resolve(null),
    ]);

    const options = toOptions(lix1Prices);
    const available = !!lix1Prices && options.some((o) => o.price !== null);

    let serviceInfo = service ? { name: service.name, slug: service.slug } : null;
    if (!serviceInfo) {
      // Look up display name from dynamic catalog so the UI still has something to show
      const catalog = await getsms.getServiceCatalog();
      const entry = catalog.find((c) => c.slug === serviceSlug);
      if (entry) serviceInfo = { name: entry.name, slug: entry.slug };
    }

    const payload = {
      available,
      country: { name: country.name, flagEmoji: country.flagEmoji },
      service: serviceInfo,
      options: available ? options : [],
    };

    // Tiered shape, present only when LIX 2 rentals are enabled. `available`
    // and `options` above keep the legacy (single-tier) meaning so older
    // clients are unaffected.
    if (smspvaRentalEnabled()) {
      const lix2Options = toOptions(lix2Prices);
      const lix2Available = !!lix2Prices && lix2Options.some((o) => o.price !== null);
      payload.available = available || lix2Available;
      payload.tiers = {
        lix1: { available, options: available ? options : [] },
        lix2: { available: lix2Available, options: lix2Available ? lix2Options : [] },
      };
    }

    success(res, payload);
  } catch (err) {
    next(err);
  }
};

exports.orderRental = async (req, res, next) => {
  try {
    const { countryId, serviceId, days, server } = req.body;
    const userId = req.user.userId;

    const numDays = Number(days);
    if (!RENTAL_DURATION_OPTIONS.includes(numDays)) {
      throw new AppError('VALIDATION_ERROR', 400, `days must be one of ${RENTAL_DURATION_OPTIONS.join(', ')}`);
    }

    // Rental tier: lix1 (get-sms, default) or lix2 (SMSPVA, flag-gated)
    const rentalTier = server || 'lix1';
    const provider = RENTAL_TIER_PROVIDER[rentalTier];
    if (!provider || (provider === 'smspva' && !smspvaRentalEnabled())) {
      throw new AppError('VALIDATION_ERROR', 400, 'Unknown rental server');
    }
    const providerModule = RENTAL_PROVIDER_MODULE[provider];

    const user = await User.findById(userId);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    const activeCount = await NumberOrder.countDocuments({ userId, status: 'ACTIVE' });
    if (activeCount >= user.maxActiveNumbers) {
      throw new AppError('MAX_NUMBERS_REACHED', 429, `Maximum ${user.maxActiveNumbers} active numbers allowed`);
    }

    const country = await Country.findById(countryId);
    if (!country) throw new AppError('NOT_FOUND', 404, 'Country not found');

    // serviceId may be a Mongo ObjectId OR a raw slug from the dynamic catalog.
    // Resolve to a Service record, lazy-creating one if the slug exists in the catalog.
    let service = null;
    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
      service = await Service.findById(serviceId);
    }
    if (!service && serviceId && !mongoose.Types.ObjectId.isValid(serviceId)) {
      service = await Service.findOne({ slug: serviceId });
      if (!service) {
        const catalog = await getsms.getServiceCatalog();
        const entry = catalog.find((c) => c.slug === serviceId);
        if (entry) {
          service = await Service.findOneAndUpdate(
            { slug: entry.slug },
            { $setOnInsert: { slug: entry.slug, name: entry.name, isEnabled: true } },
            { upsert: true, new: true }
          );
        }
      }
    }
    if (!service) throw new AppError('VALIDATION_ERROR', 400, 'serviceId is required for rental');

    const prices = await getRentalPrices(provider, country.code, service.slug);
    const chargeCredits = prices?.[numDays];
    if (!chargeCredits) {
      throw new AppError('NOT_FOUND', 404, `${numDays}-day rental not available for ${service.name} in ${country.name}`);
    }

    if (user.creditBalance < chargeCredits) {
      throw new AppError('INSUFFICIENT_CREDITS', 402, `Need ${chargeCredits} credits, you have ${user.creditBalance}`);
    }

    // Rent the number BEFORE charging, so a provider outage never costs the user
    // credits. get-sms.com occasionally 500s ("Internal server error") on its order
    // endpoint — surface that as a clean, reassuring message instead of a raw 500.
    let result;
    try {
      result = await providerModule.getNumber(country.code, service.slug, numDays);
    } catch (err) {
      logger.warn(`Rental getNumber failed (${provider} ${country.code}/${service.slug}, ${numDays}d): ${err.message}`);
      throw new AppError('PROVIDER_ERROR', 502, 'Number rentals are temporarily unavailable. Please try again in a couple of minutes.');
    }

    await spendCredits(userId, chargeCredits, `${numDays}-day rental: ${country.flagEmoji} ${country.name} - ${service.name}`);

    let order;
    try {
      order = await NumberOrder.create({
        userId,
        countryId,
        serviceId: service._id,
        phoneNumber: result.phone,
        providerOrderId: result.id,
        provider,
        creditsCharged: chargeCredits,
        orderType: 'RENTAL',
        rentalDays: numDays,
        countryCode: country.code,
        status: 'ACTIVE',
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      // Post-spend failure: refund + release provider rental.
      try {
        await refundCredits(userId, chargeCredits, `Refund: rental order create failed — ${country.flagEmoji} ${country.name}`);
      } catch (refundErr) {
        logger.error(`CRITICAL: rental refund failed for user ${userId}, ${chargeCredits}cr: ${refundErr.message}`);
      }
      try { await providerModule.cancel(result.id); } catch (_) {}
      throw err;
    }

    smsPoller.startPolling(order);

    logger.info(`Rental ${numDays}-day ${country.code}/${service.slug} via ${SERVER_LABEL[provider]} (${provider}): ${chargeCredits}cr`);

    success(res, {
      order: {
        id: order._id,
        phoneNumber: result.phone,
        country: { name: country.name, flagEmoji: country.flagEmoji },
        service: { name: service.name },
        expiresAt: order.expiresAt,
        creditsCharged: chargeCredits,
        rentalDays: numDays,
        orderType: 'RENTAL',
        status: order.status,
        note: `Dedicated ${service.name} number — active for ${numDays} days.`,
      },
    }, 201);
  } catch (err) {
    next(err);
  }
};

// ─── Dashboard widgets ────────────────────────────────────────────────────────

/** GET /numbers/usage-sparkline — last 7 days of orders + credits spent */
exports.getUsageSparkline = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - SEVEN_DAYS_MS);

    const orderAgg = await NumberOrder.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          credits: { $sum: '$creditsCharged' },
        },
      },
    ]);

    const byDay = Object.fromEntries(orderAgg.map((d) => [d._id, { orders: d.orders, credits: d.credits }]));

    // Build a contiguous 7-day series ending today
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const entry = byDay[key] || { orders: 0, credits: 0 };
      days.push({ date: key, orders: entry.orders, credits: entry.credits });
    }

    const totalOrders = days.reduce((s, d) => s + d.orders, 0);
    const totalCredits = days.reduce((s, d) => s + d.credits, 0);

    success(res, { days, totalOrders, totalCredits });
  } catch (err) {
    next(err);
  }
};

/** GET /numbers/trending — global top services ordered in last 24h */
exports.getTrendingServices = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const agg = await NumberOrder.aggregate([
      { $match: { createdAt: { $gte: since }, serviceId: { $ne: null } } },
      { $group: { _id: '$serviceId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: '_id',
          as: 'service',
        },
      },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: 0,
          id: '$service._id',
          slug: '$service.slug',
          name: '$service.name',
          icon: '$service.icon',
          count: 1,
        },
      },
    ]);

    success(res, { trending: agg });
  } catch (err) {
    next(err);
  }
};

/** GET /numbers/recent-sms — last 10 received SMS across user's orders */
exports.getRecentSms = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // OTP single-SMS orders (skip scrubbed placeholders)
    const otpOrders = await NumberOrder.find({
      userId,
      smsContent: { $nin: [null, '[deleted]'] },
      smsReceivedAt: { $ne: null },
    })
      .sort({ smsReceivedAt: -1 })
      .limit(15)
      .populate('countryId', 'name flagEmoji')
      .populate('serviceId', 'name slug')
      .select('_id phoneNumber smsContent smsCode smsReceivedAt countryId serviceId rentalServiceSlug orderType');

    // RENTAL orders with embedded smsMessages — fan out the messages
    const rentalOrders = await NumberOrder.find({
      userId,
      orderType: 'RENTAL',
      'smsMessages.0': { $exists: true },
    })
      .sort({ updatedAt: -1 })
      .limit(15)
      .populate('countryId', 'name flagEmoji')
      .populate('serviceId', 'name slug')
      .select('_id phoneNumber smsMessages countryId serviceId rentalServiceSlug orderType');

    const items = [];

    for (const o of otpOrders) {
      items.push({
        orderId: o._id,
        phoneNumber: o.phoneNumber,
        text: o.smsContent,
        code: o.smsCode,
        receivedAt: o.smsReceivedAt,
        country: o.countryId ? { name: o.countryId.name, flagEmoji: o.countryId.flagEmoji } : null,
        service: o.serviceId
          ? { name: o.serviceId.name, slug: o.serviceId.slug }
          : (o.rentalServiceSlug ? { name: o.rentalServiceSlug, slug: o.rentalServiceSlug } : null),
        orderType: o.orderType,
      });
    }

    for (const o of rentalOrders) {
      for (const msg of o.smsMessages) {
        items.push({
          orderId: o._id,
          phoneNumber: o.phoneNumber,
          text: msg.text,
          code: msg.code,
          receivedAt: msg.receivedAt,
          country: o.countryId ? { name: o.countryId.name, flagEmoji: o.countryId.flagEmoji } : null,
          service: o.serviceId
            ? { name: o.serviceId.name, slug: o.serviceId.slug }
            : (o.rentalServiceSlug ? { name: o.rentalServiceSlug, slug: o.rentalServiceSlug } : null),
          orderType: o.orderType,
        });
      }
    }

    items.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    success(res, { messages: items.slice(0, 10) });
  } catch (err) {
    next(err);
  }
};
