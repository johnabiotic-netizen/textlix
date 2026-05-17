const express = require('express');
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const AuditLog = require('../models/AuditLog');
const { success } = require('../utils/response');

const router = express.Router();

// Admin endpoints get a tighter rate limit than the general API
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Slow down' } },
});

router.use(authenticate, requireAdmin, adminLimiter);

router.get('/dashboard', adminController.getDashboard);

router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser);
router.patch('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/:id/adjust-credits', adminController.adjustCredits);

router.get('/transactions', adminController.getTransactions);
router.get('/payments', adminController.getPayments);
router.get('/orders', adminController.getOrders);

router.get('/countries', adminController.getCountries);
router.patch('/countries/:id', adminController.updateCountry);

router.get('/services', adminController.getServices);
router.patch('/services/:id', adminController.updateService);

router.get('/pricing', adminController.getPricing);
router.patch('/pricing/:id', adminController.updatePricing);

router.get('/settings', adminController.getSettings);
router.patch('/settings', adminController.updateSettings);

router.get('/revenue-report', adminController.getRevenueReport);
router.get('/export/transactions', adminController.exportTransactions);

router.get('/provider-health', adminController.getProviderHealth);

// Promo codes
router.get('/promo-codes', adminController.getPromoCodes);
router.post('/promo-codes', adminController.createPromoCode);
router.patch('/promo-codes/:id', adminController.updatePromoCode);
router.delete('/promo-codes/:id', adminController.deletePromoCode);

// Debug: raw Get-SMS API response for diagnosing price parsing
router.get('/debug/getsms-prices', async (req, res, next) => {
  try {
    const axios = require('axios');
    const country = req.query.country || 'ssha'; // default = US
    const service = req.query.service || 'wa';   // default = WhatsApp
    const { data } = await axios.get('https://get-sms.com/api/v2/rent/', {
      params: { userkey: process.env.GETSMS_API_KEY, method: 'getcountprices', country, service },
      timeout: 15000,
    });
    success(res, { country, service, raw: data });
  } catch (err) {
    next(err);
  }
});

// Audit log viewer
router.get('/audit-logs', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.success !== undefined) filter.success = req.query.success === 'true';

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);
    success(res, { logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
