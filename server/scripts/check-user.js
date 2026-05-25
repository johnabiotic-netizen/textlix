// Inspect a user's order + transaction history. Used for support investigations.
// Usage: railway run node scripts/check-user.js takeheedcare@gmail.com

const mongoose = require('mongoose');
const User = require('../src/models/User');
const NumberOrder = require('../src/models/NumberOrder');
const CreditTransaction = require('../src/models/CreditTransaction');

(async () => {
  const email = process.argv[2];
  if (!email) { console.error('usage: check-user.js <email>'); process.exit(1); }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to DB\n`);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) { console.log(`User not found: ${email}`); process.exit(0); }

  console.log(`USER: ${user.name} <${user.email}>`);
  console.log(`  _id: ${user._id}`);
  console.log(`  Balance: ${user.creditBalance} credits`);
  console.log(`  Member since: ${user.createdAt.toISOString().slice(0, 10)}`);
  console.log(`  Banned: ${user.isBanned}`);
  console.log();

  const orders = await NumberOrder.find({ userId: user._id })
    .populate('countryId', 'name flagEmoji code')
    .populate('serviceId', 'name slug')
    .sort({ createdAt: -1 })
    .limit(50);

  console.log(`── ORDERS (last 50) ─────────────────`);
  for (const o of orders) {
    const ageMins = Math.round((Date.now() - o.createdAt.getTime()) / 60000);
    const got = o.smsContent && o.smsContent !== '[deleted]' ? 'SMS' : 'NO-SMS';
    const refund = o.refundPending ? ' refundPending=true' : '';
    const attempts = o.refundAttempts ? ` attempts=${o.refundAttempts}` : '';
    console.log(`  ${o.createdAt.toISOString().slice(0, 19).replace('T', ' ')}  ${o.status.padEnd(15)} ${o.creditsCharged.toString().padStart(4)}cr  ${o.countryId?.flagEmoji || ''} ${o.countryId?.code || '??'} ${o.serviceId?.slug || o.rentalServiceSlug || '??'}  ${got}${refund}${attempts}  (${ageMins}m ago)`);
    console.log(`     _id=${o._id}  phone=${o.phoneNumber}  type=${o.orderType || 'OTP'}`);
  }
  console.log();

  const tx = await CreditTransaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50);
  console.log(`── CREDIT TRANSACTIONS (last 50) ────`);
  let total = 0;
  for (const t of tx) {
    const sign = t.amount > 0 ? '+' : '';
    console.log(`  ${t.createdAt.toISOString().slice(0, 19).replace('T', ' ')}  ${t.type.padEnd(14)} ${sign}${t.amount.toString().padStart(5)}cr  bal=${t.balanceAfter.toString().padStart(5)}  ref=${t.referenceId || '-'}  ${(t.description || '').slice(0, 60)}`);
    total += t.amount;
  }
  console.log();
  console.log(`Ledger total: ${total} cr  (matches current balance ${user.creditBalance}? ${total === user.creditBalance})`);

  // Sanity: orders that spent credits but have no corresponding REFUND despite being EXPIRED-no-SMS
  console.log(`\n── STUCK ORDER ANALYSIS ─────────────`);
  const otpExpiredNoSms = orders.filter(o =>
    (o.orderType === 'OTP' || !o.orderType) &&
    o.status === 'EXPIRED' &&
    (!o.smsContent || o.smsContent === '[deleted]')
  );
  console.log(`OTP orders in EXPIRED status with no SMS: ${otpExpiredNoSms.length}`);

  let stuck = 0;
  for (const o of otpExpiredNoSms) {
    const refund = tx.find(t => t.referenceId === o._id.toString() && t.type === 'REFUND');
    if (!refund) {
      stuck++;
      console.log(`  ! STUCK: order ${o._id} - ${o.creditsCharged}cr never refunded (refundPending=${o.refundPending})`);
    }
  }
  if (stuck === 0) console.log(`✓ No stuck orders — every EXPIRED-no-SMS order has a matching REFUND.`);

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
