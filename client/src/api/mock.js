// Dev-only mock responses — wired in when backend is unreachable
export const MOCK_COUNTRIES = [
  { id: '1', _id: '1', name: 'United States', code: 'US', flagEmoji: '🇺🇸', serviceCount: 12, minPrice: 50 },
  { id: '2', _id: '2', name: 'United Kingdom', code: 'GB', flagEmoji: '🇬🇧', serviceCount: 10, minPrice: 60 },
  { id: '3', _id: '3', name: 'Russia', code: 'RU', flagEmoji: '🇷🇺', serviceCount: 15, minPrice: 30 },
  { id: '4', _id: '4', name: 'Germany', code: 'DE', flagEmoji: '🇩🇪', serviceCount: 9, minPrice: 70 },
  { id: '5', _id: '5', name: 'France', code: 'FR', flagEmoji: '🇫🇷', serviceCount: 8, minPrice: 65 },
  { id: '6', _id: '6', name: 'India', code: 'IN', flagEmoji: '🇮🇳', serviceCount: 14, minPrice: 25 },
  { id: '7', _id: '7', name: 'Brazil', code: 'BR', flagEmoji: '🇧🇷', serviceCount: 7, minPrice: 40 },
  { id: '8', _id: '8', name: 'Canada', code: 'CA', flagEmoji: '🇨🇦', serviceCount: 11, minPrice: 55 },
  { id: '9', _id: '9', name: 'Australia', code: 'AU', flagEmoji: '🇦🇺', serviceCount: 8, minPrice: 75 },
  { id: '10', _id: '10', name: 'Netherlands', code: 'NL', flagEmoji: '🇳🇱', serviceCount: 6, minPrice: 80 },
  { id: '11', _id: '11', name: 'Sweden', code: 'SE', flagEmoji: '🇸🇪', serviceCount: 5, minPrice: 85 },
  { id: '12', _id: '12', name: 'Nigeria', code: 'NG', flagEmoji: '🇳🇬', serviceCount: 6, minPrice: 35 },
];

export const MOCK_SERVICES = [
  { _id: 's1', name: 'WhatsApp', icon: '💬', pricing: { finalPrice: 50, available: 120 } },
  { _id: 's2', name: 'Telegram', icon: '✈️', pricing: { finalPrice: 45, available: 85 } },
  { _id: 's3', name: 'Google', icon: '🔍', pricing: { finalPrice: 60, available: 200 } },
  { _id: 's4', name: 'Facebook', icon: '📘', pricing: { finalPrice: 55, available: 150 } },
  { _id: 's5', name: 'Instagram', icon: '📸', pricing: { finalPrice: 65, available: 90 } },
  { _id: 's6', name: 'Twitter', icon: '🐦', pricing: { finalPrice: 70, available: 60 } },
  { _id: 's7', name: 'Tinder', icon: '🔥', pricing: { finalPrice: 80, available: 40 } },
  { _id: 's8', name: 'Uber', icon: '🚗', pricing: { finalPrice: 55, available: 75 } },
];

export const MOCK_ACTIVE_ORDERS = [
  {
    _id: 'o1',
    phoneNumber: '+1 (555) 234-5678',
    countryId: { name: 'United States', flagEmoji: '🇺🇸' },
    serviceId: { name: 'WhatsApp' },
    status: 'ACTIVE',
    creditsCharged: 50,
    expiresAt: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
    smsContent: null,
    smsCode: null,
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'o2',
    phoneNumber: '+44 7700 900123',
    countryId: { name: 'United Kingdom', flagEmoji: '🇬🇧' },
    serviceId: { name: 'Telegram' },
    status: 'ACTIVE',
    creditsCharged: 60,
    expiresAt: new Date(Date.now() + 7 * 60 * 1000).toISOString(),
    smsContent: 'Your Telegram code is 48291. Do not share it.',
    smsCode: '48291',
    createdAt: new Date().toISOString(),
  },
];

