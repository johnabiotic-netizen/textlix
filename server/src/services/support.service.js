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
    // A USER reply (or a fresh AGENT reply) clears any pending auto-close warning.
    $set: { lastMessagePreview: String(text).slice(0, PREVIEW_LEN), lastMessageAt: new Date(), lastSender: sender, ...((sender === 'USER' || sender === 'AGENT') ? { autoResolveWarnedAt: null } : {}) },
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

  // Email every human agent — but only on the FIRST escalation, so follow-up
  // messages on an already-waiting chat don't re-spam the whole team.
  if (set.escalatedAt) {
    notifyAllAdmins(conversation, set.escalationReason).catch((err) =>
      logger.warn('Support escalation email failed:', err.message)
    );
  }
}

// Notify all support humans (every admin) that a chat needs a person. Recipients
// are all admin accounts plus the optional SUPPORT_ESCALATION_EMAIL inbox.
async function notifyAllAdmins(conversation, reason) {
  let recipients = [];
  try {
    const User = require('../models/User');
    const admins = await User.find({ role: 'ADMIN', isBanned: { $ne: true } }, 'email');
    recipients = admins.map((a) => a.email).filter(Boolean);
  } catch (_) {}
  const extra = process.env.SUPPORT_ESCALATION_EMAIL || process.env.ADMIN_EMAIL;
  if (extra) recipients.push(extra);
  recipients = [...new Set(recipients.map((e) => String(e).toLowerCase()))];
  if (!recipients.length) return;

  const { sendSupportEscalationEmail } = require('../utils/email');
  await sendSupportEscalationEmail(recipients, {
    conversationId: String(conversation._id),
    preview: conversation.lastMessagePreview,
    reason,
  });
}

// Entry point for an inbound USER message. Persists it, notifies admins, then
// hands to the AI if available + enabled; otherwise routes straight to a human.
// The AI service is loaded via a guarded require so this works before Phase 2
// ships support-ai.service.js (same pattern as the optional push.service).
async function handleUserMessage(conversation, text) {
  // If the user comes back after a resolved/closed chat, reopen it fresh with
  // the AI back in charge. A human helping once shouldn't sideline Ada forever —
  // she steps aside only while a human is ACTIVELY handling the conversation.
  if (conversation.status === 'RESOLVED' || conversation.status === 'CLOSED') {
    conversation.status = 'AI';
    conversation.aiEnabled = true;
    conversation.assignedAdminId = null;
    await SupportConversation.findByIdAndUpdate(conversation._id, {
      $set: { status: 'AI', aiEnabled: true, assignedAdminId: null },
    });
  }

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
