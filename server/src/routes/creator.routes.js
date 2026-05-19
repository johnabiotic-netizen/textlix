const express = require('express');
const creator = require('../controllers/creator.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.post('/apply', creator.apply);
router.get('/me', creator.getMe);
router.get('/earnings', creator.getEarnings);
router.get('/referrals', creator.getReferrals);
router.put('/bank', creator.updateBank);
router.post('/withdraw', creator.requestWithdrawal);
router.get('/withdrawals', creator.getWithdrawals);

module.exports = router;
