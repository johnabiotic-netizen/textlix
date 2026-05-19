const crypto = require('crypto');
const NumberOrder = require('../models/NumberOrder');
const User = require('../models/User');
const fivesim = require('../providers/sms/fivesim.provider');
const smsactivate = require('../providers/sms/smsactivate.provider');
const grizzlysms = require('../providers/sms/grizzlysms.provider');
const smspool = require('../providers/sms/smspool.provider');
const getsms = require('../providers/sms/getsms.provider');
const getsmsotp = require('../providers/sms/getsmsotp.provider');
const { sendSmsNotificationEmail } = require('../utils/email');
const logger = require('../config/logger');

class SMSPollerService {
  constructor() {
    this.activePolls = new Map();
    this.pollFailures = new Map(); // orderId → consecutive error count
    this.io = null;
  }

  setIO(io) {
    this.io = io;
  }

  startPolling(order) {
    const orderId = order._id.toString();
    if (this.activePolls.has(orderId)) return;

    const intervalId = setInterval(async () => {
      try {
        await this._poll(order);
        this.pollFailures.delete(orderId);
      } catch (err) {
        const fails = (this.pollFailures.get(orderId) || 0) + 1;
        this.pollFailures.set(orderId, fails);
        logger.error(`Poll error for order ${orderId} (${fails}/10):`, err.message);
        if (fails >= 10) {
          logger.warn(`Stopping poll for order ${orderId} after 10 consecutive errors`);
          this.stopPolling(orderId);
        }
      }
    }, 5000);

    this.activePolls.set(orderId, intervalId);
    logger.debug(`Started polling order ${orderId}`);
  }

  async _poll(order) {
    if (order.provider === 'getsmsotp') {
      await this._pollGetSmsOtp(order);
    } else if (order.provider === 'getsms') {
      await this._pollGetSms(order);
    } else if (order.provider === 'smspool') {
      await this._pollSmsPool(order);
    } else if (order.provider === 'smsactivate') {
      await this._pollSmsActivate(order);
    } else if (order.provider === 'grizzlysms') {
      await this._pollGrizzly(order);
    } else {
      await this._pollFiveSim(order);
    }
  }

  async _pollGetSmsOtp(order) {
    const statusStr = await getsmsotp.getStatus(order.providerOrderId);
    if (statusStr.startsWith('STATUS_OK') || statusStr.startsWith('STATUS_WAIT_RETRY')) {
      const parts = statusStr.split(':');
      const code = parts[1] || null;
      const fakeSms = { text: code ? `Your code: ${code}` : '', code };
      await this._handleOtpSms(order, fakeSms);
    } else if (statusStr === 'STATUS_CANCEL') {
      this.stopPolling(order._id.toString());
    }
  }

  async _pollGetSms(order) {
    const messages = await getsms.getSMS(order.providerOrderId);
    if (!messages.length) return;
    const smsList = messages.map((m) => ({
      id: crypto.createHash('md5').update(`${m.text}|${m.date}`).digest('hex'),
      text: m.text,
      code: extractCode(m.text),
    }));
    await this._handleRentalSms(order, smsList);
  }

  async _pollFiveSim(order) {
    if (order.orderType === 'RENTAL') {
      // Hosting orders: use the dedicated inbox endpoint which returns all received SMS
      const smsList = await fivesim.getHostingInbox(order.providerOrderId);
      if (smsList.length > 0) {
        await this._handleRentalSms(order, smsList);
      }
      return;
    }

    // OTP activation
    const result = await fivesim.checkOrder(order.providerOrderId);
    if (result.sms && result.sms.length > 0) {
      await this._handleOtpSms(order, result.sms[0]);
    }
    if (result.status === 'TIMEOUT' || result.status === 'CANCELED') {
      this.stopPolling(order._id.toString());
    }
  }

  async _pollGrizzly(order) {
    if (order.orderType === 'RENTAL') {
      const messages = await grizzlysms.getRentStatus(order.providerOrderId);
      if (!messages.length) return;
      const smsList = messages.map((m) => ({
        id: crypto.createHash('md5').update(`${m.text}|${m.date}`).digest('hex'),
        text: m.text,
        code: extractCode(m.text),
      }));
      await this._handleRentalSms(order, smsList);
    } else {
      // OTP activation — same status string format as SMS-Activate
      const statusStr = await grizzlysms.getStatus(order.providerOrderId);
      if (statusStr.startsWith('STATUS_OK') || statusStr.startsWith('STATUS_WAIT_RETRY')) {
        const parts = statusStr.split(':');
        const code = parts[1] || null;
        const fakeSms = { text: code ? `Your code: ${code}` : '', code };
        await this._handleOtpSms(order, fakeSms);
      } else if (statusStr === 'STATUS_CANCEL') {
        this.stopPolling(order._id.toString());
      }
    }
  }

  async _pollSmsActivate(order) {
    // SMSActivate status string format:
    //   STATUS_WAIT_CODE          — waiting
    //   STATUS_OK:<code>          — SMS received, code extracted
    //   STATUS_CANCEL             — cancelled / no SMS
    //   STATUS_WAIT_RESEND        — waiting for resend
    //   STATUS_WAIT_RETRY:<code>  — retry, code present
    const statusStr = await smsactivate.getStatus(order.providerOrderId);

    if (statusStr.startsWith('STATUS_OK') || statusStr.startsWith('STATUS_WAIT_RETRY')) {
      const parts = statusStr.split(':');
      const code = parts[1] || null;
      const fakeSms = { text: code ? `Your code: ${code}` : '', code };
      await this._handleOtpSms(order, fakeSms);
    } else if (statusStr === 'STATUS_CANCEL') {
      this.stopPolling(order._id.toString());
    }
    // STATUS_WAIT_CODE / STATUS_WAIT_RESEND — keep polling
  }

  async _pollSmsPool(order) {
    const messages = await smspool.getRentalMessages(order.providerOrderId);
    if (!messages.length) return;

    const smsList = messages.map((m) => {
      const text = m.sms_content || m.message || m.text || '';
      const date = m.time || m.date || '';
      return {
        id: crypto.createHash('md5').update(`${text}|${date}`).digest('hex'),
        text,
        code: m.sms_code || extractCode(text),
      };
    });
    await this._handleRentalSms(order, smsList);
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
    // Load existing message IDs to avoid saving duplicates.
    // Check both messageId (new generic field) and fivesimId (legacy 5sim field).
    const existing = await NumberOrder.findById(order._id, 'smsMessages');
    const seenIds = new Set(
      (existing?.smsMessages || []).flatMap((m) => [m.messageId, m.fivesimId].filter(Boolean))
    );

    const newMessages = smsList
      .filter((sms) => sms.id && !seenIds.has(String(sms.id)))
      .map((sms) => ({
        messageId: String(sms.id),
        fivesimId: String(sms.id), // kept for backwards-compat with existing 5sim rental orders
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
      this.pollFailures.delete(key);
      logger.debug(`Stopped polling order ${key}`);
    }
  }

  stopAll() {
    for (const [, intervalId] of this.activePolls) {
      clearInterval(intervalId);
    }
    this.activePolls.clear();
    this.pollFailures.clear();
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
