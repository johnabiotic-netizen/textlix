const { z } = require('zod');

const platformsSchema = z.array(
  z.object({
    platform: z.string().trim().min(1).max(40),
    handle: z.string().trim().min(1).max(100),
    followerCount: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  })
).max(10);

const applySchema = z.object({
  platforms: platformsSchema,
  proofLinks: z.array(z.string().trim().url().max(2048)).max(10).optional(),
  bio: z.string().trim().max(2000).optional(),
});

const updateBankSchema = z.object({
  bankName: z.string().trim().min(1).max(100),
  accountNumber: z.string().trim().regex(/^[0-9]{6,20}$/, 'Invalid account number'),
  accountName: z.string().trim().min(1).max(100),
});

const updateReferralCodeSchema = z.object({
  referralCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, 'Code must be 3-20 chars, letters/numbers/-/_ only'),
});

const requestWithdrawalSchema = z.object({
  amountNaira: z.coerce.number().int().min(1000).max(10_000_000),
});

module.exports = { applySchema, updateBankSchema, updateReferralCodeSchema, requestWithdrawalSchema };
