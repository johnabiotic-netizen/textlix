const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const {
  generateAccessToken,
  issueRefreshToken,
  generateRandomToken,
  generateReferralCode,
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

    // Look up referrer — creator codes earn Naira commissions; regular codes earn credits
    let referredBy = null;
    let creatorReferredBy = null;
    if (refCode) {
      const referrer = await User.findOne({ referralCode: refCode.toUpperCase() });
      if (referrer) {
        if (referrer.isCreator) creatorReferredBy = referrer._id;
        else referredBy = referrer._id;
      }
    }

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      provider: 'LOCAL',
      emailVerifyToken,
      referralCode,
      referredBy,
      creatorReferredBy,
    });

    sendVerificationEmail(user.email, emailVerifyToken).catch((err) => {
      logger.error('Failed to send verification email', { email: user.email, error: err.message });
    });

    const accessToken = generateAccessToken(user);
    await issueRefreshToken(user, res, User);

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

    // If 2FA enabled, return a short-lived pending token instead of full auth
    if (user.twoFAEnabled) {
      const tempToken = jwt.sign(
        { userId: user._id.toString(), type: '2fa_pending' },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '5m' }
      );
      return success(res, { requiresTwoFA: true, tempToken });
    }

    const accessToken = generateAccessToken(user);
    await issueRefreshToken(user, res, User);

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

    // ─── Refresh-token reuse detection ─────────────────────────────────────
    // The user row stores the JTI of the most-recently-issued refresh token.
    // If the incoming token's JTI doesn't match, it's an old (already-rotated)
    // token — either a slow retry that's harmless to reject, or a stolen
    // token. Be conservative: revoke the entire session.
    //
    // Backwards-compat: pre-rollout tokens lack a jti AND no jti is stored
    // on the user. Accept that single case once, then enforcement kicks in.
    const incomingJti = payload.jti;
    if (user.refreshJti || incomingJti) {
      if (!incomingJti || user.refreshJti !== incomingJti) {
        await User.findByIdAndUpdate(user._id, {
          $inc: { tokenVersion: 1 },
          refreshJti: null,
        });
        clearRefreshCookie(res);
        audit('SUSPICIOUS_ACTIVITY', {
          userId: user._id,
          email: user.email,
          ip: getIP(req),
          userAgent: getUA(req),
          meta: { reason: 'refresh_token_reuse' },
          success: false,
        });
        logger.warn(`Refresh token reuse detected for user ${user._id} — session revoked`);
        throw new AppError('UNAUTHORIZED', 401, 'Session revoked. Please log in again.');
      }
    }

    const accessToken = generateAccessToken(user);
    await issueRefreshToken(user, res, User);

    audit('TOKEN_REFRESH', { userId: user._id, ip: getIP(req), userAgent: getUA(req) });
    success(res, { accessToken });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { tokenVersion: 1 },
      refreshJti: null,
    });
    clearRefreshCookie(res);
    audit('LOGOUT', { userId: req.user.userId, ip: getIP(req), userAgent: getUA(req) });
    success(res, { message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

exports.oauthCallback = async (user, res, refCode) => {
  try {
    if (refCode) {
      const freshUser = await User.findById(user._id);
      if (!freshUser.referredBy && !freshUser.creatorReferredBy) {
        const referrer = await User.findOne({ referralCode: refCode.toUpperCase() });
        if (referrer && String(referrer._id) !== String(user._id)) {
          if (referrer.isCreator) {
            await User.findByIdAndUpdate(user._id, { creatorReferredBy: referrer._id });
            logger.info(`OAuth referral: ${user.email} → creator ${referrer.email} (${refCode})`);
          } else {
            await User.findByIdAndUpdate(user._id, { referredBy: referrer._id });
            logger.info(`OAuth referral: ${user.email} → user ${referrer.email} (${refCode})`);
          }
        } else {
          logger.warn(`OAuth referral: code ${refCode} not found or self-referral`);
        }
      }
    }
  } catch (err) {
    logger.warn(`OAuth referral apply failed: ${err.message}`);
  }
  const accessToken = generateAccessToken(user);
  await issueRefreshToken(user, res, User);
  audit('OAUTH_LOGIN', { userId: user._id, email: user.email });
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  res.redirect(`${frontendUrl}/auth/callback#token=${accessToken}`);
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

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

exports.twoFASetup = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

    const secret = speakeasy.generateSecret({
      name: `TextLix (${user.email})`,
      issuer: 'TextLix',
    });

    // Store secret temporarily (not enabled yet — user must confirm with a valid token)
    await User.findByIdAndUpdate(user._id, { twoFASecret: secret.base32 });

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);
    success(res, { qrCodeDataUrl, secret: secret.base32 });
  } catch (err) { next(err); }
};

exports.twoFAEnable = async (req, res, next) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user?.twoFASecret) throw new AppError('VALIDATION_ERROR', 400, '2FA setup not started');

    const valid = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: 'base32',
      token: String(token),
      window: 1,
    });
    if (!valid) throw new AppError('UNAUTHORIZED', 401, 'Invalid authentication code');

    await User.findByIdAndUpdate(user._id, { twoFAEnabled: true });
    audit('2FA_ENABLED', { userId: user._id, email: user.email });
    success(res, { message: '2FA enabled successfully' });
  } catch (err) { next(err); }
};

