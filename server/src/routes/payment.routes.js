const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Webhooks — no auth (raw body is handled in app.js before express.json runs)
router.post('/oxprocessing/webhook', paymentController.oxprocessingWebhook);
router.post('/korapay/webhook', paymentController.korapayWebhook);

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
