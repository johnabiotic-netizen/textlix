const DeviceToken = require('../models/DeviceToken');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');

// Mobile clients call this on every cold start: upsert by Expo push token so
// the same physical device is one row regardless of how many times it logs in.
// If the token already exists for a different user (device handover), we
// reassign it — the previous user simply stops getting pushes on that device.
exports.register = async (req, res, next) => {
  try {
    const { expoPushToken, platform, appVersion } = req.body;
    if (!expoPushToken || typeof expoPushToken !== 'string') {
      throw new AppError('VALIDATION_ERROR', 400, 'expoPushToken required');
    }
    if (!['ios', 'android'].includes(platform)) {
      throw new AppError('VALIDATION_ERROR', 400, 'platform must be ios or android');
    }
    // Sanity bound on the Expo push token — they're short strings like
    // ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
    if (expoPushToken.length > 200) {
      throw new AppError('VALIDATION_ERROR', 400, 'expoPushToken too long');
    }

    const doc = await DeviceToken.findOneAndUpdate(
      { expoPushToken },
      {
        $set: {
          userId: req.user.userId,
          platform,
          appVersion: appVersion ? String(appVersion).slice(0, 40) : null,
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    success(res, { device: { id: doc._id, platform: doc.platform, lastSeenAt: doc.lastSeenAt } }, 201);
  } catch (err) {
    next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    const devices = await DeviceToken.find({ userId: req.user.userId })
      .select('platform appVersion lastSeenAt createdAt')
      .sort({ lastSeenAt: -1 })
      .limit(20);
    success(res, { devices });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await DeviceToken.deleteOne({
      _id: req.params.tokenId,
      userId: req.user.userId,
    });
    if (result.deletedCount === 0) throw new AppError('NOT_FOUND', 404, 'Device not found');
    success(res, { message: 'Device removed' });
  } catch (err) {
    next(err);
  }
};
