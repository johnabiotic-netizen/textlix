const SupportConversation = require('../models/SupportConversation');
const SupportMessage = require('../models/SupportMessage');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const support = require('../services/support.service');
const supportUsage = require('../services/support-usage');

function serializeConversation(c, user) {
  return {
    id: c._id,
    userId: c.userId,
    user: user ? { id: user._id, name: user.name, email: user.email } : null,
    status: c.status,
    aiEnabled: c.aiEnabled,
    assignedAdminId: c.assignedAdminId,
    lastMessagePreview: c.lastMessagePreview,
    lastMessageAt: c.lastMessageAt,
    unread: c.unreadForAdmin,
    escalatedAt: c.escalatedAt,
    escalationReason: c.escalationReason,
    createdAt: c.createdAt,
  };
}

async function loadConversation(id) {
  const convo = await SupportConversation.findById(id);
  if (!convo) throw new AppError('NOT_FOUND', 404, 'Conversation not found');
  return convo;
}

// GET /admin/support/conversations?status=&page=
exports.listConversations = async (req, res, next) => {
  try {
    const { status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 25;

    const filter = {};
    if (status === 'waiting') filter.status = 'WAITING_HUMAN';
    else if (status === 'human') filter.status = 'HUMAN';
    else if (status === 'ai') filter.status = 'AI';
    else if (status === 'resolved') filter.status = { $in: ['RESOLVED', 'CLOSED'] };
    // default (no/unknown status) → all

    const [convos, total, waitingCount] = await Promise.all([
      SupportConversation.find(filter)
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      SupportConversation.countDocuments(filter),
      SupportConversation.countDocuments({ status: 'WAITING_HUMAN' }),
    ]);

    const users = await User.find(
      { _id: { $in: convos.map((c) => c.userId) } },
      'name email'
    );
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    success(res, {
      conversations: convos.map((c) => serializeConversation(c, userMap.get(String(c.userId)))),
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
      waitingCount,
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/support/usage — this month's AI spend + deflection rate for the dashboard.
exports.getUsage = async (req, res, next) => {
  try {
    const u = await supportUsage.summary();
    const handled = u.conversations + u.deflected;
    success(res, {
      ...u,
      deflectionRate: handled > 0 ? Math.round((u.deflected / handled) * 100) : 0,
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/support/conversations/:id/messages
exports.getMessages = async (req, res, next) => {
  try {
    const convo = await loadConversation(req.params.id);
    const [messages, user] = await Promise.all([
      SupportMessage.find({ conversationId: convo._id }).sort({ createdAt: 1 }),
      User.findById(convo.userId, 'name email creditBalance'),
    ]);
    // Viewing the thread clears the admin unread badge.
    await SupportConversation.findByIdAndUpdate(convo._id, { $set: { unreadForAdmin: 0 } });
    success(res, {
      conversation: serializeConversation(convo, user),
      messages: messages.map((m) => ({
        id: m._id,
        sender: m.sender,
        text: m.text,
        adminId: m.adminId,
        deflected: !!(m.meta && m.meta.deflected),
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/support/conversations/:id/messages — human agent reply.
exports.reply = async (req, res, next) => {
  try {
    const convo = await loadConversation(req.params.id);
    const text = req.body.text && req.body.text.trim();
    if (!text) throw new AppError('VALIDATION_ERROR', 400, 'Message cannot be empty');

    await support.appendMessage(convo, { sender: 'AGENT', text, adminId: req.user.userId });
    await SupportConversation.findByIdAndUpdate(convo._id, {
      $set: {
        status: 'HUMAN',
        aiEnabled: false,
        assignedAdminId: convo.assignedAdminId || req.user.userId,
        unreadForAdmin: 0,
      },
    });

    support.emitToUser(convo.userId, 'support:message', {
      conversationId: convo._id,
      sender: 'AGENT',
      text,
    });

    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /admin/support/conversations/:id/assign — claim the conversation.
exports.assign = async (req, res, next) => {
  try {
    const convo = await loadConversation(req.params.id);
    await SupportConversation.findByIdAndUpdate(convo._id, {
      $set: { assignedAdminId: req.user.userId, status: 'HUMAN', aiEnabled: false },
    });
    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /admin/support/conversations/:id/resolve
exports.resolve = async (req, res, next) => {
  try {
    const convo = await loadConversation(req.params.id);
    await SupportConversation.findByIdAndUpdate(convo._id, { $set: { status: 'RESOLVED' } });
    support.emitToUser(convo.userId, 'support:resolved', { conversationId: convo._id });
    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /admin/support/conversations/:id/reopen
exports.reopen = async (req, res, next) => {
  try {
    const convo = await loadConversation(req.params.id);
    await SupportConversation.findByIdAndUpdate(convo._id, { $set: { status: 'HUMAN' } });
    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /admin/support/conversations/:id/ai-toggle — hand back to / take from AI.
exports.aiToggle = async (req, res, next) => {
  try {
    const convo = await loadConversation(req.params.id);
    const aiEnabled = !convo.aiEnabled;
    await SupportConversation.findByIdAndUpdate(convo._id, {
      $set: { aiEnabled, status: aiEnabled ? 'AI' : 'HUMAN' },
    });
    success(res, { aiEnabled });
  } catch (err) {
    next(err);
  }
};
