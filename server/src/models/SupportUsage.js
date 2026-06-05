const mongoose = require('mongoose');

// Per-month rollup of support-AI usage. Incremented atomically ($inc) after
// each AI call so the monthly budget check is a single cheap read (no scan).
// `month` is 'YYYY-MM' in UTC.
const supportUsageSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true },
    conversations: { type: Number, default: 0 },
    deflected: { type: Number, default: 0 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cachedTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportUsage', supportUsageSchema);
