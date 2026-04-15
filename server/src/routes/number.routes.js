const express = require('express');
const numberController = require('../controllers/number.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/countries', numberController.getCountries);
router.get('/countries/:countryId/services', numberController.getServices);
router.get('/countries/:countryId/rental-price', numberController.getRentalPrice);
router.get('/services', numberController.getServiceList);
router.get('/services/:serviceSlug/countries', numberController.getCountriesForService);
router.post('/order', numberController.orderNumber);
router.post('/order/rental', numberController.orderRental);
router.get('/active', numberController.getActiveOrders);
router.get('/history', numberController.getOrderHistory);
router.post('/:orderId/cancel', numberController.cancelOrder);
router.post('/:orderId/resend', numberController.resendSMS);

module.exports = router;
