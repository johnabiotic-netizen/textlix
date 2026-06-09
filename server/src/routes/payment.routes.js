const express = require('express');
const rateLimit = require('express-rate-limit');
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const schemas = require('../schemas/payment.schemas');

const router = express.Router();

// Per-user limit on payment init calls — stops abusers from spamming pending
// rows / amplifying outbound provider calls.
const initLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.userId?.toString() || req.ip,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many payment attempts, slow down' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhooks — no auth (raw body is handled in app.js before express.json runs)
router.post('/oxprocessing/webhook', paymentController.oxprocessingWebhook);
router.post('/korapay/webhook', paymentController.korapayWebhook);

// Protected routes
router.use(authenticate);
router.get('/packages', paymentController.getPackages);
router.post('/validate-promo', validate(schemas.validatePromoSchema), paymentController.validatePromo);
router.get('/promo/:code/status', paymentController.getPromoStatus);

// 0xProcessing (crypto)
router.post('/oxprocessing/create', initLimiter, validate(schemas.oxprocessingCreateSchema), paymentController.oxprocessingCreate);

// KoraPay (Nigeria)
router.post('/korapay/initialize', initLimiter, validate(schemas.initSchema), paymentController.korapayInitialize);
router.get('/korapay/verify/:reference', paymentController.korapayVerify);

router.get('/history', paymentController.getHistory);

module.exports = router;
