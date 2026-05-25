const cron = require('node-cron');
const NumberOrder = require('../models/NumberOrder');
const { refundCredits } = require('../services/credit.service');
const fivesim = require('../providers/sms/fivesim.provider');
const grizzlysms = require('../providers/sms/grizzlysms.provider');
const smspool = require('../providers/sms/smspool.provider');
const smsPoller = require('../services/sms-poller.service');
const logger = require('../config/logger');

let io;

const setIO = (socketIo) => {
  io = socketIo;
};

// Try to refund an OTP order that's been marked EXPIRED + refundPending.
// Called for both fresh expiries and retries of previously-failed refunds.
// Idempotent at the credit ledger (addCredits dedupes on referenceId).
const tryRefund = async (order) => {
  try {
    await refundCredits(
      order.userId,
      order.creditsCharged,
      `Refund: number expired without SMS`,
      order._id.toString()
    );
    await NumberOrder.findByIdAndUpdate(order._id, {
      status: 'REFUNDED',
      refundPending: false,
    });
    if (io) {
      io.to(`user:${order.userId}`).emit('number:expired', {
        orderId: order._id,
        orderType: 'OTP',
        refunded: true,
        creditsRefunded: order.creditsCharged,
      });
    }
    logger.info(`Refunded order ${order._id} (${order.creditsCharged}cr to user ${order.userId})`);
  } catch (err) {
    // Leave refundPending=true so the next cron tick retries.
    await NumberOrder.findByIdAndUpdate(order._id, { $inc: { refundAttempts: 1 } });
    logger.error(`Refund failed for order ${order._id} (attempt ${(order.refundAttempts || 0) + 1}): ${err.message}`);
  }
};

const runExpiryCheck = async () => {
  try {
    // 1. Process freshly-expired ACTIVE orders.
    const expired = await NumberOrder.find({
      status: 'ACTIVE',
      expiresAt: { $lte: new Date() },
    });

    for (const order of expired) {
      smsPoller.stopPolling(order._id.toString());

      if (order.orderType === 'RENTAL') {
        // Rentals: no refund — user paid for time, not SMS count
        await NumberOrder.findByIdAndUpdate(order._id, { status: 'RENTAL_EXPIRED' });
        if (order.provider === 'smspool') {
          // SMSPool rentals expire on the provider side automatically
        } else if (order.provider === 'grizzlysms') {
          try { await grizzlysms.setRentStatus(order.providerOrderId, 1); } catch (_) {}
        } else {
          try { await fivesim.cancelOrder(order.providerOrderId); } catch (_) {}
        }
        if (io) {
          io.to(`user:${order.userId}`).emit('number:expired', {
            orderId: order._id,
            orderType: 'RENTAL',
            refunded: false,
          });
        }
        continue;
      }

      // OTP path. Atomically transition ACTIVE → COMPLETED (if SMS arrived)
      // or EXPIRED+refundPending (if not). The atomic flip + re-read prevents
      // races with the SMS poller that might have just marked it COMPLETED.
      const claimed = await NumberOrder.findOneAndUpdate(
        { _id: order._id, status: 'ACTIVE' },
        order.smsContent
          ? { $set: { status: 'COMPLETED' } }
          : { $set: { status: 'EXPIRED', refundPending: true } },
        { new: true }
      );
      if (!claimed) continue; // poller beat us to it

      if (claimed.smsContent) {
        if (io) {
          io.to(`user:${order.userId}`).emit('number:expired', {
            orderId: order._id, orderType: 'OTP', refunded: false,
          });
        }
        continue;
      }

      // Cancel on provider (best-effort)
      try {
        if (order.provider === 'grizzlysms') {
          await grizzlysms.setStatus(order.providerOrderId, 8);
        } else {
          await fivesim.cancelOrder(order.providerOrderId);
        }
      } catch (_) {}

      await tryRefund(claimed);
    }

    // 2. Retry any orders that previously failed to refund.
    // refundPending is the durable flag — this loop keeps trying until success.
    const pending = await NumberOrder.find({ refundPending: true, status: 'EXPIRED' });
    for (const order of pending) {
      // Cap retries logged loudly so an admin notices — but keep retrying.
      if (order.refundAttempts >= 10 && order.refundAttempts % 60 === 0) {
        logger.error(`Order ${order._id} has failed refund ${order.refundAttempts} times — needs admin attention`);
      }
      await tryRefund(order);
    }

    const total = expired.length + pending.length;
    if (total > 0) {
      logger.info(`Expiry sweep: ${expired.length} expired + ${pending.length} retried refunds`);
    }
  } catch (err) {
    logger.error('Number expiry job error:', err);
  }
};

// One-off recovery on server startup: find OTP orders that are already
// EXPIRED, have no SMS, and have no matching REFUND CreditTransaction.
// This catches orders stuck before the refundPending flag existed.
const recoverStuckOrders = async () => {
  try {
    const CreditTransaction = require('../models/CreditTransaction');
    // Look at OTP orders marked EXPIRED in the last 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const candidates = await NumberOrder.find({
      orderType: { $in: ['OTP', null, undefined] },
      status: 'EXPIRED',
      smsContent: { $in: [null, ''] },
      createdAt: { $gte: since },
    });
    let stuck = 0;
    for (const o of candidates) {
      const refunded = await CreditTransaction.findOne({
        userId: o.userId,
        referenceId: o._id.toString(),
        type: 'REFUND',
      });
      if (!refunded) {
        await NumberOrder.findByIdAndUpdate(o._id, { refundPending: true });
        stuck++;
      }
    }
    if (stuck > 0) {
      logger.warn(`Recovery: flagged ${stuck} stuck orders for refund — will be processed by next cron tick`);
    }
  } catch (err) {
    logger.error('Recovery sweep failed:', err.message);
  }
};

const start = () => {
  // Recover any stuck orders from before this fix shipped, then run normally.
  recoverStuckOrders().then(() => runExpiryCheck()).catch(() => {});
  cron.schedule('* * * * *', runExpiryCheck);
  logger.info('Number expiry cron started');
};

module.exports = { start, setIO, runExpiryCheck, recoverStuckOrders };