exports.twoFADisable = async (req, res, next) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user?.twoFAEnabled) throw new AppError('VALIDATION_ERROR', 400, '2FA is not enabled');

    const valid = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: 'base32',
      token: String(token),
      window: 1,
    });
    if (!valid) throw new AppError('UNAUTHORIZED', 401, 'Invalid authentication code');

    await User.findByIdAndUpdate(user._id, { twoFAEnabled: false, twoFASecret: null });
    audit('2FA_DISABLED', { userId: user._id, email: user.email });
    success(res, { message: '2FA disabled' });
  } catch (err) { next(err); }
};

exports.twoFAComplete = async (req, res, next) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) throw new AppError('VALIDATION_ERROR', 400, 'tempToken and code required');

    let payload;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_ACCESS_SECRET);
    } catch {
      throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired session');
    }
    if (payload.type !== '2fa_pending') throw new AppError('UNAUTHORIZED', 401, 'Invalid token type');

    const user = await User.findById(payload.userId);
    if (!user || !user.twoFAEnabled || !user.twoFASecret) {
      throw new AppError('UNAUTHORIZED', 401, 'User or 2FA not found');
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: 'base32',
      token: String(code),
      window: 1,
    });
    if (!valid) throw new AppError('UNAUTHORIZED', 401, 'Invalid authentication code');

    const accessToken = generateAccessToken(user);
    await issueRefreshToken(user, res, User);
    audit('LOGIN_SUCCESS_2FA', { userId: user._id, email: user.email });
    success(res, { user: formatUser(user), accessToken });
  } catch (err) { next(err); }
};

// Hosts where we'll attach an SSO token. Anything else is treated as an
// open-redirect attempt and falls back to the safe default.
const ALLOWED_SSO_HOSTS = new Set([
  'www.textlix.com',
  'textlix.com',
  'creator.textlix.com',
]);
const SAFE_SSO_DEFAULT = 'https://www.textlix.com/dashboard';

function sanitizeSsoRedirect(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return new URL(SAFE_SSO_DEFAULT);
    if (!ALLOWED_SSO_HOSTS.has(u.hostname)) return new URL(SAFE_SSO_DEFAULT);
    // Strip any pre-existing sso/sso_failed params attackers might have set
    u.searchParams.delete('sso');
    u.searchParams.delete('sso_failed');
    return u;
  } catch {
    return new URL(SAFE_SSO_DEFAULT);
  }
}

// GET /auth/sso/main — restore session on www.textlix.com via cookie (browser navigation)
exports.mainSsoInit = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    const target = sanitizeSsoRedirect(req.query.redirect || SAFE_SSO_DEFAULT);

    if (!token) {
      target.searchParams.set('sso_failed', '1');
      return res.redirect(target.toString());
    }
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) {
      target.searchParams.set('sso_failed', '1');
      return res.redirect(target.toString());
    }
    const ssoToken = jwt.sign(
      { userId: user._id, type: 'main_sso' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '90s' }
    );
    target.searchParams.set('sso', ssoToken);
    return res.redirect(target.toString());
  } catch { return res.redirect('https://www.textlix.com/login'); }
};

// POST /auth/sso/exchange-main — exchange main SSO token for session
exports.mainSsoExchange = async (req, res, next) => {
  try {
    const { ssoToken } = req.body;
    if (!ssoToken) throw new AppError('VALIDATION_ERROR', 400, 'Missing sso token');
    const payload = jwt.verify(ssoToken, process.env.JWT_ACCESS_SECRET);
    if (payload.type !== 'main_sso') throw new AppError('UNAUTHORIZED', 401, 'Invalid SSO token');
    const user = await User.findById(payload.userId);
    if (!user) throw new AppError('UNAUTHORIZED', 401, 'User not found');
    const accessToken = generateAccessToken(user);
    await issueRefreshToken(user, res, User);
    success(res, { user: formatUser(user), accessToken });
  } catch (err) { next(err); }
};

// GET /auth/sso/creator — bridge session from main domain to creator subdomain.
// If the visitor has no main-domain session, we can't bridge anything — so send
// them to the main login with a redirect back to THIS bridge. After they sign in
// (which sets the .textlix.com cookie), the main login bounces them straight back
// here, the cookie is now present, and the bridge completes. Without this they'd
// just land back on the creator login page — a silent dead-end.
const CREATOR_SSO_LOGIN_REDIRECT =
  'https://www.textlix.com/login?redirect=' +
  encodeURIComponent('https://api.textlix.com/api/v1/auth/sso/creator');

exports.creatorSsoInit = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.redirect(CREATOR_SSO_LOGIN_REDIRECT);
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) return res.redirect(CREATOR_SSO_LOGIN_REDIRECT);
    // Short-lived (90s) SSO token
    const ssoToken = jwt.sign(
      { userId: user._id, type: 'creator_sso' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '90s' }
    );
    return res.redirect(`https://creator.textlix.com/dashboard?sso=${ssoToken}`);
  } catch { return res.redirect(CREATOR_SSO_LOGIN_REDIRECT); }
};

// POST /auth/sso/exchange — exchange SSO token for a real session
exports.creatorSsoExchange = async (req, res, next) => {
  try {
    const { ssoToken } = req.body;
    if (!ssoToken) throw new AppError('VALIDATION_ERROR', 400, 'Missing sso token');
    const payload = jwt.verify(ssoToken, process.env.JWT_ACCESS_SECRET);
    if (payload.type !== 'creator_sso') throw new AppError('UNAUTHORIZED', 401, 'Invalid SSO token');
    const user = await User.findById(payload.userId);
    if (!user) throw new AppError('UNAUTHORIZED', 401, 'User not found');
    const accessToken = generateAccessToken(user);
    await issueRefreshToken(user, res, User);
    success(res, { user: formatUser(user), accessToken });
  } catch (err) { next(err); }
};
