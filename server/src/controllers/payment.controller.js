const crypto = require('crypto');
const Payment = require('../models/Payment');
const User = require('../models/User');
const PromoCode = require('../models/PromoCode');
const CreatorEarning = require('../models/CreatorEarning');
const { addCredits } = require('../services/credit.service');
const oxprocessingProvider = require('../providers/payment/0xprocessing.provider');
const korapayProvider = require('../providers/payment/korapay.provider');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const logger = require('../config/logger');
const { getIO } = require('../config/io');
const { getUsdToNgnRate } = require('../utils/exchangerate');

const getNgnRate = () => parseFloat(process.env.KORAPAY_NGN_RATE) || 1600;

// Recharge packages are flat 1¢/credit — no built-in bonus. The launch promo
// (LAUNCH10: +20% on $10+) is the only top-up bonus, applied via promo code.
const PACKAGES = [
  { id: 'starter', amountUSD: 2, credits: 200, bonus: 0, label: 'Starter' },
  { id: 'basic', amountUSD: 5, credits: 500, bonus: 0, label: 'Basic' },
  { id: 'standard', amountUSD: 10, credits: 1000, bonus: 0, label: 'Standard' },
  { id: 'pro', amountUSD: 25, credits: 2500, bonus: 0, label: 'Pro' },
  { id: 'premium', amountUSD: 50, credits: 5000, bonus: 0, label: 'Premium' },
];

const calcCredits = (amountUSD, packageId) => {
  if (packageId) {
    const pkg = PACKAGES.find((p) => p.id === packageId);
    if (pkg) return { credits: pkg.credits + pkg.bonus, amountUSD: pkg.amountUSD };
  }
  const credits = Math.floor(amountUSD * 100);
  return { credits, amountUSD };
};

/**
 * Atomically consume a promo code (if valid) and return bonus credits.
 * Returns 0 if the code is missing, invalid, expired, or exhausted.
 */
async function applyPromo(code, amountUSD, baseCredits) {
  if (!code) return 0;
  const promo = await PromoCode.findOneAndUpdate(
    {
      code: code.toUpperCase().trim(),
      isActive: true,
      $and: [
        { $or: [{ maxUses: null }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }] },
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
        { minAmountUSD: { $lte: amountUSD } },
      ],
    },
    { $inc: { usedCount: 1 } },
    { new: false }
  );
  if (!promo) return 0;
  return promo.type === 'FLAT_BONUS'
    ? promo.value
    : Math.floor(baseCredits * promo.value / 100);
}

exports.validatePromo = async (req, res, next) => {
  try {
    const { code, amountUSD } = req.body;
    if (!code) throw new AppError('VALIDATION_ERROR', 400, 'Code required');
    const promo = await PromoCode.findOne({ code: code.toUpperCase().trim(), isActive: true });
    if (!promo) throw new AppError('NOT_FOUND', 404, 'Invalid promo code');
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      throw new AppError('VALIDATION_ERROR', 400, 'Promo code has reached its usage limit');
    }
    if (promo.expiresAt && promo.expiresAt < new Date()) {
      throw new AppError('VALIDATION_ERROR', 400, 'Promo code has expired');
    }
    if (amountUSD && parseFloat(amountUSD) < promo.minAmountUSD) {
      throw new AppError('VALIDATION_ERROR', 400, `Minimum $${promo.minAmountUSD} required for this code`);
    }
    success(res, { promo: { code: promo.code, type: promo.type, value: promo.value } });
  } catch (err) {
    next(err);
  }
};

exports.getPackages = (req, res) => {
  success(res, {
    packages: PACKAGES.map((p) => ({ ...p, totalCredits: p.credits + p.bonus })),
    ngnRate: getNgnRate(),
  });
};

// ─── 0xProcessing (crypto) ───────────────────────────────────────────────────

