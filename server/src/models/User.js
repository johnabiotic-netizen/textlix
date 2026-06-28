const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: null },
    role: { type: String, enum: ['USER', 'ADMIN', 'AGENT'], default: 'USER' },
    // For AGENT accounts: which admin-panel sections they can access (e.g.
    // ['support']). Admins implicitly have everything. Editable by admins.
    permissions: { type: [String], default: [] },
    creditBalance: { type: Number, default: 0, min: 0 },
    isEmailVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    maxActiveNumbers: { type: Number, default: 5 },
    provider: { type: String, enum: ['LOCAL', 'GOOGLE', 'GITHUB'], default: 'LOCAL' },
    providerId: { type: String, default: null },
    tokenVersion: { type: Number, default: 0 },
    // The JTI of the currently-valid refresh token. Used for refresh-token
    // reuse detection: if a refresh request arrives with a different jti
    // (i.e. an old, already-rotated token), the whole session is revoked.
    refreshJti: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    emailVerifyToken: { type: String, default: null },
    loginAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date, default: null },
    referralCode: { type: String, unique: true, sparse: true, default: null },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referralBonusPaid: { type: Boolean, default: false },
    creatorReferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    emailNotifications: { type: Boolean, default: true },
    twoFASecret:  { type: String, default: null },
    twoFAEnabled: { type: Boolean, default: false },
    // ── Pre-launch promo: first 500 sign-ups follow socials → 50 credits ─────
    welcomeBonusClaimed: { type: Boolean, default: false },
    welcomeBonusClaimedAt: { type: Date, default: null },
    welcomeBonusClaimedIp: { type: String, default: null },
    // Lowercased + plus-stripped + Gmail-dot-collapsed form of `email`.
    // Set when a user claims the welcome bonus; used to dedupe Gmail/aliasing
    // tricks where one person registers many addresses to multi-claim.
    emailNormalized: { type: String, default: null },
    // ── Creator / affiliate fields ──────────────────────────────────────────
    isCreator: { type: Boolean, default: false },
    creatorStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    creatorProfile: {
      platforms: [{ platform: String, handle: String, followerCount: Number }],
      proofLinks: [String],
      bio: String,
      appliedAt: Date,
      reviewedAt: Date,
      reviewNote: String,
    },
    bankAccount: {
      bankName: { type: String, default: null },
      accountNumber: { type: String, default: null },
      accountName: { type: String, default: null },
    },
    pendingEarningsNaira: { type: Number, default: 0 },
    totalEarningsNaira: { type: Number, default: 0 },
    withdrawnNaira: { type: Number, default: 0 },
    // ── Acquisition attribution (first-touch) ────────────────────────────────
    // Where this user originally came from, captured from the landing URL at
    // signup (utm_*, fbclid/ttclid/gclid → normalized `source`). Powers the
    // admin conversion tracker. Set once and never overwritten (first-touch).
    attribution: {
      source: { type: String, default: null },
      medium: { type: String, default: null },
      campaign: { type: String, default: null },
      content: { type: String, default: null },
      term: { type: String, default: null },
      fbclid: { type: String, default: null },
      ttclid: { type: String, default: null },
      gclid: { type: String, default: null },
      referrer: { type: String, default: null },
      landingPath: { type: String, default: null },
      capturedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

userSchema.index({ provider: 1, providerId: 1 });
// Welcome-bonus abuse checks — cheap because the claimed subset is capped at 500
userSchema.index({ welcomeBonusClaimed: 1, emailNormalized: 1 });
userSchema.index({ welcomeBonusClaimed: 1, welcomeBonusClaimedIp: 1 });
// Conversion-tracker aggregations: signups grouped by acquisition source.
userSchema.index({ 'attribution.source': 1, createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
