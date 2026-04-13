require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Country = require('../src/models/Country');
const Service = require('../src/models/Service');
const NumberPricing = require('../src/models/NumberPricing');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/verifynow';

const newServices = [
  { name: 'Netflix', slug: 'netflix', icon: 'netflix', sortOrder: 13 },
  { name: 'Apple', slug: 'apple', icon: 'apple', sortOrder: 14 },
  { name: 'Microsoft', slug: 'microsoft', icon: 'microsoft', sortOrder: 15 },
  { name: 'Steam', slug: 'steam', icon: 'steam', sortOrder: 16 },
  { name: 'Tinder', slug: 'tinder', icon: 'tinder', sortOrder: 17 },
  { name: 'Airbnb', slug: 'airbnb', icon: 'airbnb', sortOrder: 18 },
  { name: 'Yahoo', slug: 'yahoo', icon: 'yahoo', sortOrder: 19 },
  { name: 'Viber', slug: 'viber', icon: 'viber', sortOrder: 20 },
  { name: 'WeChat', slug: 'wechat', icon: 'wechat', sortOrder: 21 },
  { name: 'Line', slug: 'line', icon: 'line', sortOrder: 22 },
  { name: 'Twitch', slug: 'twitch', icon: 'twitch', sortOrder: 23 },
  { name: 'eBay', slug: 'ebay', icon: 'ebay', sortOrder: 24 },
  { name: 'Blizzard', slug: 'blizzard', icon: 'blizzard', sortOrder: 25 },
  { name: 'Shopee', slug: 'shopee', icon: 'shopee', sortOrder: 26 },
  { name: 'Lazada', slug: 'lazada', icon: 'lazada', sortOrder: 27 },
  { name: 'PayPal', slug: 'paypal', icon: 'paypal', sortOrder: 28 },
  { name: 'Truecaller', slug: 'truecaller', icon: 'truecaller', sortOrder: 29 },
  { name: 'Signal', slug: 'signal', icon: 'signal', sortOrder: 30 },
  { name: 'Fiverr', slug: 'fiverr', icon: 'fiverr', sortOrder: 31 },
  { name: 'Shopify', slug: 'shopify', icon: 'shopify', sortOrder: 32 },
  { name: 'Blablacar', slug: 'blablacar', icon: 'blablacar', sortOrder: 33 },
  { name: 'Alibaba', slug: 'alibaba', icon: 'alibaba', sortOrder: 34 },
  { name: 'AliExpress', slug: 'aliexpress', icon: 'aliexpress', sortOrder: 35 },
  { name: 'Bolt', slug: 'bolt', icon: 'bolt', sortOrder: 36 },
  { name: 'Grindr', slug: 'grindr', icon: 'grindr', sortOrder: 37 },
  { name: 'Proton Mail', slug: 'protonmail', icon: 'protonmail', sortOrder: 38 },
  { name: 'Zoho', slug: 'zoho', icon: 'zoho', sortOrder: 39 },
  { name: 'TradingView', slug: 'tradingview', icon: 'tradingview', sortOrder: 40 },
  // Dating apps
  { name: 'Happn', slug: 'happn', icon: 'happn', sortOrder: 41 },
  { name: 'Plenty of Fish', slug: 'pof', icon: 'pof', sortOrder: 42 },
  { name: 'Hily', slug: 'hily', icon: 'hily', sortOrder: 43 },
  { name: 'Skout', slug: 'skout', icon: 'skout', sortOrder: 44 },
  { name: 'Cupid', slug: 'cupid', icon: 'cupid', sortOrder: 45 },
  // Ride-hailing
  { name: 'Grab', slug: 'grabtaxi', icon: 'grabtaxi', sortOrder: 46 },
  { name: 'Gojek', slug: 'gojek', icon: 'gojek', sortOrder: 47 },
  { name: 'DiDi', slug: 'didi', icon: 'didi', sortOrder: 48 },
  // Food delivery
  { name: 'Deliveroo', slug: 'deliveroo', icon: 'deliveroo', sortOrder: 49 },
  { name: 'Foodpanda', slug: 'foodpanda', icon: 'foodpanda', sortOrder: 50 },
  { name: 'Wolt', slug: 'wolt', icon: 'wolt', sortOrder: 51 },
  { name: "Domino's Pizza", slug: 'dominospizza', icon: 'dominospizza', sortOrder: 52 },
  { name: "McDonald's", slug: 'mcdonalds', icon: 'mcdonalds', sortOrder: 53 },
  // Secondhand/Classifieds
  { name: 'Vinted', slug: 'vinted', icon: 'vinted', sortOrder: 54 },
  { name: 'Poshmark', slug: 'poshmark', icon: 'poshmark', sortOrder: 55 },
  { name: 'OLX', slug: 'olx', icon: 'olx', sortOrder: 56 },
  { name: 'Carousell', slug: 'carousell', icon: 'carousell', sortOrder: 57 },
  { name: 'Craigslist', slug: 'craigslist', icon: 'craigslist', sortOrder: 58 },
  // Asian platforms
  { name: 'KakaoTalk', slug: 'kakaotalk', icon: 'kakaotalk', sortOrder: 59 },
  { name: 'Zalo', slug: 'zalo', icon: 'zalo', sortOrder: 60 },
  { name: 'Weibo', slug: 'weibo', icon: 'weibo', sortOrder: 61 },
  { name: 'Baidu', slug: 'baidu', icon: 'baidu', sortOrder: 62 },
  { name: 'iQIYI', slug: 'iqiyi', icon: 'iqiyi', sortOrder: 63 },
  { name: 'Tencent QQ', slug: 'tencentqq', icon: 'tencentqq', sortOrder: 64 },
  { name: 'Naver', slug: 'naver', icon: 'naver', sortOrder: 65 },
  { name: 'Kwai', slug: 'kwai', icon: 'kwai', sortOrder: 66 },
  // Gaming
  { name: 'Faceit', slug: 'faceit', icon: 'faceit', sortOrder: 67 },
  // Finance/Crypto
  { name: 'Paxful', slug: 'paxful', icon: 'paxful', sortOrder: 68 },
  // Events & Tickets
  { name: 'Ticketmaster', slug: 'ticketmaster', icon: 'ticketmaster', sortOrder: 69 },
  // Misc high-demand
  { name: 'Clubhouse', slug: 'clubhouse', icon: 'clubhouse', sortOrder: 70 },
  { name: 'Nike', slug: 'nike', icon: 'nike', sortOrder: 71 },
];

