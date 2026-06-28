// Unified analytics facade — fires every ad pixel (TikTok + Meta) from a single
// place so call sites don't have to import each provider individually. Each
// underlying call is a no-op when its pixel is missing/blocked, so this is safe
// to call unconditionally. Add new providers here and every event flows to them.

import * as tt from './tiktok';
import * as fb from './facebook';

export function trackPageView() {
  tt.trackPageView();
  fb.trackPageView();
}

export function trackCompleteRegistration() {
  tt.trackCompleteRegistration();
  fb.trackCompleteRegistration();
}

export function trackInitiateCheckout(args) {
  tt.trackInitiateCheckout(args);
  fb.trackInitiateCheckout(args);
}

// A successful top-up: TikTok's standard event is "CompletePayment", Meta's is
// "Purchase" — both fire here off the same call.
export function trackCompletePayment(args) {
  tt.trackCompletePayment(args);
  fb.trackPurchase(args);
}
