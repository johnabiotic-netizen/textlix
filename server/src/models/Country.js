const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    flagEmoji: { type: String, required: true },
    isEnabled: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

countrySchema.index({ isEnabled: 1, sortOrder: 1 });

module.exports = mongoose.model('Country', countrySchema);
