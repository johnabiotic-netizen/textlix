const cron = require('node-cron');
const NumberOrder = require('../models/NumberOrder');
const { refundCredits } = require('../services/credit.service');
const fivesim = require('../providers/sms/fivesim.provider');
const smsPoller = require('../services/sms-poller.service');
const logger = require('../config/logger');

let io;

const setIO = (socketIo) => {
  io = socketIo;
};

const runExpiryCheck = async () => {
  try {
    const expired = await NumberOrder.find({
      status: 'ACTIVE',
      expiresAt: { $lte: new Date() },
    });

    for (const order of expired) {
      try {
        await fivesim.cancelOrder(order.providerOrderId);
      } catch (_) {}

      await NumberOrder.findByIdAndUpdate(order._id, {
        status: order.smsContent ? 'COMPLETED' : 'EXPIRED',
      });

      if (!order.smsContent) {
        try {
          await refundCredits(
            order.userId,
            order.creditsCharged,
            `Refund: number expired without SMS`,
            order._id.toString()
          );

          await NumberOrder.findByIdAndUpdate(order._id, { status: 'REFUNDED' });

          if (io) {
            io.to(`user:${order.userId}`).emit('number:expired', {
              orderId: order._id,
              refunded: true,
              creditsRefunded: order.creditsCharged,
            });
          }
        } catch (err) {
          logger.error(`Failed to refund order ${order._id}:`, err.message);
        }
      } else if (io) {
        io.to(`user:${order.userId}`).emit('number:expired', {
          orderId: order._id,
          refunded: false,
        });
      }

      smsPoller.stopPolling(order._id.toString());
    }

    if (expired.length > 0) {
      logger.info(`Expired ${expired.length} number orders`);
    }
  } catch (err) {
    logger.error('Number expiry job error:', err);
  }
};

const start = () => {
  cron.schedule('* * * * *', runExpiryCheck);
  logger.info('Number expiry cron started');
};

module.exports = { start, setIO, runExpiryCheck };