exports.oxprocessingCreate = async (req, res, next) => {
  try {
    const { amountUSD, currency, packageId, promoCode } = req.body;
    const { credits: baseCredits, amountUSD: finalAmount } = calcCredits(parseFloat(amountUSD) || 0, packageId);
    const promoBonus = await applyPromo(promoCode, finalAmount, baseCredits);
    const credits = baseCredits + promoBonus;

    if (finalAmount < 2) throw new AppError('VALIDATION_ERROR', 400, 'Minimum top-up is $2');

    const user = await User.findById(req.user.userId);
    const payment = await Payment.create({
      userId: user._id,
      method: 'CRYPTO',
      provider: '0xprocessing',
      amountUSD: finalAmount,
      currency: currency || 'USDT',
      creditsAdded: credits,
      status: 'PENDING',
    });

    const formFields = oxprocessingProvider.buildPaymentForm({
      orderId: payment._id.toString(),
      amountUSD: finalAmount,
      currency: currency || 'USDT',
      email: user.email,
      clientId: user._id.toString(),
      successUrl: `${process.env.FRONTEND_URL}/payments/success`,
      cancelUrl: `${process.env.FRONTEND_URL}/payments/cancel`,
    });

    logger.info(`0xProcessing form fields for order ${payment._id}: ${JSON.stringify({ ...formFields, email: '***' })}`);

    success(res, {
      formAction: 'https://app.0xprocessing.com/Payment',
      formFields,
      orderId: payment._id,
    }, 201);
  } catch (err) {
    next(err);
  }
};

exports.oxprocessingWebhook = async (req, res, next) => {
  try {
    // 0xProcessing posts JSON with the signature INSIDE the body. We register
    // express.raw on this route so we can verify the bytes deterministically.
    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch (e) {
      logger.warn('0xProcessing webhook rejected: malformed JSON');
      return res.status(400).end();
    }

    if (!oxprocessingProvider.verifyWebhookSignature(payload)) {
      logger.warn(`0xProcessing webhook rejected: invalid signature for BillingID=${payload?.BillingID} PaymentId=${payload?.PaymentId}`);
      return res.status(401).end();
    }

    const { BillingID, Status, PaymentId, Test } = payload;

    // Test pings from the 0xProcessing dashboard arrive with Test=true and
    // synthetic IDs. Acknowledge so the dashboard shows green, but don't
    // credit.
    if (Test) {
      logger.info(`0xProcessing webhook test ping accepted (BillingID=${BillingID})`);
      return res.sendStatus(200);
    }

    if (Status === 'Success') {
      // Atomic gate: only one concurrent webhook flips PENDING → COMPLETED.
      // addCredits is also internally idempotent on (userId, referenceId)
      // — defence-in-depth in case the gate is bypassed somehow.
      const payment = await Payment.findOneAndUpdate(
        { _id: BillingID, status: 'PENDING' },
        { $set: { status: 'COMPLETED', completedAt: new Date(), externalId: String(PaymentId) } },
        { new: false }
      );
      if (payment) {
        try {
          await addCredits(
            payment.userId,
            payment.creditsAdded,
            `Credit purchase: $${payment.amountUSD} via 0xProcessing`,
            payment._id.toString()
          );
          const io = getIO();
          if (io) io.to(`user:${payment.userId}`).emit('payment:completed', { creditsAdded: payment.creditsAdded });
        } catch (err) {
          // Roll back the gate so a retry can re-attempt delivery.
          await Payment.findByIdAndUpdate(BillingID, { $set: { status: 'PENDING', completedAt: null } });
          logger.error(`0xProcessing credit delivery failed for ${BillingID}: ${err.message}`);
          return res.sendStatus(500);
        }
        // Soft post-credit work — failures here MUST NOT roll back the credit
        // (user already paid + got their credits). Just log and move on.
        try {
          await maybeAwardReferralBonus(payment.userId, payment.creditsAdded, payment._id.toString());
        } catch (e) { logger.warn(`Referral bonus failed for ${payment._id}: ${e.message}`); }
        try {
          await maybeAwardCreatorCommission(payment.userId, payment.amountUSD, payment._id);
        } catch (e) { logger.warn(`Creator commission failed for ${payment._id}: ${e.message}`); }
      } else {
        logger.warn(`0xProcessing webhook: no PENDING payment matched BillingID=${BillingID} (already completed or wrong id)`);
      }
    } else {
      logger.info(`0xProcessing webhook: BillingID=${BillingID} status=${Status} (not a credit event)`);
    }
    res.sendStatus(200);
  } catch (err) {
    logger.error('0xProcessing webhook error:', err);
    res.sendStatus(500);
  }
};

// ─── KoraPay (Nigeria) ────────────────────────────────────────────────────────

