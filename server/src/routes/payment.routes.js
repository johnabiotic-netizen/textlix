const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

const rawBody = express.raw({ type: 'application/json' });

// Webhooks — no auth, raw body for signature verification
router.post('/oxprocessing/webhook', rawBody, paymentController.oxprocessingWebhook);
router.post('/korapay/webhook', rawBody, paymentController.korapayWebhook);

// Protected routes
router.use(authenticate);
router.get('/packages', paymentController.getPackages);

// 0xProcessing (crypto)
router.post('/oxprocessing/create', paymentController.oxprocessingCreate);

// KoraPay (Nigeria)
router.post('/korapay/initialize', paymentController.korapayInitialize);
router.get('/korapay/verify/:reference', paymentController.korapayVerify);

router.get('/history', paymentController.getHistory);

module.exports = router;
