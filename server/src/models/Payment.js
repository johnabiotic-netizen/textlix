const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    method: { type: String, enum: ['PAYSTACK', 'CRYPTO'], required: true },
    provider: { type: String, required: true },
    externalId: { type: String, default: null, index: true },
    amountUSD: { type: Number, required: true },
    amountLocal: { type: Number, default: null },
    currency: { type: String, default: 'USD' },
    creditsAdded: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'EXPIRED'],
      default: 'PENDING',
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
