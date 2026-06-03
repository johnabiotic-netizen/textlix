/**
 * discover-grizzlysms-catalog.js
 *
 * Calls GrizzlySMS's two discovery endpoints and prints what they actually
 * carry — code, name, and inventory count per code. Compares against our
 * existing SLUG_TO_CODE map and tells us:
 *
 *   1. Which codes have live inventory we DON'T yet map (potential additions)
 *   2. Which codes we DO map but GrizzlySMS shows no inventory for (dead)
 *   3. Whether our 6 zero-coverage codes from the last sync are real
 *
 * Pure read-only — never writes to the DB. Safe to run anytime.
 *
 *   railway run node server/scripts/discover-grizzlysms-catalog.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const BASE_URL = 'https://api.grizzlysms.com/stubs/handler_api.php';
const API_KEY = process.env.GRIZZLYSMS_API_KEY;

// Pulled from the provider file so we don't drift.
const grizzly = require('../src/providers/sms/grizzlysms.provider');
// We import the constant indirectly — read the file for SLUG_TO_CODE since
// it isn't exported. Cheap parse, runs once.
const fs = require('fs');
const providerSrc = fs.readFileSync(
  require('path').join(__dirname, '../src/providers/sms/grizzlysms.provider.js'),
  'utf8'
);
const slugMapMatch = providerSrc.match(/const SLUG_TO_CODE = \{([\s\S]*?)\};/);
const SLUG_TO_CODE = {};
if (slugMapMatch) {
  const body = slugMapMatch[1];
  const entryRe = /(\w+):\s*'([^']+)'/g;
  let m;
  while ((m = entryRe.exec(body))) SLUG_TO_CODE[m[1]] = m[2];
}
const CODE_TO_SLUG = Object.fromEntries(
  Object.entries(SLUG_TO_CODE).map(([slug, code]) => [code, slug])
);

const call = async (params) => {
  const { data } = await axios.get(BASE_URL, {
    params: { api_key: API_KEY, ...params },
    timeout: 30000,
  });
  return data;
};

const slugify = (name) =>
  String(name).toLowerCase()
    .replace(/[^\w]+/g, '')
    .replace(/^_+|_+$/g, '');

async function run() {
  if (!API_KEY) {
    console.error('GRIZZLYSMS_API_KEY missing from env');
    process.exit(1);
  }

  // ── Step 1: getServicesList — code → human name ───────────────────────────
  console.log('Calling getServicesList...\n');
  let serviceList = [];
  try {
    const data = await call({ action: 'getServicesList' });
    if (Array.isArray(data)) serviceList = data;
    else if (data && typeof data === 'object') {
      // Some implementations return { code: name } or { services: [...] }
      if (Array.isArray(data.services)) serviceList = data.services;
      else serviceList = Object.entries(data).map(([code, name]) => ({ code, name }));
    }
  } catch (err) {
    console.error(`  getServicesList failed: ${err.message}`);
  }
  console.log(`  ${serviceList.length} services in catalog\n`);

  const codeToName = {};
  for (const entry of serviceList) {
    const code = entry.code || entry.id || entry.service;
    const name = entry.name || entry.title || entry.label;
    if (code) codeToName[code] = name || code;
  }

  // ── Step 2: getPrices (no params) — code → inventory across countries ────
  console.log('Calling getPrices (no params) — fetching full inventory...\n');
  let priceData;
  try {
    priceData = await call({ action: 'getPrices' });
  } catch (err) {
    console.error(`  getPrices failed: ${err.message}`);
    priceData = {};
  }

  // Shape: { [countryId]: { [code]: { [priceStr]: count } } }
  const codeStats = {}; // code → { countries: Set, totalCount }
  if (priceData && typeof priceData === 'object') {
    for (const [, services] of Object.entries(priceData)) {
      if (!services || typeof services !== 'object') continue;
      for (const [code, prices] of Object.entries(services)) {
        if (!prices || typeof prices !== 'object') continue;
        let countryCount = 0;
        for (const [, cnt] of Object.entries(prices)) {
          countryCount += Number(cnt) || 0;
        }
        if (countryCount > 0) {
          if (!codeStats[code]) codeStats[code] = { countries: 0, totalCount: 0 };
          codeStats[code].countries++;
          codeStats[code].totalCount += countryCount;
        }
      }
    }
  }
  const codesWithInventory = Object.keys(codeStats).sort();
  console.log(`  ${codesWithInventory.length} unique codes have live inventory\n`);

  // ── Step 3: Cross-reference ───────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CODES WITH INVENTORY WE DO NOT YET MAP (candidates to add)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  const candidates = codesWithInventory.filter((c) => !CODE_TO_SLUG[c]);
  if (candidates.length === 0) {
    console.log('  (none — we already map every code GrizzlySMS has inventory for)\n');
  } else {
    candidates
      .sort((a, b) => codeStats[b].countries - codeStats[a].countries)
      .slice(0, 50)
      .forEach((code) => {
        const name = codeToName[code] || '(unknown)';
        const stats = codeStats[code];
        const slug = slugify(name) || code;
        console.log(`  ${code.padEnd(6)} → ${slug.padEnd(20)} (${name.padEnd(25)}) ${stats.countries} countries, ${stats.totalCount} numbers`);
      });
    if (candidates.length > 50) {
      console.log(`  ... and ${candidates.length - 50} more`);
    }
    console.log('\nSuggested SLUG_TO_CODE entries to add (top 50 by coverage):\n');
    candidates
      .sort((a, b) => codeStats[b].countries - codeStats[a].countries)
      .slice(0, 50)
      .forEach((code) => {
        const name = codeToName[code] || code;
        const slug = slugify(name) || code;
        console.log(`  ${slug}: '${code}',  // ${name} — ${codeStats[code].countries} countries`);
      });
    console.log();
  }

  // ── Step 4: Codes we map but GrizzlySMS shows no inventory ───────────────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CODES WE MAP BUT GRIZZLYSMS HAS NO INVENTORY FOR (dead)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  const dead = Object.entries(CODE_TO_SLUG).filter(([code]) => !codeStats[code]);
  if (dead.length === 0) {
    console.log('  (none — every mapped code has at least some inventory)\n');
  } else {
    dead.forEach(([code, slug]) => {
      const name = codeToName[code] || '(not in getServicesList)';
      console.log(`  ${slug.padEnd(20)} → '${code}'  (${name})`);
    });
    console.log();
  }

  // ── Step 5: Diagnose the 6 zero-coverage codes from last sync ────────────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DIAGNOSING LAST SYNC\'S 6 ZERO-COVERAGE CODES');
  console.log('═══════════════════════════════════════════════════════════════\n');
  const probes = [
    ['vk', 'vk'], ['okru', 'ok'], ['yandex', 'ya'],
    ['pinterest', 'pn'], ['avito', 'av'], ['yahoo', 'yh'],
  ];
  for (const [slug, code] of probes) {
    const inServiceList = codeToName[code] ? `yes (\"${codeToName[code]}\")` : 'NO';
    const inventory = codeStats[code]
      ? `${codeStats[code].countries} countries`
      : 'NO inventory';
    console.log(`  ${slug.padEnd(12)} (${code}):  in getServicesList=${inServiceList.padEnd(20)}  inventory=${inventory}`);

    // If this code isn't in the catalog, look for similar candidate codes
    if (!codeToName[code]) {
      const guesses = Object.entries(codeToName)
        .filter(([, n]) => n && n.toLowerCase().includes(slug.replace(/_|ru/g, '')))
        .slice(0, 3);
      if (guesses.length) {
        guesses.forEach(([gc, gn]) => {
          const inv = codeStats[gc] ? `${codeStats[gc].countries}c` : 'no inv';
          console.log(`      ↳ maybe '${gc}' = "${gn}" (${inv})`);
        });
      }
    }
  }
  console.log();
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
