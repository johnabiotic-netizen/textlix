const mongoose = require('mongoose');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const AppError = require('../utils/AppError');

const addCredits = async (userId, amount, description, referenceId = null, type = 'PURCHASE') => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { creditBalance: amount } },
      { new: true, session }
    );
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    await CreditTransaction.create(
      [{ userId, amount, type, description, balanceAfter: user.creditBalance, referenceId }],
      { session }
    );

    await session.commitTransaction();
    return user.creditBalance;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const spendCredits = async (userId, amount, description, referenceId = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    if (user.creditBalance < amount) {
      throw new AppError(
        'INSUFFICIENT_CREDITS',
        402,
        `You need ${amount} credits but only have ${user.creditBalance}`
      );
    }

    user.creditBalance -= amount;
    await user.save({ session });

    await CreditTransaction.create(
      [
        {
          userId,
          amount: -amount,
          type: 'SPEND',
          description,
          balanceAfter: user.creditBalance,
          referenceId,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return user.creditBalance;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const refundCredits = async (userId, amount, description, referenceId = null) => {
  return addCredits(userId, amount, description, referenceId, 'REFUND');
};

const adminAdjustCredits = async (userId, amount, reason, adminId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    const newBalance = user.creditBalance + amount;
    if (newBalance < 0) throw new AppError('VALIDATION_ERROR', 400, 'Balance cannot go below 0');

    user.creditBalance = newBalance;
    await user.save({ session });

    await CreditTransaction.create(
      [
        {
          userId,
          amount,
          type: 'ADMIN_ADJUST',
          description: `Admin adjustment: ${reason}`,
          balanceAfter: newBalance,
          referenceId: adminId.toString(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return newBalance;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = { addCredits, spendCredits, refundCredits, adminAdjustCredits };
