const welcomeBonusService = require('../services/welcome-bonus.service');
const { success } = require('../utils/response');

exports.status = async (req, res, next) => {
  try {
    const data = await welcomeBonusService.getStatus(req.user.userId);
    success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.claim = async (req, res, next) => {
  try {
    const data = await welcomeBonusService.claim(req.user.userId, req.ip);
    success(res, data);
  } catch (err) {
    next(err);
  }
};
