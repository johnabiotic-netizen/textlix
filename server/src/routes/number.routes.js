const express = require('express');
const numberController = require('../controllers/number.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/countries', numberController.getCountries);
router.get('/countries/:countryId/services', numberController.getServices);
router.post('/order', numberController.orderNumber);
router.get('/active', numberController.getActiveOrders);
router.get('/history', numberController.getOrderHistory);
router.post('/:orderId/cancel', numberController.cancelOrder);
router.post('/:orderId/resend', numberController.resendSMS);

module.exports = router;
