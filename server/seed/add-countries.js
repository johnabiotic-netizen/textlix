require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Country = require('../src/models/Country');
const Service = require('../src/models/Service');
const NumberPricing = require('../src/models/NumberPricing');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/verifynow';

// All 5sim-supported countries (5simSlug -> { code, name, flag, sortOrder })
const allCountries = [
  { code: 'US', name: 'United States', flagEmoji: '🇺🇸', fivesim: 'usa', sortOrder: 1 },
  { code: 'GB', name: 'United Kingdom', flagEmoji: '🇬🇧', fivesim: 'england', sortOrder: 2 },
  { code: 'IN', name: 'India', flagEmoji: '🇮🇳', fivesim: 'india', sortOrder: 3 },
  { code: 'NG', name: 'Nigeria', flagEmoji: '🇳🇬', fivesim: 'nigeria', sortOrder: 4 },
  { code: 'RU', name: 'Russia', flagEmoji: '🇷🇺', fivesim: 'russia', sortOrder: 5 },
  { code: 'BR', name: 'Brazil', flagEmoji: '🇧🇷', fivesim: 'brazil', sortOrder: 6 },
  { code: 'DE', name: 'Germany', flagEmoji: '🇩🇪', fivesim: 'germany', sortOrder: 7 },
  { code: 'FR', name: 'France', flagEmoji: '🇫🇷', fivesim: 'france', sortOrder: 8 },
  { code: 'CA', name: 'Canada', flagEmoji: '🇨🇦', fivesim: 'canada', sortOrder: 9 },
  { code: 'AU', name: 'Australia', flagEmoji: '🇦🇺', fivesim: 'australia', sortOrder: 10 },
  { code: 'ID', name: 'Indonesia', flagEmoji: '🇮🇩', fivesim: 'indonesia', sortOrder: 11 },
  { code: 'PH', name: 'Philippines', flagEmoji: '🇵🇭', fivesim: 'philippines', sortOrder: 12 },
  { code: 'VN', name: 'Vietnam', flagEmoji: '🇻🇳', fivesim: 'vietnam', sortOrder: 13 },
  { code: 'MX', name: 'Mexico', flagEmoji: '🇲🇽', fivesim: 'mexico', sortOrder: 14 },
  { code: 'PK', name: 'Pakistan', flagEmoji: '🇵🇰', fivesim: 'pakistan', sortOrder: 15 },
  { code: 'BD', name: 'Bangladesh', flagEmoji: '🇧🇩', fivesim: 'bangladesh', sortOrder: 16 },
  { code: 'KE', name: 'Kenya', flagEmoji: '🇰🇪', fivesim: 'kenya', sortOrder: 17 },
  { code: 'GH', name: 'Ghana', flagEmoji: '🇬🇭', fivesim: 'ghana', sortOrder: 18 },
  { code: 'ZA', name: 'South Africa', flagEmoji: '🇿🇦', fivesim: 'southafrica', sortOrder: 19 },
  { code: 'UA', name: 'Ukraine', flagEmoji: '🇺🇦', fivesim: 'ukraine', sortOrder: 20 },
  // New countries
  { code: 'ES', name: 'Spain', flagEmoji: '🇪🇸', fivesim: 'spain', sortOrder: 21 },
  { code: 'IT', name: 'Italy', flagEmoji: '🇮🇹', fivesim: 'italy', sortOrder: 22 },
  { code: 'NL', name: 'Netherlands', flagEmoji: '🇳🇱', fivesim: 'netherlands', sortOrder: 23 },
  { code: 'PL', name: 'Poland', flagEmoji: '🇵🇱', fivesim: 'poland', sortOrder: 24 },
  { code: 'SE', name: 'Sweden', flagEmoji: '🇸🇪', fivesim: 'sweden', sortOrder: 25 },
  { code: 'NO', name: 'Norway', flagEmoji: '🇳🇴', fivesim: 'norway', sortOrder: 26 },
  { code: 'DK', name: 'Denmark', flagEmoji: '🇩🇰', fivesim: 'denmark', sortOrder: 27 },
  { code: 'FI', name: 'Finland', flagEmoji: '🇫🇮', fivesim: 'finland', sortOrder: 28 },
  { code: 'PT', name: 'Portugal', flagEmoji: '🇵🇹', fivesim: 'portugal', sortOrder: 29 },
  { code: 'BE', name: 'Belgium', flagEmoji: '🇧🇪', fivesim: 'belgium', sortOrder: 30 },
  { code: 'AT', name: 'Austria', flagEmoji: '🇦🇹', fivesim: 'austria', sortOrder: 31 },
  { code: 'CH', name: 'Switzerland', flagEmoji: '🇨🇭', fivesim: 'switzerland', sortOrder: 32 },
  { code: 'GR', name: 'Greece', flagEmoji: '🇬🇷', fivesim: 'greece', sortOrder: 33 },
  { code: 'RO', name: 'Romania', flagEmoji: '🇷🇴', fivesim: 'romania', sortOrder: 34 },
  { code: 'CZ', name: 'Czech Republic', flagEmoji: '🇨🇿', fivesim: 'czech', sortOrder: 35 },
  { code: 'HU', name: 'Hungary', flagEmoji: '🇭🇺', fivesim: 'hungary', sortOrder: 36 },
  { code: 'SK', name: 'Slovakia', flagEmoji: '🇸🇰', fivesim: 'slovakia', sortOrder: 37 },
  { code: 'HR', name: 'Croatia', flagEmoji: '🇭🇷', fivesim: 'croatia', sortOrder: 38 },
  { code: 'BG', name: 'Bulgaria', flagEmoji: '🇧🇬', fivesim: 'bulgaria', sortOrder: 39 },
  { code: 'RS', name: 'Serbia', flagEmoji: '🇷🇸', fivesim: 'serbia', sortOrder: 40 },
  { code: 'IE', name: 'Ireland', flagEmoji: '🇮🇪', fivesim: 'ireland', sortOrder: 41 },
  { code: 'SA', name: 'Saudi Arabia', flagEmoji: '🇸🇦', fivesim: 'saudiarabia', sortOrder: 42 },
  { code: 'EG', name: 'Egypt', flagEmoji: '🇪🇬', fivesim: 'egypt', sortOrder: 43 },
  { code: 'MA', name: 'Morocco', flagEmoji: '🇲🇦', fivesim: 'morocco', sortOrder: 44 },
  { code: 'TN', name: 'Tunisia', flagEmoji: '🇹🇳', fivesim: 'tunisia', sortOrder: 45 },
  { code: 'TH', name: 'Thailand', flagEmoji: '🇹🇭', fivesim: 'thailand', sortOrder: 46 },
  { code: 'MY', name: 'Malaysia', flagEmoji: '🇲🇾', fivesim: 'malaysia', sortOrder: 47 },
  { code: 'TW', name: 'Taiwan', flagEmoji: '🇹🇼', fivesim: 'taiwan', sortOrder: 48 },
  { code: 'HK', name: 'Hong Kong', flagEmoji: '🇭🇰', fivesim: 'hongkong', sortOrder: 49 },
  { code: 'KH', name: 'Cambodia', flagEmoji: '🇰🇭', fivesim: 'cambodia', sortOrder: 50 },
  { code: 'LA', name: 'Laos', flagEmoji: '🇱🇦', fivesim: 'laos', sortOrder: 51 },
  { code: 'LK', name: 'Sri Lanka', flagEmoji: '🇱🇰', fivesim: 'srilanka', sortOrder: 52 },
  { code: 'NP', name: 'Nepal', flagEmoji: '🇳🇵', fivesim: 'nepal', sortOrder: 53 },
  { code: 'MN', name: 'Mongolia', flagEmoji: '🇲🇳', fivesim: 'mongolia', sortOrder: 54 },
  { code: 'KZ', name: 'Kazakhstan', flagEmoji: '🇰🇿', fivesim: 'kazakhstan', sortOrder: 55 },
  { code: 'UZ', name: 'Uzbekistan', flagEmoji: '🇺🇿', fivesim: 'uzbekistan', sortOrder: 56 },
  { code: 'AZ', name: 'Azerbaijan', flagEmoji: '🇦🇿', fivesim: 'azerbaijan', sortOrder: 57 },
  { code: 'GE', name: 'Georgia', flagEmoji: '🇬🇪', fivesim: 'georgia', sortOrder: 58 },
  { code: 'AM', name: 'Armenia', flagEmoji: '🇦🇲', fivesim: 'armenia', sortOrder: 59 },
  { code: 'KG', name: 'Kyrgyzstan', flagEmoji: '🇰🇬', fivesim: 'kyrgyzstan', sortOrder: 60 },
  { code: 'TJ', name: 'Tajikistan', flagEmoji: '🇹🇯', fivesim: 'tajikistan', sortOrder: 61 },
  { code: 'TM', name: 'Turkmenistan', flagEmoji: '🇹🇲', fivesim: 'turkmenistan', sortOrder: 62 },
  { code: 'IL', name: 'Israel', flagEmoji: '🇮🇱', fivesim: 'israel', sortOrder: 63 },
  { code: 'JO', name: 'Jordan', flagEmoji: '🇯🇴', fivesim: 'jordan', sortOrder: 64 },
  { code: 'KW', name: 'Kuwait', flagEmoji: '🇰🇼', fivesim: 'kuwait', sortOrder: 65 },
  { code: 'OM', name: 'Oman', flagEmoji: '🇴🇲', fivesim: 'oman', sortOrder: 66 },
  { code: 'BH', name: 'Bahrain', flagEmoji: '🇧🇭', fivesim: 'bahrain', sortOrder: 67 },
  { code: 'AR', name: 'Argentina', flagEmoji: '🇦🇷', fivesim: 'argentina', sortOrder: 68 },
  { code: 'CO', name: 'Colombia', flagEmoji: '🇨🇴', fivesim: 'colombia', sortOrder: 69 },
  { code: 'CL', name: 'Chile', flagEmoji: '🇨🇱', fivesim: 'chile', sortOrder: 70 },
  { code: 'PE', name: 'Peru', flagEmoji: '🇵🇪', fivesim: 'peru', sortOrder: 71 },
  { code: 'VE', name: 'Venezuela', flagEmoji: '🇻🇪', fivesim: 'venezuela', sortOrder: 72 },
  { code: 'EC', name: 'Ecuador', flagEmoji: '🇪🇨', fivesim: 'ecuador', sortOrder: 73 },
  { code: 'BO', name: 'Bolivia', flagEmoji: '🇧🇴', fivesim: 'bolivia', sortOrder: 74 },
  { code: 'PY', name: 'Paraguay', flagEmoji: '🇵🇾', fivesim: 'paraguay', sortOrder: 75 },
  { code: 'UY', name: 'Uruguay', flagEmoji: '🇺🇾', fivesim: 'uruguay', sortOrder: 76 },
  { code: 'GT', name: 'Guatemala', flagEmoji: '🇬🇹', fivesim: 'guatemala', sortOrder: 77 },
  { code: 'CR', name: 'Costa Rica', flagEmoji: '🇨🇷', fivesim: 'costarica', sortOrder: 78 },
  { code: 'PA', name: 'Panama', flagEmoji: '🇵🇦', fivesim: 'panama', sortOrder: 79 },
  { code: 'DO', name: 'Dominican Republic', flagEmoji: '🇩🇴', fivesim: 'dominicana', sortOrder: 80 },
  { code: 'HN', name: 'Honduras', flagEmoji: '🇭🇳', fivesim: 'honduras', sortOrder: 81 },
  { code: 'SV', name: 'El Salvador', flagEmoji: '🇸🇻', fivesim: 'salvador', sortOrder: 82 },
  { code: 'NI', name: 'Nicaragua', flagEmoji: '🇳🇮', fivesim: 'nicaragua', sortOrder: 83 },
  { code: 'PR', name: 'Puerto Rico', flagEmoji: '🇵🇷', fivesim: 'puertorico', sortOrder: 84 },
  { code: 'ET', name: 'Ethiopia', flagEmoji: '🇪🇹', fivesim: 'ethiopia', sortOrder: 85 },
  { code: 'TZ', name: 'Tanzania', flagEmoji: '🇹🇿', fivesim: 'tanzania', sortOrder: 86 },
  { code: 'UG', name: 'Uganda', flagEmoji: '🇺🇬', fivesim: 'uganda', sortOrder: 87 },
  { code: 'CM', name: 'Cameroon', flagEmoji: '🇨🇲', fivesim: 'cameroon', sortOrder: 88 },
  { code: 'CI', name: 'Ivory Coast', flagEmoji: '🇨🇮', fivesim: 'ivorycoast', sortOrder: 89 },
  { code: 'SN', name: 'Senegal', flagEmoji: '🇸🇳', fivesim: 'senegal', sortOrder: 90 },
  { code: 'RW', name: 'Rwanda', flagEmoji: '🇷🇼', fivesim: 'rwanda', sortOrder: 91 },
  { code: 'MZ', name: 'Mozambique', flagEmoji: '🇲🇿', fivesim: 'mozambique', sortOrder: 92 },
  { code: 'ZM', name: 'Zambia', flagEmoji: '🇿🇲', fivesim: 'zambia', sortOrder: 93 },
  { code: 'MW', name: 'Malawi', flagEmoji: '🇲🇼', fivesim: 'malawi', sortOrder: 94 },
  { code: 'NA', name: 'Namibia', flagEmoji: '🇳🇦', fivesim: 'namibia', sortOrder: 95 },
  { code: 'BW', name: 'Botswana', flagEmoji: '🇧🇼', fivesim: 'botswana', sortOrder: 96 },
  { code: 'MG', name: 'Madagascar', flagEmoji: '🇲🇬', fivesim: 'madagascar', sortOrder: 97 },
  { code: 'SL', name: 'Sierra Leone', flagEmoji: '🇸🇱', fivesim: 'sierraleone', sortOrder: 98 },
  { code: 'LR', name: 'Liberia', flagEmoji: '🇱🇷', fivesim: 'liberia', sortOrder: 99 },
  { code: 'GN', name: 'Guinea', flagEmoji: '🇬🇳', fivesim: 'guinea', sortOrder: 100 },
  { code: 'BJ', name: 'Benin', flagEmoji: '🇧🇯', fivesim: 'benin', sortOrder: 101 },
  { code: 'TG', name: 'Togo', flagEmoji: '🇹🇬', fivesim: 'togo', sortOrder: 102 },
  { code: 'BF', name: 'Burkina Faso', flagEmoji: '🇧🇫', fivesim: 'burkinafaso', sortOrder: 103 },
  { code: 'ML', name: 'Mali', flagEmoji: '🇲🇱', fivesim: 'mali', sortOrder: 104 },
  { code: 'NE', name: 'Niger', flagEmoji: '🇳🇪', fivesim: 'niger', sortOrder: 105 },
  { code: 'TD', name: 'Chad', flagEmoji: '🇹🇩', fivesim: 'chad', sortOrder: 106 },
  { code: 'AO', name: 'Angola', flagEmoji: '🇦🇴', fivesim: 'angola', sortOrder: 107 },
  { code: 'GA', name: 'Gabon', flagEmoji: '🇬🇦', fivesim: 'gabon', sortOrder: 108 },
  { code: 'CG', name: 'Congo', flagEmoji: '🇨🇬', fivesim: 'congo', sortOrder: 109 },
  { code: 'BI', name: 'Burundi', flagEmoji: '🇧🇮', fivesim: 'burundi', sortOrder: 110 },
  { code: 'DJ', name: 'Djibouti', flagEmoji: '🇩🇯', fivesim: 'djibouti', sortOrder: 111 },
  { code: 'GM', name: 'Gambia', flagEmoji: '🇬🇲', fivesim: 'gambia', sortOrder: 112 },
  { code: 'GW', name: 'Guinea-Bissau', flagEmoji: '🇬🇼', fivesim: 'guineabissau', sortOrder: 113 },
  { code: 'CV', name: 'Cape Verde', flagEmoji: '🇨🇻', fivesim: 'capeverde', sortOrder: 114 },
  { code: 'MR', name: 'Mauritania', flagEmoji: '🇲🇷', fivesim: 'mauritania', sortOrder: 115 },
  { code: 'MU', name: 'Mauritius', flagEmoji: '🇲🇺', fivesim: 'mauritius', sortOrder: 116 },
  { code: 'SC', name: 'Seychelles', flagEmoji: '🇸🇨', fivesim: 'seychelles', sortOrder: 117 },
  { code: 'KM', name: 'Comoros', flagEmoji: '🇰🇲', fivesim: 'comoros', sortOrder: 118 },
  { code: 'LS', name: 'Lesotho', flagEmoji: '🇱🇸', fivesim: 'lesotho', sortOrder: 119 },
  { code: 'GQ', name: 'Equatorial Guinea', flagEmoji: '🇬🇶', fivesim: 'equatorialguinea', sortOrder: 120 },
  { code: 'LT', name: 'Lithuania', flagEmoji: '🇱🇹', fivesim: 'lithuania', sortOrder: 121 },
  { code: 'LV', name: 'Latvia', flagEmoji: '🇱🇻', fivesim: 'latvia', sortOrder: 122 },
  { code: 'EE', name: 'Estonia', flagEmoji: '🇪🇪', fivesim: 'estonia', sortOrder: 123 },
  { code: 'MD', name: 'Moldova', flagEmoji: '🇲🇩', fivesim: 'moldova', sortOrder: 124 },
  { code: 'BY', name: 'Belarus', flagEmoji: '🇧🇾', fivesim: 'belarus', sortOrder: 125 },
  { code: 'AL', name: 'Albania', flagEmoji: '🇦🇱', fivesim: 'albania', sortOrder: 126 },
  { code: 'MK', name: 'North Macedonia', flagEmoji: '🇲🇰', fivesim: 'northmacedonia', sortOrder: 127 },
  { code: 'BA', name: 'Bosnia and Herzegovina', flagEmoji: '🇧🇦', fivesim: 'bih', sortOrder: 128 },
  { code: 'ME', name: 'Montenegro', flagEmoji: '🇲🇪', fivesim: 'montenegro', sortOrder: 129 },
  { code: 'SI', name: 'Slovenia', flagEmoji: '🇸🇮', fivesim: 'slovenia', sortOrder: 130 },
  { code: 'CY', name: 'Cyprus', flagEmoji: '🇨🇾', fivesim: 'cyprus', sortOrder: 131 },
  { code: 'LU', name: 'Luxembourg', flagEmoji: '🇱🇺', fivesim: 'luxembourg', sortOrder: 132 },
  { code: 'DZ', name: 'Algeria', flagEmoji: '🇩🇿', fivesim: 'algeria', sortOrder: 133 },
  { code: 'LY', name: 'Libya', flagEmoji: '🇱🇾', fivesim: 'libya', sortOrder: 134 },
  { code: 'JM', name: 'Jamaica', flagEmoji: '🇯🇲', fivesim: 'jamaica', sortOrder: 135 },
  { code: 'TT', name: 'Trinidad and Tobago', flagEmoji: '🇹🇹', fivesim: 'trinidad', sortOrder: 136 },
  { code: 'GY', name: 'Guyana', flagEmoji: '🇬🇾', fivesim: 'guyana', sortOrder: 137 },
  { code: 'HT', name: 'Haiti', flagEmoji: '🇭🇹', fivesim: 'haiti', sortOrder: 138 },
  { code: 'BB', name: 'Barbados', flagEmoji: '🇧🇧', fivesim: 'barbados', sortOrder: 139 },
  { code: 'MV', name: 'Maldives', flagEmoji: '🇲🇻', fivesim: 'maldives', sortOrder: 140 },
  { code: 'TL', name: 'Timor-Leste', flagEmoji: '🇹🇱', fivesim: 'easttimor', sortOrder: 141 },
  { code: 'PG', name: 'Papua New Guinea', flagEmoji: '🇵🇬', fivesim: 'papuanewguinea', sortOrder: 142 },
];

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'verifynow' });
  console.log('Connected!\n');

  // Upsert all countries
  console.log('Upserting countries...');
  const countryDocs = [];
  for (const c of allCountries) {
    const doc = await Country.findOneAndUpdate(
      { code: c.code },
      { name: c.name, code: c.code, flagEmoji: c.flagEmoji, sortOrder: c.sortOrder, isEnabled: true },
      { upsert: true, new: true }
    );
    countryDocs.push(doc);
  }
  console.log(`  ✓ ${countryDocs.length} countries upserted\n`);

  // Get all enabled services
  const services = await Service.find({ isEnabled: true });
  console.log(`Found ${services.length} services\n`);

  // Add pricing for every country × service combo that doesn't exist yet
  console.log('Adding pricing entries...');
  let added = 0, skipped = 0;

  // Tier pricing based on region
  const highTier  = new Set(['US','GB','CA','AU','DE','FR','NL','SE','NO','DK','FI','AT','BE','IE','LU','CH']);
  const midTier   = new Set(['ES','IT','PT','PL','GR','CZ','HU','RO','SK','HR','BG','RS','SI','CY','LT','LV','EE','IL','SA','KW','BH','OM','AU','JP','KR','TW','HK','MY','TH','AR','CL','CO','UY','CR','PA']);

  function getPrice(code, basePrice) {
    if (highTier.has(code)) return Math.round(basePrice * 1.8);
    if (midTier.has(code)) return Math.round(basePrice * 1.3);
    return basePrice; // low tier
  }

  // Base prices per service (provider cost in credits)
  const basePrices = {
    whatsapp:10, telegram:8, google:7, facebook:6, instagram:9, twitter:3,
    tiktok:3, snapchat:29, linkedin:5, discord:13, uber:9, amazon:10,
    netflix:17, apple:4, microsoft:8, steam:14, tinder:14, airbnb:21,
    yahoo:5, viber:12, wechat:38, line:4, twitch:8, ebay:20, blizzard:3,
    shopee:26, lazada:8, paypal:10, truecaller:13, signal:4,
    fiverr:6, shopify:8, blablacar:6, alibaba:5, aliexpress:2, bolt:4,
    grindr:6, protonmail:10, zoho:17, tradingview:8,
    happn:10, pof:13, hily:10, skout:10, cupid:10, grabtaxi:10,
    gojek:8, didi:8, deliveroo:6, foodpanda:9, wolt:9, dominospizza:6,
    mcdonalds:6, vinted:8, poshmark:9, olx:15, carousell:10, craigslist:31,
    kakaotalk:12, zalo:4, weibo:18, baidu:6, iqiyi:8, tencentqq:23,
    naver:13, kwai:4, faceit:9, paxful:6, ticketmaster:6, clubhouse:6, nike:13,
  };

  for (const country of countryDocs) {
    for (const svc of services) {
      const existing = await NumberPricing.findOne({ countryId: country._id, serviceId: svc._id });
      if (existing) { skipped++; continue; }

      const base = basePrices[svc.slug] || 8;
      const providerCost = getPrice(country.code, base);
      const finalPrice = Math.ceil(providerCost * 1.3);

      await NumberPricing.create({
        countryId: country._id,
        serviceId: svc._id,
        providerCost,
        marginPercent: 30,
        finalPrice,
        isAvailable: true,
      });
      added++;
    }
  }

  console.log(`  ✓ ${added} new pricing entries added`);
  console.log(`  - ${skipped} already existed (skipped)\n`);
  console.log(`✅ Done! Platform now has ${countryDocs.length} countries × ${services.length} services`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
