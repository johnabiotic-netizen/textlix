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

// Override DNS resolver to public servers — Atlas mongodb+srv:// URIs require
// SRV record lookups, and some ISP DNS resolvers don't return them, which
// surfaces as ECONNREFUSED on querySrv. Google + Cloudflare always do.
require('dns').setServers(['8.8.8.8', '1.1.1.1']);

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
  // ── Bulk Grizzly-only round (auto-generated via generate-grizzly-additions.js) ──
  smiles: { name: 'Smiles', icon: 'smiles' },
  myntroshop: { name: 'Myntro-Shop', icon: 'myntroshop' },
  pofcom: { name: 'pof.com', icon: 'pofcom' },
  winzogame: { name: 'WinzoGame', icon: 'winzogame' },
  flipkard: { name: 'Flipkard', icon: 'flipkard' },
  aichat: { name: 'AI Chat', icon: 'aichat' },
  blizzardbattlenet: { name: 'Blizzard - Battle.Net', icon: 'blizzardbattlenet' },
  beanfun: { name: 'Beanfun', icon: 'beanfun' },
  azure: { name: 'Azure', icon: 'azure' },
  linemessenger: { name: 'Line messenger', icon: 'linemessenger' },
  jingdong: { name: 'Jingdong', icon: 'jingdong' },
  sahibinden: { name: 'Sahibinden', icon: 'sahibinden' },
  googlechat: { name: 'Google Chat', icon: 'googlechat' },
  samsung: { name: 'Samsung', icon: 'samsung' },
  grab: { name: 'Grab', icon: 'grab' },
  '1xbet': { name: '1xbet', icon: '1xbet' },
  talku: { name: 'TalkU', icon: 'talku' },
  rumble: { name: 'Rumble', icon: 'rumble' },
  redbookxiaohongshu: { name: 'RedBook (Xiaohongshu)', icon: 'redbookxiaohongshu' },
  awsamazon: { name: 'AWS Amazon', icon: 'awsamazon' },
  akulaku: { name: 'Akulaku', icon: 'akulaku' },
  rambler: { name: 'Rambler', icon: 'rambler' },
  fastwin: { name: 'Fastwin', icon: 'fastwin' },
  oppo: { name: 'Oppo', icon: 'oppo' },
  playkaro: { name: 'PlayKaro', icon: 'playkaro' },
  parlayplay: { name: 'ParlayPlay', icon: 'parlayplay' },
  drom: { name: 'Drom', icon: 'drom' },
  damejidlo: { name: 'Damejidlo', icon: 'damejidlo' },
  railoneexswarail: { name: 'RailOne (ex-SwaRail)', icon: 'railoneexswarail' },
  winmatch: { name: 'WinMatch', icon: 'winmatch' },
  deliveryclub: { name: 'Delivery Club', icon: 'deliveryclub' },
  kazanexpress: { name: 'KazanExpress', icon: 'kazanexpress' },
  spincrush: { name: 'Spincrush', icon: 'spincrush' },
  innopay: { name: 'Innopay', icon: 'innopay' },
  chalkboard: { name: 'Chalkboard', icon: 'chalkboard' },
  iherb: { name: 'iHerb', icon: 'iherb' },
  anyother: { name: 'AnyOther', icon: 'anyother' },
  orbimed: { name: 'Orbimed', icon: 'orbimed' },
  alipayhk: { name: 'AlipayHK', icon: 'alipayhk' },
  dewupoison: { name: 'DewuPoison', icon: 'dewupoison' },
  stormgain: { name: 'Stormgain', icon: 'stormgain' },
  cloudchat: { name: 'CloudChat', icon: 'cloudchat' },
  liveme: { name: 'LiveMe', icon: 'liveme' },
  switchere: { name: 'Switchere', icon: 'switchere' },
  phonepe: { name: 'PhonePe', icon: 'phonepe' },
  happytuk: { name: 'Happytuk', icon: 'happytuk' },
  buff163: { name: 'Buff.163', icon: 'buff163' },
  cred: { name: 'Cred', icon: 'cred' },
  gorillas: { name: 'Gorillas', icon: 'gorillas' },
  ovo: { name: 'Ovo', icon: 'ovo' },
  ubox: { name: 'UBOX', icon: 'ubox' },
  omnicard: { name: 'Omnicard', icon: 'omnicard' },
  taptap: { name: 'TapTap', icon: 'taptap' },
  shell: { name: 'Shell', icon: 'shell' },
  cupis: { name: 'Cupis', icon: 'cupis' },
  broadblue: { name: 'Broadblue', icon: 'broadblue' },
  googlemessenger: { name: 'Google Messenger', icon: 'googlemessenger' },
  '24betting': { name: '24betting', icon: '24betting' },
  megogo: { name: 'Megogo', icon: 'megogo' },
  vivaldi: { name: 'Vivaldi', icon: 'vivaldi' },
  seospirit: { name: 'Seospirit', icon: 'seospirit' },
  klarna: { name: 'Klarna', icon: 'klarna' },
  battle: { name: 'Battle', icon: 'battle' },
  cg163: { name: 'cg.163', icon: 'cg163' },
  ivi: { name: 'Ivi', icon: 'ivi' },
  womply: { name: 'Womply', icon: 'womply' },
  fastwin2: { name: 'Fastwin 2', icon: 'fastwin2' },
  freedomfinance: { name: 'FreedomFinance', icon: 'freedomfinance' },
  remit: { name: 'Remit', icon: 'remit' },
  urent: { name: 'Urent', icon: 'urent' },
  kleinanzeigen: { name: 'Kleinanzeigen', icon: 'kleinanzeigen' },
  akudo: { name: 'Akudo', icon: 'akudo' },
  rummygold: { name: 'Rummy Gold', icon: 'rummygold' },
  ais: { name: 'AIS', icon: 'ais' },
  nh7: { name: 'NH7', icon: 'nh7' },
  gogym: { name: 'GoGym', icon: 'gogym' },
  ftx: { name: 'FTX', icon: 'ftx' },
  agoda: { name: 'Agoda', icon: 'agoda' },
  moteplassen: { name: 'Moteplassen', icon: 'moteplassen' },
  match: { name: 'Match', icon: 'match' },
  kolesakzkrishakz: { name: 'Kolesa.kz / Krisha.kz', icon: 'kolesakzkrishakz' },
  ostin: { name: 'Ostin', icon: 'ostin' },
  ingalaxy: { name: 'Ingalaxy', icon: 'ingalaxy' },
  flowwow: { name: 'Flowwow', icon: 'flowwow' },
  weco: { name: 'Weco', icon: 'weco' },
  love: { name: 'LOVE', icon: 'love' },
  iti: { name: 'Iti', icon: 'iti' },
  bazarstore: { name: 'Bazar-store', icon: 'bazarstore' },
  casinoonline: { name: 'Casino Online', icon: 'casinoonline' },
  adakami: { name: 'AdaKami', icon: 'adakami' },
  tenchat: { name: 'TenChat', icon: 'tenchat' },
  yoshidrops: { name: 'Yoshidrops', icon: 'yoshidrops' },
  multinet: { name: 'Multinet', icon: 'multinet' },
  hiyachat: { name: 'Hiyachat', icon: 'hiyachat' },
  faberlic: { name: 'Faberlic', icon: 'faberlic' },
  '4funlite': { name: '4FunLite', icon: '4funlite' },
  taikang: { name: 'Taikang', icon: 'taikang' },
  biglion: { name: 'Biglion', icon: 'biglion' },
  regru: { name: 'Reg.ru', icon: 'regru' },
  teenpattidynasty: { name: 'Teen Patti Dynasty', icon: 'teenpattidynasty' },
  coinut: { name: 'Coinut', icon: 'coinut' },
  periscope: { name: 'Periscope', icon: 'periscope' },
  beget: { name: 'Beget', icon: 'beget' },
  hoff: { name: 'Hoff', icon: 'hoff' },
  wink: { name: 'Wink', icon: 'wink' },
  myboost: { name: 'MyBoost', icon: 'myboost' },
  tilda: { name: 'Tilda', icon: 'tilda' },
  vodorobot: { name: 'Vodorobot', icon: 'vodorobot' },
  yoho: { name: 'YoHo', icon: 'yoho' },
  mudah: { name: 'Mudah', icon: 'mudah' },
  withiyc: { name: 'With IYC', icon: 'withiyc' },
  move: { name: 'Move', icon: 'move' },
  textfree: { name: 'TextFree', icon: 'textfree' },
  affirm: { name: 'Affirm', icon: 'affirm' },
  getcontact: { name: 'Getcontact', icon: 'getcontact' },
  mico: { name: 'MICO', icon: 'mico' },
  x5retailgroup: { name: 'X5 Retail Group', icon: 'x5retailgroup' },
  diffbot: { name: 'Diffbot', icon: 'diffbot' },
  mobileproxy: { name: 'Mobileproxy', icon: 'mobileproxy' },
  wog: { name: 'WOG', icon: 'wog' },
  farpost: { name: 'Farpost', icon: 'farpost' },
  tanuki: { name: 'Tanuki', icon: 'tanuki' },
  jddatingjd: { name: 'JD Dating', icon: 'jddatingjd' },
  bpclub: { name: 'BP Club', icon: 'bpclub' },
  bybit: { name: 'Bybit', icon: 'bybit' },
  chococrush: { name: 'Choco Crush', icon: 'chococrush' },
  sankesandladders: { name: 'Snakes and Ladders', icon: 'sankesandladders' },
  stickpool: { name: 'StickPool', icon: 'stickpool' },
  callapp: { name: 'CallApp', icon: 'callapp' },
  artstation: { name: 'Artstation', icon: 'artstation' },
  beboo: { name: 'Beboo', icon: 'beboo' },
  allesbonus: { name: 'ALLES Bonus', icon: 'allesbonus' },
  '163om': { name: '163.com', icon: '163om' },
  ikayetvar: { name: 'Sikayetvar', icon: 'ikayetvar' },
  marlboro: { name: 'Marlboro', icon: 'marlboro' },
  apollo247: { name: 'Apollo 247', icon: 'apollo247' },
  pesohere: { name: 'Pesohere', icon: 'pesohere' },
  blsspain: { name: 'BLS Spain', icon: 'blsspain' },
  sravni: { name: 'Sravni', icon: 'sravni' },
  alfagift: { name: 'Alfagift', icon: 'alfagift' },
  localbitcoins: { name: 'LocalBitcoins', icon: 'localbitcoins' },
  '2domains': { name: '2domains', icon: '2domains' },
  mozen: { name: 'Mozen', icon: 'mozen' },
  miravia: { name: 'Miravia', icon: 'miravia' },
  zoon: { name: 'Zoon', icon: 'zoon' },
  yappy: { name: 'YAPPY', icon: 'yappy' },
  tolokaai: { name: 'Toloka.ai', icon: 'tolokaai' },
  jumptaxi: { name: 'JumpTaxi', icon: 'jumptaxi' },
  funpay: { name: 'Funpay', icon: 'funpay' },
  rumbler: { name: 'Rumbler', icon: 'rumbler' },
  azsirbis: { name: 'Azsirbis', icon: 'azsirbis' },
  book24: { name: 'Book24', icon: 'book24' },
  cofix: { name: 'Cofix', icon: 'cofix' },
  internetopros: { name: 'InternetOpros', icon: 'internetopros' },
  winelab: { name: 'Winelab', icon: 'winelab' },
  lootably: { name: 'Lootably', icon: 'lootably' },
  atlasbusby: { name: 'Atlasbus.by', icon: 'atlasbusby' },
  checkscan: { name: 'Checkscan', icon: 'checkscan' },
  dosmart: { name: 'Dosmart', icon: 'dosmart' },
  novex: { name: 'Novex', icon: 'novex' },
  nationallottery: { name: 'National Lottery', icon: 'nationallottery' },
  onrealt: { name: 'Onrealt', icon: 'onrealt' },
  luxy: { name: 'Luxy', icon: 'luxy' },
  mailcom: { name: 'mail.com', icon: 'mailcom' },
  mybeautybonus: { name: 'My Beauty Bonus', icon: 'mybeautybonus' },
  starscoffee: { name: 'Stars Coffee', icon: 'starscoffee' },
  flor2u: { name: 'Flor2U', icon: 'flor2u' },
  imomessager: { name: 'IMO Messenger', icon: 'imomessager' },
  krasyar: { name: 'Krasyar', icon: 'krasyar' },
  okx: { name: 'OKX', icon: 'okx' },
  luckybike: { name: 'LuckyBike', icon: 'luckybike' },
  chibbis: { name: 'Chibbis', icon: 'chibbis' },
  maxidom: { name: 'Maxidom', icon: 'maxidom' },
  enticegames: { name: 'EnticeGames', icon: 'enticegames' },
  friendsclub: { name: 'Friendsclub', icon: 'friendsclub' },
  grozd: { name: 'Grozd', icon: 'grozd' },
  falla: { name: 'Falla', icon: 'falla' },
  isaku: { name: 'i.saku', icon: 'isaku' },
  neteller: { name: 'NETELLER', icon: 'neteller' },
  likecentre: { name: 'LikeCentre', icon: 'likecentre' },
  okko: { name: 'Okko', icon: 'okko' },
  docusign: { name: 'DocuSign', icon: 'docusign' },
  iyc: { name: 'IYC', icon: 'iyc' },
  viendong: { name: 'Viendong', icon: 'viendong' },
  zuscoffee: { name: 'ZUS Coffee', icon: 'zuscoffee' },
  tbigwin: { name: 'Tbigwin', icon: 'tbigwin' },
  wirex: { name: 'Wirex', icon: 'wirex' },
  namascar: { name: 'Namascar', icon: 'namascar' },
  mexc: { name: 'MEXC', icon: 'mexc' },
  presto: { name: 'Presto', icon: 'presto' },
  casinobetgambling: { name: 'Casino / Bet / Gambling', icon: 'casinobetgambling' },
  lemo: { name: 'Lemo', icon: 'lemo' },
  stripe: { name: 'Stripe', icon: 'stripe' },
  tmtw: { name: 'TMTW', icon: 'tmtw' },
  sayhichat: { name: 'SayHi Chat', icon: 'sayhichat' },
  nimotv: { name: 'NimoTV', icon: 'nimotv' },
  maya: { name: 'Maya', icon: 'maya' },
  '360kredi': { name: '360Kredi', icon: '360kredi' },
  ninjaz: { name: 'Ninjaz', icon: 'ninjaz' },
  moonpay: { name: 'MoonPay', icon: 'moonpay' },
  kulturpass: { name: 'KulturPass', icon: 'kulturpass' },
  mocamoca: { name: 'MocaMoca', icon: 'mocamoca' },
  binance: { name: 'Binance', icon: 'binance' },
  aly: { name: 'ALY', icon: 'aly' },
  playtime: { name: 'PlayTime', icon: 'playtime' },
  sugo: { name: 'SUGO', icon: 'sugo' },
  autodesk: { name: 'Autodesk', icon: 'autodesk' },
  kbx: { name: 'KBX', icon: 'kbx' },
  trueid: { name: 'TrueID', icon: 'trueid' },
  maxis: { name: 'Maxis', icon: 'maxis' },
  greywoods: { name: 'Greywoods', icon: 'greywoods' },
  tealive: { name: 'Tealive', icon: 'tealive' },
  globalcash: { name: 'Global Cash', icon: 'globalcash' },
  confirmtkt: { name: 'ConfirmTkt', icon: 'confirmtkt' },
  poe: { name: 'Poe', icon: 'poe' },
  googlepay: { name: 'Google Pay', icon: 'googlepay' },
  ezmatch: { name: 'EZMatch', icon: 'ezmatch' },
  things: { name: 'Things', icon: 'things' },
  xbox: { name: 'Xbox', icon: 'xbox' },
  blackcatcard: { name: 'Blackcatcard', icon: 'blackcatcard' },
  quark: { name: 'Quark', icon: 'quark' },
  wallester: { name: 'Wallester', icon: 'wallester' },
  bunq: { name: 'Bunq', icon: 'bunq' },
  simply: { name: 'Simply', icon: 'simply' },
  monzo: { name: 'Monzo', icon: 'monzo' },
  '2ememain': { name: '2ememain', icon: '2ememain' },
  freechargeapp: { name: 'FreeCharge', icon: 'freechargeapp' },
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
