const { z } = require('zod');

const messageSchema = z.object({
  text: z.string().trim().min(1, 'Message cannot be empty').max(4000, 'Message is too long'),
});

const escalateSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

const startConversationSchema = z.object({
  text: z.string().trim().min(1).max(4000).optional(),
});

module.exports = { messageSchema, escalateSchema, startConversationSchema };
