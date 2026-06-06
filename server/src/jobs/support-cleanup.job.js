const cron = require('node-cron');
const SupportConversation = require('../models/SupportConversation');
const SupportMessage = require('../models/SupportMessage');
const { emitToUser, emitToAdmins } = require('../services/support.service');
const settings = require('../services/support-settings');
const logger = require('../config/logger');

let task = null;

// Auto-resolve chats the user has gone quiet on. We only close conversations
// where the ball is in the USER's court — i.e. AI-handled chats (Ada always
// replies, so an idle AI chat means the user left), or human chats where the
// agent spoke last. We NEVER auto-close WAITING_HUMAN or a HUMAN chat whose last
// message was the user's — those are waiting on us, not the other way round.
// Resolving re-arms the AI, so the user just messaging again reopens it fresh.
async function sweep() {
  const minutes = await settings.getNumber('support_auto_resolve_minutes', 30);
  if (!minutes || minutes <= 0) return; // 0 / unset = disabled
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  const stale = await SupportConversation.find({
    lastMessageAt: { $lt: cutoff },
    $or: [
      { status: 'AI' },
      { status: 'HUMAN', lastSender: { $in: ['AGENT', 'SYSTEM'] } },
    ],
  }).limit(200);

  for (const c of stale) {
    await SupportConversation.findByIdAndUpdate(c._id, {
      $set: { status: 'RESOLVED', aiEnabled: true, assignedAdminId: null },
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

  if (stale.length) logger.info(`Support: auto-resolved ${stale.length} inactive conversation(s)`);
}

function start() {
  if (task) return;
  task = cron.schedule('*/2 * * * *', () => sweep().catch((e) => logger.error('Support auto-resolve failed:', e.message)));
  logger.info('Support auto-resolve cron started');
}

module.exports = { start, sweep };
