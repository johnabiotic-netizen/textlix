/**
 * sync-from-5sim.js — THE definitive seed / sync script
 *
 * Replaces add-countries.js, add-services.js, fix-pricing.js, fix-pricing-v2.js
 *
 * What it does:
 *   1. Calls 5sim /guest/countries  → discovers all countries 5sim supports
 *   2. Calls 5sim /guest/products/{country}/any for each country → discovers all
 *      services and their REAL current prices (same API the order controller uses)
 *   3. Upserts Country, Service, NumberPricing records in MongoDB
 *   4. Stores fivesimSlug on each Country so the controller never needs a hardcoded map
 *
 * Run via Railway pre-deploy:
 *   node server/seed/sync-from-5sim.js
 *
 * Safe to re-run — all operations are upserts.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const https  = require('https');
const mongoose = require('mongoose');
const Country      = require('../src/models/Country');
const Service      = require('../src/models/Service');
const NumberPricing = require('../src/models/NumberPricing');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/verifynow';
const API_KEY     = (process.env.FIVESIM_API_KEY || '').trim();
const MARGIN      = 0.60;

// ─── Prettier service names ───────────────────────────────────────────────────
const SERVICE_NAMES = {
  whatsapp:'WhatsApp', telegram:'Telegram', google:'Google', facebook:'Facebook',
  instagram:'Instagram', twitter:'Twitter/X', tiktok:'TikTok', snapchat:'Snapchat',
  linkedin:'LinkedIn', discord:'Discord', uber:'Uber', amazon:'Amazon',
  netflix:'Netflix', apple:'Apple', microsoft:'Microsoft', steam:'Steam',
  tinder:'Tinder', airbnb:'Airbnb', yahoo:'Yahoo', viber:'Viber',
  wechat:'WeChat', line:'LINE', twitch:'Twitch', ebay:'eBay',
  blizzard:'Blizzard', shopee:'Shopee', lazada:'Lazada', paypal:'PayPal',
  truecaller:'Truecaller', signal:'Signal', fiverr:'Fiverr', shopify:'Shopify',
  blablacar:'BlaBlaCar', alibaba:'Alibaba', aliexpress:'AliExpress',
  bolt:'Bolt', grindr:'Grindr', protonmail:'Proton Mail', zoho:'Zoho',
  tradingview:'TradingView', happn:'Happn', pof:'Plenty of Fish', hily:'Hily',
  skout:'Skout', cupid:'Cupid', grabtaxi:'Grab', gojek:'Gojek', didi:'DiDi',
  deliveroo:'Deliveroo', foodpanda:'Foodpanda', wolt:'Wolt',
  dominospizza:"Domino's Pizza", mcdonalds:"McDonald's",
  vinted:'Vinted', poshmark:'Poshmark', olx:'OLX', carousell:'Carousell',
  craigslist:'Craigslist', kakaotalk:'KakaoTalk', zalo:'Zalo',
  weibo:'Weibo', baidu:'Baidu', iqiyi:'iQIYI', tencentqq:'Tencent QQ',
  naver:'Naver', kwai:'Kwai', faceit:'FACEIT', paxful:'Paxful',
  ticketmaster:'Ticketmaster', clubhouse:'Clubhouse', nike:'Nike',
  upwork:'Upwork', bumble:'Bumble', badoo:'Badoo', meetup:'Meetup',
  imessage:'iMessage', skype:'Skype', microsoftteams:'Microsoft Teams',
  zoom:'Zoom', gmail:'Gmail', outlook:'Outlook', mailru:'Mail.ru',
  yandex:'Yandex', vk:'VK', ok:'OK.ru', avito:'Avito',
  wildberries:'Wildberries', ozon:'Ozon', kaspi:'Kaspi',
  grab:'Grab', lyft:'Lyft', postmates:'Postmates',
  doordash:'DoorDash', ubereats:'Uber Eats',
  binance:'Binance', coinbase:'Coinbase', bybit:'Bybit', okx:'OKX',
  crypto:'Crypto.com', kraken:'Kraken',
  revolut:'Revolut', wise:'Wise', cashapp:'Cash App', venmo:'Venmo',
  stripe:'Stripe', square:'Square',
  booking:'Booking.com', expedia:'Expedia', tripadvisor:'TripAdvisor',
  agoda:'Agoda', vrbo:'VRBO',
  hinge:'Hinge', okcupid:'OkCupid', match:'Match.com', eharmony:'eHarmony',
  spotify:'Spotify', applemusic:'Apple Music', youtubemusic:'YouTube Music',
  deezer:'Deezer', soundcloud:'SoundCloud',
  youtube:'YouTube', twitch2:'Twitch', vimeo:'Vimeo',
  roblox:'Roblox', epicgames:'Epic Games', ea:'EA', riot:'Riot Games',
  playstation:'PlayStation', xbox:'Xbox', nintendo:'Nintendo',
  wordpress:'WordPress', wix:'Wix', squarespace:'Squarespace',
  godaddy:'GoDaddy', namecheap:'Namecheap',
  etsy:'Etsy', walmart:'Walmart', target:'Target', bestbuy:'Best Buy',
  wayfair:'Wayfair', chewy:'Chewy',
  linkedin2:'LinkedIn', glassdoor:'Glassdoor', indeed:'Indeed',
  angellist:'AngelList', toptal:'Toptal',
  dropbox:'Dropbox', box:'Box', onedrive:'OneDrive', googledrive:'Google Drive',
  notion:'Notion', airtable:'Airtable', monday:'Monday.com',
  hubspot:'HubSpot', salesforce:'Salesforce', mailchimp:'Mailchimp',
  twilio:'Twilio', sendgrid:'SendGrid',
  reddit:'Reddit', pinterest:'Pinterest', tumblr:'Tumblr',
  quora:'Quora', medium:'Medium', substack:'Substack',
};

function prettifyName(slug) {
  if (SERVICE_NAMES[slug]) return SERVICE_NAMES[slug];
  // Fall back: title-case with spaces
  return slug.replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── ISO 3166-1 numeric → alpha-2 (5sim returns numeric codes) ───────────────
const ISO_NUMERIC = {
  4:'AF',8:'AL',12:'DZ',24:'AO',32:'AR',36:'AU',40:'AT',31:'AZ',50:'BD',
  56:'BE',204:'BJ',68:'BO',70:'BA',72:'BW',76:'BR',100:'BG',854:'BF',
  108:'BI',116:'KH',120:'CM',124:'CA',132:'CV',144:'LK',152:'CL',170:'CO',
  174:'KM',178:'CG',191:'HR',196:'CY',203:'CZ',208:'DK',262:'DJ',214:'DO',
  218:'EC',818:'EG',222:'SV',231:'ET',233:'EE',246:'FI',250:'FR',266:'GA',
  276:'DE',288:'GH',300:'GR',320:'GT',324:'GN',624:'GW',328:'GY',332:'HT',
  340:'HN',348:'HU',356:'IN',360:'ID',372:'IE',376:'IL',380:'IT',388:'JM',
  400:'JO',398:'KZ',404:'KE',417:'KG',418:'LA',426:'LS',430:'LR',434:'LY',
  440:'LT',442:'LU',428:'LV',450:'MG',454:'MW',458:'MY',466:'ML',478:'MR',
  480:'MU',484:'MX',496:'MN',504:'MA',508:'MZ',516:'NA',524:'NP',528:'NL',
  558:'NI',562:'NE',566:'NG',578:'NO',512:'OM',586:'PK',591:'PA',604:'PE',
  608:'PH',616:'PL',620:'PT',600:'PY',630:'PR',642:'RO',646:'RW',682:'SA',
  686:'SN',694:'SL',724:'ES',752:'SE',756:'CH',762:'TJ',764:'TH',768:'TG',
  795:'TM',788:'TN',780:'TT',158:'TW',834:'TZ',804:'UA',800:'UG',840:'US',
  858:'UY',860:'UZ',862:'VE',704:'VN',710:'ZA',894:'ZM',826:'GB',643:'RU',
  191:'HR',52:'BB',48:'BH',112:'BY',8:'AL',807:'MK',70:'BA',499:'ME',
  705:'SI',196:'CY',442:'LU',818:'EG',504:'MA',788:'TN',12:'DZ',376:'IL',
  400:'JO',414:'KW',512:'OM',48:'BH',764:'TH',458:'MY',158:'TW',344:'HK',
  116:'KH',418:'LA',144:'LK',524:'NP',496:'MN',398:'KZ',860:'UZ',31:'AZ',
  268:'GE',51:'AM',417:'KG',762:'TJ',795:'TM',32:'AR',170:'CO',152:'CL',
  604:'PE',862:'VE',218:'EC',68:'BO',600:'PY',858:'UY',320:'GT',188:'CR',
  591:'PA',214:'DO',340:'HN',222:'SV',558:'NI',630:'PR',231:'ET',834:'TZ',
  800:'UG',120:'CM',384:'CI',686:'SN',646:'RW',508:'MZ',894:'ZM',454:'MW',
  516:'NA',72:'BW',450:'MG',694:'SL',430:'LR',324:'GN',204:'BJ',768:'TG',
  854:'BF',466:'ML',562:'NE',148:'TD',24:'AO',266:'GA',178:'CG',180:'CD',
  108:'BI',262:'DJ',270:'GM',624:'GW',132:'CV',478:'MR',480:'MU',690:'SC',
  174:'KM',426:'LS',226:'GQ',388:'JM',332:'HT',328:'GY',52:'BB',780:'TT',
  462:'MV',626:'TL',598:'PG',414:'KW',422:'LB',760:'SY',887:'YE',4:'AF',
  50:'BD',156:'CN',392:'JP',410:'KR',792:'TR',818:'EG',710:'ZA',288:'GH',
};

// ─── Flag emoji from 2-letter ISO code ───────────────────────────────────────
function flagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return '🌐';
  return [...iso2.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function get(path, auth = false) {
  return new Promise((resolve) => {
    const options = {
      hostname: '5sim.net',
      path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(auth ? { 'Authorization': `Bearer ${API_KEY}` } : {}),
      },
      timeout: 20000,
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve({}); }
      });
    });
    req.on('error', () => resolve({}));
    req.on('timeout', () => { req.destroy(); resolve({}); });
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'verifynow' });
  console.log('Connected!\n');

  // ── Step 1: Fetch all countries from 5sim ─────────────────────────────────
  console.log('Fetching countries from 5sim...');
  const countriesRaw = await get('/v1/guest/countries');
  const countryEntries = Object.entries(countriesRaw);
  console.log(`  5sim has ${countryEntries.length} countries\n`);

  if (countryEntries.length === 0) {
    console.error('ERROR: Got 0 countries from 5sim — check API key or network');
    process.exit(1);
  }

  // Build country lookup: isoUpper → { fivesimSlug, name, flag }
  const fivesimCountries = {}; // iso2Upper → { slug, name }
  for (const [slug, info] of countryEntries) {
    // 5sim returns numeric ISO codes (e.g. 840 for US) — convert via lookup table
    let iso2 = '';
    if (typeof info.iso === 'string' && info.iso.length === 2) {
      iso2 = info.iso.toUpperCase();
    } else if (info.iso) {
      iso2 = ISO_NUMERIC[String(info.iso)] || '';
    }
    if (!iso2) continue;
    fivesimCountries[iso2] = {
      slug,
      name: info.text_en || prettifyName(slug),
      flag: flagEmoji(iso2),
    };
  }

  // ── Step 2: Upsert countries in DB ────────────────────────────────────────
  console.log(`Upserting ${Object.keys(fivesimCountries).length} countries in DB...`);
  const countryDocs = {};
  let sortOrder = 1;

  // Popular countries first
  const popularFirst = ['US','GB','IN','NG','BR','DE','FR','CA','AU','ID','PH','VN','MX','PK','BD','KE','GH','ZA','UA','RU'];
  const allIsoCodes = [...new Set([...popularFirst, ...Object.keys(fivesimCountries)])];

  for (const iso2 of allIsoCodes) {
    const info = fivesimCountries[iso2];
    if (!info) continue;
    const doc = await Country.findOneAndUpdate(
      { code: iso2 },
      { name: info.name, code: iso2, flagEmoji: info.flag, fivesimSlug: info.slug, isEnabled: true, sortOrder: sortOrder++ },
      { upsert: true, new: true }
    );
    countryDocs[iso2] = doc;
  }
  console.log(`  ✓ ${Object.keys(countryDocs).length} countries upserted\n`);

  // ── Step 3: Fetch products per country, collect all services + prices ──────
  console.log('Fetching products per country (this takes ~2 minutes)...\n');

  const serviceSlugs = new Set();
  // realPrices[iso2][slug] = USD price
  const realPrices = {};
  const countryCodes = Object.keys(countryDocs);

  let done = 0;
  for (const iso2 of countryCodes) {
    const info = fivesimCountries[iso2];
    if (!info) continue;

    process.stdout.write(`  [${++done}/${countryCodes.length}] ${iso2} (${info.slug})... `);
    const products = await get(`/v1/guest/products/${info.slug}/any`, true);
    await sleep(250);

    const entries = Object.entries(products);
    let found = 0;
    realPrices[iso2] = {};

    for (const [slug, data] of entries) {
      if (!data || !data.Price || data.Price <= 0) continue;
      serviceSlugs.add(slug);
      realPrices[iso2][slug] = data.Price;
      found++;
    }
    console.log(`${found} services`);
  }

  console.log(`\n  Total unique services discovered: ${serviceSlugs.size}\n`);

  // ── Step 4: Upsert services in DB ─────────────────────────────────────────
  console.log('Upserting services...');

  // Priority order for well-known services
  const priorityOrder = [
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

  const orderedSlugs = [...new Set([...priorityOrder, ...serviceSlugs])];
  const serviceDocs = {};

  for (let i = 0; i < orderedSlugs.length; i++) {
    const slug = orderedSlugs[i];
    if (!serviceSlugs.has(slug)) continue; // skip priority slugs not seen in API
    const doc = await Service.findOneAndUpdate(
      { slug },
      { name: prettifyName(slug), slug, icon: slug, isEnabled: true, sortOrder: i + 1 },
      { upsert: true, new: true }
    );
    serviceDocs[slug] = doc;
  }
  console.log(`  ✓ ${Object.keys(serviceDocs).length} services upserted\n`);

  // ── Step 5: Upsert pricing ─────────────────────────────────────────────────
  console.log('Updating pricing in DB...');
  let updated = 0, disabled = 0;

  for (const iso2 of Object.keys(countryDocs)) {
    const country = countryDocs[iso2];
    const countryPrices = realPrices[iso2] || {};

    for (const [slug, svc] of Object.entries(serviceDocs)) {
      const usdPrice = countryPrices[slug];

      if (!usdPrice || usdPrice <= 0) {
        await NumberPricing.findOneAndUpdate(
          { countryId: country._id, serviceId: svc._id },
          { isAvailable: false },
          { upsert: false }
        );
        disabled++;
        continue;
      }

      const providerCost = Math.ceil(usdPrice * 100);
      const finalPrice   = Math.ceil(providerCost * (1 + MARGIN));

      await NumberPricing.findOneAndUpdate(
        { countryId: country._id, serviceId: svc._id },
        { countryId: country._id, serviceId: svc._id, providerCost, marginPercent: 60, finalPrice, isAvailable: true },
        { upsert: true, new: true }
      );
      updated++;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✅ Sync complete!');
  console.log(`   Countries: ${Object.keys(countryDocs).length}`);
  console.log(`   Services:  ${Object.keys(serviceDocs).length}`);
  console.log(`   Pricing:   ${updated} available, ${disabled} unavailable`);
  console.log(`   Margin:    ${Math.round(MARGIN * 100)}%\n`);

  const sampleCountries = ['NG','IN','US','GB','BR','DE'];
  console.log('Sample WhatsApp prices:');
  for (const iso2 of sampleCountries) {
    const p = realPrices[iso2]?.whatsapp;
    if (!p) continue;
    const cost = Math.ceil(p * 100);
    const charge = Math.ceil(cost * (1 + MARGIN));
    console.log(`  ${iso2}: $${p.toFixed(4)} → ${cost}cr cost → ${charge}cr charge ($${(charge/100).toFixed(2)})`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