exports.korapayInitialize = async (req, res, next) => {
  try {
    const { amountUSD, packageId, promoCode } = req.body;
    const { credits: baseCredits, amountUSD: finalAmount } = calcCredits(parseFloat(amountUSD) || 0, packageId);
    const promoBonus = await applyPromo(promoCode, finalAmount, baseCredits);
    const credits = baseCredits + promoBonus;

    if (finalAmount < 2) throw new AppError('VALIDATION_ERROR', 400, 'Minimum top-up is $2');

    const user = await User.findById(req.user.userId);
    const amountNGN = Math.round(finalAmount * getNgnRate() * 100) / 100;

    const payment = await Payment.create({
      userId: user._id,
      method: 'KORAPAY',
      provider: 'korapay',
      amountUSD: finalAmount,
      amountLocal: amountNGN,
      currency: 'NGN',
      creditsAdded: credits,
      status: 'PENDING',
    });

    let charge;
    try {
      charge = await korapayProvider.initializeCharge({
        reference: payment._id.toString(),
        amountNGN,
        email: user.email,
        name: user.name || user.email,
        redirectUrl: `${process.env.FRONTEND_URL}/payments/verify`,
        notificationUrl: `${process.env.SERVER_URL}/api/v1/payments/korapay/webhook`,
      });
    } catch (err) {
      // KoraPay (or its Cloudflare edge) is unreachable / erroring. Don't leak a
      // raw 500 — mark this attempt FAILED and return a clear, actionable
      // message. Crypto runs on a separate provider, so point users there.
      await Payment.findByIdAndUpdate(payment._id, { status: 'FAILED' }).catch(() => {});
      const status = err.response?.status;
      logger.error(`KoraPay initialize failed for ${payment._id}: ${status || err.code || ''} ${err.message}`);
      const upstreamDown = !err.response || status >= 500 || status === 429;
      throw new AppError(
        'PROVIDER_ERROR',
        503,
        upstreamDown
          ? 'Card and bank transfer payments are temporarily unavailable — our payment partner is having a brief outage. Please try again in a few minutes, or pay with crypto (USDT, BTC, ETH), which is working normally.'
          : "We couldn't start your card payment. Please try again, or pay with crypto instead."
      );
    }

    payment.externalId = charge.reference || payment._id.toString();
    await payment.save();

    success(res, {
      checkoutUrl: charge.checkout_url,
      reference: payment._id.toString(),
      amountNGN,
    });
  } catch (err) {
    next(err);
  }
};

exports.korapayWebhook = async (req, res, next) => {
  try {
    // Webhook arrives with raw body buffer (see app.js express.raw middleware).
    // Parse first — KoraPay signs only the `data` object, so we need it parsed
    // to verify. Parsing is side-effect-free; we still verify before acting.
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body), 'utf8');
    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch (e) {
      logger.warn('KoraPay webhook rejected: malformed JSON');
      return res.status(400).end();
    }
    const { event, data } = payload;

    // Verify HMAC signature over the `data` object before touching DB / network.
    const signature = req.headers['x-korapay-signature'];
    if (!korapayProvider.verifyWebhookSignature(data, signature)) {
      logger.warn('KoraPay webhook rejected: invalid or missing signature');
      return res.status(401).end();
    }

    if (event === 'charge.success' && data?.reference) {
      // Belt-and-braces: still verify with KoraPay API before crediting.
      const charge = await korapayProvider.verifyCharge(data.reference);
      if (charge?.status === 'success') {
        await processKorapayPayment(data.reference);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    logger.error('KoraPay webhook error:', err);
    res.sendStatus(500);
  }
};

exports.korapayVerify = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.reference);
    if (!payment) throw new AppError('NOT_FOUND', 404, 'Payment not found');
    if (payment.userId.toString() !== req.user.userId.toString()) {
      throw new AppError('FORBIDDEN', 403, 'Access denied');
    }

    const charge = await korapayProvider.verifyCharge(req.params.reference);
    if (charge?.status === 'success') {
      await processKorapayPayment(req.params.reference);
    }

    const updated = await Payment.findById(req.params.reference);
    success(res, { payment: updated });
  } catch (err) {
    next(err);
  }
};

