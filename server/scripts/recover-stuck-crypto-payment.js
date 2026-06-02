// Manually credit a user for a 0xProcessing payment that succeeded on-chain
// but never reached our DB because the webhook handler rejected the callback.
//
// This was needed once because our webhook handler had three spec mismatches
// with 0xProcessing (sig location, field name, status literal). After fixing
// those, future payments should self-heal — keep this script around as the
// support-tool pattern for stuck rows.
//
// Definition of "stuck": Payment.method = CRYPTO, provider = 0xprocessing,
// status = PENDING, belongs to the email passed on the command line, created
// less than 7 days ago.
//
// Uses addCredits with `referenceId = payment._id.toString()` — the same
// referenceId the webhook would use — so if 0xProcessing ever does redeliver
// the webhook, addCredits's idempotency check no-ops it. No double-credit.
//
// Usage:
//   node scripts/recover-stuck-crypto-payment.js <email>           # dry-run
//   node scripts/recover-stuck-crypto-payment.js <email> --confirm # write

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Payment = require('../src/models/Payment');
const { addCredits } = require('../src/services/credit.service');

(async () => {
  const email = process.argv[2];
  const confirm = process.argv.includes('--confirm');

  if (!email) {
    console.error('usage: recover-stuck-crypto-payment.js <email> [--confirm]');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to DB${confirm ? '  (--confirm: WRITES WILL HAPPEN)' : '  (dry-run)'}\n`);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.log(`User not found: ${email}`);
    await mongoose.disconnect();
    return;
  }

  console.log(`USER: ${user.name} <${user.email}>`);
  console.log(`  _id: ${user._id}`);
  console.log(`  Current balance: ${user.creditBalance} credits\n`);

  const cutoff = new Date(Date.now() - 7 * 86400000);
  const stuck = await Payment.find({
    userId: user._id,
    method: 'CRYPTO',
    provider: '0xprocessing',
    status: 'PENDING',
    createdAt: { $gte: cutoff },
  }).sort({ createdAt: -1 });

  console.log(`Stuck 0xProcessing payments (PENDING, last 7 days): ${stuck.length}`);
  if (stuck.length === 0) {
    console.log('Nothing to recover.');
    await mongoose.disconnect();
    return;
  }

  for (const p of stuck) {
    const age = Math.round((Date.now() - p.createdAt.getTime()) / 60000);
    console.log(
      `  ${p._id}  $${p.amountUSD.toString().padStart(5)}  ${p.currency.padEnd(15)}  ${p.creditsAdded}cr  (${age}m ago)`
    );
  }
  console.log();

  if (!confirm) {
    console.log('DRY RUN. Re-run with --confirm to credit these payments.');
    console.log('Note: only run --confirm after manually verifying the payment(s)');
    console.log('      landed on-chain in the 0xProcessing merchant dashboard.');
    await mongoose.disconnect();
    return;
  }

  for (const p of stuck) {
    // Same atomic gate the webhook uses — flip PENDING → COMPLETED first.
    const gated = await Payment.findOneAndUpdate(
      { _id: p._id, status: 'PENDING' },
      { $set: { status: 'COMPLETED', completedAt: new Date() } },
      { new: false }
    );
    if (!gated) {
      console.log(`  ${p._id} — already completed by another process, skipping`);
      continue;
    }

    try {
      const newBalance = await addCredits(
        p.userId,
        p.creditsAdded,
        `Credit purchase: $${p.amountUSD} via 0xProcessing (manual recovery)`,
        p._id.toString()
      );
      console.log(`  ${p._id} — credited ${p.creditsAdded}cr, new balance: ${newBalance}`);
    } catch (err) {
      await Payment.findByIdAndUpdate(p._id, {
        $set: { status: 'PENDING', completedAt: null },
      });
      console.error(`  ${p._id} — credit failed (${err.message}), rolled back gate`);
    }
  }

  console.log('\nDone.');
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
