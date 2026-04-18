const bcrypt = require('bcryptjs');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const NumberOrder = require('../models/NumberOrder');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const { generateReferralCode } = require('../utils/tokens');

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash -resetPasswordToken -emailVerifyToken');
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    success(res, { user });
  } catch (err) {
    next(err);
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    const { name, avatar, emailNotifications } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (avatar !== undefined) updates.avatar = avatar;
    if (emailNotifications !== undefined) updates.emailNotifications = Boolean(emailNotifications);

    const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true }).select('-passwordHash');
    success(res, { user });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user.passwordHash) {
      throw new AppError('VALIDATION_ERROR', 400, 'OAuth accounts cannot change password here');
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError('UNAUTHORIZED', 401, 'Current password is incorrect');

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.tokenVersion += 1;
    await user.save();

    success(res, { message: 'Password updated' });
  } catch (err) {
    next(err);
  }
};

exports.getReferral = async (req, res, next) => {
  try {
    let user = await User.findById(req.user.userId);

    // Generate a code for legacy accounts that don't have one yet
    if (!user.referralCode) {
      const code = generateReferralCode();
      user = await User.findByIdAndUpdate(req.user.userId, { referralCode: code }, { new: true });
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'https://textlix.com').trim();
    const referralLink = `${frontendUrl}/register?ref=${user.referralCode}`;

    const [referredCount, bonusEarned] = await Promise.all([
      User.countDocuments({ referredBy: user._id }),
      CreditTransaction.aggregate([
        { $match: { userId: user._id, description: /^Referral bonus:/ } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    success(res, {
      referralCode: user.referralCode,
      referralLink,
      referredCount,
      bonusEarned: bonusEarned[0]?.total || 0,
    });
  } catch (err) {
    next(err);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    const [totalPurchased, totalSpent, numbersUsed] = await Promise.all([
      CreditTransaction.aggregate([
        { $match: { userId: user._id, type: 'PURCHASE' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CreditTransaction.aggregate([
        { $match: { userId: user._id, type: 'SPEND' } },
        { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } },
      ]),
      NumberOrder.countDocuments({ userId: user._id }),
    ]);

    success(res, {
      totalSpent: totalSpent[0]?.total || 0,
      totalPurchased: totalPurchased[0]?.total || 0,
      numbersUsed,
      memberSince: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
};
