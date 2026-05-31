const express = require('express');
const ctrl = require('../controllers/welcome-bonus.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/status', ctrl.status);
router.post('/claim', ctrl.claim);

module.exports = router;
