const express = require('express');
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/admin.controller');
const adminCreatorController = require('../controllers/admin.creator.controller');
const adminSupport = require('../controllers/admin.support.controller');
const adminAgents = require('../controllers/admin.agents.controller');
const adminAnalytics = require('../controllers/admin.analytics.controller');
const { authenticate, requireSupportStaff, adminSectionGuard } = require('../middleware/auth.middleware');
const AuditLog = require('../models/AuditLog');
const { success } = require('../utils/response');

const router = express.Router();

// Admin endpoints get a tighter rate limit than the general API
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Slow down' } },
});

router.use(authenticate, requireSupportStaff, adminLimiter, adminSectionGuard);

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

// Conversion / acquisition analytics
router.get('/analytics/overview', adminAnalytics.getOverview);
router.get('/analytics/timeseries', adminAnalytics.getTimeseries);
router.get('/analytics/export', adminAnalytics.exportReport);

router.get('/provider-health', adminController.getProviderHealth);

// Promo codes
router.get('/promo-codes', adminController.getPromoCodes);
router.post('/promo-codes', adminController.createPromoCode);
router.patch('/promo-codes/:id', adminController.updatePromoCode);
router.delete('/promo-codes/:id', adminController.deletePromoCode);

// Debug: raw Get-SMS API — try getcountprices with any country/method combo
router.get('/debug/getsms-prices', async (req, res, next) => {
  try {
    const axios = require('axios');
    const country = req.query.country || 'ssha';
    const method  = req.query.method  || 'getcountprices';
    const params  = { userkey: process.env.GETSMS_API_KEY, method, country };
    const url = 'https://get-sms.com/api/v2/rent/';
    const { data } = await axios.get(url, { params, timeout: 15000 });
    success(res, { sent: params, raw: data });
  } catch (err) {
    next(err);
  }
});

// Debug: call getorders to verify API key works + see what country names look like in orders
router.get('/debug/getsms-orders', async (req, res, next) => {
  try {
    const axios = require('axios');
    const { data } = await axios.get('https://get-sms.com/api/v2/rent/', {
      params: { userkey: process.env.GETSMS_API_KEY, method: 'getorders' },
      timeout: 15000,
    });
    success(res, { raw: data });
  } catch (err) {
    next(err);
  }
});

// Creator / affiliate management
router.get('/creators', adminCreatorController.getCreators);
router.get('/creators/applications', adminCreatorController.getApplications);
router.post('/creators/:id/approve', adminCreatorController.approveCreator);
router.post('/creators/:id/reject', adminCreatorController.rejectCreator);
router.get('/creators/withdrawals', adminCreatorController.getWithdrawals);
router.post('/creators/withdrawals/:id/pay', adminCreatorController.markWithdrawalPaid);
router.post('/creators/withdrawals/:id/reject', adminCreatorController.rejectWithdrawal);

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

// ── Support chat console ──────────────────────────────────────────────────────
router.get('/support/usage', adminSupport.getUsage);
router.get('/support/conversations', adminSupport.listConversations);
router.get('/support/conversations/:id/messages', adminSupport.getMessages);
router.post('/support/conversations/:id/messages', adminSupport.reply);
router.post('/support/conversations/:id/assign', adminSupport.assign);
router.post('/support/conversations/:id/release', adminSupport.release);
router.post('/support/conversations/:id/resolve', adminSupport.resolve);
router.post('/support/conversations/:id/reopen', adminSupport.reopen);
router.post('/support/conversations/:id/ai-toggle', adminSupport.aiToggle);

// ── Support agents (admin-only; enforced by adminSectionGuard) ────────────────
router.get('/agents', adminAgents.list);
router.post('/agents', adminAgents.create);
router.patch('/agents/:id', adminAgents.update);

module.exports = router;
