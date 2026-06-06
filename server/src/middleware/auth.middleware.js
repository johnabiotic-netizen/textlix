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

// Allow ADMIN or AGENT into the admin router (agents are then narrowed per
// section by adminSectionGuard).
const requireSupportStaff = (req, res, next) => {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'AGENT')) {
    return next(new AppError('FORBIDDEN', 403, 'Staff access required'));
  }
  next();
};

// Map the first admin path segment to a permission section. Anything not listed
// (and agent-management) is admin-only for agents.
const SECTION_BY_SEGMENT = {
  support: 'support',
  users: 'users',
  transactions: 'transactions',
  payments: 'payments',
  orders: 'orders',
  catalog: 'catalog',
  pricing: 'pricing',
  settings: 'settings',
  'promo-codes': 'promo-codes',
  reports: 'reports',
  creators: 'creators',
  dashboard: 'overview',
  'provider-health': 'overview',
  'audit-logs': 'overview',
  'revenue-report': 'overview',
};

// Section-level gate for the /admin router. Admins pass everything. Agents pass
// only the sections granted on their account; agent-management is admin-only.
const adminSectionGuard = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') return next();
    if (req.user.role !== 'AGENT') return next(new AppError('FORBIDDEN', 403, 'Admin access required'));

    const parts = req.path.split('/').filter(Boolean);
    const idx = parts.indexOf('admin');
    const seg = (idx >= 0 ? parts[idx + 1] : parts[0] || '').toLowerCase();

    if (seg === 'agents') return next(new AppError('FORBIDDEN', 403, 'Admin access required'));
    const section = SECTION_BY_SEGMENT[seg];
    if (!section) return next(new AppError('FORBIDDEN', 403, 'Not permitted'));

    const User = require('../models/User');
    const u = await User.findById(req.user.userId, 'permissions role isBanned');
    if (!u || u.isBanned || u.role !== 'AGENT' || !(u.permissions || []).includes(section)) {
      return next(new AppError('FORBIDDEN', 403, 'You do not have access to this section'));
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, requireAdmin, requireSupportStaff, adminSectionGuard };
