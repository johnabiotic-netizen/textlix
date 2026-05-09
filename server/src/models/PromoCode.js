const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['PERCENT_BONUS', 'FLAT_BONUS'], default: 'PERCENT_BONUS' },
  value: { type: Number, required: true, min: 1 },
  maxUses: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  minAmountUSD: { type: Number, default: 0 },
  expiresAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('PromoCode', promoCodeSchema);
