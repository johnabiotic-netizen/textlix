const mongoose = require('mongoose');

const smsMessageSchema = new mongoose.Schema(
  {
    fivesimId: { type: String, default: null }, // dedup: don't save the same SMS twice
    text: { type: String, required: true },
    code: { type: String, default: null },
    receivedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const numberOrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null }, // null for rentals (any platform)
    phoneNumber: { type: String, required: true },
    providerOrderId: { type: String, required: true },
    provider: { type: String, required: true },
    creditsCharged: { type: Number, required: true },

    // OTP vs long-term rental
    orderType: { type: String, enum: ['OTP', 'RENTAL'], default: 'OTP' },
    rentalDays: { type: Number, default: null }, // 1 | 7 | 30

    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'REFUNDED', 'RENTAL_EXPIRED'],
      default: 'ACTIVE',
    },
    expiresAt: { type: Date, required: true },

    // OTP: single SMS fields (kept for backwards compat)
    smsContent: { type: String, default: null },
    smsCode: { type: String, default: null },
    smsReceivedAt: { type: Date, default: null },

    // RENTAL: all received messages
    smsMessages: { type: [smsMessageSchema], default: [] },
  },
  { timestamps: true }
);

numberOrderSchema.index({ userId: 1, status: 1 });
numberOrderSchema.index({ status: 1, expiresAt: 1 });
numberOrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('NumberOrder', numberOrderSchema);
