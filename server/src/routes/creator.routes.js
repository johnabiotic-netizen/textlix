const express = require('express');
const creator = require('../controllers/creator.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const schemas = require('../schemas/creator.schemas');

const router = express.Router();

router.use(authenticate);

router.post('/apply', validate(schemas.applySchema), creator.apply);
router.get('/me', creator.getMe);
router.get('/earnings', creator.getEarnings);
router.get('/referrals', creator.getReferrals);
router.put('/bank', validate(schemas.updateBankSchema), creator.updateBank);
router.put('/referral-code', validate(schemas.updateReferralCodeSchema), creator.updateReferralCode);
router.post('/withdraw', validate(schemas.requestWithdrawalSchema), creator.requestWithdrawal);
router.get('/withdrawals', creator.getWithdrawals);

module.exports = router;
