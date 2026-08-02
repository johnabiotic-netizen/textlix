// Real brand logos for services. We resolve a slug → domain, then load the
// domain's favicon (Google's favicon service, no key needed). Where `${slug}.com`
// would be wrong, the DOMAIN map corrects it. If a logo fails to load, the
// <ServiceLogo> component falls back to an emoji (EMOJI map, else 📱).

// slug → brand domain (only the cases where `${slug}.com` is wrong or ambiguous).
const DOMAIN = {
  telegram: 'telegram.org', signal: 'signal.org', line: 'line.me', wechat: 'wechat.com',
  twitter: 'x.com', x: 'x.com', google: 'google.com', googlegmail: 'google.com', gmail: 'google.com',
  googledeveloper: 'google.com', google_developer: 'google.com', youtube: 'youtube.com',
  tiktok: 'tiktok.com', tiktokdouyin: 'tiktok.com', douyin: 'douyin.com',
  instagram: 'instagram.com', instagramthreads: 'instagram.com', threads: 'threads.net',
  facebook: 'facebook.com', whatsapp: 'whatsapp.com', messenger: 'messenger.com',
  ozon: 'ozon.ru', steam: 'steampowered.com', twitch: 'twitch.tv', blizzardbattle: 'blizzard.com',
  battle: 'blizzard.com', epicgames: 'epicgames.com', riotgames: 'riotgames.com', roblox: 'roblox.com',
  cashapp: 'cash.app', proton: 'proton.me', protonmail: 'proton.me', bolt: 'bolt.eu',
  bankofamerica: 'bankofamerica.com', bofa: 'bankofamerica.com', wise: 'wise.com',
  aliexpress: 'aliexpress.com', mercadolibre: 'mercadolibre.com', asiamiles: 'asiamiles.com',
  microsoft: 'microsoft.com', outlook: 'outlook.com', apple: 'apple.com', icloud: 'icloud.com',
  openai: 'openai.com', chatgpt: 'openai.com', claude: 'claude.ai', gemini: 'gemini.google.com',
  gitcoin: 'gitcoin.co', cleartrip: 'cleartrip.com', boo: 'boo.world', curtsy: 'curtsy.com',
  tradesy: 'tradesy.com', omiai: 'omiai-jp.com', getemail: 'getemail.io',
};

export function serviceDomain(slug) {
  const s = String(slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return DOMAIN[s] || `${s}.com`;
}

// 64px favicon — crisp enough for a ~40px icon box, no API key, permissive CORS.
export function serviceLogoUrl(slug) {
  return `https://www.google.com/s2/favicons?domain=${serviceDomain(slug)}&sz=64`;
}

// Emoji fallback for when a logo can't be fetched.
const EMOJI = {
  whatsapp: '💬', telegram: '✈️', google: '🔵', googlegmail: '📧', gmail: '📧', facebook: '📘',
  instagram: '📸', instagramthreads: '📸', twitter: '🐦', x: '🐦', tiktok: '🎵', tiktokdouyin: '🎵',
  snapchat: '👻', linkedin: '💼', discord: '🎮', uber: '🚗', amazon: '📦', netflix: '🎬', spotify: '🎧',
  paypal: '💳', microsoft: '🪟', apple: '🍎', openai: '🤖', tinder: '🔥', viber: '📞', ozon: '🛒',
  steam: '🎮', twitch: '🟣', blizzardbattle: '🎮', coinbase: '🪙', binance: '🟡', fiverr: '🟢',
};

export function serviceEmoji(slug) {
  const s = String(slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return EMOJI[s] || '📱';
}
