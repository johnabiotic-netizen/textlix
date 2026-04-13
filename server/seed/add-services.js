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
];

const prices = {
  US: { netflix: 25, apple: 8, microsoft: 12, steam: 18, tinder: 20, airbnb: 30, yahoo: 8, viber: 15, wechat: 45, line: 8, twitch: 10, ebay: 25, blizzard: 6, shopee: 30, lazada: 25, paypal: 20, truecaller: 12, signal: 6, fiverr: 8, shopify: 10, blablacar: 8, alibaba: 6, aliexpress: 4, bolt: 6, grindr: 8, protonmail: 12, zoho: 18, tradingview: 10 },
  GB: { netflix: 28, apple: 9, microsoft: 13, steam: 20, tinder: 22, airbnb: 32, yahoo: 9, viber: 16, wechat: 48, line: 9, twitch: 11, ebay: 27, blizzard: 7, shopee: 32, lazada: 27, paypal: 22, truecaller: 13, signal: 7, fiverr: 9, shopify: 11, blablacar: 9, alibaba: 7, aliexpress: 5, bolt: 7, grindr: 9, protonmail: 13, zoho: 20, tradingview: 11 },
  IN: { netflix: 17, apple: 4, microsoft: 8, steam: 14, tinder: 14, airbnb: 21, yahoo: 5, viber: 12, wechat: 38, line: 4, twitch: 8, ebay: 20, blizzard: 3, shopee: 26, lazada: 8, paypal: 10, truecaller: 13, signal: 4, fiverr: 6, shopify: 8, blablacar: 6, alibaba: 5, aliexpress: 2, bolt: 4, grindr: 6, protonmail: 10, zoho: 17, tradingview: 8 },
  NG: { netflix: 20, apple: 6, microsoft: 10, steam: 15, tinder: 16, airbnb: 25, yahoo: 6, viber: 13, wechat: 40, line: 6, twitch: 9, ebay: 22, blizzard: 5, shopee: 28, lazada: 20, paypal: 15, truecaller: 10, signal: 5, fiverr: 7, shopify: 9, blablacar: 7, alibaba: 6, aliexpress: 4, bolt: 5, grindr: 7, protonmail: 11, zoho: 18, tradingview: 9 },
  RU: { netflix: 22, apple: 7, microsoft: 11, steam: 16, tinder: 18, airbnb: 28, yahoo: 7, viber: 14, wechat: 42, line: 7, twitch: 9, ebay: 23, blizzard: 5, shopee: 29, lazada: 22, paypal: 17, truecaller: 11, signal: 5, fiverr: 8, shopify: 10, blablacar: 8, alibaba: 6, aliexpress: 4, bolt: 6, grindr: 8, protonmail: 12, zoho: 18, tradingview: 10 },
};

const defaultPrices = { netflix: 22, apple: 7, microsoft: 11, steam: 16, tinder: 18, airbnb: 28, yahoo: 7, viber: 14, wechat: 42, line: 7, twitch: 9, ebay: 23, blizzard: 5, shopee: 29, lazada: 22, paypal: 17, truecaller: 11, signal: 5, fiverr: 8, shopify: 10, blablacar: 8, alibaba: 6, aliexpress: 4, bolt: 6, grindr: 8, protonmail: 12, zoho: 18, tradingview: 10 };

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
