const mongoose = require('mongoose');

const numberOrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    phoneNumber: { type: String, required: true },
    providerOrderId: { type: String, required: true },
    provider: { type: String, required: true },
    creditsCharged: { type: Number, required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'REFUNDED'],
      default: 'ACTIVE',
    },
    expiresAt: { type: Date, required: true },
    smsContent: { type: String, default: null },
    smsCode: { type: String, default: null },
    smsReceivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

numberOrderSchema.index({ userId: 1, status: 1 });
numberOrderSchema.index({ status: 1, expiresAt: 1 });
numberOrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('NumberOrder', numberOrderSchema);
