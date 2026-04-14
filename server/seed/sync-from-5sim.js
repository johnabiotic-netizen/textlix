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

// ─── 5sim slug → { code, name } ──────────────────────────────────────────────
// The /guest/countries endpoint returns { slug: {operators} } with no metadata,
// so we map slugs to ISO codes and English names ourselves.
const SLUG_MAP = {
  usa:{code:'US',name:'United States'}, england:{code:'GB',name:'United Kingdom'},
  india:{code:'IN',name:'India'}, nigeria:{code:'NG',name:'Nigeria'},
  russia:{code:'RU',name:'Russia'}, brazil:{code:'BR',name:'Brazil'},
  germany:{code:'DE',name:'Germany'}, france:{code:'FR',name:'France'},
  canada:{code:'CA',name:'Canada'}, australia:{code:'AU',name:'Australia'},
  indonesia:{code:'ID',name:'Indonesia'}, philippines:{code:'PH',name:'Philippines'},
  vietnam:{code:'VN',name:'Vietnam'}, mexico:{code:'MX',name:'Mexico'},
  pakistan:{code:'PK',name:'Pakistan'}, bangladesh:{code:'BD',name:'Bangladesh'},
  kenya:{code:'KE',name:'Kenya'}, ghana:{code:'GH',name:'Ghana'},
  southafrica:{code:'ZA',name:'South Africa'}, ukraine:{code:'UA',name:'Ukraine'},
  spain:{code:'ES',name:'Spain'}, italy:{code:'IT',name:'Italy'},
  netherlands:{code:'NL',name:'Netherlands'}, poland:{code:'PL',name:'Poland'},
  sweden:{code:'SE',name:'Sweden'}, norway:{code:'NO',name:'Norway'},
  denmark:{code:'DK',name:'Denmark'}, finland:{code:'FI',name:'Finland'},
  portugal:{code:'PT',name:'Portugal'}, belgium:{code:'BE',name:'Belgium'},
  austria:{code:'AT',name:'Austria'}, switzerland:{code:'CH',name:'Switzerland'},
  greece:{code:'GR',name:'Greece'}, romania:{code:'RO',name:'Romania'},
  czech:{code:'CZ',name:'Czech Republic'}, hungary:{code:'HU',name:'Hungary'},
  slovakia:{code:'SK',name:'Slovakia'}, croatia:{code:'HR',name:'Croatia'},
  bulgaria:{code:'BG',name:'Bulgaria'}, serbia:{code:'RS',name:'Serbia'},
  ireland:{code:'IE',name:'Ireland'}, lithuania:{code:'LT',name:'Lithuania'},
  latvia:{code:'LV',name:'Latvia'}, estonia:{code:'EE',name:'Estonia'},
  moldova:{code:'MD',name:'Moldova'}, belarus:{code:'BY',name:'Belarus'},
  albania:{code:'AL',name:'Albania'}, northmacedonia:{code:'MK',name:'North Macedonia'},
  bih:{code:'BA',name:'Bosnia and Herzegovina'}, montenegro:{code:'ME',name:'Montenegro'},
  slovenia:{code:'SI',name:'Slovenia'}, cyprus:{code:'CY',name:'Cyprus'},
  luxembourg:{code:'LU',name:'Luxembourg'},
  saudiarabia:{code:'SA',name:'Saudi Arabia'}, egypt:{code:'EG',name:'Egypt'},
  morocco:{code:'MA',name:'Morocco'}, tunisia:{code:'TN',name:'Tunisia'},
  algeria:{code:'DZ',name:'Algeria'}, israel:{code:'IL',name:'Israel'},
  jordan:{code:'JO',name:'Jordan'}, kuwait:{code:'KW',name:'Kuwait'},
  oman:{code:'OM',name:'Oman'}, bahrain:{code:'BH',name:'Bahrain'},
  lebanon:{code:'LB',name:'Lebanon'}, iraq:{code:'IQ',name:'Iraq'},
  yemen:{code:'YE',name:'Yemen'}, libya:{code:'LY',name:'Libya'},
  thailand:{code:'TH',name:'Thailand'}, malaysia:{code:'MY',name:'Malaysia'},
  taiwan:{code:'TW',name:'Taiwan'}, hongkong:{code:'HK',name:'Hong Kong'},
  cambodia:{code:'KH',name:'Cambodia'}, laos:{code:'LA',name:'Laos'},
  srilanka:{code:'LK',name:'Sri Lanka'}, nepal:{code:'NP',name:'Nepal'},
  mongolia:{code:'MN',name:'Mongolia'}, myanmar:{code:'MM',name:'Myanmar'},
  afghanistan:{code:'AF',name:'Afghanistan'}, china:{code:'CN',name:'China'},
  japan:{code:'JP',name:'Japan'}, southkorea:{code:'KR',name:'South Korea'},
  turkey:{code:'TR',name:'Turkey'},
  kazakhstan:{code:'KZ',name:'Kazakhstan'}, uzbekistan:{code:'UZ',name:'Uzbekistan'},
  azerbaijan:{code:'AZ',name:'Azerbaijan'}, georgia:{code:'GE',name:'Georgia'},
  armenia:{code:'AM',name:'Armenia'}, kyrgyzstan:{code:'KG',name:'Kyrgyzstan'},
  tajikistan:{code:'TJ',name:'Tajikistan'}, turkmenistan:{code:'TM',name:'Turkmenistan'},
  argentina:{code:'AR',name:'Argentina'}, colombia:{code:'CO',name:'Colombia'},
  chile:{code:'CL',name:'Chile'}, peru:{code:'PE',name:'Peru'},
  venezuela:{code:'VE',name:'Venezuela'}, ecuador:{code:'EC',name:'Ecuador'},
  bolivia:{code:'BO',name:'Bolivia'}, paraguay:{code:'PY',name:'Paraguay'},
  uruguay:{code:'UY',name:'Uruguay'}, guatemala:{code:'GT',name:'Guatemala'},
  costarica:{code:'CR',name:'Costa Rica'}, panama:{code:'PA',name:'Panama'},
  dominicana:{code:'DO',name:'Dominican Republic'}, honduras:{code:'HN',name:'Honduras'},
  salvador:{code:'SV',name:'El Salvador'}, nicaragua:{code:'NI',name:'Nicaragua'},
  puertorico:{code:'PR',name:'Puerto Rico'}, jamaica:{code:'JM',name:'Jamaica'},
  haiti:{code:'HT',name:'Haiti'}, guyana:{code:'GY',name:'Guyana'},
  barbados:{code:'BB',name:'Barbados'}, trinidad:{code:'TT',name:'Trinidad and Tobago'},
  ethiopia:{code:'ET',name:'Ethiopia'}, tanzania:{code:'TZ',name:'Tanzania'},
  uganda:{code:'UG',name:'Uganda'}, cameroon:{code:'CM',name:'Cameroon'},
  ivorycoast:{code:'CI',name:'Ivory Coast'}, senegal:{code:'SN',name:'Senegal'},
  rwanda:{code:'RW',name:'Rwanda'}, mozambique:{code:'MZ',name:'Mozambique'},
  zambia:{code:'ZM',name:'Zambia'}, malawi:{code:'MW',name:'Malawi'},
  namibia:{code:'NA',name:'Namibia'}, botswana:{code:'BW',name:'Botswana'},
  madagascar:{code:'MG',name:'Madagascar'}, sierraleone:{code:'SL',name:'Sierra Leone'},
  liberia:{code:'LR',name:'Liberia'}, guinea:{code:'GN',name:'Guinea'},
  benin:{code:'BJ',name:'Benin'}, togo:{code:'TG',name:'Togo'},
  burkinafaso:{code:'BF',name:'Burkina Faso'}, mali:{code:'ML',name:'Mali'},
  niger:{code:'NE',name:'Niger'}, chad:{code:'TD',name:'Chad'},
  angola:{code:'AO',name:'Angola'}, gabon:{code:'GA',name:'Gabon'},
  congo:{code:'CG',name:'Congo'}, drc:{code:'CD',name:'DR Congo'},
  burundi:{code:'BI',name:'Burundi'}, djibouti:{code:'DJ',name:'Djibouti'},
  gambia:{code:'GM',name:'Gambia'}, guineabissau:{code:'GW',name:'Guinea-Bissau'},
  capeverde:{code:'CV',name:'Cape Verde'}, mauritania:{code:'MR',name:'Mauritania'},
  mauritius:{code:'MU',name:'Mauritius'}, seychelles:{code:'SC',name:'Seychelles'},
  comoros:{code:'KM',name:'Comoros'}, lesotho:{code:'LS',name:'Lesotho'},
  equatorialguinea:{code:'GQ',name:'Equatorial Guinea'},
  zimbabwe:{code:'ZW',name:'Zimbabwe'}, sudan:{code:'SD',name:'Sudan'},
  somalia:{code:'SO',name:'Somalia'}, eritrea:{code:'ER',name:'Eritrea'},
  maldives:{code:'MV',name:'Maldives'}, easttimor:{code:'TL',name:'Timor-Leste'},
  papuanewguinea:{code:'PG',name:'Papua New Guinea'},
  newzealand:{code:'NZ',name:'New Zealand'},
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
  console.log(`  5sim has ${countryEntries.length} country/operator entries\n`);

  if (countryEntries.length === 0) {
    console.error('ERROR: Got 0 countries from 5sim — check API key or network');
    process.exit(1);
  }

  // Build country lookup: isoUpper → { fivesimSlug, name, flag }
  const fivesimCountries = {}; // iso2Upper → { slug, name }
  // /guest/countries returns { slug: { operators } } — no metadata.
  // We map slugs to ISO codes and names via SLUG_MAP.
  for (const [slug] of countryEntries) {
    const meta = SLUG_MAP[slug];
    if (!meta) continue; // virtual/unknown slug — skip
    fivesimCountries[meta.code] = {
      slug,
      name: meta.name,
      flag: flagEmoji(meta.code),
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
