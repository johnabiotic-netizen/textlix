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

// Simple in-memory cache for real-time 5sim prices (per country, 10 min TTL)
const priceCache = new Map(); // key: fivesimSlug, value: { data, expiresAt }
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MARGIN = 0.60;

async function getLiveProducts(fivesimSlug) {
  const cached = priceCache.get(fivesimSlug);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  try {
    const data = await fivesim.getProducts(fivesimSlug, 'any');
    priceCache.set(fivesimSlug, { data, expiresAt: Date.now() + CACHE_TTL });
    return data;
  } catch (err) {
    logger.warn(`Price cache miss for ${fivesimSlug}:`, err.message);
    return null;
  }
}

exports.getCountries = async (req, res, next) => {
  try {
    const countries = await Country.find({ isEnabled: true }).sort({ sortOrder: 1, name: 1 });

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

    // Fetch real-time prices from 5sim (cached 10 min) so displayed price always matches charge
    const fivesimSlug = country.fivesimSlug || ISO_TO_SLUG[country.code] || country.code.toLowerCase();
    const liveProducts = await getLiveProducts(fivesimSlug);

    const services = pricing
      .filter((p) => p.serviceId && p.serviceId.isEnabled)
      .sort((a, b) => a.serviceId.sortOrder - b.serviceId.sortOrder)
      .map((p) => {
        const live = liveProducts?.[p.serviceId.slug];
        const available = !!(live && live.Price > 0 && live.Qty > 0);
        const providerCost = available ? Math.ceil(live.Price * 100) : p.providerCost;
        const price = available ? Math.ceil(providerCost * (1 + MARGIN)) : p.finalPrice;
        return {
          id: p.serviceId._id,
          name: p.serviceId.name,
          slug: p.serviceId.slug,
          icon: p.serviceId.icon,
          price,
          available,
          pricingId: p._id,
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

    // Check active number limit
    const activeCount = await NumberOrder.countDocuments({ userId, status: 'ACTIVE' });
    if (activeCount >= user.maxActiveNumbers) {
      throw new AppError('MAX_NUMBERS_REACHED', 429, `Maximum ${user.maxActiveNumbers} active numbers allowed`);
    }

    // Get pricing
    const pricing = await NumberPricing.findOne({ countryId, serviceId, isAvailable: true });
    if (!pricing) throw new AppError('NOT_FOUND', 404, 'This number is not available');

    const country = await Country.findById(countryId);
    const service = await Service.findById(serviceId);

    if (!country || !service) throw new AppError('NOT_FOUND', 404, 'Country or service not found');

    const countryName = country.fivesimSlug || ISO_TO_SLUG[country.code] || country.code.toLowerCase();

    // Use cached estimate to verify user has roughly enough before buying
    const liveProducts = await getLiveProducts(countryName);
    const liveProduct = liveProducts?.[service.slug];
    const estimatedCost = liveProduct?.Price > 0
      ? Math.ceil(Math.ceil(liveProduct.Price * 100) * (1 + MARGIN))
      : pricing.finalPrice;

    if (user.creditBalance < estimatedCost) {
      throw new AppError('INSUFFICIENT_CREDITS', 402, `Need ~${estimatedCost} credits, you have ${user.creditBalance}`);
    }

    // Buy number first — providerResponse.price is the ACTUAL amount 5sim charged
    // (operator prices vary; 'any' picks the available operator which may cost more/less)
    let providerResponse;
    try {
      providerResponse = await fivesim.buyNumber(countryName, 'any', service.slug);
    } catch (err) {
      const detail = err.response?.data || err.message;
      logger.error(`5sim buyNumber failed — country: ${countryName}, service: ${service.slug}, error:`, detail);
      throw new AppError('PROVIDER_ERROR', 502, `Could not get a number: ${JSON.stringify(detail)}`);
    }

    // Calculate charge from the REAL price 5sim actually used
    const actualCostUSD = providerResponse.price || liveProduct?.Price || (pricing.providerCost / 100);
    const actualCostCredits = Math.ceil(actualCostUSD * 100);
    const chargeCredits = Math.ceil(actualCostCredits * (1 + MARGIN));

    logger.info(`Order ${countryName}/${service.slug}: actual 5sim price $${actualCostUSD} → ${actualCostCredits}cr cost → ${chargeCredits}cr charge`);

    // Final balance check with real price — cancel order if not enough
    if (user.creditBalance < chargeCredits) {
      try { await fivesim.cancelOrder(providerResponse.id.toString()); } catch (_) {}
      throw new AppError('INSUFFICIENT_CREDITS', 402, `Need ${chargeCredits} credits, you have ${user.creditBalance}`);
    }

    const timeoutMinutes = await getSettingNum('number_timeout_minutes', 20);

    // Deduct exact amount based on real 5sim price
    await spendCredits(userId, chargeCredits, `Number rental: ${country.flagEmoji} ${country.name} - ${service.name}`);

    // Create order
    const order = await NumberOrder.create({
      userId,
      countryId,
      serviceId,
      phoneNumber: providerResponse.phone,
      providerOrderId: providerResponse.id.toString(),
      provider: '5sim',
      creditsCharged: chargeCredits,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + timeoutMinutes * 60 * 1000),
    });

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
    const orders = await NumberOrder.find({ userId: req.user.userId, status: 'ACTIVE' })
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
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;
    const filter = { userId: req.user.userId, status: { $ne: 'ACTIVE' } };
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      NumberOrder.find(filter)
        .populate('countryId', 'name code flagEmoji')
        .populate('serviceId', 'name slug icon')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      NumberOrder.countDocuments(filter),
    ]);

    success(res, { orders, total, page: parseInt(page), pages: Math.ceil(total / limit) });
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

    const refund = !order.smsContent;
    if (refund) {
      await refundCredits(order.userId, order.creditsCharged, `Refund: cancelled number ${order.phoneNumber}`);
      await NumberOrder.findByIdAndUpdate(order._id, { status: 'REFUNDED' });
    } else {
      await NumberOrder.findByIdAndUpdate(order._id, { status: 'CANCELLED' });
    }

    success(res, { refunded: refund, creditsRefunded: refund ? order.creditsCharged : 0 });
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
