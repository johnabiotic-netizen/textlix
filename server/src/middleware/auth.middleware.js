const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const ApiKey = require('../models/ApiKey');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHORIZED', 401, 'No token provided'));
  }
  const token = authHeader.split(' ')[1];

  // API key path
  if (token.startsWith('tlx_live_')) {
    try {
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const key = await ApiKey.findOne({ keyHash: hash, isActive: true });
      if (!key) return next(new AppError('UNAUTHORIZED', 401, 'Invalid API key'));
      await ApiKey.findByIdAndUpdate(key._id, { lastUsedAt: new Date() });
      const User = require('../models/User');
      const user = await User.findById(key.userId);
      if (!user || user.isBanned) return next(new AppError('UNAUTHORIZED', 401, 'Account suspended'));
      req.user = { userId: user._id.toString(), email: user.email, role: user.role };
      return next();
    } catch (err) {
      return next(new AppError('UNAUTHORIZED', 401, 'Invalid API key'));
    }
  }

  // JWT path
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { userId: payload.userId, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    return next(new AppError('UNAUTHORIZED', 401, 'Invalid or expired token'));
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new AppError('FORBIDDEN', 403, 'Admin access required'));
  }
  next();
};

module.exports = { authenticate, requireAdmin };
