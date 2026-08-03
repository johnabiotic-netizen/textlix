const mongoose = require('mongoose');

// One message in a support thread. `sender` distinguishes the human user, the
// AI, a human agent, or a system notice. `meta` is free-form: for AI replies it
// carries { model, inputTokens, outputTokens, cachedTokens, costUsd, tools,
// deflected, escalated } so the admin cost dashboard can aggregate spend.
const supportMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportConversation',
      required: true,
      index: true,
    },
    sender: { type: String, enum: ['USER', 'AI', 'AGENT', 'SYSTEM'], required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    text: { type: String, default: '' }, // optional — a message may be image-only
    imageUrl: { type: String, default: null }, // R2 public URL of a shared image, if any
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

supportMessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('SupportMessage', supportMessageSchema);
