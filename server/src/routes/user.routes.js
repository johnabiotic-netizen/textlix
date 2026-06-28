const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.patch('/me/password', userController.changePassword);
router.get('/me/stats', userController.getStats);
router.post('/attribution', userController.setAttribution);
router.get('/me/referral', userController.getReferral);
router.get('/me/api-keys', userController.getApiKeys);
router.post('/me/api-keys', userController.createApiKey);
router.delete('/me/api-keys/:id', userController.deleteApiKey);

module.exports = router;
