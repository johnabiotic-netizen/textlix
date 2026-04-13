const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Webhooks don't need auth
router.post('/paystack/webhook', express.raw({ type: 'application/json' }), paymentController.paystackWebhook);
router.post('/crypto/webhook', paymentController.cryptoWebhook);

// Protected routes
router.use(authenticate);
router.get('/packages', paymentController.getPackages);
router.post('/paystack/initialize', paymentController.paystackInitialize);
router.get('/paystack/verify/:reference', paymentController.paystackVerify);
router.post('/crypto/create', paymentController.cryptoCreate);
router.get('/history', paymentController.getHistory);

module.exports = router;
