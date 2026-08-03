const SupportConversation = require('../models/SupportConversation');
const SupportMessage = require('../models/SupportMessage');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const support = require('../services/support.service');
const r2 = require('../services/r2.service');

const OPEN_STATUSES = ['AI', 'WAITING_HUMAN', 'HUMAN'];

function serializeConversation(c) {
  return {
    id: c._id,
    status: c.status,
    lastMessagePreview: c.lastMessagePreview,
    lastMessageAt: c.lastMessageAt,
    unread: c.unreadForUser,
    createdAt: c.createdAt,
  };
}

// Load a conversation and assert the caller owns it.
async function loadOwned(conversationId, userId) {
  const convo = await SupportConversation.findById(conversationId);
  if (!convo) throw new AppError('NOT_FOUND', 404, 'Conversation not found');
  if (String(convo.userId) !== String(userId)) {
    throw new AppError('FORBIDDEN', 403, 'Not your conversation');
  }
  return convo;
}

// GET /support/conversations — the user's history, newest first.
exports.listConversations = async (req, res, next) => {
  try {
    const convos = await SupportConversation.find({ userId: req.user.userId })
      .sort({ lastMessageAt: -1 })
      .limit(50);
    success(res, { conversations: convos.map(serializeConversation) });
  } catch (err) {
    next(err);
  }
};

// POST /support/conversations — reuse the user's open thread or start a new one.
// Optionally accepts a first message in the body.
exports.startConversation = async (req, res, next) => {
  try {
    let convo = await SupportConversation.findOne({
      userId: req.user.userId,
      status: { $in: OPEN_STATUSES },
    }).sort({ lastMessageAt: -1 });

    if (!convo) {
      convo = await SupportConversation.create({ userId: req.user.userId });
    }

    const text = req.body.text && req.body.text.trim();
    if (text) {
      await support.handleUserMessage(convo, text);
      convo = await SupportConversation.findById(convo._id);
    }

    success(res, { conversation: serializeConversation(convo) }, 201);
  } catch (err) {
    next(err);
  }
};

// GET /support/conversations/:id/messages — full thread (oldest first).
exports.getMessages = async (req, res, next) => {
  try {
    const convo = await loadOwned(req.params.id, req.user.userId);
    const messages = await SupportMessage.find({ conversationId: convo._id }).sort({ createdAt: 1 });
    success(res, {
      conversation: serializeConversation(convo),
      messages: messages.map(support.serializeMessage),
    });
  } catch (err) {
    next(err);
  }
};

// POST /support/conversations/:id/messages — user sends a message.
exports.sendMessage = async (req, res, next) => {
  try {
    const convo = await loadOwned(req.params.id, req.user.userId);
    if (convo.status === 'CLOSED') {
      throw new AppError('VALIDATION_ERROR', 400, 'This conversation is closed. Start a new one.');
    }
    await support.handleUserMessage(convo, req.body.text.trim());
    const messages = await SupportMessage.find({ conversationId: convo._id }).sort({ createdAt: 1 });
    success(res, { messages: messages.map(support.serializeMessage) });
  } catch (err) {
    next(err);
  }
};

// POST /support/conversations/:id/image — user shares an image (optional caption).
exports.sendImage = async (req, res, next) => {
  try {
    if (!r2.enabled()) throw new AppError('INTERNAL_ERROR', 503, 'Image sharing is not available right now.');
    const convo = await loadOwned(req.params.id, req.user.userId);
    if (convo.status === 'CLOSED') throw new AppError('VALIDATION_ERROR', 400, 'This conversation is closed. Start a new one.');
    if (!req.file) throw new AppError('VALIDATION_ERROR', 400, 'No image provided');

    const imageUrl = await r2.uploadImage(req.file.buffer, req.file.mimetype, 'support');
    const caption = (req.body.text || '').trim();

    // Reopen a resolved/closed chat, mirroring handleUserMessage.
    if (convo.status === 'RESOLVED' || convo.status === 'CLOSED') {
      await SupportConversation.findByIdAndUpdate(convo._id, { $set: { status: 'AI', aiEnabled: true, assignedAdminId: null } });
    }

    await support.appendMessage(convo, { sender: 'USER', text: caption, imageUrl });
    support.emitToAdmins('support:new', { conversationId: convo._id, userId: convo.userId, preview: caption || '📷 Photo' });

    const messages = await SupportMessage.find({ conversationId: convo._id }).sort({ createdAt: 1 });
    success(res, { messages: messages.map(support.serializeMessage) });
  } catch (err) {
    next(err);
  }
};

// POST /support/conversations/:id/escalate — manual "Talk to a human".
exports.escalate = async (req, res, next) => {
  try {
    const convo = await loadOwned(req.params.id, req.user.userId);
    await support.escalate(convo, req.body.reason || 'User requested a human agent');
    const updated = await SupportConversation.findById(convo._id);
    success(res, { conversation: serializeConversation(updated) });
  } catch (err) {
    next(err);
  }
};

// POST /support/conversations/:id/read — clear the user's unread counter.
exports.markRead = async (req, res, next) => {
  try {
    const convo = await loadOwned(req.params.id, req.user.userId);
    await SupportConversation.findByIdAndUpdate(convo._id, { $set: { unreadForUser: 0 } });
    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
};
