const axios = require('axios');
const logger = require('../../config/logger');

const BASE_URL = 'https://api.grizzlysms.com/stubs/handler_api.php';

// Supported rental durations in days → hours (GrizzlySMS rent_time is in hours)
const RENT_DAYS = { 1: 24, 7: 168, 28: 672 };

// Map our 5sim-style slugs to GrizzlySMS/SMS-Activate service codes.
// Adding a new entry here lets the order controller fulfill that slug via
// LIX 2 (GrizzlySMS direct) or the LIX 1 → GrizzlySMS fallback path. If a
// slug is missing here, `toCode` passes it through untouched and GrizzlySMS
// rejects the order — so this map is the gating list for what we can sell.
const SLUG_TO_CODE = {
  // Confirmed working
  whatsapp: 'wa',
  telegram: 'tg',
  google: 'go',
  instagram: 'ig',
  facebook: 'fb',
  twitter: 'tw',
  tiktok: 'tt',
  discord: 'ds',
  snapchat: 'sc',
  amazon: 'am',
  netflix: 'nf',
  uber: 'ub',
  linkedin: 'li',
  paypal: 'pp',
  viber: 'vi',
  spotify: 'sp',
  line: 'ln',
  fiverr: 'fi',
  aol: 'aol',
  microsoft: 'ms',
  // High-confidence additions from GrizzlySMS code list
  tinder: 'ti',
  signal: 'si',
  ebay: 'eb',
  tencentqq: 'qq',
  wechat: 'wc',
  weibo: 'wb',
  kakaotalk: 'ka',
  naver: 'nv',
  zalo: 'zl',
  iqiyi: 'iq',
  lyft: 'lf',
  badoo: 'bd',
  twitch: 'tv',
  grindr: 'gr',
  airbnb: 'ai',
  doordash: 'dp',
  kwai: 'kw',
  bilibili: 'bi',
  // Multi-provider expansion (services 5sim doesn't carry — added so the
  // catalog can surface them when GrizzlySMS has them). Codes verified
  // against GrizzlySMS's live getServicesList + getPrices output.
  payoneer: 'pa',         // Payoneer — confirmed inventory
  steam: 'mt',            // Steam — 199 countries
  reddit: 're',           // Reddit — 198 countries
  yahoo: 'mb',            // Yahoo — 200 countries (was 'yh' which is dead)
  // The next five had no inventory under the codes I picked. Left in the
  // map intentionally — they cost nothing to keep and removing them risks
  // breaking some future order path I haven't considered. The sync script's
  // MULTI_PROVIDER_SLUGS no longer references them so they stop creating
  // orphan Service docs.
  vk: 'vk',
  okru: 'ok',
  yandex: 'ya',
  pinterest: 'pn',        // 'pn' is actually "CoffeeLike" on Grizzly — Pinterest isn't carried
  avito: 'av',
  // Bulk additions from GrizzlySMS catalog discovery — 25 services with
  // 199-201 country coverage. Names matched against the live getServicesList.
  apple: 'wx',
  nike: 'ew',
  vinted: 'kc',
  bumble: 'mo',
  truecaller: 'tl',
  foodpanda: 'nz',
  deliveroo: 'zk',
  olacabs: 'ly',
  microsoftoutlook: 'mm',
  paytm: 'ge',
  ticketmaster: 'gp',
  alipay: 'hw',
  lazada: 'dl',
  swiggy: 'jx',
  bolt: 'tx',
  didi: 'xk',
  taobao: 'qd',
  noon: 'tf',
  getir: 'ul',
  okcupid: 'vm',
  tantan: 'wh',
  twilio: 'ee',
  jiomart: 'aay',
  michat: 'mc',
  claude: 'acz',
  // ── Bulk Grizzly-only round (auto-generated via generate-grizzly-additions.js) ──
  smiles: 'agb',
  myntroshop: 'nl',
  pofcom: 'pf',
  winzogame: 'vs',
  flipkard: 'xt',
  aichat: 'dr',
  blizzardbattlenet: 'bz',
  beanfun: 'gr_bf',
  azure: 'gr_ur',
  linemessenger: 'me',
  jingdong: 'za',
  sahibinden: 'gr_sh',
  googlechat: 'ght',
  samsung: 'gs',
  grab: 'jg',
  '1xbet': 'wj',
  talku: 'tu',
  rumble: 'gr_ru',
  redbookxiaohongshu: 'qf',
  awsamazon: 'gr_aw',
  akulaku: 'tm',
  rambler: 'gr_ra',
  fastwin: 'faw',
  oppo: 'gr_op',
  playkaro: 'gr_pk',
  parlayplay: 'gr_pp',
  drom: 'hz',
  damejidlo: 'ox',
  railoneexswarail: 'swr',
  winmatch: 'wmh',
  deliveryclub: 'dt',
  kazanexpress: 'ol',
  spincrush: 'sch',
  innopay: 'gr_ip',
  chalkboard: 'gr_rd',
  iherb: 'ih',
  anyother: 'ot',
  orbimed: 'gr_or',
  alipayhk: 'hwhk',
  dewupoison: 'lx',
  stormgain: 'vj',
  cloudchat: 'dd',
  liveme: 'gr_lm',
  switchere: 'se',
  phonepe: 'noh',
  happytuk: 'gr_py',
  buff163: 'bf',
  cred: 'edd',
  gorillas: 'gr_gs',
  ovo: 'xh',
  ubox: 'gr_ubox',
  omnicard: 'ocd',
  taptap: 'tap',
  shell: 'vg',
  cupis: 'cp',
  broadblue: 'gr_br',
  googlemessenger: 'gmsg',
  '24betting': 'lh',
  megogo: 'lv',
  vivaldi: 'vd',
  seospirit: 'vv',
  klarna: 'afz',
  battle: 'bt',
  cg163: 'cg',
  ivi: 'js',
  womply: 'gr_ly',
  fastwin2: 'waf',
  freedomfinance: 'ff',
  remit: 'gr_re',
  urent: 'of',
  kleinanzeigen: 'gr_dh',
  akudo: 'rf',
  rummygold: 'rmg',
  ais: 'wv',
  nh7: 'nh7',
  gogym: 'gg',
  ftx: 'gr_fx',
  agoda: 'gr_ag',
  moteplassen: 'mp',
  match: 'axr',
  kolesakzkrishakz: 'kl',
  ostin: 'gr_ot',
  ingalaxy: 'gy',
  flowwow: 'gr_fw',
  weco: 'wo',
  love: 'gr_lv',
  iti: 'ad',
  bazarstore: 'gr_bz',
  casinoonline: 'co',
  adakami: 'ko',
  tenchat: 'cr',
  yoshidrops: 'yd',
  multinet: 'gr_mu',
  hiyachat: 'gr_hi',
  faberlic: 'rm',
  '4funlite': 'fl',
  taikang: 'aw',
  biglion: 'gr_bl',
  regru: 'ow',
  teenpattidynasty: 'gr_td',
  coinut: 'gr_cn',
  periscope: 'gr_pe',
  beget: 'bg',
  hoff: 'gr_hf',
  wink: 'ta',
  myboost: 'afm',
  tilda: 'gr_tl',
  vodorobot: 'vr',
  yoho: 'gr_yo',
  mudah: 'bdv',
  withiyc: 'gr_iy',
  move: 'gr_mo',
  textfree: 'asf',
  affirm: 'bow',
  getcontact: 'gr_gc',
  mico: 'gr_mi',
  x5retailgroup: 'x5',
  diffbot: 'dfb',
  mobileproxy: 'gr_le',
  wog: 'gr_wg',
  farpost: 'gr_fr',
  tanuki: 'gr_tk',
  jddatingjd: 'jddt',
  bpclub: 'bu',
  bybit: 'abn',
  chococrush: 'chc',
  sankesandladders: 'sal',
  stickpool: 'scp',
  callapp: 'gw',
  artstation: 'gr_st',
  beboo: 'acx',
  allesbonus: 'gr_sb',
  '163om': 'wp',
  ikayetvar: 'fs',
  marlboro: 'gr_ma',
  apollo247: 'oop',
  pesohere: 'aqd',
  blsspain: 'bs',
  sravni: 'gr_sr',
  alfagift: 'bn',
  localbitcoins: 'gr_lb',
  '2domains': 'gr_ns',
  mozen: 'mz',
  miravia: 'yr',
  zoon: 'gr_zo',
  yappy: 'kj',
  tolokaai: 'tlk',
  jumptaxi: 'jt',
  funpay: 'ng',
  rumbler: 'tc',
  azsirbis: 'gr_az',
  book24: 'gr_bk',
  cofix: 'gr_cx',
  internetopros: 'gr_io',
  winelab: 'gr_wn',
  lootably: 'gr_ab',
  atlasbusby: 'gr_as',
  checkscan: 'gr_ch',
  dosmart: 'gr_ds',
  novex: 'gr_ex',
  nationallottery: 'gr_lo',
  onrealt: 'gr_ox',
  luxy: 'lxy',
  mailcom: 'yq',
  mybeautybonus: 'gr_bo',
  starscoffee: 'gr_cf',
  flor2u: 'gr_fl',
  imomessager: 'gr_im',
  krasyar: 'gr_kr',
  okx: 'aor',
  luckybike: 'gr_bi',
  chibbis: 'gr_cs',
  maxidom: 'gr_dm',
  enticegames: 'gr_eg',
  friendsclub: 'gr_fc',
  grozd: 'gr_gr',
  falla: 'gr_la',
  isaku: 'is',
  neteller: 'aok',
  likecentre: 'gr_lc',
  okko: 'og',
  docusign: 'blr',
  iyc: 'gr_yc',
  viendong: 'bwn',
  zuscoffee: 'aik',
  tbigwin: 'tbg',
  wirex: 'baa',
  namascar: 'nmc',
  mexc: 'bii',
  presto: 'ary',
  casinobetgambling: 'pc',
  lemo: 'atc',
  stripe: 'nu',
  tmtw: 'bhu',
  sayhichat: 'bgh',
  nimotv: 'kz',
  maya: 'ard',
  '360kredi': 'ayo',
  ninjaz: 'azu',
  moonpay: 'bgj',
  kulturpass: 'bsx',
  mocamoca: 'axe',
  binance: 'aon',
  aly: 'awi',
  playtime: 'awz',
  sugo: 'bao',
  autodesk: 'bbl',
  kbx: 'aqu',
  trueid: 'axb',
  maxis: 'act',
  greywoods: 'aet',
  tealive: 'avb',
  globalcash: 'beg',
  confirmtkt: 'ctkt',
  poe: 'opd',
  googlepay: 'gpy',
  ezmatch: 'bgb',
  things: 'lz',
  xbox: 'aml',
  blackcatcard: 'anp',
  quark: 'ccw',
  wallester: 'bxx',
  bunq: 'ahe',
  simply: 'aoj',
  monzo: 'aom',
  '2ememain': 'blx',
  freechargeapp: 'kg',
};

