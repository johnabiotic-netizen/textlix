const mongoose = require('mongoose');
const Country = require('../models/Country');
const Service = require('../models/Service');
const NumberPricing = require('../models/NumberPricing');
const NumberOrder = require('../models/NumberOrder');
const User = require('../models/User');
const { spendCredits, refundCredits } = require('../services/credit.service');
const smsPoller = require('../services/sms-poller.service');
const fivesim = require('../providers/sms/fivesim.provider');
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

const MARGIN = 0.60;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Cache: serviceSlug → { countrySlug → { maxPrice, bestRate, totalCount } }
const serviceMaxPriceCache = new Map();

/**
 * Returns price + rate data for a service across all countries/operators.
 * Shape: { countrySlug → { maxPrice (USD), bestRate (0-1), totalCount } }
 */
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
        // 5sim rate can come back as 0-1 decimal or 0-100 percentage; normalise to 0-1
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
    return null;
  }
}

/** Warm price cache for the most popular services on server startup */
const TOP_SERVICES = ['whatsapp', 'telegram', 'google', 'instagram', 'facebook', 'tiktok', 'twitter'];
exports.warmPriceCache = async function warmPriceCache() {
  for (const slug of TOP_SERVICES) {
    try {
      await getMaxPrices(slug);
      await new Promise((r) => setTimeout(r, 300)); // small delay to avoid hammering 5sim
    } catch (_) {}
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
    const finalPrice   = Math.ceil(providerCost * (1 + MARGIN));
    ops.push({
      updateOne: {
        filter: { countryId: country._id, serviceId: svc._id },
        update: { $set: { providerCost, finalPrice, marginPercent: 60, isAvailable: true } },
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
  return Math.ceil(Math.ceil(data.maxPrice * 100) * (1 + MARGIN));
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

// ─── Hosting (rental) price cache ────────────────────────────────────────────
const hostingMaxPriceCache = new Map();

async function getHostingMaxPrices(serviceSlug) {
  const cached = hostingMaxPriceCache.get(serviceSlug);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const raw = await fivesim.getHostingPrices(serviceSlug);
    const byCountry = raw[serviceSlug] || {};
    const maxPrices = {};

    for (const [countrySlug, operators] of Object.entries(byCountry)) {
      let max = 0;
      let bestRate = 0;
      for (const opData of Object.values(operators)) {
        if (opData.cost > max) max = opData.cost;
        const rawRate = opData.rate || 0;
        const normRate = rawRate > 1 ? rawRate / 100 : rawRate;
        if (normRate > bestRate) bestRate = normRate;
      }
      if (max > 0) maxPrices[countrySlug] = { cost: max, bestRate };
    }

    hostingMaxPriceCache.set(serviceSlug, { data: maxPrices, expiresAt: Date.now() + CACHE_TTL });
    return maxPrices;
  } catch (err) {
    logger.warn(`getHostingMaxPrices failed for ${serviceSlug}:`, err.message);
    return null;
  }
}

// Hosting services 5sim actually supports — ordered by popularity
const HOSTING_SERVICES = ['whatsapp', 'telegram', 'google', 'instagram', 'facebook', 'tiktok', 'twitter', 'discord', 'snapchat', 'amazon'];

/** Rental price per day in credits for a country+service combo */
async function getRentalDailyCredits(country5simSlug, serviceSlug) {
  const maxPrices = await getHostingMaxPrices(serviceSlug);
  const entry = maxPrices?.[country5simSlug];
  if (!entry) return null;
  return Math.ceil(Math.ceil(entry.cost * 100) * (1 + MARGIN));
}

const RENTAL_DURATION_OPTIONS = [1, 7, 30];

const SERVICE_LABELS = {
  whatsapp: 'WhatsApp', telegram: 'Telegram', google: 'Google', instagram: 'Instagram',
  facebook: 'Facebook', tiktok: 'TikTok', twitter: 'Twitter / X', discord: 'Discord',
  snapchat: 'Snapchat', amazon: 'Amazon',
};

/** List all enabled services with country counts */
exports.getServiceList = async (req, res, next) => {
  try {
    const { mode = 'otp' } = req.query;

    if (mode === 'rental') {
      // For rental, only return services 5sim supports for hosting
      // Fetch hosting price data for each in parallel to get country counts
      const priceResults = await Promise.all(
        HOSTING_SERVICES.map((slug) =>
          getHostingMaxPrices(slug).then((data) => ({ slug, data }))
        )
      );

      // Count how many countries have availability per service
      const allCountries = await Country.find({ isEnabled: true });
      const result = [];
      for (const { slug, data } of priceResults) {
        if (!data) continue;
        let countryCount = 0;
        let minPriceUSD = Infinity;
        for (const country of allCountries) {
          const csSlug = country.fivesimSlug || ISO_TO_SLUG[country.code] || country.code.toLowerCase();
          const entry = data[csSlug];
          if (!entry) continue;
          countryCount++;
          if (entry.cost < minPriceUSD) minPriceUSD = entry.cost;
        }
        if (countryCount === 0) continue;
        const minPrice = Math.ceil(Math.ceil(minPriceUSD * 100) * (1 + MARGIN));
        result.push({ slug, name: SERVICE_LABELS[slug] || slug, countryCount, minPrice });
      }
      return success(res, { services: result });
    }

    // OTP mode — query from Service + NumberPricing
    const services = await Service.find({ isEnabled: true }).sort({ sortOrder: 1, name: 1 });
    const serviceIds = services.map((s) => s._id);

    const counts = await NumberPricing.aggregate([
      { $match: { serviceId: { $in: serviceIds }, isAvailable: true } },
      { $group: { _id: '$serviceId', countryCount: { $sum: 1 }, minPrice: { $min: '$finalPrice' } } },
    ]);
    const countMap = {};
    for (const c of counts) countMap[c._id.toString()] = { countryCount: c.countryCount, minPrice: c.minPrice };

    const result = services
      .filter((s) => countMap[s._id.toString()]?.countryCount > 0)
      .map((s) => ({
        id: s._id,
        name: s.name,
        slug: s.slug,
        icon: s.icon,
        countryCount: countMap[s._id.toString()]?.countryCount || 0,
        minPrice: countMap[s._id.toString()]?.minPrice || 0,
      }));

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
        price: Math.ceil(Math.ceil(data.maxPrice * 100) * (1 + MARGIN)),
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
      // Fetch hosting prices for this service and return countries that have availability
      const maxPrices = await getHostingMaxPrices(serviceSlug);
      if (!maxPrices) return success(res, { countries: [] });

      // Build reverse map: 5sim slug → country doc
      const allCountries = await Country.find({ isEnabled: true });
      const result = [];
      for (const country of allCountries) {
        const slug = country.fivesimSlug || ISO_TO_SLUG[country.code] || country.code.toLowerCase();
        const entry = maxPrices[slug];
        if (!entry) continue;
        const pricePerDay = Math.ceil(Math.ceil(entry.cost * 100) * (1 + MARGIN));
        const successRate = entry.bestRate > 0 ? Math.min(100, Math.round(entry.bestRate * 1000) / 10) : null;
        result.push({
          id: country._id,
          name: country.name,
          code: country.code,
          flagEmoji: country.flagEmoji,
          pricePerDay,
          minPrice: pricePerDay,
          successRate,
        });
      }
      result.sort((a, b) => a.name.localeCompare(b.name));
      return success(res, { countries: result });
    }

    // OTP mode — look up from NumberPricing
    const svc = await Service.findOne({ slug: serviceSlug, isEnabled: true });
    if (!svc) throw new AppError('NOT_FOUND', 404, 'Service not found');

    const pricing = await NumberPricing.find({ serviceId: svc._id, isAvailable: true }).populate('countryId');
    const maxPrices = await getMaxPrices(serviceSlug);

    const result = [];
    for (const p of pricing) {
      const c = p.countryId;
      if (!c || !c.isEnabled) continue;
      const slug = c.fivesimSlug || ISO_TO_SLUG[c.code] || c.code.toLowerCase();
      const livePrice = maxPrices?.[slug];
      const price = livePrice != null ? Math.ceil(Math.ceil(livePrice * 100) * (1 + MARGIN)) : p.finalPrice;
      const available = maxPrices != null ? livePrice > 0 : p.isAvailable;
      if (!available) continue;
      result.push({
        id: c._id,
        name: c.name,
        code: c.code,
        flagEmoji: c.flagEmoji,
        minPrice: price,
      });
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
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
      // Fetch hosting prices for all supported services in parallel
      const allPriceMaps = await Promise.all(
        HOSTING_SERVICES.map((slug) => getHostingMaxPrices(slug))
      );

      // For each country, find if any hosting service has availability
      const result = [];
      for (const country of countries) {
        const csSlug = country.fivesimSlug || ISO_TO_SLUG[country.code] || country.code.toLowerCase();
        let minPricePerDay = Infinity;
        let serviceCount = 0;
        let bestRate = 0;
        for (const priceMap of allPriceMaps) {
          if (!priceMap) continue;
          const entry = priceMap[csSlug];
          if (!entry) continue;
          serviceCount++;
          const pricePerDay = Math.ceil(Math.ceil(entry.cost * 100) * (1 + MARGIN));
          if (pricePerDay < minPricePerDay) minPricePerDay = pricePerDay;
          if (entry.bestRate > bestRate) bestRate = entry.bestRate;
        }
        if (serviceCount === 0) continue;
        result.push({
          id: country._id,
          name: country.name,
          code: country.code,
          flagEmoji: country.flagEmoji,
          serviceCount,
          minPrice: minPricePerDay,
          successRate: bestRate > 0 ? Math.min(100, Math.round(bestRate * 1000) / 10) : null,
        });
      }
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

exports.getServices = async (req, res, next) => {
  try {
    const { countryId } = req.params;
    const country = await Country.findById(countryId);
    if (!country || !country.isEnabled) throw new AppError('NOT_FOUND', 404, 'Country not found');

    const pricing = await NumberPricing.find({ countryId }).populate('serviceId');

    const fivesimSlug = country.fivesimSlug || ISO_TO_SLUG[country.code] || country.code.toLowerCase();

    // Sort first so indices stay stable when we zip with price results
    const enabledPricing = pricing
      .filter((p) => p.serviceId && p.serviceId.isEnabled)
      .sort((a, b) => a.serviceId.sortOrder - b.serviceId.sortOrder);

    // Fetch live prices, raw max-price maps, and per-service success rates in parallel
    const [priceResults, liveMaxMaps, serviceRates] = await Promise.all([
      Promise.all(enabledPricing.map((p) => getChargeCredits(fivesimSlug, p.serviceId.slug, p.finalPrice))),
      Promise.all(enabledPricing.map((p) => getMaxPrices(p.serviceId.slug))),
      getServiceSuccessRates(),
    ]);

    const services = enabledPricing.map((p, i) => {
      const liveData = liveMaxMaps[i]?.[fivesimSlug];
      const available = liveMaxMaps[i] != null ? (liveData?.maxPrice > 0) : p.isAvailable;
      // Use 5sim's live rate as primary success signal; fall back to our own order history
      const fivesimRate = liveData?.bestRate != null ? Math.min(100, Math.round(liveData.bestRate * 1000) / 10) : null;
      const successRate = fivesimRate ?? serviceRates[p.serviceId._id.toString()] ?? null;
      return {
        id: p.serviceId._id,
        name: p.serviceId.name,
        slug: p.serviceId.slug,
        icon: p.serviceId.icon,
        price: priceResults[i],
        available,
        pricingId: p._id,
        successRate,
        availableCount: liveData?.totalCount ?? null,
      };
    });

    success(res, { country: { id: country._id, name: country.name, flagEmoji: country.flagEmoji }, services });
  } catch (err) {
    next(err);
  }
};

exports.orderNumber = async (req, res, next) => {
  try {
    const { countryId, serviceId } = req.body;
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

    const chargeCredits = await getChargeCredits(countryName, service.slug, pricing.finalPrice);

    if (user.creditBalance < chargeCredits) {
      throw new AppError('INSUFFICIENT_CREDITS', 402, `Need ${chargeCredits} credits, you have ${user.creditBalance}`);
    }

    // Buy number from provider before touching credits
    let providerResponse;
    try {
      providerResponse = await fivesim.buyNumber(countryName, 'any', service.slug);
    } catch (err) {
      const detail = err.response?.data || err.message;
      logger.error(`5sim buyNumber failed — country: ${countryName}, service: ${service.slug}, error:`, detail);
      throw new AppError('PROVIDER_ERROR', 502, `Could not get a number: ${JSON.stringify(detail)}`);
    }

    logger.info(`Order ${countryName}/${service.slug}: charged ${chargeCredits}cr, 5sim used $${providerResponse.price}`);

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
          provider: '5sim',
          creditsCharged: chargeCredits,
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + timeoutMinutes * 60 * 1000),
        }], { session });
        order = created;
      });
    } catch (err) {
      session.endSession();
      // Concurrent requests exceeded the cap after credits were already spent — refund and cancel
      if (err.code === 'MAX_NUMBERS_REACHED') {
        await refundCredits(userId, chargeCredits, `Refund: slot full (concurrent order) ${country.flagEmoji} ${country.name}`);
        await fivesim.cancelOrder(providerResponse.id.toString()).catch(() => {});
      }
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
      },
    }, 201);
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

    success(res, { orders });
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

    success(res, { orders, total, page: p, pages: Math.ceil(total / l) });
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
    try {
      await fivesim.cancelOrder(order.providerOrderId);
    } catch (_) {}

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
          const live = await fivesim.checkOrder(order.providerOrderId);
          if (live?.sms?.length > 0) {
            hasSms = true;
            // Write the SMS into the order so DB is consistent
            await NumberOrder.findByIdAndUpdate(order._id, {
              smsContent: live.sms[0].text,
              smsReceivedAt: new Date(),
              status: 'COMPLETED',
            });
          }
        } catch (_) {
          // Provider check failed — fall back to DB state (conservative: don't refund if uncertain)
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
    const country = await Country.findById(countryId);
    if (!country || !country.isEnabled) throw new AppError('NOT_FOUND', 404, 'Country not found');

    const countrySlug = country.fivesimSlug || ISO_TO_SLUG[country.code] || country.code.toLowerCase();

    // Fetch prices for all hosting services in parallel
    const priceResults = await Promise.all(
      HOSTING_SERVICES.map((svc) => getRentalDailyCredits(countrySlug, svc).then((p) => ({ slug: svc, pricePerDay: p })))
    );

    const availableServices = priceResults.filter((s) => s.pricePerDay != null);

    if (availableServices.length === 0) {
      return success(res, { available: false });
    }

    success(res, {
      available: true,
      services: availableServices.map((s) => ({
        slug: s.slug,
        name: SERVICE_LABELS[s.slug] || s.slug,
        pricePerDay: s.pricePerDay,
        options: RENTAL_DURATION_OPTIONS.map((days) => ({
          days,
          price: s.pricePerDay * days,
          label: days === 1 ? '1 Day' : days === 7 ? '7 Days' : '30 Days',
        })),
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.orderRental = async (req, res, next) => {
  try {
    const { countryId, days, serviceSlug } = req.body;
    const userId = req.user.userId;

    if (!RENTAL_DURATION_OPTIONS.includes(Number(days))) {
      throw new AppError('VALIDATION_ERROR', 400, `days must be one of: ${RENTAL_DURATION_OPTIONS.join(', ')}`);
    }
    if (!serviceSlug || !HOSTING_SERVICES.includes(serviceSlug)) {
      throw new AppError('VALIDATION_ERROR', 400, `serviceSlug must be one of: ${HOSTING_SERVICES.join(', ')}`);
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    const activeCount = await NumberOrder.countDocuments({ userId, status: 'ACTIVE' });
    if (activeCount >= user.maxActiveNumbers) {
      throw new AppError('MAX_NUMBERS_REACHED', 429, `Maximum ${user.maxActiveNumbers} active numbers allowed`);
    }

    const country = await Country.findById(countryId);
    if (!country) throw new AppError('NOT_FOUND', 404, 'Country not found');

    const countrySlug = country.fivesimSlug || ISO_TO_SLUG[country.code] || country.code.toLowerCase();

    const dailyCredits = await getRentalDailyCredits(countrySlug, serviceSlug);
    if (!dailyCredits) {
      throw new AppError('NOT_FOUND', 404, `Rental not available for ${serviceSlug} in this country`);
    }

    const chargeCredits = dailyCredits * Number(days);

    if (user.creditBalance < chargeCredits) {
      throw new AppError('INSUFFICIENT_CREDITS', 402, `Need ${chargeCredits} credits, you have ${user.creditBalance}`);
    }

    // Buy hosting number for the specific service
    let providerResponse;
    try {
      providerResponse = await fivesim.buyHostingNumber(countrySlug, 'any', serviceSlug);
    } catch (err) {
      const detail = err.response?.data || err.message;
      logger.error(`5sim buyHostingNumber failed — ${countrySlug}/${serviceSlug}:`, detail);
      throw new AppError('PROVIDER_ERROR', 502, `Could not get a rental number: ${JSON.stringify(detail)}`);
    }

    logger.info(`Rental order ${countrySlug}/${serviceSlug}: ${days}d, charged ${chargeCredits}cr`);

    await spendCredits(userId, chargeCredits, `${days}-day rental: ${country.flagEmoji} ${country.name} - ${SERVICE_LABELS[serviceSlug] || serviceSlug}`);

    const order = await NumberOrder.create({
      userId,
      countryId,
      serviceId: null,
      phoneNumber: providerResponse.phone,
      providerOrderId: providerResponse.id.toString(),
      provider: '5sim',
      creditsCharged: chargeCredits,
      orderType: 'RENTAL',
      rentalDays: Number(days),
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000),
    });

    smsPoller.startPolling(order);

    success(res, {
      order: {
        id: order._id,
        phoneNumber: order.phoneNumber,
        country: { name: country.name, flagEmoji: country.flagEmoji },
        service: { name: SERVICE_LABELS[serviceSlug] || serviceSlug, slug: serviceSlug },
        expiresAt: order.expiresAt,
        creditsCharged: chargeCredits,
        rentalDays: order.rentalDays,
        orderType: 'RENTAL',
        status: order.status,
      },
    }, 201);
  } catch (err) {
    next(err);
  }
};
