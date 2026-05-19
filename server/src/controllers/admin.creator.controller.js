const User = require('../models/User');
const CreatorEarning = require('../models/CreatorEarning');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const logger = require('../config/logger');

exports.getApplications = async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;
    const users = await User.find({ creatorStatus: status })
      .select('name email creatorProfile creatorStatus createdAt')
      .sort({ 'creatorProfile.appliedAt': -1 })
      .limit(100);
    success(res, { applications: users });
  } catch (err) { next(err); }
};

exports.getCreators = async (req, res, next) => {
  try {
    const creators = await User.find({ isCreator: true })
      .select('name email referralCode pendingEarningsNaira totalEarningsNaira withdrawnNaira createdAt')
      .sort({ totalEarningsNaira: -1 })
      .limit(200);

    const counts = await User.aggregate([
      { $match: { creatorReferredBy: { $in: creators.map((c) => c._id) } } },
      { $group: { _id: '$creatorReferredBy', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    for (const c of counts) countMap[c._id.toString()] = c.count;

    const result = creators.map((c) => ({
      ...c.toObject(),
      referralCount: countMap[c._id.toString()] || 0,
    }));

    success(res, { creators: result });
  } catch (err) { next(err); }
};

exports.approveCreator = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    if (user.creatorStatus !== 'pending') throw new AppError('VALIDATION_ERROR', 400, 'Application is not pending');

    await User.findByIdAndUpdate(req.params.id, {
      isCreator: true,
      creatorStatus: 'approved',
      'creatorProfile.reviewedAt': new Date(),
      'creatorProfile.reviewNote': req.body.note || '',
    });

    logger.info(`Admin approved creator: ${user.email}`);
    success(res, { message: `${user.name} approved as creator` });
  } catch (err) { next(err); }
};

exports.rejectCreator = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    await User.findByIdAndUpdate(req.params.id, {
      creatorStatus: 'rejected',
      'creatorProfile.reviewedAt': new Date(),
      'creatorProfile.reviewNote': req.body.note || '',
    });

    logger.info(`Admin rejected creator: ${user.email}`);
    success(res, { message: `${user.name} rejected` });
  } catch (err) { next(err); }
};

exports.getWithdrawals = async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;
    const withdrawals = await WithdrawalRequest.find({ status })
      .populate('creatorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(200);
    success(res, { withdrawals });
  } catch (err) { next(err); }
};

exports.markWithdrawalPaid = async (req, res, next) => {
  try {
    const wr = await WithdrawalRequest.findById(req.params.id);
    if (!wr) throw new AppError('NOT_FOUND', 404, 'Withdrawal request not found');
    if (wr.status !== 'pending') throw new AppError('VALIDATION_ERROR', 400, 'Already processed');

    await Promise.all([
      WithdrawalRequest.findByIdAndUpdate(req.params.id, {
        status: 'paid',
        processedAt: new Date(),
        adminNote: req.body.note || '',
      }),
      User.findByIdAndUpdate(wr.creatorId, { $inc: { withdrawnNaira: wr.amountNaira } }),
      CreatorEarning.updateMany(
        { creatorId: wr.creatorId, status: 'pending' },
        { $set: { status: 'withdrawn' } }
      ),
    ]);

    logger.info(`Admin marked withdrawal ${req.params.id} as paid (₦${wr.amountNaira})`);
    success(res, { message: `₦${wr.amountNaira.toLocaleString()} marked as paid` });
  } catch (err) { next(err); }
};

exports.rejectWithdrawal = async (req, res, next) => {
  try {
    const wr = await WithdrawalRequest.findById(req.params.id);
    if (!wr) throw new AppError('NOT_FOUND', 404, 'Withdrawal request not found');
    if (wr.status !== 'pending') throw new AppError('VALIDATION_ERROR', 400, 'Already processed');

    await Promise.all([
      WithdrawalRequest.findByIdAndUpdate(req.params.id, {
        status: 'rejected',
        processedAt: new Date(),
        adminNote: req.body.note || '',
      }),
      // Refund earnings back to creator's pending balance
      User.findByIdAndUpdate(wr.creatorId, { $inc: { pendingEarningsNaira: wr.amountNaira } }),
    ]);

    success(res, { message: 'Withdrawal rejected and funds returned to creator balance' });
  } catch (err) { next(err); }
};
