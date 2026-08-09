const mongoose = require('mongoose');

// Push notification tokens for mobile clients. One row per device per user;
// the same user can have multiple devices (phone + tablet). expoPushToken is
// unique across the whole collection — if a token gets reassigned to a new
// user (factory reset + re-login), the upsert reclaims it.
const deviceTokenSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expoPushToken:  { type: String, required: true, unique: true },
  platform:       { type: String, enum: ['ios', 'android'], required: true },
  appVersion:     { type: String, default: null },
  // TTL-driven cleanup: any device that hasn't checked in for 90 days is
  // assumed uninstalled and gets purged. Mobile app updates lastSeenAt on
  // every cold-start register call.
  lastSeenAt:     { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
}, { timestamps: true });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
