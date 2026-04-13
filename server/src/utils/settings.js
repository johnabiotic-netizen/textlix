const PlatformSettings = require('../models/PlatformSettings');

const getSetting = async (key) => {
  const setting = await PlatformSettings.findOne({ key });
  return setting ? setting.value : null;
};

const getSettingNum = async (key, defaultVal) => {
  const val = await getSetting(key);
  return val !== null ? parseFloat(val) : defaultVal;
};

module.exports = { getSetting, getSettingNum };
