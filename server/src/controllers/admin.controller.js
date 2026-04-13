const mongoose = require('mongoose');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const Payment = require('../models/Payment');
const NumberOrder = require('../models/NumberOrder');
const Country = require('../models/Country');
const Service = require('../models/Service');
const NumberPricing = require('../models/NumberPricing');
const PlatformSettings = require('../models/PlatformSettings');
const { adminAdjustCredits } = require('../services/credit.service');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');

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
    const { page = 1, limit = 20, search, status } = req.query;
    const skip = (page - 1) * limit;
    const filter = {};
    if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    if (status === 'banned') filter.isBanned = true;
    if (status === 'active') filter.isBanned = false;

    const [users, total] = await Promise.all([
      User.find(filter).select('-passwordHash -resetPasswordToken -emailVerifyToken').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);

    success(res, { users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
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
    if (isBanned !== undefined) updates.isBanned = isBanned;
    if (banReason !== undefined) updates.banReason = banReason;
    if (maxActiveNumbers !== undefined) updates.maxActiveNumbers = parseInt(maxActiveNumbers);
    if (role !== undefined) updates.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-passwordHash');
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    success(res, { user });
  } catch (err) {
    next(err);
  }
};

exports.adjustCredits = async (req, res, next) => {
  try {
    const { amount, reason } = req.body;
    if (!amount || !reason) throw new AppError('VALIDATION_ERROR', 400, 'Amount and reason required');

    const newBalance = await adminAdjustCredits(req.params.id, parseInt(amount), reason, req.user.userId);
    success(res, { newBalance });
  } catch (err) {
    next(err);
  }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, type, userId, dateFrom, dateTo } = req.query;
    const skip = (page - 1) * limit;
    const filter = {};
    if (type) filter.type = type;
    if (userId) filter.userId = new mongoose.Types.ObjectId(userId);
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const [transactions, total] = await Promise.all([
      CreditTransaction.find(filter).populate('userId', 'name email').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      CreditTransaction.countDocuments(filter),
    ]);

    success(res, { transactions, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, method, status, dateFrom, dateTo } = req.query;
    const skip = (page - 1) * limit;
    const filter = {};
    if (method) filter.method = method;
    if (status) filter.status = status;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter).populate('userId', 'name email').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Payment.countDocuments(filter),
    ]);

    success(res, { payments, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, countryId, serviceId } = req.query;
    const skip = (page - 1) * limit;
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
        .limit(parseInt(limit)),
      NumberOrder.countDocuments(filter),
    ]);

    success(res, { orders, total, page: parseInt(page), pages: Math.ceil(total / limit) });
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

exports.updateSettings = async (req, res, next) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
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

    const csv = [
      'Date,User,Email,Type,Amount,Balance After,Description',
      ...transactions.map((t) =>
        [
          t.createdAt.toISOString(),
          t.userId?.name || '',
          t.userId?.email || '',
          t.type,
          t.amount,
          t.balanceAfter,
          `"${(t.description || '').replace(/"/g, '""')}"`,
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
