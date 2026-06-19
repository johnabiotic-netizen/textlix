// TikTok pixel event helpers.
//
// The base pixel (ttq.load + ttq.page) is installed in index.html and tracks
// PageViews automatically. These helpers fire conversion events on top of it.
//
// Every call is a no-op when window.ttq is missing — the script may be blocked
// by an ad blocker, or not yet loaded — so callers never have to guard.

const ttq = () => (typeof window !== 'undefined' ? window.ttq : undefined);

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
