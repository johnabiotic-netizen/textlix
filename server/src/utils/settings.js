const PlatformSettings = require('../models/PlatformSettings');

const getSetting = async (key) => {
  const setting = await PlatformSettings.findOne({ key });
  return setting ? setting.value : null;
};

const getSettingNum = async (key, defaultVal) => {
  const val = await getSetting(key);
  return val !== null ? parseFloat(val) : defaultVal;
};

// Upsert a setting. `value` is stored as a string (the column type), so JSON
// snapshots should be JSON.stringify'd by the caller.
const setSetting = async (key, value) => {
  await PlatformSettings.updateOne(
    { key },
    { $set: { value: String(value) } },
    { upsert: true }
  );
};

module.exports = { getSetting, getSettingNum, setSetting };
