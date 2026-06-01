// Identify and (with --confirm) delete test users from the database.
// Default behaviour is DRY-RUN — prints the scope and a sample. No changes.
//
// Definition of "test user" (must satisfy ALL):
//   - creditBalance === 0
//   - role !== 'ADMIN'
//   - email !== founder email (hardcoded below)
//   - has zero Payment records
//   - has zero NumberOrder records
//   - has never received an admin credit adjustment (e.g. the 2 users
//     the founder manually gifted 1000 credits to)
//
// Users who paid before and burned through their credits ARE preserved
// (Payment history flags them as real). Same for users who placed orders
// and for users the admin manually credited.
//
// Cascade-deletes the matching User + their CreditTransaction + DeviceToken
// records. Other collections (Payment, NumberOrder, CreatorEarning) are
// already empty for the matched set by definition.
//
// Usage:
//   node scripts/delete-test-users.js              # dry-run, no changes
//   node scripts/delete-test-users.js --confirm    # actually delete
//
// MONGODB_URI must point to the prod cluster. The script loads server/.env
// automatically, so it works equally well via `railway run` or locally.

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');
const NumberOrder = require('../src/models/NumberOrder');
const Payment = require('../src/models/Payment');
const CreditTransaction = require('../src/models/CreditTransaction');

const FOUNDER_EMAIL = 'dnamesmarc@gmail.com';

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  const confirm = process.argv.includes('--confirm');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to DB${confirm ? '  (--confirm: WRITES WILL HAPPEN)' : '  (dry-run)'}\n`);

  const candidates = await User.find({
    creditBalance: 0,
    role: { $ne: 'ADMIN' },
    email: { $ne: FOUNDER_EMAIL.toLowerCase() },
  })
    .select('_id email name createdAt isCreator welcomeBonusClaimed')
    .lean();

  console.log(`Users with balance=0 (excluding admins, founder): ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('Nothing to evaluate.');
    await mongoose.disconnect();
    return;
  }

  const ids = candidates.map((c) => c._id);
  const [paidUserIds, orderingUserIds, adminAdjustedUserIds] = await Promise.all([
    Payment.distinct('userId', { userId: { $in: ids } }),
    NumberOrder.distinct('userId', { userId: { $in: ids } }),
    // Admin-adjust = manual founder credit gift. Welcome-bonus rows also
    // use type=ADMIN_ADJUST but their referenceId starts with `welcome-bonus:`,
    // so exclude those from the "manually credited" check.
    CreditTransaction.distinct('userId', {
      userId: { $in: ids },
      type: 'ADMIN_ADJUST',
      referenceId: { $not: /^welcome-bonus:/ },
    }),
  ]);

  const paidSet = new Set(paidUserIds.map((i) => i.toString()));
  const orderSet = new Set(orderingUserIds.map((i) => i.toString()));
  const adjustSet = new Set(adminAdjustedUserIds.map((i) => i.toString()));

  const safe = candidates.filter((c) => {
    const idStr = c._id.toString();
    return !paidSet.has(idStr) && !orderSet.has(idStr) && !adjustSet.has(idStr);
  });

  console.log(`  preserved — had payment history:     ${paidSet.size}`);
  console.log(`  preserved — had order history:       ${orderSet.size}`);
  console.log(`  preserved — admin credit adjustment: ${adjustSet.size}`);
  console.log(`  SAFE TO DELETE:                      ${safe.length}\n`);

  if (safe.length === 0) {
    console.log('Nothing matches the safe-delete criteria.');
    await mongoose.disconnect();
    return;
  }

  console.log('── SAMPLE (first 20) ─────────────────────────────────────────');
  for (const u of safe.slice(0, 20)) {
    const ageDays = Math.round((Date.now() - new Date(u.createdAt).getTime()) / 86400000);
    const tags = [];
    if (u.isCreator) tags.push('CREATOR');
    if (u.welcomeBonusClaimed) tags.push('WELCOME-CLAIMED');
    console.log(
      `  ${u._id}  ${(u.email || '').padEnd(38)}  ${(u.name || '').padEnd(22)}  ${ageDays}d  ${tags.join(' ')}`
    );
  }
  if (safe.length > 20) console.log(`  ... and ${safe.length - 20} more`);
  console.log();

  if (!confirm) {
    console.log('DRY RUN. Re-run with --confirm to delete.');
    await mongoose.disconnect();
    return;
  }

  const toDelete = safe.map((s) => s._id);

  console.log(`Deleting ${toDelete.length} users and their related records...`);

  const txResult = await CreditTransaction.deleteMany({ userId: { $in: toDelete } });
  console.log(`  CreditTransaction records deleted: ${txResult.deletedCount}`);

  try {
    const dtResult = await mongoose.connection
      .collection('devicetokens')
      .deleteMany({ userId: { $in: toDelete } });
    console.log(`  DeviceToken records deleted:       ${dtResult.deletedCount}`);
  } catch (e) {
    console.log(`  DeviceToken cleanup skipped: ${e.message}`);
  }

  const userResult = await User.deleteMany({ _id: { $in: toDelete } });
  console.log(`  User records deleted:              ${userResult.deletedCount}`);

  console.log('\nDone.');
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
