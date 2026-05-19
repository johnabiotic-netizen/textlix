const mongoose = require('mongoose');

const creatorEarningSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
    amountUSD: { type: Number, required: true },
    usdNgnRate: { type: Number, required: true },
    commissionNaira: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'withdrawn'], default: 'pending' },
  },
  { timestamps: true }
);

creatorEarningSchema.index({ creatorId: 1, createdAt: -1 });

module.exports = mongoose.model('CreatorEarning', creatorEarningSchema);
