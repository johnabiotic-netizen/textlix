const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

/**
 * Record a security-sensitive event.
 * Always fire-and-forget — never await in a request path.
 * Failures are logged but never propagated to the caller.
 */
const audit = (action, { userId = null, email = null, ip = null, userAgent = null, meta = null, success = true } = {}) => {
  AuditLog.create({ action, userId, email, ip, userAgent, meta, success }).catch((err) => {
    logger.error('Audit log write failed:', err.message);
  });
};

/**
 * Extract the real client IP from an Express request.
 * Works behind Railway / nginx reverse proxy (trust proxy: 1 is set in app.js).
 */
const getIP = (req) => req.ip || req.connection?.remoteAddress || null;

const getUA = (req) => (req.headers['user-agent'] || '').slice(0, 200);

module.exports = { audit, getIP, getUA };