async function processKorapayPayment(reference) {
  // Atomic gate: only one concurrent caller flips PENDING → COMPLETED.
  // addCredits is also internally idempotent on (userId, referenceId)
  // — defence-in-depth in case a retry slips past the gate.
  const payment = await Payment.findOneAndUpdate(
    { _id: reference, status: 'PENDING' },
    { $set: { status: 'COMPLETED', completedAt: new Date() } },
    { new: false }
  );
  if (!payment) return;

  try {
    await addCredits(
      payment.userId,
      payment.creditsAdded,
      `Credit purchase: $${payment.amountUSD} via KoraPay`,
      payment._id.toString()
    );
  } catch (err) {
    // Roll back the gate so the next webhook delivery can retry.
    await Payment.findByIdAndUpdate(reference, { $set: { status: 'PENDING', completedAt: null } });
    logger.error(`KoraPay credit delivery failed for ${reference}: ${err.message}`);
    throw err;
  }

  logger.info(`KoraPay payment completed: ${payment._id}, credits: ${payment.creditsAdded}`);
  // Soft post-credit work — failures here must not roll back the credit.
  try {
    await maybeAwardReferralBonus(payment.userId, payment.creditsAdded, payment._id.toString());
  } catch (e) { logger.warn(`Referral bonus failed for ${payment._id}: ${e.message}`); }
  const io = getIO();
  if (io) io.to(`user:${payment.userId}`).emit('payment:completed', { creditsAdded: payment.creditsAdded });
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function maybeAwardReferralBonus(userId, creditsAdded, referenceId) {
  try {
    const user = await User.findOneAndUpdate(
      { _id: userId, referredBy: { $ne: null }, referralBonusPaid: false },
      { $set: { referralBonusPaid: true } },
      { new: false }
    );
    if (!user) return;

    const bonus = Math.floor(creditsAdded * 0.1);
    if (bonus < 1) return;

    await addCredits(
      user.referredBy,
      bonus,
      `Referral bonus: ${bonus} credits for referring ${user.email}`,
      referenceId
    );
    logger.info(`Referral bonus of ${bonus} credits awarded to ${user.referredBy} for referring ${userId}`);
  } catch (err) {
    logger.error('Referral bonus error:', err.message);
  }
}

async function maybeAwardCreatorCommission(userId, amountUSD, paymentId) {
  try {
    const user = await User.findById(userId, 'creatorReferredBy email');
    if (!user?.creatorReferredBy) return;

    const creator = await User.findById(user.creatorReferredBy, 'isCreator email');
    if (!creator?.isCreator) return;

    const rate = await getUsdToNgnRate();
    const commissionNaira = Math.floor(amountUSD * rate * 0.1);
    if (commissionNaira < 1) return;

    await Promise.all([
      CreatorEarning.create({
        creatorId: creator._id,
        referredUserId: userId,
        paymentId,
        amountUSD,
        usdNgnRate: rate,
        commissionNaira,
      }),
      User.findByIdAndUpdate(creator._id, {
        $inc: { pendingEarningsNaira: commissionNaira, totalEarningsNaira: commissionNaira },
      }),
    ]);

    logger.info(`Creator commission ₦${commissionNaira} awarded to ${creator._id} for referral ${userId}`);
  } catch (err) {
    logger.error(`Creator commission error: ${err.message}`);
  }
}

// ─── Payment history ──────────────────────────────────────────────────────────

// Provider-agnostic "look up my payment by id" — used by the mobile verify
// screen for crypto, where there's no client-side re-verify path (webhook is
// the only source of truth). KoraPay flows still use /korapay/verify which
// additionally re-confirms with the provider.
exports.getMyPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw new AppError('NOT_FOUND', 404, 'Payment not found');
    if (payment.userId.toString() !== req.user.userId.toString()) {
      throw new AppError('FORBIDDEN', 403, 'Access denied');
    }
    success(res, { payment });
  } catch (err) {
    next(err);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const p = Math.max(1, parseInt(req.query.page) || 1);
    const l = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
    const skip = (p - 1) * l;

    const [payments, total] = await Promise.all([
      Payment.find({ userId: req.user.userId }).sort({ createdAt: -1 }).skip(skip).limit(l),
      Payment.countDocuments({ userId: req.user.userId }),
    ]);

    success(res, { payments, total, page: p, pages: Math.ceil(total / l) });
  } catch (err) {
    next(err);
  }
};
