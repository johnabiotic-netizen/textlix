const { z } = require('zod');

// Email — RFC-tight enough for our needs, trimmed + lowercased
const email = z.string().trim().toLowerCase().email().max(254);
// Passwords: min 8, max 128, no other complexity beyond non-empty trim
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const name = z.string().trim().min(1, 'Name is required').max(100);
const referralCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/i, 'Invalid referral code').optional().or(z.literal(''));

const registerSchema = z.object({
  name,
  email,
  password,
  referralCode,
});

const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
  // 2FA token (optional, supplied during 2FA step)
  twoFactorToken: z.string().regex(/^\d{6}$/).optional(),
});

const forgotPasswordSchema = z.object({
  email,
});

const resetPasswordSchema = z.object({
  token: z.string().min(10).max(512),
  newPassword: password,
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10).max(2048).optional(),
});

const ssoExchangeSchema = z.object({
  ssoToken: z.string().min(10).max(2048),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});

const verifyEmailSchema = z.object({
  token: z.string().min(10).max(512),
});

const enable2faSchema = z.object({
  token: z.string().regex(/^\d{6}$/),
});

const disable2faSchema = z.object({
  password: z.string().min(1).max(128),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshSchema,
  ssoExchangeSchema,
  changePasswordSchema,
  verifyEmailSchema,
  enable2faSchema,
  disable2faSchema,
};
