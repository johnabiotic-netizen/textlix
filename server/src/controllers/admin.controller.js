const mongoose = require('mongoose');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const Payment = require('../models/Payment');
const NumberOrder = require('../models/NumberOrder');
const Country = require('../models/Country');
const Service = require('../models/Service');
const NumberPricing = require('../models/NumberPricing');
const PlatformSettings = require('../models/PlatformSettings');
const PromoCode = require('../models/PromoCode');
const { adminAdjustCredits } = require('../services/credit.service');
const fivesim = require('../providers/sms/fivesim.provider');
const smsPoller = require('../services/sms-poller.service');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const { audit, getIP, getUA } = require('../utils/audit');

// Escape special regex characters to prevent ReDoS via user-supplied search strings
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Safe pagination helper — prevents NaN and runaway queries
const safePage = (p) => Math.max(1, parseInt(p) || 1);
const safeLimit = (l, max = 100) => Math.min(Math.max(1, parseInt(l) || 20), max);

exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      revenueToday, revenueWeek, revenueMonth, revenueTotal,
      usersTotal, usersToday, activeToday,
      activeNumbers, totalOrders,
      creditsPurchased, creditsSpent, creditsRefunded,
    ] = await Promise.all([
      Payment.aggregate([{ $match: { status: 'COMPLETED', completedAt: { $gte: startOfDay } } }, { $group: { _id: null, total: { $sum: '$amountUSD' } } }]),
      Payment.aggregate([{ $match: { status: 'COMPLETED', completedAt: { $gte: startOfWeek } } }, { $group: { _id: null, total: { $sum: '$amountUSD' } } }]),
      Payment.aggregate([{ $match: { status: 'COMPLETED', completedAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$amountUSD' } } }]),
      Payment.aggregate([{ $match: { status: 'COMPLETED' } }, { $group: { _id: null, total: { $sum: '$amountUSD' } } }]),
      User.countDocuments({ role: 'USER' }),
      User.countDocuments({ createdAt: { $gte: startOfDay } }),
      User.countDocuments({ lastLoginAt: { $gte: startOfDay } }),
      NumberOrder.countDocuments({ status: 'ACTIVE' }),
      NumberOrder.countDocuments(),
      CreditTransaction.aggregate([{ $match: { type: 'PURCHASE' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      CreditTransaction.aggregate([{ $match: { type: 'SPEND' } }, { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }]),
      CreditTransaction.aggregate([{ $match: { type: 'REFUND' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);

    const successOrders = await NumberOrder.countDocuments({ smsContent: { $ne: null } });
    const successRate = totalOrders > 0 ? Math.round((successOrders / totalOrders) * 100) : 0;

    success(res, {
      revenue: {
        today: revenueToday[0]?.total || 0,
        week: revenueWeek[0]?.total || 0,
        month: revenueMonth[0]?.total || 0,
        total: revenueTotal[0]?.total || 0,
      },
      users: { total: usersTotal, new_today: usersToday, active_today: activeToday },
      numbers: { active_now: activeNumbers, total_ordered: totalOrders, success_rate: successRate },
      credits: {
        total_purchased: creditsPurchased[0]?.total || 0,
        total_spent: creditsSpent[0]?.total || 0,
        total_refunded: creditsRefunded[0]?.total || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const { page, limit, search, status } = req.query;
    const p = safePage(page);
    const l = safeLimit(limit);
    const skip = (p - 1) * l;
    const filter = {};
    if (search) {
      const safe = escapeRegex(search.trim().slice(0, 100)); // cap length too
      filter.$or = [{ name: { $regex: safe, $options: 'i' } }, { email: { $regex: safe, $options: 'i' } }];
    }
    if (status === 'banned') filter.isBanned = true;
    if (status === 'active') filter.isBanned = false;

    const [users, total] = await Promise.all([
      User.find(filter).select('-passwordHash -resetPasswordToken -emailVerifyToken').sort({ createdAt: -1 }).skip(skip).limit(l),
      User.countDocuments(filter),
    ]);

    success(res, { users, total, page: p, pages: Math.ceil(total / l) });
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash -resetPasswordToken -emailVerifyToken');
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    const [transactions, orders, payments] = await Promise.all([
      CreditTransaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20),
      NumberOrder.find({ userId: user._id }).populate('countryId', 'name flagEmoji').populate('serviceId', 'name').sort({ createdAt: -1 }).limit(20),
      Payment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10),
    ]);

    success(res, { user, transactions, orders, payments });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { isBanned, banReason, maxActiveNumbers, role } = req.body;
    const updates = {};
    if (isBanned !== undefined) updates.isBanned = Boolean(isBanned);
    if (banReason !== undefined) updates.banReason = banReason;
    if (maxActiveNumbers !== undefined) updates.maxActiveNumbers = Math.max(1, Math.min(20, parseInt(maxActiveNumbers) || 5));
    if (role !== undefined) {
      if (!['USER', 'ADMIN'].includes(role)) throw new AppError('VALIDATION_ERROR', 400, 'Invalid role');
      updates.role = role;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-passwordHash');
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    audit('ADMIN_UPDATE_USER', { userId: req.user.userId, ip: getIP(req), userAgent: getUA(req), meta: { targetUserId: req.params.id, updates } });
    success(res, { user });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    if (user.role === 'ADMIN') throw new AppError('FORBIDDEN', 403, 'Cannot delete admin accounts');

    // Cancel active 5sim orders before removing DB records so the provider
    // doesn't keep charging the account balance after the user is gone
    const activeOrders = await NumberOrder.find({ userId: req.params.id, status: 'ACTIVE' });
    for (const order of activeOrders) {
      smsPoller.stopPolling(order._id.toString());
      try { await fivesim.cancelOrder(order.providerOrderId); } catch (_) {}
    }

    await Promise.all([
      User.findByIdAndDelete(req.params.id),
      CreditTransaction.deleteMany({ userId: req.params.id }),
      Payment.deleteMany({ userId: req.params.id }),
      NumberOrder.deleteMany({ userId: req.params.id }),
    ]);
    audit('ADMIN_DELETE_USER', { userId: req.user.userId, ip: getIP(req), userAgent: getUA(req), meta: { targetUserId: req.params.id, targetEmail: user.email } });
    success(res, { message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

exports.adjustCredits = async (req, res, next) => {
  try {
    const { amount, reason } = req.body;
    if (!amount || !reason) throw new AppError('VALIDATION_ERROR', 400, 'Amount and reason required');

    const newBalance = await adminAdjustCredits(req.params.id, parseInt(amount), reason, req.user.userId);
    audit('ADMIN_ADJUST_CREDITS', { userId: req.user.userId, ip: getIP(req), userAgent: getUA(req), meta: { targetUserId: req.params.id, amount: parseInt(amount), reason } });
    success(res, { newBalance });
  } catch (err) {
    next(err);
  }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const { page, limit, type, userId, dateFrom, dateTo } = req.query;
    const p = safePage(page);
    const l = safeLimit(limit);
    const skip = (p - 1) * l;
    const filter = {};
    if (type) filter.type = type;
    if (userId) filter.userId = new mongoose.Types.ObjectId(userId);
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const [transactions, total] = await Promise.all([
      CreditTransaction.find(filter).populate('userId', 'name email').sort({ createdAt: -1 }).skip(skip).limit(l),
      CreditTransaction.countDocuments(filter),
    ]);

    success(res, { transactions, total, page: p, pages: Math.ceil(total / l) });
  } catch (err) {
    next(err);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const { page, limit, method, status, dateFrom, dateTo } = req.query;
    const p = safePage(page);
    const l = safeLimit(limit);
    const skip = (p - 1) * l;
    const filter = {};
    if (method) filter.method = method;
    if (status) filter.status = status;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter).populate('userId', 'name email').sort({ createdAt: -1 }).skip(skip).limit(l),
      Payment.countDocuments(filter),
    ]);

    success(res, { payments, total, page: p, pages: Math.ceil(total / l) });
  } catch (err) {
    next(err);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const { page, limit, status, countryId, serviceId } = req.query;
    const p = safePage(page);
    const l = safeLimit(limit);
    const skip = (p - 1) * l;
    const filter = {};
    if (status) filter.status = status;
    if (countryId) filter.countryId = new mongoose.Types.ObjectId(countryId);
    if (serviceId) filter.serviceId = new mongoose.Types.ObjectId(serviceId);

    const [orders, total] = await Promise.all([
      NumberOrder.find(filter)
        .populate('userId', 'name email')
        .populate('countryId', 'name flagEmoji')
        .populate('serviceId', 'name icon')
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

exports.getCountries = async (req, res, next) => {
  try {
    const countries = await Country.find().sort({ sortOrder: 1 });
    success(res, { countries });
  } catch (err) {
    next(err);
  }
};

exports.updateCountry = async (req, res, next) => {
  try {
    const { isEnabled, sortOrder } = req.body;
    const updates = {};
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    const country = await Country.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!country) throw new AppError('NOT_FOUND', 404, 'Country not found');
    success(res, { country });
  } catch (err) {
    next(err);
  }
};

exports.getServices = async (req, res, next) => {
  try {
    const services = await Service.find().sort({ sortOrder: 1 });
    success(res, { services });
  } catch (err) {
    next(err);
  }
};

exports.updateService = async (req, res, next) => {
  try {
    const { isEnabled, sortOrder } = req.body;
    const updates = {};
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    const service = await Service.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!service) throw new AppError('NOT_FOUND', 404, 'Service not found');
    success(res, { service });
  } catch (err) {
    next(err);
  }
};

exports.getPricing = async (req, res, next) => {
  try {
    const { countryId, serviceId } = req.query;
    const filter = {};
    if (countryId) filter.countryId = new mongoose.Types.ObjectId(countryId);
    if (serviceId) filter.serviceId = new mongoose.Types.ObjectId(serviceId);

    const pricing = await NumberPricing.find(filter)
      .populate('countryId', 'name flagEmoji code')
      .populate('serviceId', 'name icon slug')
      .sort({ 'countryId.name': 1 });

    success(res, { pricing });
  } catch (err) {
    next(err);
  }
};

exports.updatePricing = async (req, res, next) => {
  try {
    const { marginPercent, isAvailable } = req.body;
    const pricing = await NumberPricing.findById(req.params.id);
    if (!pricing) throw new AppError('NOT_FOUND', 404, 'Pricing entry not found');

    if (marginPercent !== undefined) {
      pricing.marginPercent = parseFloat(marginPercent);
      pricing.finalPrice = Math.ceil(pricing.providerCost * (1 + pricing.marginPercent / 100));
    }
    if (isAvailable !== undefined) pricing.isAvailable = isAvailable;

    await pricing.save();
    success(res, { pricing });
  } catch (err) {
    next(err);
  }
};

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await PlatformSettings.find();
    success(res, { settings });
  } catch (err) {
    next(err);
  }
};

const ALLOWED_SETTINGS_KEYS = new Set([
  'maxActiveNumbers',
  'numberExpiryMinutes',
  'defaultMarginPercent',
  'maintenanceMode',
  'korapayNgnRate',
  'smsProviderPrimary',
  'smsProviderFallback',
  'referralBonusPercent',
  'minTopupUSD',
  'announcementBanner',
]);

exports.updateSettings = async (req, res, next) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_SETTINGS_KEYS.has(key)) {
        throw new AppError('VALIDATION_ERROR', 400, `Unknown setting key: ${key}`);
      }
      await PlatformSettings.findOneAndUpdate(
        { key },
        { value: String(value) },
        { upsert: true, new: true }
      );
    }
    success(res, { message: 'Settings updated' });
  } catch (err) {
    next(err);
  }
};

exports.getRevenueReport = async (req, res, next) => {
  try {
    const { period = 'daily', dateFrom, dateTo } = req.query;
    const start = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = dateTo ? new Date(dateTo) : new Date();

    const groupBy =
      period === 'monthly'
        ? { year: { $year: '$completedAt' }, month: { $month: '$completedAt' } }
        : period === 'weekly'
        ? { year: { $year: '$completedAt' }, week: { $week: '$completedAt' } }
        : { year: { $year: '$completedAt' }, month: { $month: '$completedAt' }, day: { $dayOfMonth: '$completedAt' } };

    const data = await Payment.aggregate([
      { $match: { status: 'COMPLETED', completedAt: { $gte: start, $lte: end } } },
      { $group: { _id: groupBy, revenue: { $sum: '$amountUSD' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    const byMethod = await Payment.aggregate([
      { $match: { status: 'COMPLETED', completedAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$method', revenue: { $sum: '$amountUSD' }, count: { $sum: 1 } } },
    ]);

    success(res, { data, byMethod });
  } catch (err) {
    next(err);
  }
};

exports.exportTransactions = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const filter = {};
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const transactions = await CreditTransaction.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(10000);

    const sanitizeCsv = (v) => {
      const s = String(v ?? '').replace(/"/g, '""');
      // Prefix formula-triggering characters to prevent spreadsheet injection
      return /^[=+\-@\t\r]/.test(s) ? `"'${s}"` : `"${s}"`;
    };

    const csv = [
      'Date,User,Email,Type,Amount,Balance After,Description',
      ...transactions.map((t) =>
        [
          t.createdAt.toISOString(),
          sanitizeCsv(t.userId?.name),
          sanitizeCsv(t.userId?.email),
          t.type,
          t.amount,
          t.balanceAfter,
          sanitizeCsv(t.description),
        ].join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

// ─── Provider health ──────────────────────────────────────────────────────────

exports.getProviderHealth = async (req, res, next) => {
  try {
    const since1h = new Date(Date.now() - 60 * 60 * 1000);

    const [fivesimBalance, hourlyAgg] = await Promise.all([
      fivesim.getProfile().then((p) => p?.balance ?? null).catch(() => null),
      NumberOrder.aggregate([
        { $match: { provider: '5sim', createdAt: { $gte: since1h }, status: { $in: ['COMPLETED', 'EXPIRED', 'REFUNDED', 'CANCELLED'] } } },
        { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } } } },
      ]),
    ]);

    const hourly = hourlyAgg[0] || { total: 0, completed: 0 };
    const successRate1h = hourly.total >= 5
      ? Math.round((hourly.completed / hourly.total) * 1000) / 10
      : null;

    success(res, {
      fivesim: {
        balance: fivesimBalance,
        successRate1h,
        ordersLast1h: hourly.total,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Promo codes ──────────────────────────────────────────────────────────────

exports.getPromoCodes = async (req, res, next) => {
  try {
    const p = safePage(req.query.page);
    const l = safeLimit(req.query.limit);
    const skip = (p - 1) * l;
    const filter = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const [promoCodes, total] = await Promise.all([
      PromoCode.find(filter).sort({ createdAt: -1 }).skip(skip).limit(l),
      PromoCode.countDocuments(filter),
    ]);
    success(res, { promoCodes, total, page: p, pages: Math.ceil(total / l) });
  } catch (err) {
    next(err);
  }
};

exports.createPromoCode = async (req, res, next) => {
  try {
    const { code, type, value, maxUses, minAmountUSD, expiresAt } = req.body;
    if (!code || value == null) throw new AppError('VALIDATION_ERROR', 400, 'code and value are required');
    const promo = await PromoCode.create({
      code,
      type: type || 'PERCENT_BONUS',
      value: parseFloat(value),
      maxUses: maxUses != null ? parseInt(maxUses) : null,
      minAmountUSD: parseFloat(minAmountUSD) || 0,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
    audit('ADMIN_CREATE_PROMO', { userId: req.user.userId, ip: getIP(req), userAgent: getUA(req), meta: { code: promo.code } });
    success(res, { promo }, 201);
  } catch (err) {
    next(err);
  }
};

exports.updatePromoCode = async (req, res, next) => {
  try {
    const { isActive, maxUses, expiresAt, value, minAmountUSD } = req.body;
    const updates = {};
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (maxUses !== undefined) updates.maxUses = maxUses === null ? null : parseInt(maxUses);
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (value !== undefined) updates.value = parseFloat(value);
    if (minAmountUSD !== undefined) updates.minAmountUSD = parseFloat(minAmountUSD);
    const promo = await PromoCode.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!promo) throw new AppError('NOT_FOUND', 404, 'Promo code not found');
    audit('ADMIN_UPDATE_PROMO', { userId: req.user.userId, ip: getIP(req), userAgent: getUA(req), meta: { promoId: req.params.id, updates } });
    success(res, { promo });
  } catch (err) {
    next(err);
  }
};

exports.deletePromoCode = async (req, res, next) => {
  try {
    const promo = await PromoCode.findByIdAndDelete(req.params.id);
    if (!promo) throw new AppError('NOT_FOUND', 404, 'Promo code not found');
    audit('ADMIN_DELETE_PROMO', { userId: req.user.userId, ip: getIP(req), userAgent: getUA(req), meta: { promoId: req.params.id, code: promo.code } });
    success(res, { message: 'Promo code deleted' });
  } catch (err) {
    next(err);
  }
};
