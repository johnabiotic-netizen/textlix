const cron = require('node-cron');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { sendRecoveryNudgeEmail } = require('../utils/email');
const logger = require('../config/logger');

let task = null;

const DAY = 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 200;   // safety cap — never blast more than this in one sweep
const GAP_MS = 650;        // stay under Resend's ~2 req/s

// Nudge users who STARTED a top-up but never finished — exactly once, ever.
// Guardrails (see recoveryNudgeSentAt on the User model):
//   • only abandonments aged 24h–7d (not mid-checkout, not stale)
//   • never-funded only (no COMPLETED payment on record)
//   • opted-in only (emailNotifications !== false)
//   • one email per user for life (recoveryNudgeSentAt gate)
async function sweep() {
  const now = Date.now();
  const windowStart = new Date(now - 7 * DAY);  // no older than 7 days
  const windowEnd = new Date(now - 1 * DAY);    // at least 24h old

  // Users with an abandoned checkout inside the window.
  const abandoned = await Payment.aggregate([
    { $match: { status: { $in: ['PENDING', 'FAILED', 'EXPIRED'] }, createdAt: { $gte: windowStart, $lte: windowEnd } } },
    { $group: { _id: '$userId' } },
  ]);
  const ids = abandoned.map((a) => a._id);
  if (!ids.length) return;

  // Drop anyone who has EVER completed a payment.
  const funded = new Set((await Payment.distinct('userId', { status: 'COMPLETED', userId: { $in: ids } })).map(String));
  const eligibleIds = ids.filter((id) => !funded.has(String(id)));
  if (!eligibleIds.length) return;

  // Opted-in + never-nudged only. The recoveryNudgeSentAt gate is what makes
  // this safe to run daily — a nudged user is permanently excluded.
  const recipients = await User.find(
    { _id: { $in: eligibleIds }, emailNotifications: { $ne: false }, recoveryNudgeSentAt: null },
    'email name'
  ).limit(MAX_PER_RUN).lean();

  if (!recipients.length) return;

  let ok = 0, fail = 0;
  for (const u of recipients) {
    if (!u.email) continue;
    const firstName = (u.name || '').trim().split(/\s+/)[0] || 'there';
    try {
      await sendRecoveryNudgeEmail(u.email, firstName);
      // Mark ONLY after a successful send so a transient failure retries next run.
      await User.updateOne({ _id: u._id }, { $set: { recoveryNudgeSentAt: new Date() } });
      ok++;
    } catch (err) {
      fail++;
      logger.warn(`Recovery nudge failed for ${u.email}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, GAP_MS));
  }
  logger.info(`Recovery-nudge sweep: ${ok} sent, ${fail} failed (candidates ${recipients.length})`);
}

function start() {
  if (task) return;
  // Once daily at 10:00 UTC (11:00 WAT) — calm cadence; the 24h+ delay and the
  // once-per-user gate mean a person is nudged at most one time, ever.
  task = cron.schedule('0 10 * * *', () => sweep().catch((e) => logger.error('Recovery-nudge sweep failed:', e.message)));
  logger.info('Recovery-nudge cron started');
}

module.exports = { start, sweep };
