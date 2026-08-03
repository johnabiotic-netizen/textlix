const express = require('express');
const rateLimit = require('express-rate-limit');
const support = require('../controllers/support.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const schemas = require('../schemas/support.schemas');
const upload = require('../middleware/upload');

const router = express.Router();

// Throttle inbound messages per client — protects against spam and runaway
// AI cost from a single user. Read-only routes are not limited.
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Slow down a moment' } },
});

router.use(authenticate);

router.get('/conversations', support.listConversations);
router.post('/conversations', messageLimiter, validate(schemas.startConversationSchema), support.startConversation);
router.get('/conversations/:id/messages', support.getMessages);
router.post('/conversations/:id/messages', messageLimiter, validate(schemas.messageSchema), support.sendMessage);
router.post('/conversations/:id/image', messageLimiter, upload.single('image'), support.sendImage);
router.post('/conversations/:id/escalate', validate(schemas.escalateSchema), support.escalate);
router.post('/conversations/:id/read', support.markRead);

module.exports = router;
