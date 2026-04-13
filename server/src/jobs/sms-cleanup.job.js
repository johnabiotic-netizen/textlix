const cron = require('node-cron');
const NumberOrder = require('../models/NumberOrder');
const { getSettingNum } = require('../utils/settings');
const logger = require('../config/logger');

const runCleanup = async () => {
  try {
    const retentionHours = await getSettingNum('sms_retention_hours', 24);
    const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

    const result = await NumberOrder.updateMany(
      { smsContent: { $ne: null }, smsContent: { $ne: '[deleted]' }, smsReceivedAt: { $lte: cutoff } },
      { $set: { smsContent: '[deleted]', smsCode: null } }
    );

    if (result.modifiedCount > 0) {
      logger.info(`SMS cleanup: deleted content from ${result.modifiedCount} orders`);
    }
  } catch (err) {
    logger.error('SMS cleanup job error:', err);
  }
};

const start = () => {
  cron.schedule('0 0 * * *', runCleanup);
  logger.info('SMS cleanup cron started');
};

module.exports = { start, runCleanup };
