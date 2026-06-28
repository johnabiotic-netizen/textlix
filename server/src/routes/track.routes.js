const express = require('express');
const rateLimit = require('express-rate-limit');
const trackController = require('../controllers/track.controller');

const router = express.Router();

// Public, unauthenticated visit beacon. Rate-limited generously per IP since a
// session only ever sends one (guarded client-side), but bursts of new sessions
// from one egress IP (carrier NAT, Cloudflare) are normal.
const visitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${req.headers['cf-connecting-ip'] || req.ip}`,
});

router.post('/visit', visitLimiter, trackController.recordVisit);

module.exports = router;
