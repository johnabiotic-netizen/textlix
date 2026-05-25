/*
 * Recovery for the "credits spent but no order created" bug.
 *
 * Pre-fix, if the post-spendCredits transaction failed with anything other
 * than MAX_NUMBERS_REACHED, credits were taken but the user got no number
 * and no refund. This script finds all such orphaned SPENDs and issues
 * the corresponding refunds (idempotent via referenceId).
 *
 * SPEND description format: "Number rental: <flag> <country> - <service>"
 * (set in number.controller.js when ordering an OTP number)
 *
 * Detection logic:
 *   1. For each SPEND tx whose description starts with "Number rental:":
 *   2. Look for a NumberOrder for the same user with the same creditsCharged
 *      within ±5 minutes of the spend.
 *   3. If no matching order exists, this is an orphan — issue a refund.
 *
 * Refund referenceId is `orphan-spend-recovery-<spend_id>` so addCredits
 * dedup prevents double-refunding if this script is re-run.
 *
 * Usage:
 *   railway run node scripts/recover-orphan-spends.js               # dry run
 *   railway run node scripts/recover-orphan-spends.js --apply       # actually refund
 *   railway run node scripts/recover-orphan-spends.js --user=email  # one user only
 */

const mongoose = require('mongoose');
const User = require('../src/models/User');
const NumberOrder = require('../src/models/NumberOrder');
const CreditTransaction = require('../src/models/CreditTransaction');
const { refundCredits } = require('../src/services/credit.service');

const APPLY = process.argv.includes('--apply');
const userArg = process.argv.find((a) => a.startsWith('--user='));
const onlyEmail = userArg ? userArg.slice('--user='.length).toLowerCase() : null;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // Limit to the bug window — anything before this commit can't have been protected.
  const SINCE = new Date('2026-04-01');
  const matchFilter = {
    type: 'SPEND',
    description: { $regex: '^Number rental:' },
    createdAt: { $gte: SINCE },
  };

  if (onlyEmail) {
    const u = await User.findOne({ email: onlyEmail });
    if (!u) { console.log(`No user matching ${onlyEmail}`); process.exit(0); }
    matchFilter.userId = u._id;
  }

  const spends = await CreditTransaction.find(matchFilter)
    .sort({ createdAt: 1 })
    .populate('userId', 'email name creditBalance');

  console.log(`Scanning ${spends.length} candidate SPEND transactions${onlyEmail ? ` for ${onlyEmail}` : ''}…\n`);

  let orphans = 0;
  let totalCr = 0;
  const refundsByUser = new Map();

  for (const sp of spends) {
    if (!sp.userId) continue;
    const amount = Math.abs(sp.amount);

    // Already refunded once by this recovery? Skip.
    const refRef = `orphan-spend-recovery-${sp._id}`;
    const existingRefund = await CreditTransaction.findOne({
      userId: sp.userId._id,
      referenceId: refRef,
    });
    if (existingRefund) continue;

    // Did an order get created within ±5 minutes for the same amount?
    const windowMs = 5 * 60 * 1000;
    const nearbyOrder = await NumberOrder.findOne({
      userId: sp.userId._id,
      creditsCharged: amount,
      createdAt: { $gte: new Date(sp.createdAt.getTime() - windowMs), $lte: new Date(sp.createdAt.getTime() + windowMs) },
    });

    if (nearbyOrder) continue; // legitimate spend, order exists

    orphans++;
    totalCr += amount;
    const list = refundsByUser.get(sp.userId.email) || [];
    list.push({ id: sp._id, amount, at: sp.createdAt, desc: sp.description, refRef });
    refundsByUser.set(sp.userId.email, list);
  }

  console.log(`Found ${orphans} orphan SPENDs across ${refundsByUser.size} users — ${totalCr} credits owed`);
  console.log(`\nPer-user breakdown:`);
  for (const [email, list] of refundsByUser) {
    const sum = list.reduce((s, r) => s + r.amount, 0);
    console.log(`  ${email.padEnd(40)} ${list.length} orphans  ${sum} cr`);
  }

  if (!APPLY) {
    console.log(`\n(dry run — pass --apply to actually issue refunds)`);
    await mongoose.disconnect();
    return;
  }

  console.log(`\n── Applying refunds ────────────────────`);
  for (const [email, list] of refundsByUser) {
    for (const item of list) {
      try {
        const user = await User.findOne({ email });
        await refundCredits(
          user._id,
          item.amount,
          `Auto-refund (recovery): orphaned spend ${item.at.toISOString()} — credits charged without number delivered`,
          item.refRef
        );
        console.log(`  ✓ ${email}  +${item.amount}cr  ref=${item.refRef}`);
      } catch (err) {
        console.log(`  ✗ ${email}  FAILED: ${err.message}`);
      }
    }
  }
  console.log(`\nDone.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
