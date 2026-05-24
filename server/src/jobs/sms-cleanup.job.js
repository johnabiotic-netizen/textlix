const cron = require('node-cron');
const NumberOrder = require('../models/NumberOrder');
const PlatformSettings = require('../models/PlatformSettings');
const { getSettingNum } = require('../utils/settings');
const logger = require('../config/logger');

// Default retention: 90 days. SMS codes are kept readable in the user's
// inbox + history for this window before being scrubbed.
const DEFAULT_RETENTION_HOURS = 90 * 24;

const runCleanup = async () => {
  try {
    const retentionHours = await getSettingNum('sms_retention_hours', DEFAULT_RETENTION_HOURS);
    const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

    const result = await NumberOrder.updateMany(
      {
        smsReceivedAt: { $lte: cutoff },
        smsContent: { $nin: [null, '[deleted]'] },
      },
      { $set: { smsContent: '[deleted]', smsCode: null } }
    );

    if (result.modifiedCount > 0) {
      logger.info(`SMS cleanup: scrubbed content from ${result.modifiedCount} orders older than ${retentionHours}h`);
    }
  } catch (err) {
    logger.error('SMS cleanup job error:', err);
  }
};

// One-time migration: bump any stale (≤ 30-day) sms_retention_hours setting
// up to 90 days. Old default was 24h which wiped codes too quickly.
const migrateRetentionSetting = async () => {
  try {
    const existing = await PlatformSettings.findOne({ key: 'sms_retention_hours' });
    if (!existing) {
      await PlatformSettings.create({
        key: 'sms_retention_hours',
        value: String(DEFAULT_RETENTION_HOURS),
        description: 'Hours to retain SMS content before deletion',
      });
      logger.info(`sms_retention_hours seeded at ${DEFAULT_RETENTION_HOURS}h`);
      return;
    }
    const current = parseFloat(existing.value);
    if (Number.isFinite(current) && current <= 30 * 24) {
      existing.value = String(DEFAULT_RETENTION_HOURS);
      await existing.save();
      logger.info(`sms_retention_hours migrated ${current}h → ${DEFAULT_RETENTION_HOURS}h`);
    }
  } catch (err) {
    logger.warn(`sms_retention_hours migration skipped: ${err.message}`);
  }
};

const start = () => {
  migrateRetentionSetting().catch(() => {});
  cron.schedule('0 0 * * *', runCleanup);
  logger.info('SMS cleanup cron started');
};

module.exports = { start, runCleanup };
