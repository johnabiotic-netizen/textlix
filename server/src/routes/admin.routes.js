const express = require('express');
const adminController = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate, requireAdmin);

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

module.exports = router;
