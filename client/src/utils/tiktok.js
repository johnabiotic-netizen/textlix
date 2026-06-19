// TikTok pixel event helpers.
//
// The base pixel (ttq.load + ttq.page) is installed in index.html and tracks
// PageViews automatically. These helpers fire conversion events on top of it.
//
// Every call is a no-op when window.ttq is missing — the script may be blocked
// by an ad blocker, or not yet loaded — so callers never have to guard.

const ttq = () => (typeof window !== 'undefined' ? window.ttq : undefined);

// Fire a TikTok PageView. The base pixel loads in index.html but does NOT call
// page() — we drive PageView from React so it fires on every client-side route
// change (this is an SPA; there are no full reloads between pages).
export function trackPageView() {
  const t = ttq();
  if (t) t.page();
}

// Fire when a user finishes creating an account (email signup or OAuth).
export function trackCompleteRegistration() {
  const t = ttq();
  if (t) t.track('CompleteRegistration');
}

// Fire when a user starts a top-up (after a payment is initialized, as we hand
// off to the provider). `valueUSD` is the intended top-up amount in US dollars.
export function trackInitiateCheckout({ valueUSD } = {}) {
  const t = ttq();
  if (!t) return;
  const value = Number(valueUSD);
  t.track('InitiateCheckout', {
    currency: 'USD',
    ...(Number.isFinite(value) && value > 0 ? { value: Number(value.toFixed(2)) } : {}),
    contents: [{ content_id: 'credits', content_type: 'product', content_name: 'TextLix credits' }],
  });
}

// Fire TikTok's standard "CompletePayment" event when a top-up succeeds.
// `valueUSD` is the revenue in US dollars; credits are billed at 100 credits/$1,
// so callers that only have a credit count can pass creditsAdded / 100.
export function trackCompletePayment({ valueUSD, currency = 'USD' } = {}) {
  const t = ttq();
  if (!t) return;
  const value = Number(valueUSD);
  t.track('CompletePayment', {
    currency,
    ...(Number.isFinite(value) && value > 0 ? { value: Number(value.toFixed(2)) } : {}),
    contents: [{ content_id: 'credits', content_type: 'product', content_name: 'TextLix credits' }],
  });
}