const toCode = (slug) => SLUG_TO_CODE[slug] || slug;

// Reverse map (provider service code → our canonical slug, first slug wins).
// Used to turn a by-country price response back into slug-keyed pricing.
const CODE_TO_SLUG = {};
for (const [slug, code] of Object.entries(SLUG_TO_CODE)) {
  if (!(code in CODE_TO_SLUG)) CODE_TO_SLUG[code] = slug;
}

// ISO-2 → GrizzlySMS numeric country ID (from live getCountries API response)
const ISO_TO_COUNTRY_ID = {
  UA: 1,   KZ: 2,   CN: 3,   PH: 4,   MM: 5,   ID: 6,   MY: 7,   KE: 8,
  TZ: 9,   VN: 10,  KG: 11,  IL: 13,  HK: 14,  PL: 15,  GB: 16,  MG: 17,
  CD: 18,  NG: 19,  MO: 20,  EG: 21,  IN: 22,  IE: 23,  KH: 24,  LA: 25,
  HT: 26,  CI: 27,  GM: 28,  RS: 29,  YE: 30,  ZA: 31,  RO: 32,  CO: 33,
  EE: 34,  AZ: 35,  CA: 36,  MA: 37,  GH: 38,  AR: 39,  UZ: 40,  CM: 41,
  TD: 42,  DE: 43,  LT: 44,  HR: 45,  SE: 46,  IQ: 47,  NL: 48,  LV: 49,
  AT: 50,  BY: 51,  TH: 52,  SA: 53,  MX: 54,  TW: 55,  ES: 56,  DZ: 58,
  SI: 59,  BD: 60,  SN: 61,  TR: 62,  CZ: 63,  LK: 64,  PE: 65,  PK: 66,
  NZ: 67,  GN: 68,  ML: 69,  VE: 70,  ET: 71,  MN: 72,  BR: 73,  AF: 74,
  UG: 75,  AO: 76,  CY: 77,  FR: 78,  PG: 79,  MZ: 80,  NP: 81,  BE: 82,
  BG: 83,  HU: 84,  MD: 85,  IT: 86,  PY: 87,  HN: 88,  TN: 89,  NI: 90,
  TL: 91,  BO: 92,  CR: 93,  GT: 94,  AE: 95,  ZW: 96,  PR: 97,  TG: 99,
  KW: 100, SV: 101, LY: 102, JM: 103, TT: 104, EC: 105, SZ: 106, OM: 107,
  BA: 108, DO: 109, SY: 110, QA: 111, PA: 112, CU: 113, MR: 114, SL: 115,
  JO: 116, PT: 117, BB: 118, BI: 119, BJ: 120, BN: 121, BS: 122, BW: 123,
  BZ: 124, CF: 125, DM: 126, GD: 127, GE: 128, GR: 129, GW: 130, GY: 131,
  IS: 132, KM: 133, KN: 134, LR: 135, LS: 136, MW: 137, NA: 138, NE: 139,
  RW: 140, SK: 141, SR: 142, TJ: 143, MC: 144, BH: 145, RE: 146, ZM: 147,
  AM: 148, SO: 149, CG: 150, CL: 151, BF: 152, LB: 153, GA: 154, AL: 155,
  UY: 156, MU: 157, BT: 158, MV: 159, GP: 160, TM: 161, GF: 162, FI: 163,
  LC: 164, LU: 165, VC: 166, GQ: 167, DJ: 168, AG: 169, KY: 170, ME: 171,
  DK: 172, CH: 173, NO: 174, AU: 175, ER: 176, SS: 177, ST: 178, AW: 179,
  MS: 180, AI: 181, JP: 182, MK: 183, SC: 184, NC: 185, CV: 186, US: 187,
  PS: 188, GI: 201, XK: 203, NU: 204, BM: 1003, VU: 1007, GL: 1008,
  AD: 1062, IR: 10016, AS: 10161, TO: 10227, WS: 10231, LI: 10348,
  SX: 10349, KR: 10350, SG: 10351,
};

