const mongoose = require('mongoose');

// A support conversation between one user and the support system (AI + humans).
// Messages live in the separate SupportMessage collection (avoids the 16MB doc
// cap on long threads), mirroring the CreditTransaction-style separation.
const supportConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['AI', 'WAITING_HUMAN', 'HUMAN', 'RESOLVED', 'CLOSED'],
      default: 'AI',
    },
    // The admin who has taken over the conversation (null while AI-handled).
    assignedAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // When true the AI may answer new user messages; flipped off once a human
    // takes over (or via the admin kill-switch).
    aiEnabled: { type: Boolean, default: true },
    lastMessagePreview: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    unreadForUser: { type: Number, default: 0 },
    unreadForAdmin: { type: Number, default: 0 },
    escalatedAt: { type: Date, default: null },
    escalationReason: { type: String, default: null },
  },
  { timestamps: true }
);

supportConversationSchema.index({ userId: 1, lastMessageAt: -1 });
supportConversationSchema.index({ status: 1, lastMessageAt: -1 });
supportConversationSchema.index({ assignedAdminId: 1 });

module.exports = mongoose.model('SupportConversation', supportConversationSchema);
