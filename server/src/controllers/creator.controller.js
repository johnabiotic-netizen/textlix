const User = require('../models/User');
const CreatorEarning = require('../models/CreatorEarning');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const { getUsdToNgnRate } = require('../utils/exchangerate');
const logger = require('../config/logger');

const MIN_WITHDRAWAL_NAIRA = 50000;

// ─── Apply to become a creator ────────────────────────────────────────────────
exports.apply = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { platforms, bio, proofLinks } = req.body;

    const user = await User.findById(userId);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    if (user.creatorStatus === 'approved') {
      throw new AppError('VALIDATION_ERROR', 400, 'You are already an approved creator');
    }
    if (user.creatorStatus === 'pending') {
      throw new AppError('VALIDATION_ERROR', 400, 'Your application is already under review');
    }

    if (!platforms?.length) throw new AppError('VALIDATION_ERROR', 400, 'At least one platform is required');
    if (!proofLinks?.length) throw new AppError('VALIDATION_ERROR', 400, 'At least one proof link is required');

    await User.findByIdAndUpdate(userId, {
      creatorStatus: 'pending',
      creatorProfile: {
        platforms,
        bio: bio || '',
        proofLinks,
        appliedAt: new Date(),
      },
    });

    success(res, { message: 'Application submitted. We will review it within 24–48 hours.' });
  } catch (err) {
    next(err);
  }
};

// ─── Get creator dashboard data ───────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select(
      'name email referralCode isCreator creatorStatus creatorProfile bankAccount pendingEarningsNaira totalEarningsNaira withdrawnNaira'
    );
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    const referralLink = user.isCreator
      ? `${process.env.CLIENT_URL || 'https://textlix.com'}/register?ref=${user.referralCode}`
      : null;

    const [totalReferrals, pendingWithdrawal] = await Promise.all([
      User.countDocuments({ creatorReferredBy: user._id }),
      WithdrawalRequest.countDocuments({ creatorId: user._id, status: 'pending' }),
    ]);

    const rate = await getUsdToNgnRate();

    success(res, {
      creator: {
        name: user.name,
        email: user.email,
        referralCode: user.referralCode,
        referralLink,
        isCreator: user.isCreator,
        creatorStatus: user.creatorStatus,
        creatorProfile: user.creatorProfile,
        bankAccount: user.bankAccount,
        pendingEarningsNaira: user.pendingEarningsNaira,
        totalEarningsNaira: user.totalEarningsNaira,
        withdrawnNaira: user.withdrawnNaira,
        totalReferrals,
        pendingWithdrawal: pendingWithdrawal > 0,
        currentUsdNgnRate: rate,
        minWithdrawalNaira: MIN_WITHDRAWAL_NAIRA,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Earnings history ─────────────────────────────────────────────────────────
exports.getEarnings = async (req, res, next) => {
  try {
    const p = Math.max(1, parseInt(req.query.page) || 1);
    const l = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
    const skip = (p - 1) * l;

    const [earnings, total] = await Promise.all([
      CreatorEarning.find({ creatorId: req.user.userId })
        .populate('referredUserId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(l),
      CreatorEarning.countDocuments({ creatorId: req.user.userId }),
    ]);

    success(res, { earnings, total, page: p, pages: Math.ceil(total / l) });
  } catch (err) {
    next(err);
  }
};

// ─── Referrals list ───────────────────────────────────────────────────────────
exports.getReferrals = async (req, res, next) => {
  try {
    const p = Math.max(1, parseInt(req.query.page) || 1);
    const l = 20;
    const skip = (p - 1) * l;

    const [referrals, total] = await Promise.all([
      User.find({ creatorReferredBy: req.user.userId })
        .select('name email createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(l),
      User.countDocuments({ creatorReferredBy: req.user.userId }),
    ]);

    success(res, { referrals, total, page: p, pages: Math.ceil(total / l) });
  } catch (err) {
    next(err);
  }
};

// ─── Update bank account ──────────────────────────────────────────────────────
exports.updateBank = async (req, res, next) => {
  try {
    const { bankName, accountNumber, accountName } = req.body;
    if (!bankName || !accountNumber || !accountName) {
      throw new AppError('VALIDATION_ERROR', 400, 'Bank name, account number, and account name are required');
    }

    await User.findByIdAndUpdate(req.user.userId, {
      bankAccount: { bankName, accountNumber, accountName },
    });

    success(res, { message: 'Bank account updated' });
  } catch (err) {
    next(err);
  }
};

// ─── Request withdrawal ───────────────────────────────────────────────────────
exports.requestWithdrawal = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    if (!user.isCreator) throw new AppError('FORBIDDEN', 403, 'Not an approved creator');

    if (user.pendingEarningsNaira < MIN_WITHDRAWAL_NAIRA) {
      throw new AppError('VALIDATION_ERROR', 400, `Minimum withdrawal is ₦${MIN_WITHDRAWAL_NAIRA.toLocaleString()}. You have ₦${user.pendingEarningsNaira.toLocaleString()}`);
    }

    const existing = await WithdrawalRequest.findOne({ creatorId: userId, status: 'pending' });
    if (existing) throw new AppError('VALIDATION_ERROR', 400, 'You already have a pending withdrawal request');

    const bank = user.bankAccount;
    if (!bank?.bankName || !bank?.accountNumber || !bank?.accountName) {
      throw new AppError('VALIDATION_ERROR', 400, 'Please set up your bank account before requesting a withdrawal');
    }

    const amount = user.pendingEarningsNaira;

    await Promise.all([
      WithdrawalRequest.create({
        creatorId: userId,
        amountNaira: amount,
        bankAccount: { bankName: bank.bankName, accountNumber: bank.accountNumber, accountName: bank.accountName },
      }),
      User.findByIdAndUpdate(userId, { $set: { pendingEarningsNaira: 0 } }),
    ]);

    logger.info(`Withdrawal request ₦${amount} from creator ${userId}`);
    success(res, { message: `Withdrawal request of ₦${amount.toLocaleString()} submitted. We will process it within 24–48 hours.` });
  } catch (err) {
    next(err);
  }
};

// ─── Withdrawal history ───────────────────────────────────────────────────────
exports.getWithdrawals = async (req, res, next) => {
  try {
    const withdrawals = await WithdrawalRequest.find({ creatorId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    success(res, { withdrawals });
  } catch (err) {
    next(err);
  }
};
