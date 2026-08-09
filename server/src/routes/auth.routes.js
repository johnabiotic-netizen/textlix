const express = require('express');
const passport = require('../config/passport');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const schemas = require('../schemas/auth.schemas');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Strict limiter for login/register/forgot — 5 per minute
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'),
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, please try again later' } },
});

// Looser limiter for refresh — 30 per minute (proactive refresh fires often)
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many refresh attempts' } },
});

// Reset password — 10 per hour to prevent brute-forcing tokens
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many reset attempts' } },
});

router.post('/register', authLimiter, validate(schemas.registerSchema), authController.register);
router.post('/login', authLimiter, validate(schemas.loginSchema), authController.login);
router.post('/refresh', refreshLimiter, authController.refresh);
router.post('/logout', authenticate, authController.logout);

// Mobile auth — refresh token returned in body, not cookie (SecureStore on device).
router.post('/register-mobile', authLimiter, validate(schemas.registerSchema), authController.registerMobile);
router.post('/login-mobile', authLimiter, validate(schemas.loginSchema), authController.loginMobile);
router.post('/refresh-mobile', refreshLimiter, authController.refreshMobile);
router.post('/forgot-password', authLimiter, validate(schemas.forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', resetLimiter, validate(schemas.resetPasswordSchema), authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);

// Cookie options shared by short-lived OAuth state cookies (ref code, client flag).
const oauthStateCookie = { maxAge: 10 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'none' };

// Google OAuth — ref code stored in a short-lived cookie (more reliable than state param)
router.get('/google', (req, res, next) => {
  // Validate ref so attackers can't stuff arbitrary content into a session cookie.
  const ref = String(req.query.ref || '').trim();
  if (ref && /^[A-Z0-9_-]{3,20}$/i.test(ref)) {
    res.cookie('oauthRef', ref.toUpperCase(), oauthStateCookie);
  }
  // ?client=mobile flips callback into mobile-SSO mode (Universal/App Link return).
  if (String(req.query.client || '') === 'mobile') {
    res.cookie('oauthClient', 'mobile', oauthStateCookie);
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed` }),
  (req, res) => {
    const ref = req.cookies?.oauthRef || null;
    const isMobile = req.cookies?.oauthClient === 'mobile';
    if (ref) res.clearCookie('oauthRef');
    if (isMobile) res.clearCookie('oauthClient');
    authController.oauthCallback(req.user, res, ref, isMobile);
  }
);

// GitHub OAuth
router.get('/github', (req, res, next) => {
  if (String(req.query.client || '') === 'mobile') {
    res.cookie('oauthClient', 'mobile', oauthStateCookie);
  }
  passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});
router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed` }),
  (req, res) => {
    const isMobile = req.cookies?.oauthClient === 'mobile';
    if (isMobile) res.clearCookie('oauthClient');
    authController.oauthCallback(req.user, res, null, isMobile);
  }
);

// 2FA routes — setup/enable/disable require auth; complete is pre-auth
router.post('/2fa/setup',    authenticate, authController.twoFASetup);
router.post('/2fa/enable',   authenticate, authController.twoFAEnable);
router.post('/2fa/disable',  authenticate, authController.twoFADisable);
router.post('/2fa/complete',              authController.twoFAComplete);

// SSO bridges (browser navigation carries cookies, XHR may not)
router.get('/sso/main', authController.mainSsoInit);
router.post('/sso/exchange-main', validate(schemas.ssoExchangeSchema), authController.mainSsoExchange);
router.get('/sso/creator', authController.creatorSsoInit);
router.post('/sso/exchange', validate(schemas.ssoExchangeSchema), authController.creatorSsoExchange);
router.post('/sso/exchange-mobile', validate(schemas.ssoExchangeSchema), authController.mobileOauthExchange);

module.exports = router;
