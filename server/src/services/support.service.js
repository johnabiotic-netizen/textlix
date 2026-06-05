const SupportConversation = require('../models/SupportConversation');
const SupportMessage = require('../models/SupportMessage');
const { getIO } = require('../config/io');
const logger = require('../config/logger');

const PREVIEW_LEN = 120;

// ── Socket emit helpers ───────────────────────────────────────────────────────
function emitToUser(userId, event, payload) {
  const io = getIO();
  if (io) io.to(`user:${String(userId)}`).emit(event, payload);
}

function emitToAdmins(event, payload) {
  const io = getIO();
  if (io) io.to('admin:support').emit(event, payload);
}

// Shape a message for the wire / API responses.
function serializeMessage(m) {
  return {
    id: m._id,
    conversationId: m.conversationId,
    sender: m.sender,
    text: m.text,
    deflected: !!(m.meta && m.meta.deflected),
    createdAt: m.createdAt,
  };
}

// Persist a message and roll the conversation's preview / unread counters.
// USER messages mark unread for admins; everything else marks unread for the user.
async function appendMessage(conversation, { sender, text, adminId = null, meta = {} }) {
  const msg = await SupportMessage.create({
    conversationId: conversation._id,
    sender,
    adminId,
    text,
    meta,
  });

  const unreadField = sender === 'USER' ? 'unreadForAdmin' : 'unreadForUser';
  await SupportConversation.findByIdAndUpdate(conversation._id, {
    $set: { lastMessagePreview: String(text).slice(0, PREVIEW_LEN), lastMessageAt: new Date() },
    $inc: { [unreadField]: 1 },
  });

  return msg;
}

// Mark a conversation as needing a human and notify the admin console + (later)
// email. Idempotent-ish: only flips status/escalatedAt when not already waiting.
async function escalate(conversation, reason) {
  const set = { aiEnabled: false };
  if (conversation.status === 'AI' || conversation.status === 'HUMAN') {
    set.status = 'WAITING_HUMAN';
  }
  if (!conversation.escalatedAt) {
    set.escalatedAt = new Date();
    set.escalationReason = reason || 'Escalated to a human agent';
  }
  await SupportConversation.findByIdAndUpdate(conversation._id, { $set: set });

  emitToAdmins('support:escalated', {
    conversationId: conversation._id,
    userId: conversation.userId,
    reason: set.escalationReason || conversation.escalationReason,
  });

  // Best-effort email alert (added in the email util; no-op/log if absent).
  try {
    const { sendSupportEscalationEmail } = require('../utils/email');
    if (sendSupportEscalationEmail) {
      const to = process.env.SUPPORT_ESCALATION_EMAIL || process.env.ADMIN_EMAIL;
      if (to) {
        sendSupportEscalationEmail(to, {
          conversationId: String(conversation._id),
          preview: conversation.lastMessagePreview,
          reason: set.escalationReason,
        }).catch((err) => logger.warn('Support escalation email failed:', err.message));
      }
    }
  } catch (_) {
    /* email util not extended yet — ignore */
  }
}

// Entry point for an inbound USER message. Persists it, notifies admins, then
// hands to the AI if available + enabled; otherwise routes straight to a human.
// The AI service is loaded via a guarded require so this works before Phase 2
// ships support-ai.service.js (same pattern as the optional push.service).
async function handleUserMessage(conversation, text) {
  const userMsg = await appendMessage(conversation, { sender: 'USER', text });

  emitToAdmins('support:new', {
    conversationId: conversation._id,
    userId: conversation.userId,
    preview: String(text).slice(0, PREVIEW_LEN),
  });

  // FAQ deflection — answer common questions for $0 before touching the AI.
  // Only while the AI is in charge of this conversation (not after a human took over).
  if (conversation.aiEnabled) {
    try {
      const faq = require('./support-faq.service');
      const answer = await faq.findAnswer(text);
      if (answer) {
        await appendMessage(conversation, { sender: 'AI', text: answer, meta: { deflected: true } });
        emitToUser(conversation.userId, 'support:message', {
          conversationId: conversation._id,
          sender: 'AI',
          text: answer,
        });
        try { require('./support-usage').record({ deflected: true }); } catch (_) {}
        return userMsg;
      }
    } catch (err) {
      logger.warn('FAQ deflection failed (continuing to AI):', err.message);
    }
  }

  let ai = null;
  try {
    ai = require('./support-ai.service');
  } catch (_) {
    ai = null;
  }

  if (ai && conversation.aiEnabled) {
    try {
      await ai.respond(conversation, text, { appendMessage, escalate, emitToUser, emitToAdmins });
      return userMsg;
    } catch (err) {
      logger.error('Support AI failed, routing to human:', err.message);
      await escalate(conversation, 'AI error — routed to a human');
      return userMsg;
    }
  }

  // No AI (Phase 1, or AI disabled) → make sure a human picks it up.
  await escalate(conversation, conversation.aiEnabled ? 'Awaiting human agent' : 'AI disabled');
  return userMsg;
}

module.exports = {
  PREVIEW_LEN,
  emitToUser,
  emitToAdmins,
  serializeMessage,
  appendMessage,
  escalate,
  handleUserMessage,
};
