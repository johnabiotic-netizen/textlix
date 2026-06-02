const { z } = require('zod');

// A user can either pick a curated package or top up a custom USD amount (min $2).
// Promo code optional.
const initBase = z.object({
  packageId: z.string().trim().min(1).max(64).optional(),
  amountUSD: z.coerce.number().min(2).max(10_000).optional(),
  promoCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,32}$/).optional().or(z.literal('')),
});
const initRefinement = (d) => Boolean(d.packageId || d.amountUSD);
const initRefinementMessage = { message: 'packageId or amountUSD required' };

const initSchema = initBase.refine(initRefinement, initRefinementMessage);

// 0xProcessing additionally takes a currency. Multichain assets use the literal
// "TICKER (CHAIN)" form per 0xProcessing's asset list — anything else makes
// their hosted page default to ERC20 for USDT/USDC, etc.
const oxprocessingCreateSchema = initBase
  .extend({
    currency: z.enum([
      'USDT (TRC20)', 'USDT (ERC20)', 'USDT (BEP20)',
      'USDC (ERC20)',
      'ETH', 'ETH (BEP20)',
      'BTC', 'LTC', 'DOGE',
      // Back-compat: legacy clients may still send bare codes; treat as the
      // historical default (ERC20-ish behavior on 0xProcessing's side).
      'USDT', 'USDC',
    ]).optional(),
  })
  .refine(initRefinement, initRefinementMessage);

const validatePromoSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,32}$/),
  amountUSD: z.coerce.number().min(0).max(10_000),
});

module.exports = { initSchema, oxprocessingCreateSchema, validatePromoSchema };
