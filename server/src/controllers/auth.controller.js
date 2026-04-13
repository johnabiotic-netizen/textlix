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
  setRefreshCookie,
  clearRefreshCookie,
} = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

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
    const { email, password, name } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) throw new AppError('VALIDATION_ERROR', 400, 'Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const emailVerifyToken = generateRandomToken();

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      provider: 'LOCAL',
      emailVerifyToken,
    });

    sendVerificationEmail(user.email, emailVerifyToken).catch(() => {});

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

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.passwordHash) {
      throw new AppError('UNAUTHORIZED', 401, 'Invalid credentials');
    }
    if (user.isBanned) {
      throw new AppError('UNAUTHORIZED', 401, `Account suspended: ${user.banReason || 'Contact support'}`);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('UNAUTHORIZED', 401, 'Invalid credentials');

    user.lastLoginAt = new Date();
    await user.save();

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
    success(res, { message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

exports.oauthCallback = (user, res) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    // Always respond 200 for security
    if (user && user.provider === 'LOCAL') {
      const token = generateRandomToken();
      user.resetPasswordToken = token;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      sendPasswordResetEmail(user.email, token).catch(() => {});
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

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/dashboard?verified=true`);
  } catch (err) {
    next(err);
  }
};
