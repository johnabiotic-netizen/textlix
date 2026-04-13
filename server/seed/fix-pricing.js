/**
 * CRITICAL FIX: Update all NumberPricing with real 5sim costs + proper margin
 *
 * Problem: Seed used placeholder providerCosts that were 3-10x too low.
 * Fix: Use actual 5sim API prices as providerCost, apply 60% margin.
 *
 * Result example (WhatsApp):
 *   Nigeria: cost=$0.277 → charge $0.45 (was $0.11 — was losing $0.167/order)
 *   India:   cost=$0.641 → charge $1.03 (was $0.07 — was losing $0.571/order)
 *   USA:     cost=$0.897 → charge $1.44 (was $0.20 — was losing $0.697/order)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const https = require('https');
const mongoose = require('mongoose');
const Country = require('../src/models/Country');
const Service = require('../src/models/Service');
const NumberPricing = require('../src/models/NumberPricing');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/verifynow';
const MARGIN = 0.60; // 60% margin — competitive with market, clearly profitable

// 5sim country name → ISO code mapping
const fivesimToCode = {
  nigeria:'NG', india:'IN', usa:'US', england:'GB', brazil:'BR',
  indonesia:'ID', philippines:'PH', vietnam:'VN', mexico:'MX',
  pakistan:'PK', bangladesh:'BD', kenya:'KE', ghana:'GH',
  southafrica:'ZA', ukraine:'UA', russia:'RU', germany:'DE',
  france:'FR', canada:'CA', australia:'AU', spain:'ES', italy:'IT',
  netherlands:'NL', poland:'PL', sweden:'SE', norway:'NO', denmark:'DK',
  finland:'FI', portugal:'PT', belgium:'BE', austria:'AT', greece:'GR',
  romania:'RO', czech:'CZ', hungary:'HU', slovakia:'SK', croatia:'HR',
  bulgaria:'BG', serbia:'RS', ireland:'IE', lithuania:'LT', latvia:'LV',
  estonia:'EE', moldova:'MD', albania:'AL', northmacedonia:'MK',
  bih:'BA', montenegro:'ME', slovenia:'SI', cyprus:'CY', luxembourg:'LU',
  saudiarabia:'SA', egypt:'EG', morocco:'MA', tunisia:'TN', algeria:'DZ',
  israel:'IL', jordan:'JO', kuwait:'KW', oman:'OM', bahrain:'BH',
  thailand:'TH', malaysia:'MY', taiwan:'TW', hongkong:'HK', cambodia:'KH',
  laos:'LA', srilanka:'LK', nepal:'NP', mongolia:'MN',
  kazakhstan:'KZ', uzbekistan:'UZ', azerbaijan:'AZ', georgia:'GE',
  armenia:'AM', kyrgyzstan:'KG', tajikistan:'TJ', turkmenistan:'TM',
  argentina:'AR', colombia:'CO', chile:'CL', peru:'PE', venezuela:'VE',
  ecuador:'EC', bolivia:'BO', paraguay:'PY', uruguay:'UY', guatemala:'GT',
  costarica:'CR', panama:'PA', dominicana:'DO', honduras:'HN',
  salvador:'SV', nicaragua:'NI', puertorico:'PR', jamaica:'JM',
  haiti:'HT', guyana:'GY', barbados:'BB',
  ethiopia:'ET', tanzania:'TZ', uganda:'UG', cameroon:'CM', ivorycoast:'CI',
  senegal:'SN', rwanda:'RW', mozambique:'MZ', zambia:'ZM', malawi:'MW',
  namibia:'NA', botswana:'BW', madagascar:'MG', sierraleone:'SL',
  liberia:'LR', guinea:'GN', benin:'BJ', togo:'TG', burkinafaso:'BF',
  chad:'TD', angola:'AO', gabon:'GA', congo:'CG', burundi:'BI',
  djibouti:'DJ', gambia:'GM', guineabissau:'GW', capeverde:'CV',
  mauritania:'MR', mauritius:'MU', seychelles:'SC', comoros:'KM',
  lesotho:'LS', equatorialguinea:'GQ',
};

function fetchPrices(slug) {
  return new Promise((resolve) => {
    https.get(`https://5sim.net/v1/guest/prices?product=${slug}`, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve({}); }
      });
    }).on('error', () => resolve({}));
  });
}

const SERVICES = [
  'whatsapp','telegram','google','facebook','instagram','twitter','tiktok',
  'snapchat','linkedin','discord','uber','amazon','netflix','apple',
  'microsoft','steam','tinder','airbnb','yahoo','viber','wechat','line',
  'twitch','ebay','blizzard','shopee','lazada','paypal','truecaller','signal',
  'fiverr','shopify','alibaba','aliexpress','bolt','grindr','protonmail',
  'zoho','tradingview','happn','pof','hily','skout','cupid','grabtaxi',
  'gojek','didi','deliveroo','foodpanda','wolt','dominospizza','mcdonalds',
  'vinted','poshmark','olx','carousell','craigslist','kakaotalk','zalo',
  'weibo','baidu','iqiyi','tencentqq','naver','kwai','faceit','paxful',
  'ticketmaster','clubhouse','nike',
];

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'verifynow' });
  console.log('Connected!\n');

  // Step 1: Fetch all real prices from 5sim
  console.log('Fetching real 5sim prices for all services...');
  const realPrices = {}; // { countryCode: { slug: usdPrice } }

  for (const slug of SERVICES) {
    process.stdout.write(`  Fetching ${slug}...`);
    const data = await fetchPrices(slug);
    const svcData = data[slug] || {};

    for (const [country5sim, code] of Object.entries(fivesimToCode)) {
      const ops = svcData[country5sim];
      if (!ops) continue;
      const prices = Object.values(ops).map(o => o.cost).filter(v => v > 0);
      if (!prices.length) continue;
      const minPrice = Math.min(...prices);
      if (!realPrices[code]) realPrices[code] = {};
      realPrices[code][slug] = minPrice;
    }

    console.log(' done');
    await new Promise(r => setTimeout(r, 150)); // rate limit
  }

  // Step 2: Get all countries and services from DB
  const countries = await Country.find({});
  const services = await Service.find({});
  const countryByCode = {};
  countries.forEach(c => countryByCode[c.code] = c);
  const serviceBySlug = {};
  services.forEach(s => serviceBySlug[s.slug] = s);

  // Step 3: Update all pricing
  console.log('\nUpdating pricing in database...');
  let updated = 0, noData = 0, disabled = 0;

  for (const code of Object.keys(countryByCode)) {
    const country = countryByCode[code];
    for (const svc of services) {
      const realCostUSD = realPrices[code]?.[svc.slug];

      if (!realCostUSD) {
        // No real price data — mark as unavailable
        await NumberPricing.findOneAndUpdate(
          { countryId: country._id, serviceId: svc._id },
          { isAvailable: false },
          { upsert: false }
        );
        disabled++;
        continue;
      }

      // Convert USD to credits (1 credit = $0.01), round up
      const providerCost = Math.ceil(realCostUSD * 100);
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
      updated++;
    }
  }

  // Step 4: Show summary
  console.log('\n✅ Pricing update complete!');
  console.log(`   ${updated} entries updated with real prices`);
  console.log(`   ${disabled} entries marked unavailable (no 5sim stock)`);
  console.log(`   Margin applied: ${Math.round(MARGIN * 100)}%\n`);

  // Show sample of new prices
  console.log('Sample new prices (WhatsApp):');
  const sampleCountries = ['NG','IN','US','GB','BR','ID','GH','KE'];
  for (const code of sampleCountries) {
    const rp = realPrices[code]?.whatsapp;
    if (!rp) continue;
    const cost = Math.ceil(rp * 100);
    const charge = Math.ceil(cost * (1 + MARGIN));
    const profit = charge - cost;
    console.log(`   ${code}: cost=${cost}cr ($${(cost/100).toFixed(2)}) → charge=${charge}cr ($${(charge/100).toFixed(2)}) → profit=${profit}cr ($${(profit/100).toFixed(2)})`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
