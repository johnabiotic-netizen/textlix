const crypto = require('crypto');
const NumberOrder = require('../models/NumberOrder');
const User = require('../models/User');
const fivesim = require('../providers/sms/fivesim.provider');
const smsactivate = require('../providers/sms/smsactivate.provider');
const grizzlysms = require('../providers/sms/grizzlysms.provider');
const smspool = require('../providers/sms/smspool.provider');
const getsms = require('../providers/sms/getsms.provider');
const getsmsotp = require('../providers/sms/getsmsotp.provider');
const smscodes = require('../providers/sms/smscodes.provider');
const smspva = require('../providers/sms/smspva.provider');
const smsbus = require('../providers/sms/smsbus.provider');
const { sendSmsNotificationEmail } = require('../utils/email');
// Mobile push lives only in the local/mobile build; the web deploy ships without
// push.service.js. Load it if present, otherwise degrade to a no-op so the
// web-only deploy never crashes on a missing module.
let pushService;
try { pushService = require('./push.service'); } catch (_) { pushService = { sendToUser: () => {} }; }
const logger = require('../config/logger');

// Build a lock-screen-friendly preview of an SMS code: keeps the first 2
// digits, masks the rest with bullets. Lets users react to a Telegram code
// arriving without unlocking, while not leaking the full code.
function redactCode(code) {
  if (!code) return '';
  const s = String(code);
  if (s.length <= 2) return s;
  return s.slice(0, 2) + '•'.repeat(Math.min(s.length - 2, 4));
}

async function _findService(order) {
  if (!order.serviceId) return null;
  // Load lazily to avoid circular imports at module init.
  const Service = require('../models/Service');
  return Service.findById(order.serviceId, 'name slug');
}

class SMSPollerService {
  constructor() {
    this.activePolls = new Map();
    this.pollFailures = new Map(); // orderId → consecutive error count
    this.inFlight = new Set();     // orderIds whose poll is still running — skip overlapping ticks
    this.io = null;
  }

  setIO(io) {
    this.io = io;
  }

  startPolling(order) {
    const orderId = order._id.toString();
    if (this.activePolls.has(orderId)) return;

    const intervalId = setInterval(async () => {
      // Skip if this order's previous poll hasn't finished. Under a slow/throttled
      // provider queue (get-sms spaces calls 1.8s apart), overlapping ticks would
      // pile up faster than they drain and saturate the queue — the bug that froze
      // pricing. One poll per order at a time keeps the queue bounded.
      if (this.inFlight.has(orderId)) return;
      this.inFlight.add(orderId);
      try {
        await this._poll(order);
        this.pollFailures.delete(orderId);
      } catch (err) {
        const fails = (this.pollFailures.get(orderId) || 0) + 1;
        this.pollFailures.set(orderId, fails);
        logger.error(`Poll error for order ${orderId} (${fails}/10): ${err.message}`);
        if (fails >= 10) {
          logger.warn(`Stopping poll for order ${orderId} after 10 consecutive errors`);
          this.stopPolling(orderId);
        }
      } finally {
        this.inFlight.delete(orderId);
      }
    }, 5000);

    this.activePolls.set(orderId, intervalId);
    logger.debug(`Started polling order ${orderId}`);
  }

