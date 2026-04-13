const express = require('express');
const creditController = require('../controllers/credit.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/balance', creditController.getBalance);
router.get('/history', creditController.getHistory);

module.exports = router;
