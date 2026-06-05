const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const User = require('../models/User');
const korapay = require('../providers/payment/korapay.provider');
const { addCredits } = require('./credit.service');
const { audit } = require('../utils/audit');
const { getIO } = require('../config/io');
const logger = require('../config/logger');

// ── Action tools the support AI may EXECUTE (write operations) ─────────────────
// Scope (per product decision): the AI may resolve a stuck card/bank (KoraPay)
// payment by re-verifying it with the provider and crediting idempotently.
// Crypto and all other money actions (refunds, cancellations) route to a human.
const TOOLS = [
  {
    name: 'resolve_pending_payment',
    description:
      "Re-check a PENDING payment with the payment provider and, if it's genuinely confirmed paid, add the credits to the user's account right away. Use this whenever the user says a payment hasn't credited / is stuck / pending. Pass the payment's id exactly as shown in the account data. Works for card/bank (KoraPay) payments only; crypto payments must go to a human.",
    input_schema: {
      type: 'object',
      properties: {
        paymentId: { type: 'string', description: "The id of the pending payment, copied from the account data JSON." },
      },
      required: ['paymentId'],
      additionalProperties: false,
    },
  },
];

// Resolve a single stuck PENDING payment. Mirrors the webhook's proven pattern:
// re-verify → atomic PENDING→COMPLETED gate → idempotent addCredits → rollback
// on failure → audit + socket. Scoped to the conversation's own user.
async function resolvePendingPayment(paymentId, userId) {
  if (!paymentId || !mongoose.Types.ObjectId.isValid(String(paymentId))) {
    return { ok: false, reason: 'invalid_id', message: 'That payment reference is not valid.' };
  }

  const payment = await Payment.findById(paymentId);
  if (!payment || String(payment.userId) !== String(userId)) {
    return { ok: false, reason: 'not_found', message: 'No matching payment on this account.' };
  }

  if (payment.status === 'COMPLETED') {
    const u = await User.findById(userId, 'creditBalance');
    return { ok: true, alreadyResolved: true, creditsAdded: payment.creditsAdded, balance: u?.creditBalance, message: 'This payment is already completed and the credits are on the account.' };
  }
  if (payment.status === 'FAILED' || payment.status === 'EXPIRED') {
    return { ok: false, status: payment.status, message: `This payment ${payment.status.toLowerCase()} — no money was taken, so there are no credits to add.` };
  }

  // status === 'PENDING'
  if (payment.method !== 'KORAPAY') {
    return { ok: false, reason: 'needs_human', message: 'This is a crypto payment, which a teammate has to verify by hand.' };
  }

  let charge;
  try {
    charge = await korapay.verifyCharge(payment._id.toString());
  } catch (e) {
    logger.error('Support AI verifyCharge failed:', e.message);
    return { ok: false, reason: 'verify_error', message: 'Could not reach the payment provider just now — try again in a moment.' };
  }

  const paid = charge && (charge.status === 'success' || charge.status === 'successful');
  if (!paid) {
    return { ok: false, status: 'PENDING', providerStatus: charge?.status || 'unknown', message: 'The provider still shows this as not completed — it usually clears within a few minutes.' };
  }

  // Atomic gate: only one process flips PENDING → COMPLETED.
  const gated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: 'PENDING' },
    { $set: { status: 'COMPLETED', completedAt: new Date() } },
    { new: false }
  );
  if (!gated) {
    const u = await User.findById(userId, 'creditBalance');
    return { ok: true, alreadyResolved: true, creditsAdded: payment.creditsAdded, balance: u?.creditBalance, message: 'It just completed — the credits are on the account.' };
  }

  let balance;
  try {
    balance = await addCredits(
      userId,
      payment.creditsAdded,
      `Credit purchase: $${payment.amountUSD} via KoraPay (resolved by support assistant)`,
      payment._id.toString()
    );
  } catch (err) {
    // Roll the gate back so a retry can re-attempt.
    await Payment.findByIdAndUpdate(payment._id, { $set: { status: 'PENDING', completedAt: null } });
    logger.error('Support AI credit delivery failed:', err.message);
    return { ok: false, reason: 'credit_error', message: 'I confirmed the payment but hit a snag adding the credits — passing this to a teammate to finish.' };
  }

  audit('SUPPORT_AI_RESOLVE_PAYMENT', {
    userId,
    meta: { paymentId: payment._id.toString(), creditsAdded: payment.creditsAdded, amountUSD: payment.amountUSD },
  });

  try {
    const io = getIO();
    if (io) io.to(`user:${String(userId)}`).emit('payment:completed', { creditsAdded: payment.creditsAdded });
  } catch (_) {}

  return { ok: true, resolved: true, creditsAdded: payment.creditsAdded, balance, message: `Confirmed and credited ${payment.creditsAdded} credits.` };
}

async function executeAction(name, input, userId) {
  if (name === 'resolve_pending_payment') return resolvePendingPayment(input?.paymentId, userId);
  return { ok: false, message: 'unknown action' };
}

module.exports = { TOOLS, executeAction };