  async _poll(order) {
    if (order.provider === 'smscodes') {
      await this._pollSmsCodes(order);
    } else if (order.provider === 'smsbus') {
      await this._pollSmsBus(order);
    } else if (order.provider === 'getsmsotp') {
      await this._pollGetSmsOtp(order);
    } else if (order.provider === 'getsms') {
      await this._pollGetSms(order);
    } else if (order.provider === 'smspva') {
      await this._pollSmsPva(order);
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

  async _pollSmsCodes(order) {
    // smscodes needs both the SecurityId (providerOrderId) and the number.
    // Polling before a code arrives is free; it only bills once a code returns.
    const code = await smscodes.getSMS(order.providerOrderId, order.phoneNumber);
    if (code) {
      await this._handleOtpSms(order, { text: `Your code: ${code}`, code });
    }
  }

  async _pollSmsBus(order) {
    // SMS-BUS (LIX 4) OTP — poll the request id for a code. Waiting/expired both
    // return null (no code yet); the expiry cron handles timeout + refund.
    const code = await smsbus.getSMS(order.providerOrderId);
    if (code) {
      await this._handleOtpSms(order, { text: `Your code: ${code}`, code });
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
    let messages;
    try {
      messages = await getsms.getSMS(order.providerOrderId);
    } catch (err) {
      // get-sms lost this rental — stop polling it (a dead rental polling forever
      // is what clogs the queue) and mark it so it leaves the active set.
      if (err.code === 'GETSMS_RENTAL_GONE') {
        logger.warn(`get-sms rental ${order.providerOrderId} no longer exists — stopping poll, marking EXPIRED`);
        await NumberOrder.findByIdAndUpdate(order._id, { status: 'EXPIRED' });
        this.stopPolling(order._id.toString());
        return;
      }
      throw err; // transient — let the generic handler count it toward the 10-error stop
    }
    if (!messages.length) return;
    const smsList = messages.map((m) => ({
      id: crypto.createHash('md5').update(`${m.text}|${m.date}`).digest('hex'),
      text: m.text,
      code: extractCode(m.text),
    }));
    await this._handleRentalSms(order, smsList);
  }

  async _pollSmsPva(order) {
    let messages;
    try {
      messages = await smspva.getSMS(order.providerOrderId);
    } catch (err) {
      // SMSPVA lost this rental — stop polling and mark it, same contract as
      // the get-sms handler (dead rentals must not clog the serialized queue).
      if (err.code === 'SMSPVA_RENTAL_GONE') {
        logger.warn(`SMSPVA rental ${order.providerOrderId} no longer exists — stopping poll, marking EXPIRED`);
        await NumberOrder.findByIdAndUpdate(order._id, { status: 'EXPIRED' });
        this.stopPolling(order._id.toString());
        return;
      }
      throw err; // transient — counts toward the 10-error stop
    }
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

    // Push notification fan-out for mobile clients. Best-effort; never throws.
    _findService(order).then((service) => {
      const code = sms.code || extractCode(sms.text);
      const svcLabel = service?.name || 'verification';
      pushService.sendToUser(order.userId, {
        title: `Code: ${redactCode(code)}`,
        body: `${order.phoneNumber} • ${svcLabel}${code ? ` • tap to view` : ''}`,
        data: { type: 'sms_received', orderId: String(order._id), orderType: 'OTP' },
      });
    }).catch(() => {});

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
    const existing = await NumberOrder.findById(order._id, 'smsMessages');
    const seenIds = new Set(
      (existing?.smsMessages || []).map((m) => m.messageId).filter(Boolean)
    );

    const newMessages = smsList
      .filter((sms) => sms.id && !seenIds.has(String(sms.id)))
      .map((sms) => ({
        messageId: String(sms.id),
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

    // Push notification for the rental — single batched notification per poll
    // tick. If multiple SMS arrived in the same tick, we surface the count.
    const latest = newMessages[newMessages.length - 1];
    const code = latest.code;
    pushService.sendToUser(order.userId, {
      title: newMessages.length > 1
        ? `${newMessages.length} new messages`
        : (code ? `Code: ${redactCode(code)}` : 'New SMS'),
      body: `${order.phoneNumber} • rental • tap to view`,
      data: { type: 'sms_received', orderId: String(order._id), orderType: 'RENTAL' },
    });

    logger.info(`${newMessages.length} rental SMS(es) received for order ${order._id}`);
  }

  stopPolling(orderId) {
    const key = orderId.toString();
    const intervalId = this.activePolls.get(key);
    if (intervalId) {
      clearInterval(intervalId);
      this.activePolls.delete(key);
      this.pollFailures.delete(key);
      this.inFlight.delete(key);
      logger.debug(`Stopped polling order ${key}`);
    }
  }

  stopAll() {
    for (const [, intervalId] of this.activePolls) {
      clearInterval(intervalId);
    }
    this.activePolls.clear();
    this.pollFailures.clear();
    this.inFlight.clear();
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
