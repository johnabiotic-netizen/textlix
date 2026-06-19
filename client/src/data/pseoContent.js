// Single source of truth for the programmatic SEO landing pages.
// Drives the landing page content, the prerender route list
// (scripts/prerender-pseo.mjs), and the sitemap generator.
//
// IMPORTANT: marketing stats here are STATIC brand copy (high, attractive) — we
// never display real or low per-combination success data on these pages.

// Static brand stats shown on every page (not live data).
export const STATS = {
  successRate: '99%',
  delivery: 'seconds',
  countries: '150+',
  services: '100+',
};

// Per-country editorial. `blurb` = 2 unique sentences about that country's
// numbers; `related` = sibling country codes for cross-linking.
export const COUNTRIES = {
  us: {
    name: 'United States', flag: '🇺🇸', dialCode: '+1',
    blurb: 'United States numbers are the most widely accepted in the world for app sign-ups and account verification. A +1 US number works smoothly with almost every global service that sends an SMS code.',
    related: ['ca', 'gb', 'au'],
  },
  gb: {
    name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44',
    blurb: 'A United Kingdom (+44) number is trusted across European and worldwide platforms. UK virtual numbers are a reliable pick when a service restricts new sign-ups to well-established regions.',
    related: ['us', 'de', 'fr'],
  },
  ca: {
    name: 'Canada', flag: '🇨🇦', dialCode: '+1',
    blurb: 'Canadian (+1) numbers carry the same broad acceptance as US numbers, on their own dedicated range. They are ideal when you need a North American number that is not US-based.',
    related: ['us', 'gb', 'au'],
  },
  au: {
    name: 'Australia', flag: '🇦🇺', dialCode: '+61',
    blurb: 'Australian (+61) numbers suit APAC-region services and platforms that prefer Oceania sign-ups. They deliver verification codes quickly despite the distance.',
    related: ['us', 'gb', 'in'],
  },
  de: {
    name: 'Germany', flag: '🇩🇪', dialCode: '+49',
    blurb: 'Germany (+49) numbers are among the most respected in Europe for account verification. A German virtual number is a strong choice for EU-focused platforms and marketplaces.',
    related: ['fr', 'gb', 'us'],
  },
  fr: {
    name: 'France', flag: '🇫🇷', dialCode: '+33',
    blurb: 'French (+33) numbers are widely accepted across European services and apps. They are a dependable option when a platform favours EU-based registrations.',
    related: ['de', 'gb', 'us'],
  },
  ru: {
    name: 'Russia', flag: '🇷🇺', dialCode: '+7',
    blurb: 'Russian (+7) numbers stay in high demand for services that originate in or cater to the region. They are often the fastest route to verifying region-specific apps.',
    related: ['in', 'de', 'us'],
  },
  in: {
    name: 'India', flag: '🇮🇳', dialCode: '+91',
    blurb: 'Indian (+91) numbers are perfect for the huge range of apps targeting South Asia. An India virtual number unlocks services that prioritise the region.',
    related: ['us', 'au', 'ng'],
  },
  ng: {
    name: 'Nigeria', flag: '🇳🇬', dialCode: '+234',
    blurb: 'Nigerian (+234) numbers open the door to Africa’s largest digital market. They are ideal for fintech, social, and gig-economy apps focused on the continent.',
    related: ['in', 'br', 'us'],
  },
  br: {
    name: 'Brazil', flag: '🇧🇷', dialCode: '+55',
    blurb: 'Brazilian (+55) numbers are the gateway to Latin America’s biggest online audience. A Brazil virtual number suits platforms that favour LATAM sign-ups.',
    related: ['us', 'ng', 'in'],
  },
};

