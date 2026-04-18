const express = require('express');
const numberController = require('../controllers/number.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

// Browsing endpoints — data changes at most every hour (price cache TTL).
// private: user-specific session, max-age=300: browser caches for 5 min.
const browseCache = (req, res, next) => { res.set('Cache-Control', 'private, max-age=300'); next(); };

router.get('/countries', browseCache, numberController.getCountries);
router.get('/countries/:countryId/services', browseCache, numberController.getServices);
router.get('/countries/:countryId/rental-price', browseCache, numberController.getRentalPrice);
router.get('/services', browseCache, numberController.getServiceList);
router.get('/services/:serviceSlug/countries', browseCache, numberController.getCountriesForService);
router.get('/services/:serviceSlug/recommendations', browseCache, numberController.getRecommendations);
router.post('/order', numberController.orderNumber);
router.post('/order/rental', numberController.orderRental);
router.get('/active', numberController.getActiveOrders);
router.get('/history', numberController.getOrderHistory);
router.post('/:orderId/cancel', numberController.cancelOrder);
router.post('/:orderId/resend', numberController.resendSMS);

module.exports = router;
