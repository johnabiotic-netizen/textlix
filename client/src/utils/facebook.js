// Meta (Facebook) pixel event helpers.
//
// The base pixel (fbq init + the initial PageView) is installed in index.html.
// These helpers fire conversion events on top of it.
//
// Every call is a no-op when window.fbq is missing — the script may be blocked
// by an ad blocker, or not yet loaded — so callers never have to guard.

const fbq = () => (typeof window !== 'undefined' ? window.fbq : undefined);

// Fire a Meta PageView. The base pixel in index.html fires the first one; this
// drives PageView on every client-side route change (this is an SPA).
export function trackPageView() {
  const f = fbq();
  if (f) f('track', 'PageView');
}

// Fire when a user finishes creating an account (email signup or OAuth).
export function trackCompleteRegistration() {
  const f = fbq();
  if (f) f('track', 'CompleteRegistration');
}

// Fire when a user starts a top-up (after a payment is initialized, as we hand
// off to the provider). `valueUSD` is the intended top-up amount in US dollars.
export function trackInitiateCheckout({ valueUSD } = {}) {
  const f = fbq();
  if (!f) return;
  const value = Number(valueUSD);
  f('track', 'InitiateCheckout', {
    currency: 'USD',
    ...(Number.isFinite(value) && value > 0 ? { value: Number(value.toFixed(2)) } : {}),
  });
}

// Fire Meta's standard "Purchase" event when a top-up succeeds. `valueUSD` is
// the revenue in US dollars; credits are billed at 100 credits/$1.
export function trackPurchase({ valueUSD, currency = 'USD' } = {}) {
  const f = fbq();
  if (!f) return;
  const value = Number(valueUSD);
  f('track', 'Purchase', {
    currency,
    ...(Number.isFinite(value) && value > 0 ? { value: Number(value.toFixed(2)) } : {}),
  });
}