const prices = {
  US:  { netflix:25,apple:8,microsoft:12,steam:18,tinder:20,airbnb:30,yahoo:8,viber:15,wechat:45,line:8,twitch:10,ebay:25,blizzard:6,shopee:30,lazada:25,paypal:20,truecaller:12,signal:6,fiverr:8,shopify:10,blablacar:8,alibaba:6,aliexpress:4,bolt:6,grindr:8,protonmail:12,zoho:18,tradingview:10,happn:12,pof:15,hily:12,skout:12,cupid:12,grabtaxi:12,gojek:10,didi:10,deliveroo:8,foodpanda:10,wolt:10,dominospizza:8,mcdonalds:8,vinted:10,poshmark:10,olx:18,carousell:12,craigslist:35,kakaotalk:15,zalo:6,weibo:20,baidu:8,iqiyi:10,tencentqq:25,naver:15,kwai:6,faceit:10,paxful:8,ticketmaster:8,clubhouse:8,nike:15 },
  GB:  { netflix:28,apple:9,microsoft:13,steam:20,tinder:22,airbnb:32,yahoo:9,viber:16,wechat:48,line:9,twitch:11,ebay:27,blizzard:7,shopee:32,lazada:27,paypal:22,truecaller:13,signal:7,fiverr:9,shopify:11,blablacar:9,alibaba:7,aliexpress:5,bolt:7,grindr:9,protonmail:13,zoho:20,tradingview:11,happn:13,pof:17,hily:13,skout:13,cupid:13,grabtaxi:13,gojek:11,didi:11,deliveroo:9,foodpanda:11,wolt:11,dominospizza:9,mcdonalds:9,vinted:11,poshmark:11,olx:20,carousell:13,craigslist:38,kakaotalk:16,zalo:7,weibo:22,baidu:9,iqiyi:11,tencentqq:27,naver:16,kwai:7,faceit:11,paxful:9,ticketmaster:9,clubhouse:9,nike:16 },
  IN:  { netflix:17,apple:4,microsoft:8,steam:14,tinder:14,airbnb:21,yahoo:5,viber:12,wechat:38,line:4,twitch:8,ebay:20,blizzard:3,shopee:26,lazada:8,paypal:10,truecaller:13,signal:4,fiverr:6,shopify:8,blablacar:6,alibaba:5,aliexpress:2,bolt:4,grindr:6,protonmail:10,zoho:17,tradingview:8,happn:10,pof:13,hily:10,skout:10,cupid:10,grabtaxi:10,gojek:8,didi:8,deliveroo:6,foodpanda:9,wolt:9,dominospizza:6,mcdonalds:6,vinted:8,poshmark:9,olx:15,carousell:10,craigslist:31,kakaotalk:12,zalo:4,weibo:18,baidu:6,iqiyi:8,tencentqq:23,naver:13,kwai:4,faceit:9,paxful:6,ticketmaster:6,clubhouse:6,nike:13 },
  NG:  { netflix:20,apple:6,microsoft:10,steam:15,tinder:16,airbnb:25,yahoo:6,viber:13,wechat:40,line:6,twitch:9,ebay:22,blizzard:5,shopee:28,lazada:20,paypal:15,truecaller:10,signal:5,fiverr:7,shopify:9,blablacar:7,alibaba:6,aliexpress:4,bolt:5,grindr:7,protonmail:11,zoho:18,tradingview:9,happn:11,pof:14,hily:11,skout:11,cupid:11,grabtaxi:11,gojek:9,didi:9,deliveroo:7,foodpanda:10,wolt:10,dominospizza:7,mcdonalds:7,vinted:9,poshmark:10,olx:17,carousell:11,craigslist:33,kakaotalk:13,zalo:5,weibo:19,baidu:7,iqiyi:9,tencentqq:24,naver:14,kwai:5,faceit:10,paxful:7,ticketmaster:7,clubhouse:7,nike:14 },
  RU:  { netflix:22,apple:7,microsoft:11,steam:16,tinder:18,airbnb:28,yahoo:7,viber:14,wechat:42,line:7,twitch:9,ebay:23,blizzard:5,shopee:29,lazada:22,paypal:17,truecaller:11,signal:5,fiverr:8,shopify:10,blablacar:8,alibaba:6,aliexpress:4,bolt:6,grindr:8,protonmail:12,zoho:18,tradingview:10,happn:12,pof:14,hily:12,skout:12,cupid:12,grabtaxi:12,gojek:10,didi:10,deliveroo:8,foodpanda:10,wolt:10,dominospizza:8,mcdonalds:8,vinted:10,poshmark:10,olx:18,carousell:12,craigslist:35,kakaotalk:14,zalo:6,weibo:20,baidu:8,iqiyi:10,tencentqq:25,naver:15,kwai:6,faceit:10,paxful:8,ticketmaster:8,clubhouse:8,nike:15 },
};

