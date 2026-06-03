/**
 * generate-grizzly-additions.js
 *
 * Single-shot script that produces the next bulk batch of GrizzlySMS services
 * to add. Sequential execution to avoid the parallel-load timeout that hit
 * the unified discovery script.
 *
 * Filters applied:
 *   - Minimum country coverage of 20 (cuts long-tail noise)
 *   - Skip codes already in SLUG_TO_CODE
 *   - Skip slugs already in our Service collection (5sim catalog)
 *   - Skip names matching the noise heuristic (swipe-app variants, "unknown",
 *     numeric-only, etc.)
 *
 * Output: two JS code blocks ready to paste:
 *   1. SLUG_TO_CODE additions for grizzlysms.provider.js
 *   2. MULTI_PROVIDER_SLUGS additions for sync-from-all-providers.js
 *
 * Run:
 *   railway run node server/scripts/generate-grizzly-additions.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dns').setServers(['8.8.8.8', '1.1.1.1']);

const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Service = require('../src/models/Service');
const grizzlySms = require('../src/providers/sms/grizzlysms.provider');

const MONGODB_URI = process.env.MONGODB_URI;
const GRIZZLY_KEY = process.env.GRIZZLYSMS_API_KEY;
const MIN_COUNTRIES = 20;
const MAX_ADDITIONS = 300;

const slugify = (name) =>
  String(name).toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 30);

const isCleanName = (name) => {
  if (!name || typeof name !== 'string') return false;
  if (name.length < 2 || name.length > 30) return false;
  const lower = name.toLowerCase();
  // Heuristics for Grizzly's known noise patterns
  if (/swipe\s*app/i.test(name)) return false;
  if (/^unknown$/i.test(name)) return false;
  if (/^[\d\W]+$/.test(name)) return false;
  if (/test/i.test(lower) && lower.length < 10) return false;
  if (/^.{1,2}$/.test(name)) return false;
  return true;
};

const callGrizzly = async (params, timeoutMs = 60000) => {
  const { data } = await axios.get(
    'https://api.grizzlysms.com/stubs/handler_api.php',
    { params: { api_key: GRIZZLY_KEY, ...params }, timeout: timeoutMs }
  );
  return data;
};

function readSlugMap() {
  const file = fs.readFileSync(
    path.join(__dirname, '../src/providers/sms/grizzlysms.provider.js'),
    'utf8'
  );
  const match = file.match(/const SLUG_TO_CODE = \{([\s\S]*?)\};/);
  if (!match) return { slugs: new Set(), codes: new Set() };
  const slugs = new Set();
  const codes = new Set();
  const re = /(\w+):\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(match[1]))) {
    slugs.add(m[1]);
    codes.add(m[2]);
  }
  return { slugs, codes };
}

function readMultiProviderSlugs() {
  const file = fs.readFileSync(
    path.join(__dirname, '../seed/sync-from-all-providers.js'),
    'utf8'
  );
  const match = file.match(/const MULTI_PROVIDER_SLUGS = \{([\s\S]*?)\n\};/);
  if (!match) return new Set();
  const slugs = new Set();
  const re = /(\w+):\s*\{\s*name/g;
  let m;
  while ((m = re.exec(match[1]))) slugs.add(m[1]);
  return slugs;
}

async function run() {
  if (!MONGODB_URI || !GRIZZLY_KEY) {
    console.error('Missing MONGODB_URI or GRIZZLYSMS_API_KEY');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'verifynow' });

  const dbSlugs = new Set((await Service.find().select('slug')).map((s) => s.slug));
  console.log(`  ${dbSlugs.size} Service slugs in DB\n`);

  await mongoose.disconnect();

  const { slugs: mapSlugs, codes: mapCodes } = readSlugMap();
  const mpSlugs = readMultiProviderSlugs();
  console.log(`SLUG_TO_CODE has ${mapSlugs.size} slugs / ${mapCodes.size} codes`);
  console.log(`MULTI_PROVIDER_SLUGS has ${mpSlugs.size} entries\n`);

  console.log('Fetching Grizzly getServicesList...');
  const list = await callGrizzly({ action: 'getServicesList' });
  let serviceList = [];
  if (Array.isArray(list)) serviceList = list;
  else if (list && typeof list === 'object') {
    serviceList = Array.isArray(list.services) ? list.services :
      Object.entries(list).map(([code, name]) => ({ code, name }));
  }
  const codeToName = {};
  for (const entry of serviceList) {
    const code = entry.code || entry.id || entry.service;
    const name = entry.name || entry.title || entry.label;
    if (code) codeToName[code] = name || code;
  }
  console.log(`  ${Object.keys(codeToName).length} services in catalog\n`);

  console.log('Fetching Grizzly getPrices (full inventory, ~3MB)...');
  const prices = await callGrizzly({ action: 'getPrices' }, 90000);
  const codeStats = {}; // code -> { countries: Set }
  if (prices && typeof prices === 'object') {
    for (const services of Object.values(prices)) {
      if (!services || typeof services !== 'object') continue;
      for (const [code, priceMap] of Object.entries(services)) {
        if (!priceMap || typeof priceMap !== 'object') continue;
        let hasInv = false;
        for (const cnt of Object.values(priceMap)) {
          if (Number(cnt) > 0) { hasInv = true; break; }
        }
        if (!hasInv) continue;
        if (!codeStats[code]) codeStats[code] = 0;
        codeStats[code]++;
      }
    }
  }
  console.log(`  ${Object.keys(codeStats).length} unique codes with live inventory\n`);

  // Build candidates
  const candidates = [];
  for (const [code, countries] of Object.entries(codeStats)) {
    if (countries < MIN_COUNTRIES) continue;
    if (mapCodes.has(code)) continue; // already mapped under some slug
    const name = codeToName[code];
    if (!isCleanName(name)) continue;
    const slug = slugify(name);
    if (slug.length < 2) continue;
    if (mapSlugs.has(slug)) continue; // slug already used in map
    if (mpSlugs.has(slug)) continue; // already in sync script
    if (dbSlugs.has(slug)) continue; // already a Service in DB (5sim catalog)
    candidates.push({ slug, code, name, countries });
  }
  candidates.sort((a, b) => b.countries - a.countries);
  const top = candidates.slice(0, MAX_ADDITIONS);

  // De-dupe by slug (multiple Grizzly codes could slugify to the same canonical)
  const seen = new Set();
  const deduped = [];
  for (const c of top) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    deduped.push(c);
  }

  console.log(`Candidates passing all filters: ${deduped.length}\n`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SLUG_TO_CODE additions for grizzlysms.provider.js');
  console.log('═══════════════════════════════════════════════════════════════\n');
  for (const c of deduped) {
    console.log(`  ${c.slug}: '${c.code}', // ${c.name} — ${c.countries}c`);
  }
  console.log();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MULTI_PROVIDER_SLUGS additions for sync-from-all-providers.js');
  console.log('═══════════════════════════════════════════════════════════════\n');
  for (const c of deduped) {
    const escapedName = c.name.replace(/'/g, "\\'");
    console.log(`  ${c.slug}: { name: '${escapedName}', icon: '${c.slug}' }, // ${c.countries}c`);
  }
  console.log();
  console.log(`Done. ${deduped.length} services ready to add.\n`);
}

run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