// Reverse map: GrizzlySMS numeric country ID → ISO-2
const COUNTRY_ID_TO_ISO = Object.fromEntries(
  Object.entries(ISO_TO_COUNTRY_ID).map(([iso, id]) => [String(id), iso])
);

const call = async (params) => {
  const { data } = await axios.get(BASE_URL, {
    params: { api_key: process.env.GRIZZLYSMS_API_KEY, ...params },
    timeout: 15000,
  });
  if (data?.status === 'error') {
    throw new Error(`GrizzlySMS: ${data.message || JSON.stringify(data)}`);
  }
  return data;
};

/**
 * Fetch rental prices for all countries for a given number of days.
 * Returns { [ISO_CODE]: { cost (USD total for period), count } }
 */
const getRentPrices = async (days = 1) => {
  const rent_time = RENT_DAYS[days] || RENT_DAYS[1];
  const data = await call({ action: 'getRentPrices', service: 'full', rent_time });
  const result = {};
  for (const [country, services] of Object.entries(data.values || {})) {
    const full = services?.full;
    if (full?.count > 0) result[country] = { cost: full.cost, count: full.count };
  }
  return result;
};

/**
 * Buy a rental number for any service in the given country.
 * Returns { id, phone, endDate }
 */
const getRentNumber = async (countryCode, days = 1) => {
  const rent_time = RENT_DAYS[days] || RENT_DAYS[1];
  const data = await call({
    action: 'getRentNumber',
    service: 'full',
    country: countryCode,
    rent_time,
  });
  if (data.status !== 'success' || !data.phone) {
    throw new Error(`GrizzlySMS getRentNumber failed: ${JSON.stringify(data)}`);
  }
  return {
    id: String(data.phone.id),
    phone: String(data.phone.number),
    endDate: data.phone.endDate,
  };
};

