const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const {
  generateAccessToken,
  generateRefreshToken,
  generateRandomToken,
  generateReferralCode,
  setRefreshCookie,
  clearRefreshCookie,
} = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { audit, getIP, getUA } = require('../utils/audit');
const logger = require('../config/logger');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const formatUser = (user) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  avatar: user.avatar,
  role: user.role,
  creditBalance: user.creditBalance,
  isEmailVerified: user.isEmailVerified,
  provider: user.provider,
  createdAt: user.createdAt,
});

exports.register = async (req, res, next) => {
  try {
    const { email, password, name, referralCode: refCode } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return success(res, { message: 'If this email is new, your account has been created.' }, 201);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const emailVerifyToken = generateRandomToken();
    const referralCode = generateReferralCode();

    // Look up referrer if a code was passed
    let referredBy = null;
    if (refCode) {
      const referrer = await User.findOne({ referralCode: refCode.toUpperCase() });
      if (referrer) referredBy = referrer._id;
    }

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      provider: 'LOCAL',
      emailVerifyToken,
      referralCode,
      referredBy,
    });

    sendVerificationEmail(user.email, emailVerifyToken).catch((err) => {
      logger.error('Failed to send verification email', { email: user.email, error: err.message });
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    success(res, { user: formatUser(user), accessToken }, 201);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ip = getIP(req);
    const ua = getUA(req);
    const normalEmail = email.toLowerCase();

    const user = await User.findOne({ email: normalEmail });

    // Unknown email — same error message as wrong password (prevents enumeration)
    if (!user || !user.passwordHash) {
      audit('LOGIN_FAILURE', { email: normalEmail, ip, userAgent: ua, success: false, meta: { reason: 'user_not_found' } });
      throw new AppError('UNAUTHORIZED', 401, 'Invalid credentials');
    }

    // Check account lockout
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockoutUntil - Date.now()) / 60000);
      audit('LOGIN_LOCKED', { userId: user._id, email: normalEmail, ip, userAgent: ua, success: false, meta: { minutesLeft } });
      throw new AppError('UNAUTHORIZED', 401, `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`);
    }

    if (user.isBanned) {
      audit('LOGIN_FAILURE', { userId: user._id, email: normalEmail, ip, userAgent: ua, success: false, meta: { reason: 'banned' } });
      throw new AppError('UNAUTHORIZED', 401, `Account suspended: ${user.banReason || 'Contact support'}`);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      // Increment failed attempt counter
      const attempts = (user.loginAttempts || 0) + 1;
      const update = { loginAttempts: attempts };

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        update.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        update.loginAttempts = 0; // reset so next lockout window starts fresh
        await User.findByIdAndUpdate(user._id, update);
        audit('LOGIN_LOCKED', { userId: user._id, email: normalEmail, ip, userAgent: ua, success: false, meta: { triggeredAfterAttempts: attempts } });
        throw new AppError('UNAUTHORIZED', 401, 'Too many failed attempts. Account locked for 15 minutes.');
      }

      await User.findByIdAndUpdate(user._id, update);
      audit('LOGIN_FAILURE', { userId: user._id, email: normalEmail, ip, userAgent: ua, success: false, meta: { attempts } });
      throw new AppError('UNAUTHORIZED', 401, 'Invalid credentials');
    }

    // Successful login — clear lockout state
    user.loginAttempts = 0;
    user.lockoutUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    audit('LOGIN_SUCCESS', { userId: user._id, email: normalEmail, ip, userAgent: ua });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    success(res, { user: formatUser(user), accessToken });
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) throw new AppError('UNAUTHORIZED', 401, 'No refresh token');

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError('UNAUTHORIZED', 401, 'Invalid refresh token');
    }

    const user = await User.findById(payload.userId);
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      throw new AppError('UNAUTHORIZED', 401, 'Session expired');
    }
    if (user.isBanned) throw new AppError('UNAUTHORIZED', 401, 'Account suspended');

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    success(res, { accessToken });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, { $inc: { tokenVersion: 1 } });
    clearRefreshCookie(res);
    audit('LOGOUT', { userId: req.user.userId, ip: getIP(req), userAgent: getUA(req) });
    success(res, { message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

exports.oauthCallback = (user, res, req) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);
  audit('OAUTH_LOGIN', { userId: user._id, email: user.email });
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    // Always respond with the same message regardless — prevents email enumeration
    if (user && user.provider === 'LOCAL') {
      const token = generateRandomToken();
      user.resetPasswordToken = token;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      sendPasswordResetEmail(user.email, token).catch(() => {});
      audit('PASSWORD_RESET_REQUEST', { userId: user._id, email: user.email, ip: getIP(req), userAgent: getUA(req) });
    }
    success(res, { message: 'If this email exists, a reset link has been sent' });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired reset token');

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.tokenVersion += 1;
    await user.save();

    audit('PASSWORD_RESET_COMPLETE', { userId: user._id, email: user.email, ip: getIP(req), userAgent: getUA(req) });
    success(res, { message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ emailVerifyToken: token });
    if (!user) throw new AppError('VALIDATION_ERROR', 400, 'Invalid verification token');

    user.isEmailVerified = true;
    user.emailVerifyToken = null;
    await user.save();

    audit('EMAIL_VERIFIED', { userId: user._id, email: user.email });
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    res.redirect(`${frontendUrl}/dashboard?verified=true`);
  } catch (err) {
    next(err);
  }
};
