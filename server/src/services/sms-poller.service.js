const NumberOrder = require('../models/NumberOrder');
const User = require('../models/User');
const fivesim = require('../providers/sms/fivesim.provider');
const { sendSmsNotificationEmail } = require('../utils/email');
const logger = require('../config/logger');

class SMSPollerService {
  constructor() {
    this.activePolls = new Map();
    this.io = null;
  }

  setIO(io) {
    this.io = io;
  }

  startPolling(order) {
    if (this.activePolls.has(order._id.toString())) return;

    const intervalId = setInterval(async () => {
      try {
        await this._poll(order);
      } catch (err) {
        logger.error(`Poll error for order ${order._id}:`, err.message);
      }
    }, 5000);

    this.activePolls.set(order._id.toString(), intervalId);
    logger.debug(`Started polling order ${order._id}`);
  }

  async _poll(order) {
    const result = await fivesim.checkOrder(order.providerOrderId);

    if (result.sms && result.sms.length > 0) {
      if (order.orderType === 'RENTAL') {
        await this._handleRentalSms(order, result.sms);
      } else {
        await this._handleOtpSms(order, result.sms[0]);
      }
    }

    // Stop polling on terminal provider statuses (OTP only — rental uses expiry cron)
    if (order.orderType !== 'RENTAL' && (result.status === 'TIMEOUT' || result.status === 'CANCELED')) {
      this.stopPolling(order._id.toString());
    }
  }

  async _handleOtpSms(order, sms) {
    await NumberOrder.findByIdAndUpdate(order._id, {
      smsContent: sms.text,
      smsCode: sms.code || extractCode(sms.text),
      smsReceivedAt: new Date(),
      status: 'COMPLETED',
    });

    if (this.io) {
      this.io.to(`user:${order.userId}`).emit('sms:received', {
        orderId: order._id,
        phoneNumber: order.phoneNumber,
        smsContent: sms.text,
        smsCode: sms.code || extractCode(sms.text),
        orderType: 'OTP',
      });
    }

    this.stopPolling(order._id.toString());

    try { await fivesim.finishOrder(order.providerOrderId); } catch (_) {}

    // Fire-and-forget email notification
    User.findById(order.userId, 'email emailNotifications').then((user) => {
      if (user?.emailNotifications) {
        sendSmsNotificationEmail(user.email, {
          phoneNumber: order.phoneNumber,
          smsCode: sms.code || extractCode(sms.text),
          smsContent: sms.text,
        }).catch((err) => logger.error('SMS notification email failed:', err.message));
      }
    }).catch(() => {});

    logger.info(`OTP SMS received for order ${order._id}`);
  }

  async _handleRentalSms(order, smsList) {
    // Load existing message IDs to avoid saving duplicates
    const existing = await NumberOrder.findById(order._id, 'smsMessages');
    const seenIds = new Set((existing?.smsMessages || []).map((m) => m.fivesimId));

    const newMessages = smsList
      .filter((sms) => sms.id && !seenIds.has(String(sms.id)))
      .map((sms) => ({
        fivesimId: String(sms.id),
        text: sms.text,
        code: sms.code || extractCode(sms.text),
        receivedAt: new Date(),
      }));

    if (newMessages.length === 0) return;

    await NumberOrder.findByIdAndUpdate(order._id, {
      $push: { smsMessages: { $each: newMessages } },
    });

    if (this.io) {
      this.io.to(`user:${order.userId}`).emit('sms:received', {
        orderId: order._id,
        phoneNumber: order.phoneNumber,
        newMessages,
        orderType: 'RENTAL',
      });
    }

    logger.info(`${newMessages.length} rental SMS(es) received for order ${order._id}`);
  }

  stopPolling(orderId) {
    const key = orderId.toString();
    const intervalId = this.activePolls.get(key);
    if (intervalId) {
      clearInterval(intervalId);
      this.activePolls.delete(key);
      logger.debug(`Stopped polling order ${key}`);
    }
  }

  stopAll() {
    for (const [, intervalId] of this.activePolls) {
      clearInterval(intervalId);
    }
    this.activePolls.clear();
    logger.info('All SMS polling stopped');
  }

  // Restart polling for orders that were active when server restarted
  async resumeActive() {
    const activeOrders = await NumberOrder.find({ status: 'ACTIVE' });
    const resumed = [];
    for (const order of activeOrders) {
      if (new Date() < order.expiresAt) {
        this.startPolling(order);
        resumed.push(order._id);
      }
    }
    logger.info(`Resumed polling for ${resumed.length} active orders (${activeOrders.length - resumed.length} already expired, will be caught by cron)`);
  }
}

function extractCode(text) {
  if (!text) return null;
  const match = text.match(/\b(\d{4,8})\b/);
  return match ? match[1] : null;
}

module.exports = new SMSPollerService();
