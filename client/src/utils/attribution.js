// First-touch acquisition attribution.
//
// On first landing we read the ad-source signals from the URL (utm_*, fbclid,
// ttclid, gclid) + referrer, normalize them to a single `source`, and store the
// result in localStorage so it survives across navigations and the signup
// redirect. First-touch: once stored, it is never overwritten.
//
// We also fire a one-per-session "visit" beacon to our own backend so the admin
// conversion tracker has a first-party Visits count (works even when ad blockers
// hide the TikTok/Meta pixels). Everything here is fail-safe: any error is
// swallowed so it can never affect page load or the signup flow.

const STORE_KEY = 'tlx_attribution';
const SID_KEY = 'tlx_sid';
const VISIT_FLAG = 'tlx_visit_sent';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

function deriveSource(p, referrer) {
  if (p.utm_source) return p.utm_source.toLowerCase();
  if (p.ttclid) return 'tiktok';
  if (p.fbclid) return 'facebook';
  if (p.gclid) return 'google';
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, '');
      if (host && !host.includes(window.location.hostname)) return host;
    } catch (_) { /* ignore */ }
  }
  return 'direct';
}

// Read the URL/referrer and persist first-touch attribution if not already set.
export function captureAttribution() {
  try {
    if (localStorage.getItem(STORE_KEY)) return; // first-touch: keep the original
    const sp = new URLSearchParams(window.location.search);
    const get = (k) => sp.get(k) || null;
    const referrer = document.referrer || null;
    const data = {
      source: deriveSource(
        {
          utm_source: get('utm_source'),
          fbclid: get('fbclid'),
          ttclid: get('ttclid'),
          gclid: get('gclid'),
        },
        referrer
      ),
      medium: get('utm_medium'),
      campaign: get('utm_campaign'),
      content: get('utm_content'),
      term: get('utm_term'),
      fbclid: get('fbclid'),
      ttclid: get('ttclid'),
      gclid: get('gclid'),
      referrer,
      landingPath: window.location.pathname,
      capturedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch (_) { /* ignore */ }
}

export function getAttribution() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  } catch (_) {
    return null;
  }
}

export function getSessionId() {
  try {
    let sid = localStorage.getItem(SID_KEY);
    if (!sid) {
      sid =
        (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) ||
        `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch (_) {
    return null;
  }
}

// Fire-and-forget visit beacon, once per browser session.
export function pingVisit() {
  try {
    if (sessionStorage.getItem(VISIT_FLAG)) return;
    sessionStorage.setItem(VISIT_FLAG, '1');
    const body = JSON.stringify({
      sessionId: getSessionId(),
      attribution: getAttribution(),
      landingPath: window.location.pathname,
      referrer: document.referrer || null,
    });
    fetch(`${API_BASE}/track/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {});
  } catch (_) { /* ignore */ }
}
