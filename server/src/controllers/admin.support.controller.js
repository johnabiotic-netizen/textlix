const SupportConversation = require('../models/SupportConversation');
const SupportMessage = require('../models/SupportMessage');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const support = require('../services/support.service');
const supportUsage = require('../services/support-usage');
const settings = require('../services/support-settings');

function serializeConversation(c, user, assignedAdminName, staleClaim) {
  return {
    id: c._id,
    userId: c.userId,
    user: user ? { id: user._id, name: user.name, email: user.email } : null,
    status: c.status,
    aiEnabled: c.aiEnabled,
    assignedAdminId: c.assignedAdminId ? String(c.assignedAdminId) : null,
    assignedAdminName: assignedAdminName || null,
    staleClaim: !!staleClaim, // assigned agent went quiet while the user waits
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

async function adminName(id) {
  if (!id) return null;
  const a = await User.findById(id, 'name');
  return a?.name || 'another agent';
}

async function takeoverMinutes() {
  return Math.max(1, await settings.getNumber('support_takeover_minutes', 5));
}

// A claim is "stale" (stealable) when another agent holds it, the user spoke
// last (so they're waiting), and there's been no agent reply for the window.
function isStaleClaim(c, takeoverMin) {
  if (!c.assignedAdminId || c.lastSender !== 'USER') return false;
  return new Date(c.lastMessageAt).getTime() < Date.now() - takeoverMin * 60 * 1000;
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

    const [convos, total, waitingCount, takeoverMin] = await Promise.all([
      SupportConversation.find(filter).sort({ lastMessageAt: -1 }).skip((page - 1) * limit).limit(limit),
      SupportConversation.countDocuments(filter),
      SupportConversation.countDocuments({ status: 'WAITING_HUMAN' }),
      takeoverMinutes(),
    ]);

    const [users, admins] = await Promise.all([
      User.find({ _id: { $in: convos.map((c) => c.userId) } }, 'name email'),
      (() => {
        const ids = convos.map((c) => c.assignedAdminId).filter(Boolean);
        return ids.length ? User.find({ _id: { $in: ids } }, 'name') : [];
      })(),
    ]);
    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const adminMap = new Map(admins.map((a) => [String(a._id), a.name]));

    success(res, {
      conversations: convos.map((c) =>
        serializeConversation(c, userMap.get(String(c.userId)), adminMap.get(String(c.assignedAdminId)), isStaleClaim(c, takeoverMin))
      ),
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
      waitingCount,
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/support/usage
exports.getUsage = async (req, res, next) => {
  try {
    const u = await supportUsage.summary();
    const handled = u.conversations + u.deflected;
    success(res, { ...u, deflectionRate: handled > 0 ? Math.round((u.deflected / handled) * 100) : 0 });
  } catch (err) {
    next(err);
  }
};

// GET /admin/support/conversations/:id/messages
exports.getMessages = async (req, res, next) => {
  try {
    const convo = await loadConversation(req.params.id);
    const [messages, user, assigned, takeoverMin] = await Promise.all([
      SupportMessage.find({ conversationId: convo._id }).sort({ createdAt: 1 }),
      User.findById(convo.userId, 'name email creditBalance'),
      convo.assignedAdminId ? User.findById(convo.assignedAdminId, 'name') : null,
      takeoverMinutes(),
    ]);
    await SupportConversation.findByIdAndUpdate(convo._id, { $set: { unreadForAdmin: 0 } });
    success(res, {
      conversation: serializeConversation(convo, user, assigned?.name, isStaleClaim(convo, takeoverMin)),
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

// Atomically claim a conversation. Succeeds if it's unclaimed, already mine, OR
// it's a STALE claim held by an unresponsive agent (user waiting past the
// takeover window). The whole condition is one findOneAndUpdate so two agents
// can't both win, and you can't steal a claim whose owner is still active.
async function claimFor(convoId, adminId) {
  const cutoff = new Date(Date.now() - (await takeoverMinutes()) * 60 * 1000);
  const claimed = await SupportConversation.findOneAndUpdate(
    {
      _id: convoId,
      $or: [
        { assignedAdminId: null },
        { assignedAdminId: adminId },
        { assignedAdminId: { $ne: null }, lastSender: 'USER', lastMessageAt: { $lt: cutoff } },
      ],
    },
    { $set: { assignedAdminId: adminId, status: 'HUMAN', aiEnabled: false } },
    { new: true }
  );
  if (!claimed) {
    const current = await SupportConversation.findById(convoId, 'assignedAdminId');
    throw new AppError('CONFLICT', 409, `${await adminName(current?.assignedAdminId)} is handling this chat and is still active.`);
  }
  return claimed;
}

// POST /admin/support/conversations/:id/assign — take ownership (or steal stale).
exports.assign = async (req, res, next) => {
  try {
    const convo = await loadConversation(req.params.id);
    const prevOwner = convo.assignedAdminId ? String(convo.assignedAdminId) : null;
    await claimFor(convo._id, req.user.userId);
    if (prevOwner !== String(req.user.userId)) {
      support.emitToAdmins('support:claimed', {
        conversationId: convo._id,
        adminId: req.user.userId,
        adminName: await adminName(req.user.userId),
      });
    }
    success(res, { ok: true });
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

    const prevOwner = convo.assignedAdminId ? String(convo.assignedAdminId) : null;
    await claimFor(convo._id, req.user.userId); // 409 if owned by an active agent

    if (prevOwner !== String(req.user.userId)) {
      support.emitToAdmins('support:claimed', {
        conversationId: convo._id,
        adminId: req.user.userId,
        adminName: await adminName(req.user.userId),
      });
    }

    await support.appendMessage(convo, { sender: 'AGENT', text, adminId: req.user.userId });
    await SupportConversation.findByIdAndUpdate(convo._id, { $set: { unreadForAdmin: 0 } });

    support.emitToUser(convo.userId, 'support:message', { conversationId: convo._id, sender: 'AGENT', text });
    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /admin/support/conversations/:id/release — hand back to the pool.
exports.release = async (req, res, next) => {
  try {
    const convo = await loadConversation(req.params.id);
    if (convo.assignedAdminId && String(convo.assignedAdminId) !== String(req.user.userId)) {
      throw new AppError('FORBIDDEN', 403, 'Only the agent handling this chat can release it.');
    }
    await SupportConversation.findByIdAndUpdate(convo._id, { $set: { assignedAdminId: null, status: 'WAITING_HUMAN' } });
    support.emitToAdmins('support:released', { conversationId: convo._id });
    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /admin/support/conversations/:id/resolve
exports.resolve = async (req, res, next) => {
  try {
    const convo = await loadConversation(req.params.id);
    // Resolving re-arms the AI so the user gets Ada again next time they write in.
    await SupportConversation.findByIdAndUpdate(convo._id, { $set: { status: 'RESOLVED', assignedAdminId: null, aiEnabled: true, resolvedBy: req.user.userId } });
    support.emitToUser(convo.userId, 'support:resolved', { conversationId: convo._id });
    support.emitToAdmins('support:released', { conversationId: convo._id });
    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /admin/support/conversations/:id/reopen — back to the pool for anyone.
exports.reopen = async (req, res, next) => {
  try {
    const convo = await loadConversation(req.params.id);
    await SupportConversation.findByIdAndUpdate(convo._id, { $set: { status: 'WAITING_HUMAN', assignedAdminId: null } });
    support.emitToAdmins('support:released', { conversationId: convo._id });
    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
};

// POST /admin/support/conversations/:id/ai-toggle
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
