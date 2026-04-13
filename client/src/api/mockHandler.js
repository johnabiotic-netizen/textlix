import {
  MOCK_COUNTRIES, MOCK_SERVICES, MOCK_ACTIVE_ORDERS, MOCK_ORDER_HISTORY,
  MOCK_TRANSACTIONS, MOCK_PACKAGES, MOCK_DASHBOARD, MOCK_REVENUE_DATA,
  MOCK_USERS,
} from './mock';

const ok = (data) => ({ success: true, data });

const paginate = (items, params) => {
  const page = parseInt(params?.page || 1);
  const limit = parseInt(params?.limit || 20);
  const start = (page - 1) * limit;
  const sliced = items.slice(start, start + limit);
  return { ...ok({ transactions: sliced, orders: sliced, payments: sliced, users: sliced, pages: Math.ceil(items.length / limit), total: items.length }), };
};

export function getMockResponse(url = '', method = 'get') {
  if (!url) return null;

  // Strip query string
  const path = url.split('?')[0];
  const m = method.toLowerCase();

  // Numbers / countries
  if (path === '/numbers/countries') return ok({ countries: MOCK_COUNTRIES });
  if (path.match(/^\/numbers\/countries\/\w+\/services/)) return ok({ country: MOCK_COUNTRIES[0], services: MOCK_SERVICES });

  // Active orders & history
  if (path === '/numbers/active') return ok({ orders: MOCK_ACTIVE_ORDERS });
  if (path === '/numbers/history') return ok({ orders: MOCK_ORDER_HISTORY, pages: 1, total: MOCK_ORDER_HISTORY.length });

  // Credits
  if (path === '/credits/balance') return ok({ balance: 1250 });
  if (path === '/credits/history') return ok({ transactions: MOCK_TRANSACTIONS, pages: 1, total: MOCK_TRANSACTIONS.length });

  // Payments
  if (path === '/payments/packages') return ok({ packages: MOCK_PACKAGES });
  if (path === '/payments/history') return ok({ payments: [], pages: 1, total: 0 });

  // User
  if (path === '/user/me') return ok({ user: { _id: 'dev-user', name: 'Dev Admin', email: 'admin@verifynow.com', role: 'ADMIN', creditBalance: 1250, provider: 'LOCAL', isEmailVerified: true, createdAt: new Date().toISOString() } });
  if (path === '/user/me/stats') return ok({ totalPurchased: 3500, totalSpent: 2250, numbersUsed: 14 });

  // Admin
  if (path === '/admin/dashboard') return ok(MOCK_DASHBOARD);
  if (path === '/admin/revenue-report') return ok({ data: MOCK_REVENUE_DATA });
  if (path === '/admin/users') return ok({ users: MOCK_USERS, pages: 1, total: MOCK_USERS.length });
  if (path.match(/^\/admin\/users\/\w+$/) && m === 'get') return ok({ user: MOCK_USERS[0], stats: { totalPurchased: 1500, totalSpent: 1050, totalRefunded: 55, numbersOrdered: 18 } });
  if (path === '/admin/transactions') return ok({ transactions: MOCK_TRANSACTIONS.map(t => ({ ...t, userId: MOCK_USERS[0] })), pages: 1, total: MOCK_TRANSACTIONS.length });
  if (path === '/admin/payments') return ok({ payments: [], pages: 1, total: 0 });
  if (path === '/admin/orders') return ok({ orders: MOCK_ORDER_HISTORY.map(o => ({ ...o, userId: MOCK_USERS[0] })), pages: 1, total: MOCK_ORDER_HISTORY.length });
  if (path === '/admin/countries') return ok({ countries: MOCK_COUNTRIES.map(c => ({ ...c, isEnabled: true })) });
  if (path === '/admin/services') return ok({ services: MOCK_SERVICES.map(s => ({ ...s, slug: s.name.toLowerCase(), isEnabled: true })) });
  if (path === '/admin/pricing') return ok({ pricing: MOCK_SERVICES.flatMap((s, si) => MOCK_COUNTRIES.slice(0, 6).map((c, ci) => ({ _id: `p${si}${ci}`, countryId: c, serviceId: s, providerCost: 30 + ci * 5, marginPercent: 30, finalPrice: Math.round((30 + ci * 5) * 1.3) }))) });
  if (path === '/admin/settings') return ok({ settings: [
    { key: 'default_margin_percent', value: 30 },
    { key: 'number_timeout_minutes', value: 20 },
    { key: 'max_active_numbers_per_user', value: 5 },
    { key: 'min_topup_usd', value: 2 },
    { key: 'sms_retention_hours', value: 48 },
    { key: 'sms_poll_interval_seconds', value: 5 },
    { key: 'sms_provider', value: '5sim' },
    { key: 'coingate_environment', value: 'sandbox' },
  ]});

  // PATCH/POST — just return success
  if (m === 'patch' || m === 'post') return ok({});

  return null;
}
