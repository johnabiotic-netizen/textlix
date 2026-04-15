const mongoose = require('mongoose');

// Immutable audit trail for security-sensitive actions.
// Documents are never updated or deleted — append-only.
const auditLogSchema = new mongoose.Schema(
  {
    // Who did it (null for unauthenticated attempts)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    email: { type: String, default: null },

    // What happened
    action: {
      type: String,
      required: true,
      enum: [
        'LOGIN_SUCCESS',
        'LOGIN_FAILURE',
        'LOGIN_LOCKED',
        'LOGOUT',
        'PASSWORD_RESET_REQUEST',
        'PASSWORD_RESET_COMPLETE',
        'EMAIL_VERIFIED',
        'OAUTH_LOGIN',
        'TOKEN_REFRESH',
        'ADMIN_UPDATE_USER',
        'ADMIN_DELETE_USER',
        'ADMIN_ADJUST_CREDITS',
        'ADMIN_UPDATE_SETTINGS',
        'ORDER_CREATED',
        'ORDER_CANCELLED',
        'PAYMENT_COMPLETED',
        'SUSPICIOUS_ACTIVITY',
      ],
    },

    // Context
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: null }, // extra details
    success: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    // Prevent accidental updates — audit logs must be immutable
    strict: true,
  }
);

// TTL index: auto-delete logs older than 90 days to manage storage
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