/**
 * Poll for SMS messages received on a rental number.
 * Returns array of { phoneFrom, text, service, date } — empty array when no SMS yet.
 */
const getRentStatus = async (rentId) => {
  const data = await call({ action: 'getRentStatus', id: rentId });
  if (data.status === 'error') return []; // NO_SMS or other non-fatal error
  const messages = [];
  for (const sms of Object.values(data.values || {})) {
    if (sms.text) messages.push({ phoneFrom: sms.phoneFrom, text: sms.text, service: sms.service, date: sms.date });
  }
  return messages;
};

/**
 * Finish or cancel a rental.
 * status=1 → finish (end early, no refund)
 * status=2 → cancel (refund, only within first 20 min with no SMS)
 */
const setRentStatus = async (rentId, status = 1) => {
  try {
    await call({ action: 'setRentStatus', id: rentId, status });
  } catch (err) {
    logger.warn(`GrizzlySMS setRentStatus failed (${rentId}):`, err.message);
  }
};

// ─── OTP pricing ─────────────────────────────────────────────────────────────

/**
 * Fetch OTP pricing for a service across all countries.
 * Returns { [numericCountryId]: { cost (USD), count } } or null if API unsupported.
 */
const getOtpPrices = async (service) => {
  const code = toCode(service);
  const data = await call({ action: 'getPrices', service: code });
  if (typeof data === 'string') return null;
  // GrizzlySMS returns { [countryId]: { [serviceCode]: { count, cost, retry } } }
  // Reshape to { [countryId]: { count, cost } } to match downstream expectations
  const result = {};
  for (const [countryId, services] of Object.entries(data || {})) {
    const svc = services[code];
    if (svc) result[countryId] = svc;
  }
  return Object.keys(result).length > 0 ? result : null;
};

