/**
 * sync-from-all-providers.js
 *
 * Adds services + per-country pricing for the slugs that exist on GrizzlySMS
 * (and optionally GetSMSOTP) but NOT on 5sim — so the catalog isn't capped
 * by what 5sim alone happens to sell.
 *
 * What it does NOT do: it does not run the 5sim sync. Run
 * `sync-from-5sim.js` first to keep the 5sim-sourced catalog fresh, then run
 * this script to layer the multi-provider additions on top.
 *
 * Strict invariants:
 *   - Never sets isAvailable: false on an existing NumberPricing row.
 *   - Never overwrites finalPrice/providerCost on a row that already has
 *     isAvailable: true (the 5sim sync owns those — we only fill gaps).
 *   - Only creates Service docs for slugs in MULTI_PROVIDER_SLUGS — i.e.
 *     services we've explicitly mapped in grizzlysms.provider.js's
 *     SLUG_TO_CODE so orders can actually be fulfilled.
 *
 * Run on Railway:
 *   railway run node server/seed/sync-from-all-providers.js
 *
 * Re-runnable. Idempotent. Safe to schedule.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Country = require('../src/models/Country');
const Service = require('../src/models/Service');
const NumberPricing = require('../src/models/NumberPricing');
const grizzly = require('../src/providers/sms/grizzlysms.provider');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/verifynow';
const MARGIN = 0.60;

// Slugs we've explicitly added to grizzlysms.provider.js's SLUG_TO_CODE
// during the multi-provider expansion. The sync script only adds Services
// for these slugs — we avoid pulling in any code we haven't verified, so
// nothing in the catalog ever fails on order because of a missing map entry.
const MULTI_PROVIDER_SLUGS = {
  // Verified via discovery script (server/scripts/discover-grizzlysms-catalog.js).
  // Every entry here has live GrizzlySMS inventory in at least 1 country.
  payoneer:         { name: 'Payoneer',          icon: 'payoneer' },
  steam:            { name: 'Steam',             icon: 'steam' },
  reddit:           { name: 'Reddit',            icon: 'reddit' },
  yahoo:            { name: 'Yahoo',             icon: 'yahoo' },
  apple:            { name: 'Apple',             icon: 'apple' },
  nike:             { name: 'Nike',              icon: 'nike' },
  vinted:           { name: 'Vinted',            icon: 'vinted' },
  bumble:           { name: 'Bumble',            icon: 'bumble' },
  truecaller:       { name: 'Truecaller',        icon: 'truecaller' },
  foodpanda:        { name: 'Foodpanda',         icon: 'foodpanda' },
  deliveroo:        { name: 'Deliveroo',         icon: 'deliveroo' },
  olacabs:          { name: 'Ola Cabs',          icon: 'olacabs' },
  microsoftoutlook: { name: 'Microsoft Outlook', icon: 'microsoftoutlook' },
  paytm:            { name: 'Paytm',             icon: 'paytm' },
  ticketmaster:     { name: 'Ticketmaster',      icon: 'ticketmaster' },
  alipay:           { name: 'Alipay',            icon: 'alipay' },
  lazada:           { name: 'Lazada',            icon: 'lazada' },
  swiggy:           { name: 'Swiggy',            icon: 'swiggy' },
  bolt:             { name: 'Bolt',              icon: 'bolt' },
  didi:             { name: 'DiDi',              icon: 'didi' },
  taobao:           { name: 'Taobao',            icon: 'taobao' },
  noon:             { name: 'Noon',              icon: 'noon' },
  getir:            { name: 'Getir',             icon: 'getir' },
  okcupid:          { name: 'OkCupid',           icon: 'okcupid' },
  tantan:           { name: 'Tantan',            icon: 'tantan' },
  twilio:           { name: 'Twilio',            icon: 'twilio' },
  jiomart:          { name: 'JioMart',           icon: 'jiomart' },
  michat:           { name: 'MiChat',            icon: 'michat' },
  claude:           { name: 'Claude',            icon: 'claude' },
};
// NB: vk / okru / yandex / pinterest / avito are NOT in this list because
// the codes I picked for them turned out to be dead on GrizzlySMS (see
// discovery output). They remain in grizzlysms.provider.js's SLUG_TO_CODE
// as inert entries so we don't break anything that might reference them.

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'verifynow' });
  console.log('Connected!\n');

  // ── Step 1: Upsert Service rows for every multi-provider slug ─────────────
  console.log(`Upserting ${Object.keys(MULTI_PROVIDER_SLUGS).length} services...`);
  const existingMaxSort = await Service.findOne().sort({ sortOrder: -1 }).select('sortOrder');
  let sortOrder = (existingMaxSort?.sortOrder || 0) + 1;
  const serviceDocs = {};
  for (const [slug, meta] of Object.entries(MULTI_PROVIDER_SLUGS)) {
    const existing = await Service.findOne({ slug });
    if (existing) {
      // Don't clobber an existing service — just ensure it's enabled.
      if (!existing.isEnabled) {
        existing.isEnabled = true;
        await existing.save();
      }
      serviceDocs[slug] = existing;
      console.log(`  ✓ ${slug} (existing)`);
    } else {
      const doc = await Service.create({
        slug, name: meta.name, icon: meta.icon, isEnabled: true,
        sortOrder: sortOrder++,
      });
      serviceDocs[slug] = doc;
      console.log(`  + ${slug} (new)`);
    }
  }
  console.log();

  // ── Step 2: Get all enabled countries ─────────────────────────────────────
  const countries = await Country.find({ isEnabled: true });
  console.log(`Found ${countries.length} enabled countries.\n`);

  // ── Step 3: For each service, fetch live GrizzlySMS prices per country ───
  console.log('Fetching GrizzlySMS prices per service (this takes ~1 min)...\n');

  // grizzly.getOtpPrices(slug) returns { [grizzlyCountryId]: { cost, count } }
  // or null if unsupported / API error.
  const grizzlyPricesBySlug = {};
  for (const slug of Object.keys(MULTI_PROVIDER_SLUGS)) {
    try {
      const prices = await grizzly.getOtpPrices(slug);
      grizzlyPricesBySlug[slug] = prices || {};
      const countriesWithPrice = Object.keys(prices || {}).length;
      console.log(`  ${slug}: ${countriesWithPrice} countries with live pricing`);
    } catch (err) {
      console.log(`  ${slug}: FAILED — ${err.message}`);
      grizzlyPricesBySlug[slug] = {};
    }
  }
  console.log();

  // ── Step 4: Upsert NumberPricing rows where any provider has coverage ────
  console.log('Upserting NumberPricing (strictly additive — never disables)...\n');
  let created = 0;
  let skipped5sim = 0;
  let noProvider = 0;

  for (const country of countries) {
    for (const slug of Object.keys(MULTI_PROVIDER_SLUGS)) {
      const svc = serviceDocs[slug];
      const grizzlyPrices = grizzlyPricesBySlug[slug];

      // grizzly keys its prices by numeric country ID — reverse via the
      // provider's exported COUNTRY_ID_TO_ISO map
      let grizzlyUsdPrice = null;
      for (const [gzCountryId, data] of Object.entries(grizzlyPrices)) {
        if (grizzly.COUNTRY_ID_TO_ISO[gzCountryId] === country.code) {
          grizzlyUsdPrice = data.cost;
          break;
        }
      }

      const existing = await NumberPricing.findOne({
        countryId: country._id,
        serviceId: svc._id,
      });

      // Invariant: never touch a row that is already live.
      if (existing && existing.isAvailable) {
        skipped5sim++;
        continue;
      }

      if (!grizzlyUsdPrice || grizzlyUsdPrice <= 0) {
        noProvider++;
        continue;
      }

      const providerCost = Math.ceil(grizzlyUsdPrice * 100);
      const finalPrice = Math.ceil(providerCost * (1 + MARGIN));

      await NumberPricing.findOneAndUpdate(
        { countryId: country._id, serviceId: svc._id },
        {
          countryId: country._id,
          serviceId: svc._id,
          providerCost,
          marginPercent: Math.round(MARGIN * 100),
          finalPrice,
          isAvailable: true,
        },
        { upsert: true, new: true }
      );
      created++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅ Multi-provider sync complete!');
  console.log(`   New / updated rows:   ${created}`);
  console.log(`   Already live (kept):  ${skipped5sim}`);
  console.log(`   No provider coverage: ${noProvider}`);
  console.log(`   Margin:               ${Math.round(MARGIN * 100)}%\n`);

  console.log('Sample Payoneer prices:');
  const payoneerSvc = serviceDocs.payoneer;
  const samples = await NumberPricing.find({ serviceId: payoneerSvc._id, isAvailable: true })
    .populate('countryId', 'name code flagEmoji')
    .limit(8);
  for (const p of samples) {
    console.log(`  ${p.countryId.flagEmoji} ${p.countryId.name}: ${p.finalPrice}cr ($${(p.finalPrice/100).toFixed(2)})`);
  }
  if (samples.length === 0) {
    console.log('  (none — GrizzlySMS may not have Payoneer pricing right now)');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
