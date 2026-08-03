const cron = require('node-cron');
const SupportConversation = require('../models/SupportConversation');
const SupportMessage = require('../models/SupportMessage');
const { emitToUser, emitToAdmins } = require('../services/support.service');
const settings = require('../services/support-settings');
const logger = require('../config/logger');
// Best-effort mobile push (absent in the web-only deploy — degrade to no-op).
let pushService;
try { pushService = require('../services/push.service'); } catch (_) { pushService = { sendToUser: () => {} }; }

let task = null;

// Auto-resolve chats the user has gone quiet on. We only close conversations
// where the ball is in the USER's court — i.e. AI-handled chats (Ada always
// replies, so an idle AI chat means the user left), or human chats where the
// agent spoke last. We NEVER auto-close WAITING_HUMAN or a HUMAN chat whose last
// message was the user's — those are waiting on us, not the other way round.
// Resolving re-arms the AI, so the user just messaging again reopens it fresh.
async function sweep() {
  const resolveMinutes = await settings.getNumber('support_auto_resolve_minutes', 30);
  if (!resolveMinutes || resolveMinutes <= 0) return; // 0 / unset = disabled
  const graceMinutes = await settings.getNumber('support_auto_resolve_grace_minutes', 10);

  const now = Date.now();
  const warnCutoff = new Date(now - resolveMinutes * 60 * 1000);
  const graceCutoff = new Date(now - graceMinutes * 60 * 1000);

  // Only chats where the ball is in the USER's court — never WAITING_HUMAN or a
  // HUMAN chat whose last message was the user's (those are waiting on us).
  const waitingOnUser = [
    { status: 'AI' },
    { status: 'HUMAN', lastSender: { $in: ['AGENT', 'SYSTEM'] } },
  ];

  // ── Stage 1: WARN idle chats we haven't warned yet ───────────────────────────
  const toWarn = await SupportConversation.find({
    lastMessageAt: { $lt: warnCutoff },
    autoResolveWarnedAt: null,
    $or: waitingOnUser,
  }).limit(200);

  for (const c of toWarn) {
    const text = `Are you still there? This chat will close automatically in ${graceMinutes} minute${graceMinutes === 1 ? '' : 's'} if we don't hear back — just reply here to keep it open.`;
    try {
      await SupportMessage.create({ conversationId: c._id, sender: 'SYSTEM', text, meta: { kind: 'auto_resolve_warning' } });
    } catch (_) { continue; }
    // Mark warned + bump the user's unread — but DON'T touch lastMessageAt (that
    // would reset the idle clock; the resolve stage keys off autoResolveWarnedAt).
    await SupportConversation.findByIdAndUpdate(c._id, {
      $set: { autoResolveWarnedAt: new Date() },
      $inc: { unreadForUser: 1 },
    });
    emitToUser(c.userId, 'support:message', { conversationId: c._id, sender: 'SYSTEM', text });
    pushService.sendToUser(c.userId, {
      title: 'Still need help?',
      body: `Your support chat closes in ${graceMinutes} min — reply to keep it open.`,
      data: { type: 'support_message', conversationId: String(c._id) },
    });
  }

  // ── Stage 2: RESOLVE chats warned long enough ago with no reply since ────────
  const toResolve = await SupportConversation.find({
    autoResolveWarnedAt: { $ne: null, $lt: graceCutoff },
    $or: waitingOnUser,
  }).limit(200);

  for (const c of toResolve) {
    await SupportConversation.findByIdAndUpdate(c._id, {
      $set: { status: 'RESOLVED', aiEnabled: true, assignedAdminId: null, autoResolveWarnedAt: null },
    });
    // Persistent note so a returning user sees why it closed (no unread bump).
    try {
      await SupportMessage.create({
        conversationId: c._id,
        sender: 'SYSTEM',
        text: "Closed this chat after a quiet spell — message any time and we'll pick right back up.",
      });
    } catch (_) {}
    emitToUser(c.userId, 'support:resolved', { conversationId: c._id });
    emitToAdmins('support:released', { conversationId: c._id });
  }

  if (toWarn.length || toResolve.length) {
    logger.info(`Support sweep: warned ${toWarn.length}, auto-resolved ${toResolve.length}`);
  }
}

function start() {
  if (task) return;
  task = cron.schedule('*/2 * * * *', () => sweep().catch((e) => logger.error('Support auto-resolve failed:', e.message)));
  logger.info('Support auto-resolve cron started');
}

module.exports = { start, sweep };