/**
 * Fetch OTP pricing for EVERY service in ONE country in a single call.
 * Returns { [ourSlug]: { cost (USD), count } } or null.
 */
const getOtpPricesByCountry = async (countryIso) => {
  const countryId = ISO_TO_COUNTRY_ID[String(countryIso || '').toUpperCase()];
  if (countryId == null) return null;
  const data = await call({ action: 'getPrices', country: countryId });
  if (!data || typeof data !== 'object') return null;
  const countryData = data[String(countryId)] || data[countryId];
  if (!countryData || typeof countryData !== 'object') return null;
  const result = {};
  for (const [code, info] of Object.entries(countryData)) {
    const slug = CODE_TO_SLUG[code];
    if (!slug || !info) continue;
    const cost = Number(info.cost);
    const count = Number(info.count);
    if (cost > 0 && count > 0) result[slug] = { cost, count };
  }
  return Object.keys(result).length ? result : null;
};

// ─── OTP activation methods ───────────────────────────────────────────────────

/**
 * Buy a one-time activation number for a specific service and country.
 * countryIso: 2-letter ISO code (e.g. 'US', 'GB'). Falls back to any country (0) if unmapped.
 * Returns { id, phone }
 */
const getNumber = async (service, countryIso) => {
  const country = ISO_TO_COUNTRY_ID[countryIso?.toUpperCase()] ?? 0;
  const data = await call({ action: 'getNumber', service: toCode(service), country });
  if (typeof data !== 'string' || !data.startsWith('ACCESS_NUMBER')) {
    throw new Error(`GrizzlySMS getNumber: ${data}`);
  }
  const [, id, phone] = data.split(':');
  return { id, phone };
};

/**
 * Poll status of an OTP activation.
 * Returns raw status string: STATUS_WAIT_CODE, STATUS_OK:<code>, STATUS_CANCEL, etc.
 */
const getStatus = async (id) => {
  const data = await call({ action: 'getStatus', id });
  return typeof data === 'string' ? data : JSON.stringify(data);
};

/**
 * Change activation status.
 * status=1  → request another SMS
 * status=6  → confirm SMS received (finish)
 * status=8  → cancel activation (triggers refund on provider side)
 */
const setStatus = async (id, status) => {
  try {
    await call({ action: 'setStatus', id, status });
  } catch (err) {
    logger.warn(`GrizzlySMS setStatus failed (${id}):`, err.message);
  }
};

// Account balance. SMS-Activate format: "ACCESS_BALANCE:123.45"
const getBalance = async () => {
  try {
    const data = await call({ action: 'getBalance' });
    const m = String(data ?? '').match(/ACCESS_BALANCE[:=]([0-9.]+)/i);
    return m ? Number(m[1]) : null;
  } catch (err) {
    logger.warn(`GrizzlySMS getBalance failed: ${err.message}`);
    return null;
  }
};

module.exports = { getRentPrices, getRentNumber, getRentStatus, setRentStatus, getNumber, getStatus, setStatus, getOtpPrices, getOtpPricesByCountry, getBalance, COUNTRY_ID_TO_ISO, RENT_DAYS, toCode };
