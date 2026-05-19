const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountNaira: { type: Number, required: true },
    bankAccount: {
      bankName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      accountName: { type: String, required: true },
    },
    status: { type: String, enum: ['pending', 'paid', 'rejected'], default: 'pending' },
    adminNote: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

withdrawalRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