// Per-service editorial. `blurb` = 2 unique sentences; `faq` = a service-specific
// Q&A; `related` = sibling service slugs for cross-linking.
export const SERVICES = {
  whatsapp: {
    name: 'WhatsApp', emoji: '💬',
    blurb: 'WhatsApp ties every account to a phone number, so a virtual number is the cleanest way to run a second account or keep your personal line private. The code lands on your dashboard the moment WhatsApp sends it.',
    faq: { q: 'Can I use the number for a second WhatsApp account?', a: 'Yes. A virtual number registers a brand-new WhatsApp account that is completely separate from the one on your personal SIM.' },
    related: ['telegram', 'tiktok', 'instagram'],
  },
  telegram: {
    name: 'Telegram', emoji: '✈️',
    blurb: 'Telegram only needs a number once, to confirm your account, after which you can hide it entirely. A virtual number lets you join Telegram without ever exposing your real SIM.',
    faq: { q: 'Will Telegram show this number to other people?', a: 'No. After verification you can set Telegram to hide your number from everyone, so it is never visible to other users.' },
    related: ['whatsapp', 'discord', 'google'],
  },
  google: {
    name: 'Google', emoji: '🔍',
    blurb: 'Google and Gmail frequently ask for SMS confirmation on new accounts. A virtual number clears that check instantly so you can finish setup without your personal phone.',
    faq: { q: 'Does this work for Gmail and YouTube too?', a: 'Yes. The same Google verification covers Gmail, YouTube, and any other Google service that asks for a phone code.' },
    related: ['instagram', 'facebook', 'telegram'],
  },
  instagram: {
    name: 'Instagram', emoji: '📸',
    blurb: 'Instagram often requires phone verification on fresh accounts and logins. A virtual number gets you verified without linking the account to your personal SIM.',
    faq: { q: 'Can I verify multiple Instagram accounts?', a: 'Each new virtual number can verify a separate Instagram account, so you can manage several profiles cleanly.' },
    related: ['facebook', 'tiktok', 'google'],
  },
  facebook: {
    name: 'Facebook', emoji: '📘',
    blurb: 'Facebook regularly prompts for SMS confirmation when you create or secure an account. A virtual number passes that step in seconds, with no personal number attached.',
    faq: { q: 'Is a virtual number enough to create a Facebook account?', a: 'Yes. Facebook accepts the SMS code sent to your virtual number to confirm a new account.' },
    related: ['instagram', 'whatsapp', 'google'],
  },
  tiktok: {
    name: 'TikTok', emoji: '🎵',
    blurb: 'TikTok asks for a phone number to confirm new accounts and unlock features. A virtual number lets you verify instantly and keep your personal line off the platform.',
    faq: { q: 'Can I use one virtual number for several TikTok accounts?', a: 'TikTok ties one account per number, so use a fresh virtual number for each separate TikTok account.' },
    related: ['instagram', 'whatsapp', 'discord'],
  },
  twitter: {
    name: 'Twitter / X', emoji: '🐦',
    blurb: 'X (formerly Twitter) uses SMS to confirm sign-ups and protect accounts. A virtual number completes verification without tying your handle to your personal phone.',
    faq: { q: 'Does this verify an X (Twitter) account?', a: 'Yes. The SMS code sent to your virtual number confirms a new or existing X (Twitter) account.' },
    related: ['discord', 'telegram', 'google'],
  },
  wechat: {
    name: 'WeChat', emoji: '🟢',
    blurb: 'WeChat is strict about phone verification on new accounts. A fresh virtual number gives you a clean line for registering and confirming your account.',
    faq: { q: 'Which country works best for WeChat?', a: 'WeChat can be sensitive to region, so picking a high-availability country improves your odds — try another country if the first code does not arrive.' },
    related: ['whatsapp', 'telegram', 'tiktok'],
  },
  tinder: {
    name: 'Tinder', emoji: '🔥',
    blurb: 'Tinder verifies every account by SMS before you can start matching. A virtual number lets you sign up while keeping your real number private.',
    faq: { q: 'Will my virtual number stay private on Tinder?', a: 'Yes. Tinder only uses the number to verify the account — it is never shown to other people you match with.' },
    related: ['instagram', 'facebook', 'whatsapp'],
  },
  discord: {
    name: 'Discord', emoji: '🎮',
    blurb: 'Discord may request phone verification to join servers or secure your account. A virtual number satisfies that check without exposing your personal SIM.',
    faq: { q: 'Does Discord accept virtual numbers for verification?', a: 'Yes. The SMS code delivered to your virtual number completes Discord phone verification.' },
    related: ['telegram', 'twitter', 'tiktok'],
  },
};

export const COUNTRY_CODES = Object.keys(COUNTRIES);
export const SERVICE_SLUGS = Object.keys(SERVICES);

// Cartesian product of supported countries × services (100 combos).
export function getCombos() {
  const combos = [];
  for (const country of COUNTRY_CODES) {
    for (const service of SERVICE_SLUGS) {
      combos.push({ country, service });
    }
  }
  return combos;
}
