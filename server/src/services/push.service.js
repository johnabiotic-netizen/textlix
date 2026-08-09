const { Expo } = require('expo-server-sdk');
const DeviceToken = require('../models/DeviceToken');
const logger = require('../config/logger');

// Expo Push API client. No constructor args needed — push tokens are
// `ExponentPushToken[...]` strings opaque to us; Expo signs delivery with the
// APNs key + FCM credentials we uploaded to the Expo dashboard.
const expo = new Expo();

const MAX_BODY_LEN = 178; // iOS truncates beyond ~178 chars on lock screen

// Send a push to all of the user's registered devices. Cleans up
// `DeviceNotRegistered` tokens (uninstalls / opt-outs) so we don't keep
// hammering them.
//
// payload: { title, body, data } — `data` is JSON-serializable and arrives in
// the notification-response handler on the device (e.g. for deep linking).
const sendToUser = async (userId, payload) => {
  try {
    const devices = await DeviceToken.find({ userId }).select('expoPushToken');
    if (devices.length === 0) return { sent: 0, skipped: 0 };

    const messages = [];
    const invalidTokens = [];
    for (const d of devices) {
      if (!Expo.isExpoPushToken(d.expoPushToken)) {
        invalidTokens.push(d.expoPushToken);
        continue;
      }
      messages.push({
        to: d.expoPushToken,
        sound: 'default',
        title: String(payload.title || 'Textlix').slice(0, 64),
        body: String(payload.body || '').slice(0, MAX_BODY_LEN),
        data: payload.data || {},
        priority: 'high',
        channelId: 'sms-arrival',
      });
    }

    if (invalidTokens.length) {
      await DeviceToken.deleteMany({ expoPushToken: { $in: invalidTokens } });
    }

    // Expo accepts up to 100 messages per request — `chunkPushNotifications`
    // handles the split. Returns receipts per message.
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      try {
        const t = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...t);
      } catch (err) {
        logger.warn(`Expo push chunk send failed: ${err.message}`);
      }
    }

    // Walk tickets — `DeviceNotRegistered` means the user uninstalled or
    // disabled notifications. Drop the token.
    const deadTokens = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        deadTokens.push(messages[i].to);
      }
    });
    if (deadTokens.length) {
      await DeviceToken.deleteMany({ expoPushToken: { $in: deadTokens } });
      logger.info(`Pruned ${deadTokens.length} dead Expo push tokens`);
    }

    return { sent: messages.length, skipped: invalidTokens.length, dead: deadTokens.length };
  } catch (err) {
    // Push is best-effort — never throw out into the caller (SMS poller, etc).
    logger.error(`pushService.sendToUser failed: ${err.message}`);
    return { sent: 0, error: err.message };
  }
};

module.exports = { sendToUser };
