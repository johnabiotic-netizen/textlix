/**
 * discover-and-reconcile-catalogs.js
 *
 * Pulls live catalogs from 5sim + GrizzlySMS + GetSMSOTP, normalises service
 * names to canonical slugs, and prints the bulk-update payload for:
 *
 *   1. grizzlysms.provider.js  — SLUG_TO_CODE additions
 *   2. getsmsotp.provider.js   — SERVICE_CODE additions
 *   3. sync-from-all-providers.js — MULTI_PROVIDER_SLUGS list
 *
 * Read-only — never writes the DB. Safe to run anytime. Run via:
 *   railway run node server/scripts/discover-and-reconcile-catalogs.js
 *
 * Reconciliation strategy:
 *   - 5sim slug is canonical when 5sim has the service (preserves existing identifiers).
 *   - For services only on Grizzly/GetSMSOTP, the canonical slug is slugify(name)
 *     of whichever non-5sim provider has more country coverage.
 *   - Names below MIN_COUNTRIES on every provider are dropped (noise filter).
 *   - Numeric-only or trivially short slugs are dropped.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dns').setServers(['8.8.8.8', '1.1.1.1']);

const https = require('https');
const axios = require('axios');
const grizzlySms = require('../src/providers/sms/grizzlysms.provider');
const getsmsotp = require('../src/providers/sms/getsmsotp.provider');

const FIVESIM_KEY = (process.env.FIVESIM_API_KEY || '').trim();
const GRIZZLY_KEY = process.env.GRIZZLYSMS_API_KEY;
const GETSMS_KEY = process.env.GETSMS_API_KEY;

// Service-quality floor: a name only counts if at least one provider has it
// in this many countries. 10 cuts most one-off / experimental SKUs.
const MIN_COUNTRIES = 10;

// 5sim country slug → ISO-2 (reused from sync-from-5sim.js spirit)
const FIVESIM_SLUG_TO_ISO = {
  usa:'US',england:'GB',india:'IN',nigeria:'NG',russia:'RU',brazil:'BR',
  germany:'DE',france:'FR',canada:'CA',australia:'AU',indonesia:'ID',
  philippines:'PH',vietnam:'VN',mexico:'MX',pakistan:'PK',bangladesh:'BD',
  kenya:'KE',ghana:'GH',southafrica:'ZA',ukraine:'UA',spain:'ES',italy:'IT',
  netherlands:'NL',poland:'PL',sweden:'SE',norway:'NO',denmark:'DK',
  finland:'FI',portugal:'PT',belgium:'BE',austria:'AT',switzerland:'CH',
  greece:'GR',romania:'RO',czech:'CZ',hungary:'HU',slovakia:'SK',croatia:'HR',
  bulgaria:'BG',serbia:'RS',ireland:'IE',lithuania:'LT',latvia:'LV',estonia:'EE',
  moldova:'MD',belarus:'BY',albania:'AL',northmacedonia:'MK',bih:'BA',
  montenegro:'ME',slovenia:'SI',cyprus:'CY',luxembourg:'LU',saudiarabia:'SA',
  egypt:'EG',morocco:'MA',tunisia:'TN',algeria:'DZ',israel:'IL',jordan:'JO',
  kuwait:'KW',oman:'OM',bahrain:'BH',lebanon:'LB',iraq:'IQ',libya:'LY',
  thailand:'TH',malaysia:'MY',taiwan:'TW',hongkong:'HK',cambodia:'KH',
  laos:'LA',srilanka:'LK',nepal:'NP',mongolia:'MN',myanmar:'MM',
  kazakhstan:'KZ',uzbekistan:'UZ',azerbaijan:'AZ',georgia:'GE',armenia:'AM',
  kyrgyzstan:'KG',tajikistan:'TJ',turkmenistan:'TM',argentina:'AR',
  colombia:'CO',chile:'CL',peru:'PE',venezuela:'VE',ecuador:'EC',bolivia:'BO',
  paraguay:'PY',uruguay:'UY',guatemala:'GT',costarica:'CR',panama:'PA',
  dominicana:'DO',honduras:'HN',salvador:'SV',nicaragua:'NI',puertorico:'PR',
  jamaica:'JM',haiti:'HT',guyana:'GY',barbados:'BB',trinidad:'TT',
  ethiopia:'ET',tanzania:'TZ',uganda:'UG',cameroon:'CM',ivorycoast:'CI',
  senegal:'SN',rwanda:'RW',mozambique:'MZ',zambia:'ZM',malawi:'MW',
  namibia:'NA',botswana:'BW',madagascar:'MG',sierraleone:'SL',liberia:'LR',
  guinea:'GN',benin:'BJ',togo:'TG',burkinafaso:'BF',mali:'ML',niger:'NE',
  chad:'TD',angola:'AO',gabon:'GA',congo:'CG',drc:'CD',burundi:'BI',
  djibouti:'DJ',gambia:'GM',guineabissau:'GW',capeverde:'CV',mauritania:'MR',
  mauritius:'MU',seychelles:'SC',comoros:'KM',lesotho:'LS',equatorialguinea:'GQ',
  zimbabwe:'ZW',sudan:'SD',maldives:'MV',easttimor:'TL',papuanewguinea:'PG',
  newzealand:'NZ',turkey:'TR',china:'CN',japan:'JP',southkorea:'KR',
};

const slugify = (name) =>
  String(name).toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 30);

const isValidSlug = (s) =>
  s && s.length >= 2 && s.length <= 30 && /^[a-z][a-z0-9]*$/.test(s);

// ─── 5sim catalog fetch ──────────────────────────────────────────────────────
function fiveSimGet(path) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: '5sim.net', path, method: 'GET',
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${FIVESIM_KEY}` },
      timeout: 10000,
    }, (r) => {
      let d = '';
      r.on('data', (c) => d += c);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', () => resolve({}));
    req.on('timeout', () => { req.destroy(); resolve({}); });
    req.end();
  });
}

async function fetch5simCatalog() {
  console.log('Fetching 5sim countries...');
  const countriesRaw = await fiveSimGet('/v1/guest/countries');
  const slugs = Object.keys(countriesRaw).filter((s) => FIVESIM_SLUG_TO_ISO[s]);
  console.log(`  ${slugs.length} 5sim countries we know about`);

  console.log('Fetching 5sim products per country (this takes a couple minutes)...');
  // { slug: { iso2: usdPrice } }
  const catalog = {};
  const BATCH = 8;
  let done = 0;
  for (let i = 0; i < slugs.length; i += BATCH) {
    const batch = slugs.slice(i, i + BATCH);
    await Promise.all(batch.map(async (cSlug) => {
      const iso = FIVESIM_SLUG_TO_ISO[cSlug];
      const products = await fiveSimGet(`/v1/guest/products/${cSlug}/any`);
      for (const [sSlug, data] of Object.entries(products || {})) {
        if (!data?.Price || data.Price <= 0) continue;
        if (!catalog[sSlug]) catalog[sSlug] = {};
        catalog[sSlug][iso] = data.Price;
      }
    }));
    done += batch.length;
    if (done % 32 === 0 || done === slugs.length) {
      console.log(`  ${done}/${slugs.length} 5sim countries processed`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return catalog; // { slug: { iso2: usdPrice } }
}

// ─── GrizzlySMS catalog fetch ────────────────────────────────────────────────
const GRIZZLY_BASE = 'https://api.grizzlysms.com/stubs/handler_api.php';
const callGrizzly = async (params) => {
  const { data } = await axios.get(GRIZZLY_BASE, {
    params: { api_key: GRIZZLY_KEY, ...params }, timeout: 30000,
  });
  return data;
};

async function fetchGrizzlyCatalog() {
  console.log('Fetching GrizzlySMS catalog...');
  let serviceList = [];
  try {
    const raw = await callGrizzly({ action: 'getServicesList' });
    if (Array.isArray(raw)) serviceList = raw;
    else if (raw && typeof raw === 'object') {
      serviceList = Array.isArray(raw.services) ? raw.services :
        Object.entries(raw).map(([code, name]) => ({ code, name }));
    }
  } catch (e) {
    console.log(`  getServicesList failed: ${e.message}`);
  }
  const codeToName = {};
  for (const entry of serviceList) {
    const code = entry.code || entry.id || entry.service;
    const name = entry.name || entry.title || entry.label;
    if (code) codeToName[code] = name || code;
  }
  console.log(`  ${Object.keys(codeToName).length} Grizzly services in getServicesList`);

  const prices = await callGrizzly({ action: 'getPrices' });
  // Shape: { countryId: { code: { priceStr: count } } }
  const catalog = {}; // { code: { name, countries: { iso2: usdPrice } } }
  for (const [countryIdStr, services] of Object.entries(prices || {})) {
    const iso = grizzlySms.COUNTRY_ID_TO_ISO[countryIdStr];
    if (!iso) continue;
    for (const [code, priceMap] of Object.entries(services || {})) {
      if (!priceMap || typeof priceMap !== 'object') continue;
      // priceMap looks like { "0.45": 200 } — take the LOWEST price with count>0
      let bestPrice = null;
      for (const [priceStr, cnt] of Object.entries(priceMap)) {
        const p = Number(priceStr);
        const c = Number(cnt);
        if (p > 0 && c > 0 && (bestPrice === null || p < bestPrice)) bestPrice = p;
      }
      if (bestPrice === null) continue;
      if (!catalog[code]) {
        catalog[code] = { name: codeToName[code] || code, countries: {} };
      }
      catalog[code].countries[iso] = bestPrice;
    }
  }
  console.log(`  ${Object.keys(catalog).length} Grizzly codes have live inventory`);
  return catalog;
}

// ─── GetSMSOTP catalog fetch ─────────────────────────────────────────────────
const GETSMS_BASE = 'https://get-sms.com/stubs/handler_api.php';
const callGetSms = async (params) => {
  const { data } = await axios.get(GETSMS_BASE, {
    params: { api_key: GETSMS_KEY, ...params }, timeout: 30000,
  });
  return data;
};

async function fetchGetSmsOtpCatalog() {
  console.log('Fetching GetSMSOTP catalog...');
  let codeToName = {};
  try {
    const raw = await callGetSms({ action: 'getServicesList' });
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        const c = entry.code || entry.id; const n = entry.name || entry.title;
        if (c) codeToName[c] = n || c;
      }
    } else if (raw && typeof raw === 'object') {
      for (const [code, name] of Object.entries(raw)) {
        codeToName[code] = name || code;
      }
    }
  } catch (e) {
    console.log(`  getServicesList failed: ${e.message}`);
  }
  console.log(`  ${Object.keys(codeToName).length} GetSMSOTP services in getServicesList`);

  // Per-country prices
  console.log('Fetching GetSMSOTP prices per country...');
  const isoEntries = Object.entries(getsmsotp.ISO_TO_COUNTRY_ID);
  const catalog = {}; // { code: { name, countries: { iso2: usdPrice } } }
  const BATCH = 6;
  for (let i = 0; i < isoEntries.length; i += BATCH) {
    const batch = isoEntries.slice(i, i + BATCH);
    await Promise.all(batch.map(async ([iso, countryId]) => {
      try {
        const raw = await callGetSms({ action: 'getPrices', country: countryId });
        const countryData = raw?.[String(countryId)];
        if (!countryData || typeof countryData !== 'object') return;
        for (const [code, priceMap] of Object.entries(countryData)) {
          if (!priceMap || typeof priceMap !== 'object') continue;
          let bestPrice = null;
          for (const [priceStr, cnt] of Object.entries(priceMap)) {
            const p = Number(priceStr);
            const c = Number(cnt);
            if (p > 0 && c > 0 && (bestPrice === null || p < bestPrice)) bestPrice = p;
          }
          if (bestPrice === null) continue;
          if (!catalog[code]) {
            catalog[code] = { name: codeToName[code] || code, countries: {} };
          }
          catalog[code].countries[iso] = bestPrice;
        }
      } catch (_) {}
    }));
  }
  console.log(`  ${Object.keys(catalog).length} GetSMSOTP codes have live inventory`);
  return catalog;
}

// ─── Reconcile ───────────────────────────────────────────────────────────────
function reconcile(fivesimCat, grizzlyCat, getsmsCat) {
  // Step 1: collect 5sim canonical slugs (which are already canonical by design)
  const services = {}; // canonicalSlug → { name, providers: { fivesim/grizzly/getsms: { code, countries } } }

  for (const [slug, byCountry] of Object.entries(fivesimCat)) {
    const countriesCount = Object.keys(byCountry).length;
    if (countriesCount === 0) continue;
    services[slug] = {
      name: prettifyName(slug),
      providers: { fivesim: { code: slug, countries: byCountry } },
    };
  }

  // Step 2: fold in Grizzly. Match by slugify(name) to existing canonical slugs.
  // If no match, register a new canonical slug.
  for (const [code, info] of Object.entries(grizzlyCat)) {
    const countriesCount = Object.keys(info.countries).length;
    if (countriesCount < 1) continue;
    const normalized = slugify(info.name);
    if (!isValidSlug(normalized)) continue;

    let canonical = services[normalized] ? normalized : null;
    // Or maybe it matches a 5sim slug under a slightly different prettified name
    if (!canonical) {
      for (const [s, svc] of Object.entries(services)) {
        if (s === normalized || slugify(svc.name) === normalized) { canonical = s; break; }
      }
    }
    if (!canonical) {
      canonical = normalized;
      services[canonical] = { name: info.name, providers: {} };
    }

    // De-dupe: if Grizzly already has another code mapped to this canonical
    // (e.g. multiple Facebook SKUs), keep the one with more country coverage.
    const existing = services[canonical].providers.grizzlysms;
    if (!existing || Object.keys(info.countries).length > Object.keys(existing.countries).length) {
      services[canonical].providers.grizzlysms = { code, countries: info.countries };
    }
  }

  // Step 3: fold in GetSMSOTP, same logic
  for (const [code, info] of Object.entries(getsmsCat)) {
    const countriesCount = Object.keys(info.countries).length;
    if (countriesCount < 1) continue;
    const normalized = slugify(info.name);
    if (!isValidSlug(normalized)) continue;

    let canonical = services[normalized] ? normalized : null;
    if (!canonical) {
      for (const [s, svc] of Object.entries(services)) {
        if (s === normalized || slugify(svc.name) === normalized) { canonical = s; break; }
      }
    }
    if (!canonical) {
      canonical = normalized;
      services[canonical] = { name: info.name, providers: {} };
    }
    const existing = services[canonical].providers.getsmsotp;
    if (!existing || Object.keys(info.countries).length > Object.keys(existing.countries).length) {
      services[canonical].providers.getsmsotp = { code, countries: info.countries };
    }
  }

  // Apply quality filter
  const filtered = {};
  for (const [slug, svc] of Object.entries(services)) {
    const maxCountries = Math.max(
      Object.keys(svc.providers.fivesim?.countries || {}).length,
      Object.keys(svc.providers.grizzlysms?.countries || {}).length,
      Object.keys(svc.providers.getsmsotp?.countries || {}).length,
    );
    if (maxCountries >= MIN_COUNTRIES) filtered[slug] = svc;
  }
  return filtered;
}

function prettifyName(slug) {
  return slug.replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Output ──────────────────────────────────────────────────────────────────
async function run() {
  if (!GRIZZLY_KEY || !GETSMS_KEY || !FIVESIM_KEY) {
    console.error('Missing one of FIVESIM_API_KEY / GRIZZLYSMS_API_KEY / GETSMS_API_KEY');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 1 — DISCOVERY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const [fivesim, grizzly, getsms] = await Promise.all([
    fetch5simCatalog(),
    fetchGrizzlyCatalog(),
    fetchGetSmsOtpCatalog(),
  ]);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 2 — RECONCILIATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const services = reconcile(fivesim, grizzly, getsms);
  const total = Object.keys(services).length;
  console.log(`  ${total} canonical services after reconciliation (filter: ≥${MIN_COUNTRIES} country coverage)\n`);

  // Provider distribution
  let onlyFs = 0, onlyGr = 0, onlyGs = 0, twoOrMore = 0;
  for (const svc of Object.values(services)) {
    const flags = [
      !!svc.providers.fivesim,
      !!svc.providers.grizzlysms,
      !!svc.providers.getsmsotp,
    ];
    const n = flags.filter(Boolean).length;
    if (n >= 2) twoOrMore++;
    else if (flags[0]) onlyFs++;
    else if (flags[1]) onlyGr++;
    else if (flags[2]) onlyGs++;
  }
  console.log(`  on 2+ providers:        ${twoOrMore}`);
  console.log(`  5sim-only:              ${onlyFs}`);
  console.log(`  GrizzlySMS-only:        ${onlyGr}`);
  console.log(`  GetSMSOTP-only:         ${onlyGs}\n`);

  // ── GrizzlySMS SLUG_TO_CODE additions ──────────────────────────────────────
  const grizzlyExistingSlugs = new Set();
  const grizzlyFile = require('fs').readFileSync(
    require('path').join(__dirname, '../src/providers/sms/grizzlysms.provider.js'), 'utf8'
  );
  const grizzlyMatch = grizzlyFile.match(/const SLUG_TO_CODE = \{([\s\S]*?)\};/);
  if (grizzlyMatch) {
    const re = /(\w+):\s*'([^']+)'/g; let m;
    while ((m = re.exec(grizzlyMatch[1]))) grizzlyExistingSlugs.add(m[1]);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  GRIZZLYSMS SLUG_TO_CODE — additions (not yet mapped)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  const grizzlyAdds = [];
  for (const [slug, svc] of Object.entries(services)) {
    if (svc.providers.grizzlysms && !grizzlyExistingSlugs.has(slug)) {
      grizzlyAdds.push({ slug, code: svc.providers.grizzlysms.code, name: svc.name,
        countries: Object.keys(svc.providers.grizzlysms.countries).length });
    }
  }
  grizzlyAdds.sort((a, b) => b.countries - a.countries);
  for (const a of grizzlyAdds) {
    console.log(`  ${a.slug}: '${a.code}', // ${a.name} — ${a.countries} countries`);
  }
  console.log(`\n  Total: ${grizzlyAdds.length} additions\n`);

  // ── GetSMSOTP SERVICE_CODE additions ───────────────────────────────────────
  const getsmsExistingSlugs = new Set();
  const getsmsFile = require('fs').readFileSync(
    require('path').join(__dirname, '../src/providers/sms/getsmsotp.provider.js'), 'utf8'
  );
  const getsmsMatch = getsmsFile.match(/const SERVICE_CODE = \{([\s\S]*?)\};/);
  if (getsmsMatch) {
    const re = /(\w+):\s*'([^']+)'/g; let m;
    while ((m = re.exec(getsmsMatch[1]))) getsmsExistingSlugs.add(m[1]);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  GETSMSOTP SERVICE_CODE — additions (not yet mapped)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  const getsmsAdds = [];
  for (const [slug, svc] of Object.entries(services)) {
    if (svc.providers.getsmsotp && !getsmsExistingSlugs.has(slug)) {
      getsmsAdds.push({ slug, code: svc.providers.getsmsotp.code, name: svc.name,
        countries: Object.keys(svc.providers.getsmsotp.countries).length });
    }
  }
  getsmsAdds.sort((a, b) => b.countries - a.countries);
  for (const a of getsmsAdds) {
    console.log(`  ${a.slug}: '${a.code}', // ${a.name} — ${a.countries} countries`);
  }
  console.log(`\n  Total: ${getsmsAdds.length} additions\n`);

  // ── MULTI_PROVIDER_SLUGS — services missing from 5sim, present on alt ──────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MULTI_PROVIDER_SLUGS — services not on 5sim');
  console.log('  (these need NumberPricing rows created by the sync)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  const altOnly = [];
  for (const [slug, svc] of Object.entries(services)) {
    if (!svc.providers.fivesim) altOnly.push({ slug, name: svc.name,
      gr: Object.keys(svc.providers.grizzlysms?.countries || {}).length,
      gs: Object.keys(svc.providers.getsmsotp?.countries || {}).length,
    });
  }
  altOnly.sort((a, b) => (b.gr + b.gs) - (a.gr + a.gs));
  for (const a of altOnly) {
    const widest = Math.max(a.gr, a.gs);
    console.log(`  ${a.slug}: { name: '${a.name.replace(/'/g, "\\'")}', icon: '${a.slug}' }, // ${widest}c (gr=${a.gr}, gs=${a.gs})`);
  }
  console.log(`\n  Total: ${altOnly.length} alt-provider-only services\n`);
}

run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
