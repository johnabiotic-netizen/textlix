const mongoose = require('mongoose');

// One document per visitor session (first landing). The client sends a random
// sessionId (stored in its localStorage) and the captured ad-source data; we
// upsert by sessionId so a session is only ever counted once (first-touch).
//
// This is the top-of-funnel "Visits" signal for the admin conversion tracker.
// It is first-party (our own endpoint), so it survives ad blockers that hide
// the TikTok/Meta pixels.
const visitSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    // Normalized acquisition source: utm_source, else facebook/tiktok/google
    // (derived from fbclid/ttclid/gclid), else the referring host, else 'direct'.
    source: { type: String, default: 'direct', index: true },
    medium: { type: String, default: null },
    campaign: { type: String, default: null },
    content: { type: String, default: null },
    term: { type: String, default: null },
    fbclid: { type: String, default: null },
    ttclid: { type: String, default: null },
    gclid: { type: String, default: null },
    referrer: { type: String, default: null },
    landingPath: { type: String, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    // Set later if/when this session signs up (links a visit to a user).
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: true }
);

visitSchema.index({ createdAt: -1 });
visitSchema.index({ source: 1, createdAt: -1 });

module.exports = mongoose.model('Visit', visitSchema);
