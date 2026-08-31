const cron = require('node-cron');
const logger = require('../config/logger');
const { getSettingNum, getSetting } = require('../utils/settings');
const { sendProviderHealthAlert } = require('../utils/email');
const fivesim = require('../providers/sms/fivesim.provider');
const grizzlysms = require('../providers/sms/grizzlysms.provider');
const smscodes = require('../providers/sms/smscodes.provider');
const smsbus = require('../providers/sms/smsbus.provider');
const smspva = require('../providers/sms/smspva.provider');
const getsms = require('../providers/sms/getsms.provider');
let pushService;
try { pushService = require('../services/push.service'); } catch (_) { pushService = { sendToUser: () => {} }; }

let task = null;

// Probe every SMS/rental provider: account balance + (for rental providers) that
// the catalog actually returns services. Returns rows with a `problem` string
// when something's wrong (low balance, unreachable, or empty catalog).
async function probe() {
  const lowBal = await getSettingNum('provider_low_balance_usd', 5);

  const [fx, gz, sc, sb, pva, gsCat, pvaCat] = await Promise.all([
    fivesim.getProfile().then((p) => p?.balance ?? null).catch(() => null),
    grizzlysms.getBalance().catch(() => null),
    smscodes.getBalance().catch(() => null),
    smsbus.getBalance().catch(() => null),
    smspva.getBalance().catch(() => null),
    getsms.getServiceCatalog().catch(() => []),
    smspva.getServiceCatalog().catch(() => []),
  ]);

  const balState = (b) => (b == null ? 'unreachable' : b < lowBal ? 'low balance' : null);
  const rows = [
    { name: '5sim (LIX 1 OTP)', balance: fx, catalog: null, problem: balState(fx) },
    { name: 'GrizzlySMS (LIX 2 OTP)', balance: gz, catalog: null, problem: balState(gz) },
    { name: 'smscodes (LIX 3 OTP)', balance: sc, catalog: null, problem: balState(sc) },
    { name: 'SMS-BUS (LIX 4 OTP)', balance: sb, catalog: null, problem: balState(sb) },
    { name: 'SMSPVA (rental LIX 2)', balance: pva, catalog: pvaCat.length, problem: balState(pva) || (pvaCat.length === 0 ? 'catalog empty' : null) },
    // GetSMS uses a rent-only key (no balance API) — reachability = catalog.
    { name: 'GetSMS (rental LIX 1)', balance: null, catalog: gsCat.length, problem: gsCat.length === 0 ? 'catalog empty (proxy down?)' : null },
  ];
  return { rows, lowBal };
}

async function sweep() {
  const { rows, lowBal } = await probe();
  const problems = rows.filter((r) => r.problem);
  if (!problems.length) { logger.info('Provider health: all providers OK'); return; }
  logger.warn(`Provider health: ${problems.length} issue(s) — ${problems.map((p) => `${p.name}: ${p.problem}`).join('; ')}`);

  // Recipients: all admin emails + the ops inbox.
  const User = require('../models/User');
  let admins = [];
  try { admins = await User.find({ role: { $in: ['ADMIN', 'AGENT'] }, isBanned: { $ne: true } }, 'email _id').lean(); } catch (_) {}
  let recipients = admins.map((a) => a.email).filter(Boolean);
  const extra = process.env.SUPPORT_ESCALATION_EMAIL || process.env.ADMIN_EMAIL;
  if (extra) recipients.push(extra);
  // Extra alert inboxes (comma/space separated) — e.g. a Gmail that reliably
  // delivers. Admin-tunable via the provider_alert_emails setting.
  try {
    const extraCsv = await getSetting('provider_alert_emails');
    if (extraCsv) recipients.push(...String(extraCsv).split(/[,;\s]+/).filter(Boolean));
  } catch (_) {}
  recipients = [...new Set(recipients.map((e) => String(e).toLowerCase()))];

  if (recipients.length) {
    await sendProviderHealthAlert(recipients, rows, problems, lowBal)
      .catch((err) => logger.warn(`Provider health email failed: ${err.message}`));
  }
  // Best-effort push to admin/agent phones.
  const body = problems.map((p) => `${p.name.split(' ')[0]}: ${p.problem}`).join(', ').slice(0, 140);
  for (const a of admins) pushService.sendToUser(a._id, { title: '⚠️ Provider issue', body, data: { type: 'provider_health' } });
}

function start() {
  if (task) return;
  // Once daily at 08:00 UTC (09:00 WAT). Alerts only fire when something's wrong.
  task = cron.schedule('0 8 * * *', () => sweep().catch((e) => logger.error('Provider-health sweep failed:', e.message)));
  logger.info('Provider-health cron started');
}

module.exports = { start, sweep, probe };
