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
  },
  { timestamps: true }
);

userSchema.index({ provider: 1, providerId: 1 });

module.exports = mongoose.model('User', userSchema);
