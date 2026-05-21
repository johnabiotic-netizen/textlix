const express = require('express');
const passport = require('../config/passport');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
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

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', refreshLimiter, authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', resetLimiter, authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);

// Google OAuth — ref code passed through state so it survives the OAuth redirect
router.get('/google', (req, res, next) => {
  const state = req.query.ref ? Buffer.from(req.query.ref).toString('base64') : undefined;
  passport.authenticate('google', { scope: ['profile', 'email'], ...(state && { state }) })(req, res, next);
});
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed` }),
  (req, res) => {
    let ref = null;
    try { if (req.query.state) ref = Buffer.from(req.query.state, 'base64').toString(); } catch {}
    authController.oauthCallback(req.user, res, ref);
  }
);

// GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed` }),
  (req, res) => authController.oauthCallback(req.user, res)
);

// 2FA routes — setup/enable/disable require auth; complete is pre-auth
router.post('/2fa/setup',    authenticate, authController.twoFASetup);
router.post('/2fa/enable',   authenticate, authController.twoFAEnable);
router.post('/2fa/disable',  authenticate, authController.twoFADisable);
router.post('/2fa/complete',              authController.twoFAComplete);

// Creator subdomain SSO bridge
router.get('/sso/creator', authController.creatorSsoInit);
router.post('/sso/exchange', authController.creatorSsoExchange);

module.exports = router;