export const MOCK_ORDER_HISTORY = [
  { _id: 'h1', phoneNumber: '+1 (555) 111-2222', countryId: { name: 'United States', flagEmoji: '🇺🇸' }, serviceId: { name: 'Google' }, status: 'COMPLETED', creditsCharged: 60, smsContent: 'G-482910 is your Google verification code.', smsCode: '482910', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { _id: 'h2', phoneNumber: '+91 98765 43210', countryId: { name: 'India', flagEmoji: '🇮🇳' }, serviceId: { name: 'WhatsApp' }, status: 'EXPIRED', creditsCharged: 0, smsContent: null, smsCode: null, createdAt: new Date(Date.now() - 172800000).toISOString() },
  { _id: 'h3', phoneNumber: '+44 7700 900456', countryId: { name: 'United Kingdom', flagEmoji: '🇬🇧' }, serviceId: { name: 'Facebook' }, status: 'REFUNDED', creditsCharged: 0, smsContent: null, smsCode: null, createdAt: new Date(Date.now() - 259200000).toISOString() },
  { _id: 'h4', phoneNumber: '+49 151 23456789', countryId: { name: 'Germany', flagEmoji: '🇩🇪' }, serviceId: { name: 'Instagram' }, status: 'COMPLETED', creditsCharged: 65, smsContent: 'Your Instagram code: 739201', smsCode: '739201', createdAt: new Date(Date.now() - 345600000).toISOString() },
];

export const MOCK_TRANSACTIONS = [
  { _id: 't1', type: 'PURCHASE', description: 'Credit purchase — $10.00', amount: 1000, balanceAfter: 1250, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { _id: 't2', type: 'SPEND', description: 'Number rental: WhatsApp (US)', amount: -50, balanceAfter: 1200, createdAt: new Date(Date.now() - 7200000).toISOString() },
  { _id: 't3', type: 'SPEND', description: 'Number rental: Telegram (UK)', amount: -60, balanceAfter: 1140, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { _id: 't4', type: 'REFUND', description: 'Auto-refund: number expired (Facebook UK)', amount: 55, balanceAfter: 1195, createdAt: new Date(Date.now() - 172800000).toISOString() },
  { _id: 't5', type: 'PURCHASE', description: 'Credit purchase — $5.00', amount: 500, balanceAfter: 1695, createdAt: new Date(Date.now() - 345600000).toISOString() },
];

export const MOCK_PACKAGES = [
  { id: 'p1', credits: 200, priceUSD: 2, bonus: 0, label: 'Starter' },
  { id: 'p2', credits: 500, priceUSD: 5, bonus: 0, label: 'Basic' },
  { id: 'p3', credits: 1100, priceUSD: 10, bonus: 100, label: 'Popular', popular: true },
  { id: 'p4', credits: 2500, priceUSD: 22, bonus: 300, label: 'Value' },
  { id: 'p5', credits: 6000, priceUSD: 50, bonus: 1000, label: 'Pro' },
];

export const MOCK_DASHBOARD = {
  revenue: { today: 142.50, week: 890.00, month: 3240.00, total: 18750.00 },
  users: { active_today: 48, new_today: 12, total: 1284 },
  numbers: { active_now: 23, total_ordered: 8940, success_rate: 94 },
  credits: { total_purchased: 2840000, total_spent: 1920000, total_refunded: 84000 },
};

export const MOCK_REVENUE_DATA = Array.from({ length: 30 }, (_, i) => ({
  _id: { month: new Date(Date.now() - (29 - i) * 86400000).getMonth() + 1, day: new Date(Date.now() - (29 - i) * 86400000).getDate() },
  revenue: Math.random() * 200 + 50,
  count: Math.floor(Math.random() * 40 + 10),
}));

export const MOCK_USERS = [
  { _id: 'u1', name: 'Alice Johnson', email: 'alice@example.com', role: 'USER', creditBalance: 450, isBanned: false, provider: 'LOCAL', createdAt: new Date(Date.now() - 30 * 86400000).toISOString() },
  { _id: 'u2', name: 'Bob Smith', email: 'bob@example.com', role: 'USER', creditBalance: 1200, isBanned: false, provider: 'GOOGLE', createdAt: new Date(Date.now() - 15 * 86400000).toISOString() },
  { _id: 'u3', name: 'Carol White', email: 'carol@example.com', role: 'USER', creditBalance: 0, isBanned: true, provider: 'LOCAL', createdAt: new Date(Date.now() - 60 * 86400000).toISOString() },
  { _id: 'u4', name: 'Dev Admin', email: 'admin@textlix.com', role: 'ADMIN', creditBalance: 9999, isBanned: false, provider: 'LOCAL', createdAt: new Date(Date.now() - 90 * 86400000).toISOString() },
];
