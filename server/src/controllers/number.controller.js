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

// Map country code to 5sim country name (5sim uses lowercase full names)
const countryCodeTo5sim = {
  US: 'usa', GB: 'england', IN: 'india', NG: 'nigeria', RU: 'russia',
  BR: 'brazil', DE: 'germany', FR: 'france', CA: 'canada', AU: 'australia',
  ID: 'indonesia', PH: 'philippines', VN: 'vietnam', MX: 'mexico',
  PK: 'pakistan', BD: 'bangladesh', KE: 'kenya', GH: 'ghana',
  ZA: 'southafrica', UA: 'ukraine',
};

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

    const pricing = await NumberPricing.find({ countryId, isAvailable: true }).populate('serviceId');

    const services = pricing
      .filter((p) => p.serviceId && p.serviceId.isEnabled)
      .sort((a, b) => a.serviceId.sortOrder - b.serviceId.sortOrder)
      .map((p) => ({
        id: p.serviceId._id,
        name: p.serviceId.name,
        slug: p.serviceId.slug,
        icon: p.serviceId.icon,
        price: p.finalPrice,
        providerCost: p.providerCost,
        available: p.isAvailable,
        pricingId: p._id,
      }));

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
    if (user.creditBalance < pricing.finalPrice) {
      throw new AppError('INSUFFICIENT_CREDITS', 402, `Need ${pricing.finalPrice} credits, you have ${user.creditBalance}`);
    }

    // Buy number from provider
    const countryName = countryCodeTo5sim[country.code] || country.code.toLowerCase();
    let providerResponse;
    try {
      providerResponse = await fivesim.buyNumber(countryName, 'any', service.slug);
    } catch (err) {
      throw new AppError('PROVIDER_ERROR', 502, 'Could not get a number right now. Please try again.');
    }

    const timeoutMinutes = await getSettingNum('number_timeout_minutes', 20);

    // Deduct credits
    await spendCredits(userId, pricing.finalPrice, `Number rental: ${country.flagEmoji} ${country.name} - ${service.name}`);

    // Create order
    const order = await NumberOrder.create({
      userId,
      countryId,
      serviceId,
      phoneNumber: providerResponse.phone,
      providerOrderId: providerResponse.id.toString(),
      provider: '5sim',
      creditsCharged: pricing.finalPrice,
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
        creditsCharged: order.creditsCharged,
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
