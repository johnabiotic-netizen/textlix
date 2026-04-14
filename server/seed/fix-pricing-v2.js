/**
 * fix-pricing-v2.js
 *
 * Uses /v1/guest/products/{country}/any — the SAME endpoint the order controller
 * queries at order time — so displayed prices match what users are actually charged.
 *
 * Previous fix-pricing.js used guest/prices (historical minimums across all operators)
 * which grossly underestimated real costs (e.g. UK WhatsApp showed $0.30 but cost $1.80).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const https = require('https');
const mongoose = require('mongoose');
const Country = require('../src/models/Country');
const Service = require('../src/models/Service');
const NumberPricing = require('../src/models/NumberPricing');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/verifynow';
const MARGIN = 0.60;
const API_KEY = (process.env.FIVESIM_API_KEY || '').trim();

// ISO code → 5sim country slug (must match what buyNumber uses in number.controller.js)
const codeToSlug = {
  US:'usa', GB:'england', IN:'india', NG:'nigeria', RU:'russia',
  BR:'brazil', DE:'germany', FR:'france', CA:'canada', AU:'australia',
  ID:'indonesia', PH:'philippines', VN:'vietnam', MX:'mexico',
  PK:'pakistan', BD:'bangladesh', KE:'kenya', GH:'ghana',
  ZA:'southafrica', UA:'ukraine',
  ES:'spain', IT:'italy', NL:'netherlands', PL:'poland', SE:'sweden',
  NO:'norway', DK:'denmark', FI:'finland', PT:'portugal', BE:'belgium',
  AT:'austria', CH:'switzerland', GR:'greece', RO:'romania', CZ:'czech',
  HU:'hungary', SK:'slovakia', HR:'croatia', BG:'bulgaria', RS:'serbia',
  IE:'ireland', LT:'lithuania', LV:'latvia', EE:'estonia', MD:'moldova',
  BY:'belarus', AL:'albania', MK:'northmacedonia', BA:'bih', ME:'montenegro',
  SI:'slovenia', CY:'cyprus', LU:'luxembourg',
  SA:'saudiarabia', EG:'egypt', MA:'morocco', TN:'tunisia', DZ:'algeria',
  IL:'israel', JO:'jordan', KW:'kuwait', OM:'oman', BH:'bahrain',
  TH:'thailand', MY:'malaysia', TW:'taiwan', HK:'hongkong', KH:'cambodia',
  LA:'laos', LK:'srilanka', NP:'nepal', MN:'mongolia',
  KZ:'kazakhstan', UZ:'uzbekistan', AZ:'azerbaijan', GE:'georgia',
  AM:'armenia', KG:'kyrgyzstan', TJ:'tajikistan', TM:'turkmenistan',
  AR:'argentina', CO:'colombia', CL:'chile', PE:'peru', VE:'venezuela',
  EC:'ecuador', BO:'bolivia', PY:'paraguay', UY:'uruguay', GT:'guatemala',
  CR:'costarica', PA:'panama', DO:'dominicana', HN:'honduras', SV:'salvador',
  NI:'nicaragua', PR:'puertorico', JM:'jamaica', HT:'haiti', GY:'guyana',
  BB:'barbados', TT:'trinidad',
  ET:'ethiopia', TZ:'tanzania', UG:'uganda', CM:'cameroon', CI:'ivorycoast',
  SN:'senegal', RW:'rwanda', MZ:'mozambique', ZM:'zambia', MW:'malawi',
  NA:'namibia', BW:'botswana', MG:'madagascar', SL:'sierraleone', LR:'liberia',
  GN:'guinea', BJ:'benin', TG:'togo', BF:'burkinafaso', TD:'chad',
  AO:'angola', GA:'gabon', CG:'congo', BI:'burundi', DJ:'djibouti',
  GM:'gambia', GW:'guineabissau', CV:'capeverde', MR:'mauritania',
  MU:'mauritius', SC:'seychelles', KM:'comoros', LS:'lesotho', GQ:'equatorialguinea',
  LY:'libya', MV:'maldives', TL:'easttimor', PG:'papuanewguinea',
};

function fetchProducts(slug5sim) {
  return new Promise((resolve) => {
    const options = {
      hostname: '5sim.net',
      path: `/v1/guest/products/${slug5sim}/any`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
      },
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve({}); }
      });
    });
    req.on('error', () => resolve({}));
    req.end();
  });
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'verifynow' });
  console.log('Connected!\n');

  const countries = await Country.find({});
  const services  = await Service.find({});
  const countryByCode = {};
  countries.forEach(c => countryByCode[c.code] = c);
  const serviceBySlug = {};
  services.forEach(s => serviceBySlug[s.slug] = s);

  console.log(`Fetching real-time prices for ${countries.length} countries via getProducts API...\n`);

  let updated = 0, disabled = 0, skipped = 0;
  const sample = {}; // collect a few for display

  for (const country of countries) {
    const slug5sim = codeToSlug[country.code];
    if (!slug5sim) {
      process.stdout.write(`  ${country.code}: no 5sim slug — skip\n`);
      skipped++;
      continue;
    }

    process.stdout.write(`  ${country.code} (${slug5sim})... `);
    const products = await fetchProducts(slug5sim);
    await new Promise(r => setTimeout(r, 200)); // rate limit

    let found = 0;
    for (const svc of services) {
      const product = products[svc.slug];

      if (!product || !product.Price || product.Price <= 0 || product.Qty === 0) {
        // Not available — mark as unavailable in DB
        await NumberPricing.findOneAndUpdate(
          { countryId: country._id, serviceId: svc._id },
          { isAvailable: false },
          { upsert: false }
        );
        disabled++;
        continue;
      }

      const providerCost = Math.ceil(product.Price * 100);
      const finalPrice   = Math.ceil(providerCost * (1 + MARGIN));

      await NumberPricing.findOneAndUpdate(
        { countryId: country._id, serviceId: svc._id },
        { countryId: country._id, serviceId: svc._id, providerCost, marginPercent: 60, finalPrice, isAvailable: true },
        { upsert: true, new: true }
      );
      updated++;
      found++;

      // Save a sample for the summary
      if (!sample[country.code] && svc.slug === 'whatsapp') {
        sample[country.code] = { providerCost, finalPrice };
      }
    }

    console.log(`${found}/${services.length} services`);
  }

  console.log('\n✅ Pricing update complete!');
  console.log(`   ${updated} entries updated with real getProducts prices`);
  console.log(`   ${disabled} entries marked unavailable`);
  console.log(`   ${skipped} countries skipped (no 5sim slug)\n`);

  // Show WhatsApp sample
  const show = ['NG','IN','US','GB','BR','DE','CA','AU'];
  console.log('WhatsApp prices after update:');
  for (const code of show) {
    const s = sample[code];
    if (!s) continue;
    const { providerCost, finalPrice } = s;
    const profit = finalPrice - providerCost;
    console.log(`  ${code}: cost=${providerCost}cr ($${(providerCost/100).toFixed(2)}) → charge=${finalPrice}cr ($${(finalPrice/100).toFixed(2)}) → profit=${profit}cr ($${(profit/100).toFixed(2)})`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
