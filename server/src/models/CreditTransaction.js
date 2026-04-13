const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ['PURCHASE', 'SPEND', 'REFUND', 'ADMIN_ADJUST'],
      required: true,
    },
    description: { type: String, required: true },
    balanceAfter: { type: Number, required: true },
    referenceId: { type: String, default: null },
  },
  { timestamps: true }
);

creditTransactionSchema.index({ userId: 1, createdAt: -1 });
creditTransactionSchema.index({ type: 1 });
creditTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);
