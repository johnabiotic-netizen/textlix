const crypto = require('crypto');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { addCredits } = require('../services/credit.service');
const paystackProvider = require('../providers/payment/paystack.provider');
const coingateProvider = require('../providers/payment/coingate.provider');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const logger = require('../config/logger');

const PACKAGES = [
  { id: 'starter', amountUSD: 2, credits: 200, bonus: 0, label: 'Starter' },
  { id: 'basic', amountUSD: 5, credits: 500, bonus: 50, label: 'Basic' },
  { id: 'standard', amountUSD: 10, credits: 1000, bonus: 150, label: 'Standard' },
  { id: 'pro', amountUSD: 25, credits: 2500, bonus: 500, label: 'Pro' },
  { id: 'premium', amountUSD: 50, credits: 5000, bonus: 1500, label: 'Premium' },
];

const calcCredits = (amountUSD, packageId) => {
  if (packageId) {
    const pkg = PACKAGES.find((p) => p.id === packageId);
    if (pkg) return { credits: pkg.credits + pkg.bonus, amountUSD: pkg.amountUSD };
  }
  const credits = Math.floor(amountUSD * 100);
  return { credits, amountUSD };
};

exports.getPackages = (req, res) => {
  success(res, { packages: PACKAGES.map((p) => ({ ...p, totalCredits: p.credits + p.bonus })) });
};

exports.paystackInitialize = async (req, res, next) => {
  try {
    const { amountUSD, packageId } = req.body;
    const { credits, amountUSD: finalAmount } = calcCredits(parseFloat(amountUSD) || 0, packageId);

    const minTopup = 2;
    if (finalAmount < minTopup) {
      throw new AppError('VALIDATION_ERROR', 400, `Minimum top-up is $${minTopup}`);
    }

    const user = await User.findById(req.user.userId);
    const payment = await Payment.create({
      userId: user._id,
      method: 'PAYSTACK',
      provider: 'paystack',
      amountUSD: finalAmount,
      currency: 'USD',
      creditsAdded: credits,
      status: 'PENDING',
    });

    const amountKobo = Math.round(finalAmount * 100 * 100); // USD → cents → kobo
    const data = await paystackProvider.initializeTransaction({
      email: user.email,
      amountKobo,
      reference: payment._id.toString(),
      callbackUrl: `${process.env.FRONTEND_URL}/payments/verify`,
      metadata: { userId: user._id, credits, paymentId: payment._id },
    });

    payment.externalId = data.reference;
    await payment.save();

    success(res, { authorizationUrl: data.authorization_url, reference: payment._id.toString() });
  } catch (err) {
    next(err);
  }
};

exports.paystackWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature && hash !== signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const { event, data } = req.body;
    if (event !== 'charge.success') return res.sendStatus(200);

    await processPaystackPayment(data.reference);
    res.sendStatus(200);
  } catch (err) {
    logger.error('Paystack webhook error:', err);
    res.sendStatus(500);
  }
};

exports.paystackVerify = async (req, res, next) => {
  try {
    const data = await paystackProvider.verifyTransaction(req.params.reference);
    if (data.status === 'success') {
      await processPaystackPayment(req.params.reference);
    }
    const payment = await Payment.findById(req.params.reference);
    success(res, { payment });
  } catch (err) {
    next(err);
  }
};

async function processPaystackPayment(reference) {
  const payment = await Payment.findById(reference);
  if (!payment || payment.status === 'COMPLETED') return;

  payment.status = 'COMPLETED';
  payment.completedAt = new Date();
  await payment.save();

  await addCredits(
    payment.userId,
    payment.creditsAdded,
    `Credit purchase: $${payment.amountUSD} via Paystack`,
    payment._id.toString()
  );
  logger.info(`Paystack payment completed: ${payment._id}, credits: ${payment.creditsAdded}`);
}

exports.cryptoCreate = async (req, res, next) => {
  try {
    const { amountUSD, currency, packageId } = req.body;
    const { credits, amountUSD: finalAmount } = calcCredits(parseFloat(amountUSD) || 0, packageId);

    if (finalAmount < 2) throw new AppError('VALIDATION_ERROR', 400, 'Minimum top-up is $2');

    const user = await User.findById(req.user.userId);
    const payment = await Payment.create({
      userId: user._id,
      method: 'CRYPTO',
      provider: 'coingate',
      amountUSD: finalAmount,
      currency: currency || 'USDT',
      creditsAdded: credits,
      status: 'PENDING',
    });

    const order = await coingateProvider.createOrder({
      orderId: payment._id.toString(),
      priceAmount: finalAmount,
      priceCurrency: 'USD',
      title: 'TextLix Credits',
      description: `Purchase of ${credits} credits`,
      callbackUrl: `${process.env.SERVER_URL}/api/v1/payments/crypto/webhook`,
      successUrl: `${process.env.FRONTEND_URL}/payments/success`,
      cancelUrl: `${process.env.FRONTEND_URL}/payments/cancel`,
    });

    payment.externalId = order.id?.toString();
    await payment.save();

    success(res, {
      paymentUrl: order.payment_url,
      orderId: payment._id,
      expiresAt: order.expire_at,
    }, 201);
  } catch (err) {
    next(err);
  }
};

exports.cryptoWebhook = async (req, res, next) => {
  try {
    const { status, order_id } = req.body;
    if (status === 'paid') {
      const payment = await Payment.findById(order_id);
      if (payment && payment.status !== 'COMPLETED') {
        payment.status = 'COMPLETED';
        payment.completedAt = new Date();
        await payment.save();
        await addCredits(
          payment.userId,
          payment.creditsAdded,
          `Credit purchase: $${payment.amountUSD} via Crypto`,
          payment._id.toString()
        );
      }
    }
    res.sendStatus(200);
  } catch (err) {
    logger.error('Crypto webhook error:', err);
    res.sendStatus(500);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const filter = { userId: req.user.userId };

    const [payments, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Payment.countDocuments(filter),
    ]);

    success(res, { payments, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};
