const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');

exports.getBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('creditBalance');
    success(res, { balance: user.creditBalance });
  } catch (err) {
    next(err);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (page - 1) * limit;

    const filter = { userId: req.user.userId };
    if (type) filter.type = type;

    const [transactions, total] = await Promise.all([
      CreditTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      CreditTransaction.countDocuments(filter),
    ]);

    success(res, {
      transactions,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};
