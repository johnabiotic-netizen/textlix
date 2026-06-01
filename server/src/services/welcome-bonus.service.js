const PlatformSettings = require('../models/PlatformSettings');
const User = require('../models/User');
const { addCredits } = require('./credit.service');
const { normalizeEmail } = require('../utils/normalize-email');
const AppError = require('../utils/AppError');

const CAP = parseInt(process.env.WELCOME_BONUS_CAP || '500', 10);
const CREDITS = parseInt(process.env.WELCOME_BONUS_CREDITS || '50', 10);
const COUNTER_KEY = 'WELCOME_BONUS_REMAINING';

async function ensureCounter() {
  await PlatformSettings.updateOne(
    { key: COUNTER_KEY },
    {
      $setOnInsert: {
        value: String(CAP),
        description: 'Remaining welcome-bonus claims (pre-launch follow-to-claim campaign)',
      },
    },
    { upsert: true }
  );
}

async function getStatus(userId) {
  await ensureCounter();
  const [user, counter] = await Promise.all([
    User.findById(userId).select('welcomeBonusClaimed welcomeBonusClaimedAt isEmailVerified'),
    PlatformSettings.findOne({ key: COUNTER_KEY }),
  ]);
  const remaining = Math.max(0, parseInt(counter?.value || '0', 10));
  const claimed = !!user?.welcomeBonusClaimed;
  return {
    claimed,
    claimedAt: user?.welcomeBonusClaimedAt || null,
    emailVerified: !!user?.isEmailVerified,
    remaining,
    totalCap: CAP,
    credits: CREDITS,
    eligible: remaining > 0 && !claimed,
  };
}

async function claim(userId, clientIp) {
  await ensureCounter();

  const user = await User.findById(userId).select(
    'welcomeBonusClaimed email isEmailVerified'
  );
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  if (user.welcomeBonusClaimed) {
    throw new AppError('VALIDATION_ERROR', 400, 'Welcome bonus already claimed');
  }

  // ── Defence 1: require verified email ───────────────────────────────────────
  if (!user.isEmailVerified) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Please verify your email before claiming the welcome bonus'
    );
  }

  // ── Defence 2: dedupe by normalised email (catches Gmail .+ alias tricks) ───
  const emailNormalized = normalizeEmail(user.email);
  if (emailNormalized) {
    const emailDup = await User.findOne({
      _id: { $ne: userId },
      welcomeBonusClaimed: true,
      emailNormalized,
    }).select('_id').lean();
    if (emailDup) {
      throw new AppError('VALIDATION_ERROR', 400, 'Welcome bonus already claimed');
    }
  }

  // ── Defence 3: dedupe by client IP (catches multi-account on same device) ──
  if (clientIp) {
    const ipDup = await User.findOne({
      _id: { $ne: userId },
      welcomeBonusClaimed: true,
      welcomeBonusClaimedIp: clientIp,
    }).select('_id').lean();
    if (ipDup) {
      throw new AppError(
        'VALIDATION_ERROR',
        400,
        'This network has already claimed a welcome bonus. Try from a different network or contact support.'
      );
    }
  }

  // Atomic conditional decrement: only succeeds while counter value > 0
  const counter = await PlatformSettings.findOneAndUpdate(
    { key: COUNTER_KEY, $expr: { $gt: [{ $toInt: '$value' }, 0] } },
    [{ $set: { value: { $toString: { $subtract: [{ $toInt: '$value' }, 1] } } } }],
    { new: true }
  );
  if (!counter) {
    throw new AppError('VALIDATION_ERROR', 400, `Welcome bonus offer has ended — all ${CAP} spots claimed`);
  }

  // Atomic per-user mark. If a concurrent claim slipped through, restore counter.
  const marked = await User.findOneAndUpdate(
    { _id: userId, welcomeBonusClaimed: { $ne: true } },
    {
      welcomeBonusClaimed: true,
      welcomeBonusClaimedAt: new Date(),
      welcomeBonusClaimedIp: clientIp || null,
      emailNormalized,
    },
    { new: true }
  );
  if (!marked) {
    await PlatformSettings.updateOne(
      { key: COUNTER_KEY },
      [{ $set: { value: { $toString: { $add: [{ $toInt: '$value' }, 1] } } } }]
    );
    throw new AppError('VALIDATION_ERROR', 400, 'Welcome bonus already claimed');
  }

  const newBalance = await addCredits(
    userId,
    CREDITS,
    'Welcome bonus — pre-launch follow-to-claim promo',
    `welcome-bonus:${userId}`,
    'ADMIN_ADJUST'
  );

  return { newBalance, credits: CREDITS };
}

module.exports = { getStatus, claim, CAP, CREDITS };
