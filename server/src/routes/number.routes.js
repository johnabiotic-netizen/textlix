const express = require('express');
const rateLimit = require('express-rate-limit');
const numberController = require('../controllers/number.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.userId?.toString() || req.ip,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many orders, please slow down' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// Browsing endpoints — data changes at most every hour (price cache TTL).
// private: user-specific session, max-age=300: browser caches for 5 min.
const browseCache = (req, res, next) => { res.set('Cache-Control', 'private, max-age=300'); next(); };

router.get('/countries', browseCache, numberController.getCountries);
router.get('/countries/:countryId/services', browseCache, numberController.getServices);
router.get('/countries/:countryId/rental-price', browseCache, numberController.getRentalPrice);
router.get('/services', browseCache, numberController.getServiceList);
router.get('/services/:serviceSlug/countries', browseCache, numberController.getCountriesForService);
router.get('/services/:serviceSlug/recommendations', browseCache, numberController.getRecommendations);
router.post('/order', orderLimiter, numberController.orderNumber);
router.post('/order/rental', orderLimiter, numberController.orderRental);
router.get('/active', numberController.getActiveOrders);
router.get('/history', numberController.getOrderHistory);
router.get('/:orderId', numberController.getOrder);
router.post('/:orderId/cancel', numberController.cancelOrder);
router.post('/:orderId/resend', numberController.resendSMS);

module.exports = router;
