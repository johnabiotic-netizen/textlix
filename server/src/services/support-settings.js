const PlatformSettings = require('../models/PlatformSettings');

// Support config lives in the PlatformSettings key/value store so admins can
// change it live (AI on/off, KB text, FAQ list, budget cap) with no redeploy.
// Cache reads briefly so a busy chat doesn't hit Mongo on every message.
const CACHE_MS = 30 * 1000;
let _cache = { at: 0, map: new Map() };

async function loadAll() {
  if (Date.now() - _cache.at < CACHE_MS) return _cache.map;
  const rows = await PlatformSettings.find({
    key: {
      $in: [
        'support_ai_enabled',
        'support_kb',
        'support_faq',
        'support_budget_monthly_usd',
        'support_business_hours',
      ],
    },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  _cache = { at: Date.now(), map };
  return map;
}

async function getString(key, fallback = '') {
  const map = await loadAll();
  const v = map.get(key);
  return v == null || v === '' ? fallback : v;
}

async function getBool(key, fallback) {
  const map = await loadAll();
  const v = map.get(key);
  if (v == null || v === '') return fallback;
  return v === 'true' || v === '1' || v === 'on';
}

async function getNumber(key, fallback = 0) {
  const map = await loadAll();
  const n = Number(map.get(key));
  return Number.isFinite(n) ? n : fallback;
}

// Lets the admin save endpoint force a refresh after writing settings.
function clearCache() {
  _cache = { at: 0, map: new Map() };
}

module.exports = { getString, getBool, getNumber, clearCache };
