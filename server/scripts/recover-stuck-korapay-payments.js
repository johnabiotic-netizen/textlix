// Reconcile KoraPay payments stuck on PENDING.
//
// Root cause (fixed in korapay.provider.js): our webhook signature check
// HMAC'd the whole request body, but KoraPay signs ONLY the `data` object with
// the secret key. So every charge.success webhook was rejected with 401 and
// payments only completed when the user's browser made it back to the
// /payments/verify redirect. Users who closed the tab/app first stayed PENDING
// despite having paid.
//
// This script finds every PENDING KoraPay payment, re-verifies each one
// against the KoraPay API (the source of truth — never credit on our say-so),
// and credits only those KoraPay confirms as `success`. It uses the SAME
// referenceId the webhook uses (payment._id), so addCredits is idempotent: if a
// webhook ever redelivers, it no-ops. No double-credit.
//
// Usage:
//   railway run node server/scripts/recover-stuck-korapay-payments.js            # dry-run, all users
//   railway run node server/scripts/recover-stuck-korapay-payments.js --confirm  # credit confirmed-success
//   railway run node server/scripts/recover-stuck-korapay-payments.js <email>    # scope to one user
//
// If users were ALREADY credited manually (e.g. admin "Adjust Credits"), their
// Payment rows are still PENDING and a redelivered webhook / re-visited verify
// link could double-credit them. Close that window WITHOUT paying out again:
//   railway run node server/scripts/recover-stuck-korapay-payments.js --mark-resolved            # dry-run
//   railway run node server/scripts/recover-stuck-korapay-payments.js --mark-resolved --confirm  # write
// (--mark-resolved skips anything created in the last 30m so in-flight payments
//  that are still genuinely owed credits are left alone.)

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
require('dns').setServers(['8.8.8.8', '1.1.1.1']); // Atlas SRV resolves through public DNS

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Payment = require('../src/models/Payment');
const korapayProvider = require('../src/providers/payment/korapay.provider');
const { addCredits } = require('../src/services/credit.service');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// In --mark-resolved mode we won't touch anything created within this window,
// so a genuinely in-flight payment can never be settled-without-credit.
const RESOLVE_MIN_AGE_MS = 30 * 60 * 1000; // 30 minutes

(async () => {
  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  // --mark-resolved: the user already credited these manually (e.g. via admin
  // "Adjust Credits"), which leaves the Payment row PENDING. Flip it to
  // COMPLETED WITHOUT crediting again, closing the double-credit window that
  // the now-working webhook (or a user revisiting /payments/verify) would open.
  const markResolved = args.includes('--mark-resolved');
  const email = args.find((a) => !a.startsWith('--'));

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  if (!process.env.KORAPAY_SECRET_KEY) {
    console.error('KORAPAY_SECRET_KEY not set — cannot verify charges');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected${confirm ? '  (--confirm: WRITES WILL HAPPEN)' : '  (dry-run)'}\n`);

  const filter = { method: 'KORAPAY', status: 'PENDING' };
  if (email) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log(`User not found: ${email}`);
      await mongoose.disconnect();
      return;
    }
    filter.userId = user._id;
    console.log(`Scoped to ${user.email} (${user._id})\n`);
  }

  const stuck = await Payment.find(filter).sort({ createdAt: 1 });
  console.log(`PENDING KoraPay payments: ${stuck.length}\n`);
  if (stuck.length === 0) {
    await mongoose.disconnect();
    return;
  }

  const summary = { success: 0, credited: 0, resolved: 0, notPaid: 0, error: 0, skipped: 0 };

  for (const p of stuck) {
    const reference = (p.externalId || p._id).toString();
    const age = Math.round((Date.now() - p.createdAt.getTime()) / 60000);
    const label = `${p._id}  $${String(p.amountUSD).padStart(5)}  ${p.creditsAdded}cr  (${age}m ago)`;

    let charge;
    try {
      charge = await korapayProvider.verifyCharge(reference);
    } catch (err) {
      const code = err.response?.status;
      console.log(`  ${label} — verify failed (${code || err.message}), skipping`);
      summary.error++;
      await sleep(250);
      continue;
    }

    if (charge?.status !== 'success') {
      console.log(`  ${label} — KoraPay status="${charge?.status || 'unknown'}", NOT crediting`);
      summary.notPaid++;
      await sleep(250);
      continue;
    }

    summary.success++;

    // ── Mode A: mark-resolved (already manually credited) ──────────────────
    if (markResolved) {
      const ageMs = Date.now() - p.createdAt.getTime();
      if (ageMs < RESOLVE_MIN_AGE_MS) {
        // Too recent to assume it was part of the manual round — could be
        // in-flight and still owed credits. Leave it for the webhook/credit path.
        console.log(`  ${label} — under 30m old, leaving PENDING (could be in-flight)`);
        summary.skipped++;
        await sleep(250);
        continue;
      }
      if (!confirm) {
        console.log(`  ${label} — KoraPay SUCCESS → would mark COMPLETED (no credit; manually paid out)`);
        await sleep(250);
        continue;
      }
      const settled = await Payment.findOneAndUpdate(
        { _id: p._id, status: 'PENDING' },
        { $set: { status: 'COMPLETED', completedAt: new Date(), metadata: { ...(p.metadata || {}), reconciledManually: true } } },
        { new: false }
      );
      if (!settled) {
        console.log(`  ${label} — no longer PENDING, skipping`);
        summary.skipped++;
        continue;
      }
      console.log(`  ${label} — marked COMPLETED (no credit; closed double-credit window)`);
      summary.resolved++;
      await sleep(250);
      continue;
    }

    // ── Mode B: credit (default) ───────────────────────────────────────────
    if (!confirm) {
      console.log(`  ${label} — KoraPay says SUCCESS → would credit`);
      await sleep(250);
      continue;
    }

    // Same atomic gate the webhook uses — flip PENDING → COMPLETED first.
    const gated = await Payment.findOneAndUpdate(
      { _id: p._id, status: 'PENDING' },
      { $set: { status: 'COMPLETED', completedAt: new Date() } },
      { new: false }
    );
    if (!gated) {
      console.log(`  ${label} — already completed by another process, skipping`);
      summary.skipped++;
      continue;
    }

    try {
      const newBalance = await addCredits(
        p.userId,
        p.creditsAdded,
        `Credit purchase: $${p.amountUSD} via KoraPay (reconciliation)`,
        p._id.toString()
      );
      console.log(`  ${label} — credited, new balance: ${newBalance}`);
      summary.credited++;
    } catch (err) {
      await Payment.findByIdAndUpdate(p._id, { $set: { status: 'PENDING', completedAt: null } });
      console.error(`  ${label} — credit failed (${err.message}), rolled back gate`);
      summary.error++;
    }
    await sleep(250);
  }

  console.log('\n─── Summary ───');
  console.log(`  KoraPay confirmed success : ${summary.success}`);
  console.log(`  Credited this run         : ${summary.credited}`);
  console.log(`  Marked resolved (no credit): ${summary.resolved}`);
  console.log(`  Not paid / abandoned      : ${summary.notPaid}`);
  console.log(`  Skipped (done / too recent): ${summary.skipped}`);
  console.log(`  Errors                    : ${summary.error}`);
  if (!confirm && summary.success > 0) {
    const action = markResolved
      ? 'mark the confirmed-success payments COMPLETED without crediting'
      : 'credit the confirmed-success payments';
    console.log(`\nDRY RUN. Re-run with --confirm to ${action}.`);
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