const defaultPrices = { netflix:22,apple:7,microsoft:11,steam:16,tinder:18,airbnb:28,yahoo:7,viber:14,wechat:42,line:7,twitch:9,ebay:23,blizzard:5,shopee:29,lazada:22,paypal:17,truecaller:11,signal:5,fiverr:8,shopify:10,blablacar:8,alibaba:6,aliexpress:4,bolt:6,grindr:8,protonmail:12,zoho:18,tradingview:10,happn:12,pof:14,hily:12,skout:12,cupid:12,grabtaxi:12,gojek:10,didi:10,deliveroo:8,foodpanda:10,wolt:10,dominospizza:8,mcdonalds:8,vinted:10,poshmark:10,olx:18,carousell:12,craigslist:35,kakaotalk:14,zalo:6,weibo:20,baidu:8,iqiyi:10,tencentqq:25,naver:15,kwai:6,faceit:10,paxful:8,ticketmaster:8,clubhouse:8,nike:15 };

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'verifynow' });
  console.log('Connected!');

  // Upsert new services
  console.log('Adding new services...');
  const serviceDocs = [];
  for (const svc of newServices) {
    const doc = await Service.findOneAndUpdate(
      { slug: svc.slug },
      svc,
      { upsert: true, new: true }
    );
    serviceDocs.push(doc);
    console.log(`  ✓ ${svc.name}`);
  }

  // Get all countries
  const countries = await Country.find({ isEnabled: true });
  console.log(`\nAdding pricing for ${countries.length} countries × ${serviceDocs.length} services...`);

  let count = 0;
  for (const country of countries) {
    const countryPrices = prices[country.code] || defaultPrices;
    for (const svc of serviceDocs) {
      const providerCost = countryPrices[svc.slug] || defaultPrices[svc.slug] || 10;
      const finalPrice = Math.ceil(providerCost * 1.3);
      await NumberPricing.findOneAndUpdate(
        { countryId: country._id, serviceId: svc._id },
        { countryId: country._id, serviceId: svc._id, providerCost, marginPercent: 30, finalPrice, isAvailable: true },
        { upsert: true, new: true }
      );
      count++;
    }
  }

  console.log(`\n✅ Done! Added ${count} pricing entries.`);
  console.log(`   ${serviceDocs.length} new services × ${countries.length} countries`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
