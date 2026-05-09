const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  keyHash:    { type: String, required: true, unique: true },
  prefix:     { type: String, required: true },          // first 16 chars for display
  name:       { type: String, required: true, trim: true },
  lastUsedAt: { type: Date, default: null },
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

apiKeySchema.statics.generate = function () {
  const raw = `tlx_live_${crypto.randomBytes(24).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 16);
  return { raw, hash, prefix };
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
