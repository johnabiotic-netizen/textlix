const express = require('express');
const deviceController = require('../controllers/device.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.post('/register',       deviceController.register);
router.get('/',                deviceController.list);
router.delete('/:tokenId',     deviceController.remove);

module.exports = router;
