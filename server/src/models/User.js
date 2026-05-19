const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: null },
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    creditBalance: { type: Number, default: 0, min: 0 },
    isEmailVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    maxActiveNumbers: { type: Number, default: 5 },
    provider: { type: String, enum: ['LOCAL', 'GOOGLE', 'GITHUB'], default: 'LOCAL' },
    providerId: { type: String, default: null },
    tokenVersion: { type: Number, default: 0 },
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
  },
  { timestamps: true }
);

userSchema.index({ provider: 1, providerId: 1 });

module.exports = mongoose.model('User', userSchema);
