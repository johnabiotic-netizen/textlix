const mongoose = require('mongoose');

const numberPricingSchema = new mongoose.Schema(
  {
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    providerCost: { type: Number, required: true },
    marginPercent: { type: Number, default: 30 },
    finalPrice: { type: Number, required: true },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

numberPricingSchema.index({ countryId: 1, serviceId: 1 }, { unique: true });
numberPricingSchema.index({ isAvailable: 1 });

module.exports = mongoose.model('NumberPricing', numberPricingSchema);
