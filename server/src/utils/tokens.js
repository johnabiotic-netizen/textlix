const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Long-lived rolling refresh window. The session is rotated (fresh token +
// fresh cookie) on every /auth/refresh, so as long as a user returns within
// this window the session rolls forward indefinitely — they only get logged
// out by clearing cookies/cache, an explicit logout, or being continuously
// absent for the full window. Single source of truth so the JWT expiry and the
// cookie maxAge can never drift apart (a mismatch would silently log users out).
// Intentionally NOT read from JWT_REFRESH_EXPIRES_IN — that env var was 7d and
// would override this, defeating the "stay logged in" guarantee.
const REFRESH_TOKEN_DAYS = 365;
const REFRESH_TOKEN_MS = REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

// Refresh tokens carry a JTI so we can detect reuse (industry-standard
// refresh-token rotation pattern). The JTI is also stored on the user row;
// only the most-recently-issued JTI is accepted on subsequent refreshes.
const generateRefreshToken = (user, jti) => {
  return jwt.sign(
    { userId: user._id, tokenVersion: user.tokenVersion, jti },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: `${REFRESH_TOKEN_DAYS}d` }
  );
};

// Issue a refresh token, persist its JTI on the user, set the cookie.
// Use this everywhere instead of calling generateRefreshToken + setRefreshCookie
// separately, so reuse detection in /refresh always has a JTI to compare against.
const issueRefreshToken = async (user, res, UserModel) => {
  const jti = crypto.randomUUID();
  await UserModel.findByIdAndUpdate(user._id, { refreshJti: jti });
  const token = generateRefreshToken(user, jti);
  setRefreshCookie(res, token);
  return token;
};

const generateRandomToken = () => crypto.randomBytes(32).toString('hex');

const generateReferralCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

const setRefreshCookie = (res, refreshToken) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_MS,
    path: '/',
    ...(isProd && { domain: '.textlix.com' }),
  });
};

const clearRefreshCookie = (res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('refreshToken', {
    path: '/',
    ...(isProd && { domain: '.textlix.com' }),
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  issueRefreshToken,
  generateRandomToken,
  generateReferralCode,
  setRefreshCookie,
  clearRefreshCookie,
};
