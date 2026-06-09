const axios = require('axios');
const logger = require('../../config/logger');

// smscodes.io (LIX 4) — a custom REST API (NOT SMS-Activate handler_api).
//   Base: https://code.smscodes.io/api/sms , auth via ?key=
//   Countries are ISO codes; services are UUIDs resolved by name.
//   Buy: GetServiceNumber?iso=&serv=  → { SecurityId, Number, Rate }
//   Poll: GetSMSCode?sid=&number=     → { SMS }   (only charged ON delivery)
//   No cancel endpoint — unused numbers simply aren't charged.
const BASE_URL = 'https://code.smscodes.io/api/sms';

// smscodes blocks request bursts aggressively (429, then a longer NotAuthorised
// cooldown). So we (a) serialize all calls through a single queue with a minimum
// gap between them, and (b) back off + retry on a 429 or a 200-body NotAuthorised.
// This keeps us under their limit instead of tripping the cooldown.
const MIN_GAP_MS = 800;
let _chain = Promise.resolve();
let _lastCallAt = 0;

const isBlocked = (data) =>
  data && typeof data === 'object' && (data.Status === 'NotAuthorised' || data.Error === 'NotAuthorised');

async function doCall(path, timeout, attempt) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE_URL}${path}${sep}key=${process.env.SMSCODES_API_KEY}`;
  try {
    const { data } = await axios.get(url, { timeout });
    if (isBlocked(data) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt)); // 1.5s, 3s, 6s
      return doCall(path, timeout, attempt + 1);
    }
    return data;
  } catch (err) {
    if (err.response?.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
      return doCall(path, timeout, attempt + 1);
    }
    throw err;
  }
}

// Queue: each call waits for the previous one, plus a min gap, so we never burst.
const call = (path, timeout = 30000) => {
  const run = _chain.then(async () => {
    const gap = MIN_GAP_MS - (Date.now() - _lastCallAt);
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
    _lastCallAt = Date.now();
    return doCall(path, timeout, 0);
  });
  _chain = run.then(() => {}, () => {}); // keep the queue alive regardless of outcome
  return run;
};

// Normalize a service name/slug for matching: lowercase alphanumerics only.
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Our slug → smscodes normalized service name, where the two don't match 1:1.
const SLUG_TO_SCNAME = { google: 'googlegmail' }; // smscodes lists it as "Google/Gmail"
const SCNAME_TO_SLUG = {};
for (const [slug, nm] of Object.entries(SLUG_TO_SCNAME)) SCNAME_TO_SLUG[nm] = slug;

// smscodes uses a few NON-ISO country codes. Confirmed live: United Kingdom is
// "UK" on smscodes, but the ISO standard (and our DB) is "GB" — so iso=GB returned
// nothing and hid the UK's 1,352 numbers. Map our ISO <-> smscodes code on the way
// out and back. (Add more pairs here if other non-ISO codes surface.)
const ISO_TO_SC = { GB: 'UK' };
const SC_TO_ISO = { UK: 'GB' };
const toScIso = (iso) => ISO_TO_SC[String(iso || '').toUpperCase()] || String(iso || '').toUpperCase();
const fromScIso = (code) => SC_TO_ISO[String(code || '').toUpperCase()] || String(code || '').toUpperCase();

// Cache the (normalized service name → ServiceID) map. The service list is large
// and stable, so cache it 1h.
let _svcMap = null;
let _svcExpire = 0;
const SVC_TTL = 60 * 60 * 1000;

async function loadServiceMap() {
  if (_svcMap && Date.now() < _svcExpire) return _svcMap;
  const data = await call('/GetServiceCodes');
  const list = Array.isArray(data?.Services) ? data.Services : [];
  const map = {};
  for (const s of list) {
    const id = s.ServiceID;
    const key = norm(s.ServiceName);
    if (id && key && !(key in map)) map[key] = id;
  }
  if (Object.keys(map).length) { _svcMap = map; _svcExpire = Date.now() + SVC_TTL; }
  return _svcMap || {};
}

async function serviceIdFor(slug) {
  const map = await loadServiceMap();
  const key = norm(slug);
  const override = SLUG_TO_SCNAME[key];
  return (override && map[override]) || map[key] || null;
}

// Buy an activation number. Returns { id (SecurityId), phone (Number) }.
const getNumber = async (serviceSlug, countryIso) => {
  const serviceId = await serviceIdFor(serviceSlug);
  if (!serviceId) throw new Error(`smscodes: no service id for ${serviceSlug}`);
  const iso = toScIso(countryIso); // map ISO → smscodes code (e.g. GB → UK)
  const data = await call(`/GetServiceNumber?iso=${iso}&serv=${serviceId}`);
  if (data?.Status === 'Success' && data?.Number && data?.SecurityId) {
    return { id: String(data.SecurityId), phone: String(data.Number) };
  }
  throw new Error(`smscodes GetServiceNumber: ${data?.Error || data?.Status || JSON.stringify(data)}`);
};

// Poll for the received code. Returns the code string, or null while waiting.
// Polling before a code arrives is free; smscodes only bills once SMS is returned.
//
// IMPORTANT: while waiting, smscodes returns Status:'Success' with the SMS field
// set to a human-readable status STRING, not null — confirmed live:
//   { Status:'Success', SMS:'Message not received yet', Balance:'$3.00' }
// A naive truthy check would return that sentence as if it were the OTP. So we
// treat any known/obvious "still waiting" sentinel as "no code yet" → null.
const WAITING_SENTINELS = new Set([
  'message not received yet', // confirmed live
  'no sms', 'waiting', 'pending',
]);
const getSMS = async (securityId, number) => {
  try {
    const data = await call(`/GetSMSCode?sid=${encodeURIComponent(securityId)}&number=${encodeURIComponent(number)}`);
    const raw = data?.SMS;
    if (!raw) return null;
    const text = String(raw).trim();
    const low = text.toLowerCase();
    // Confirmed waiting sentinel + defensive catch for any similar status phrase.
    if (WAITING_SENTINELS.has(low) || low.includes('not received') || low.includes('waiting for')) return null;
    return text;
  } catch (err) {
    logger.warn(`smscodes getSMS(${securityId}) failed: ${err.message}`);
    return null;
  }
};

// Prices for a service across all countries → { [ISO]: { cost (USD), count } }.
// smscodes has no per-combo stock count (it bills on delivery), so count=1 marks
// "listed/available" for the catalog's availability check.
const getOtpPrices = async (serviceSlug) => {
  const serviceId = await serviceIdFor(serviceSlug);
  if (!serviceId) return null;
  try {
    const data = await call(`/GetServicePrices?serviceId=${serviceId}`);
    const list = Array.isArray(data?.Prices) ? data.Prices : [];
    const result = {};
    for (const row of list) {
      const iso = fromScIso(row.Iso); // map smscodes code → ISO (e.g. UK → GB)
      const cost = Number(row.Price);
      if (iso && cost > 0) result[iso] = { cost, count: 1 };
    }
    return Object.keys(result).length ? result : null;
  } catch (err) {
    logger.warn(`smscodes getOtpPrices(${serviceSlug}) failed: ${err.message}`);
    return null;
  }
};

// All services for ONE country → { [ourSlug]: { cost (USD), count } }.
const getOtpPricesByCountry = async (countryIso) => {
  const iso = toScIso(countryIso); // map ISO → smscodes code (e.g. GB → UK)
  try {
    const data = await call(`/GetCountryPrices?iso=${iso}`, 60000); // 1000+ services — slow endpoint
    const list = Array.isArray(data?.Prices) ? data.Prices : [];
    const result = {};
    for (const row of list) {
      const raw = norm(row.ServiceName); // normalized name doubles as our slug for common services
      const slug = SCNAME_TO_SLUG[raw] || raw;
      const cost = Number(row.Price);
      if (slug && cost > 0 && !(slug in result)) result[slug] = { cost, count: 1 };
    }
    return Object.keys(result).length ? result : null;
  } catch (err) {
    logger.warn(`smscodes getOtpPricesByCountry(${countryIso}) failed: ${err.message}`);
    return null;
  }
};

const getBalance = async () => {
  try {
    const data = await call('/GetBalance');
    return data?.Balance != null ? Number(data.Balance) : null;
  } catch (err) {
    logger.warn(`smscodes getBalance failed: ${err.message}`);
    return null;
  }
};

// Per-country live stock → { [ISO]: numbersAvailable }. GetCountryCodes only lists
// countries that currently have numbers, so a missing/zero ISO = no stock. The
// catalog uses this to hide smscodes (LIX 3) where there's nothing to buy.
// Confirmed shape: { Countries: [{ CountryName, CountryCode, NumbersAvailable }] }.
const getCountryStock = async () => {
  try {
    const data = await call('/GetCountryCodes', 45000); // smscodes latency is erratic — allow 45s
    const list = Array.isArray(data?.Countries) ? data.Countries : [];
    const out = {};
    for (const c of list) {
      const iso = fromScIso(c.CountryCode); // map smscodes code → ISO (e.g. UK → GB)
      const qty = Number(c.NumbersAvailable);
      if (iso) out[iso] = Number.isFinite(qty) ? qty : 0;
    }
    return out;
  } catch (err) {
    logger.warn(`smscodes getCountryStock failed: ${err.message}`);
    return null;
  }
};

module.exports = { getNumber, getSMS, getOtpPrices, getOtpPricesByCountry, getBalance, getCountryStock, serviceIdFor };
