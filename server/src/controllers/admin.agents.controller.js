const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SupportConversation = require('../models/SupportConversation');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const { audit, getIP, getUA } = require('../utils/audit');

// Admin-panel sections an agent can be granted. 'support' is always included.
const SECTIONS = [
  'support', 'overview', 'users', 'transactions', 'payments', 'orders',
  'catalog', 'pricing', 'settings', 'promo-codes', 'reports', 'creators',
];

function cleanPerms(perms) {
  const list = Array.isArray(perms) ? perms.filter((p) => SECTIONS.includes(p)) : [];
  if (!list.includes('support')) list.unshift('support'); // agents always get support
  return [...new Set(list)];
}

// GET /admin/agents — list agents with resolved + currently-handling stats.
exports.list = async (req, res, next) => {
  try {
    const agents = await User.find(
      { role: 'AGENT' },
      'name email permissions isBanned createdAt lastLoginAt'
    ).sort({ createdAt: -1 });

    const [resolvedAgg, handlingAgg] = await Promise.all([
      SupportConversation.aggregate([
        { $match: { resolvedBy: { $ne: null } } },
        { $group: { _id: '$resolvedBy', count: { $sum: 1 } } },
      ]),
      SupportConversation.aggregate([
        { $match: { status: { $in: ['HUMAN', 'WAITING_HUMAN'] }, assignedAdminId: { $ne: null } } },
        { $group: { _id: '$assignedAdminId', count: { $sum: 1 } } },
      ]),
    ]);
    const resolvedMap = new Map(resolvedAgg.map((r) => [String(r._id), r.count]));
    const handlingMap = new Map(handlingAgg.map((r) => [String(r._id), r.count]));

    success(res, {
      sections: SECTIONS,
      agents: agents.map((a) => ({
        id: a._id,
        name: a.name,
        email: a.email,
        permissions: a.permissions || [],
        active: !a.isBanned,
        createdAt: a.createdAt,
        lastLoginAt: a.lastLoginAt,
        resolved: resolvedMap.get(String(a._id)) || 0,
        handling: handlingMap.get(String(a._id)) || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/agents — create an agent account.
exports.create = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      throw new AppError('VALIDATION_ERROR', 400, 'Name, email and password are required');
    }
    if (String(password).length < 8) {
      throw new AppError('VALIDATION_ERROR', 400, 'Password must be at least 8 characters');
    }
    const normEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normEmail });
    if (existing) throw new AppError('VALIDATION_ERROR', 400, 'An account with that email already exists');

    const passwordHash = await bcrypt.hash(password, 12);
    const agent = await User.create({
      name: String(name).trim(),
      email: normEmail,
      passwordHash,
      role: 'AGENT',
      permissions: cleanPerms(req.body.permissions),
      isEmailVerified: true,
      provider: 'LOCAL',
    });

    audit('ADMIN_CREATE_AGENT', {
      userId: req.user.userId,
      ip: getIP(req),
      userAgent: getUA(req),
      meta: { agentId: agent._id.toString(), email: normEmail },
    });

    success(
      res,
      { agent: { id: agent._id, name: agent.name, email: agent.email, permissions: agent.permissions, active: true, resolved: 0, handling: 0 } },
      201
    );
  } catch (err) {
    next(err);
  }
};

// PATCH /admin/agents/:id — edit permissions / activate-deactivate / rename.
exports.update = async (req, res, next) => {
  try {
    const agent = await User.findById(req.params.id);
    if (!agent || agent.role !== 'AGENT') throw new AppError('NOT_FOUND', 404, 'Agent not found');

    const set = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) set.name = req.body.name.trim();
    if (Array.isArray(req.body.permissions)) set.permissions = cleanPerms(req.body.permissions);
    if (typeof req.body.active === 'boolean') set.isBanned = !req.body.active;

    await User.findByIdAndUpdate(agent._id, { $set: set });
    audit('ADMIN_UPDATE_AGENT', {
      userId: req.user.userId,
      ip: getIP(req),
      userAgent: getUA(req),
      meta: { agentId: agent._id.toString(), updates: set },
    });
    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
};
