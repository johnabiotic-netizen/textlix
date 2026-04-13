require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../src/models/User');
const Country = require('../src/models/Country');
const Service = require('../src/models/Service');
const NumberPricing = require('../src/models/NumberPricing');
const PlatformSettings = require('../src/models/PlatformSettings');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/verifynow';

const countries = [
  { name: 'United States', code: 'US', flagEmoji: '🇺🇸', sortOrder: 1 },
  { name: 'United Kingdom', code: 'GB', flagEmoji: '🇬🇧', sortOrder: 2 },
  { name: 'India', code: 'IN', flagEmoji: '🇮🇳', sortOrder: 3 },
  { name: 'Nigeria', code: 'NG', flagEmoji: '🇳🇬', sortOrder: 4 },
  { name: 'Russia', code: 'RU', flagEmoji: '🇷🇺', sortOrder: 5 },
  { name: 'Brazil', code: 'BR', flagEmoji: '🇧🇷', sortOrder: 6 },
  { name: 'Germany', code: 'DE', flagEmoji: '🇩🇪', sortOrder: 7 },
  { name: 'France', code: 'FR', flagEmoji: '🇫🇷', sortOrder: 8 },
  { name: 'Canada', code: 'CA', flagEmoji: '🇨🇦', sortOrder: 9 },
  { name: 'Australia', code: 'AU', flagEmoji: '🇦🇺', sortOrder: 10 },
  { name: 'Indonesia', code: 'ID', flagEmoji: '🇮🇩', sortOrder: 11 },
  { name: 'Philippines', code: 'PH', flagEmoji: '🇵🇭', sortOrder: 12 },
  { name: 'Vietnam', code: 'VN', flagEmoji: '🇻🇳', sortOrder: 13 },
  { name: 'Mexico', code: 'MX', flagEmoji: '🇲🇽', sortOrder: 14 },
  { name: 'Pakistan', code: 'PK', flagEmoji: '🇵🇰', sortOrder: 15 },
  { name: 'Bangladesh', code: 'BD', flagEmoji: '🇧🇩', sortOrder: 16 },
  { name: 'Kenya', code: 'KE', flagEmoji: '🇰🇪', sortOrder: 17 },
  { name: 'Ghana', code: 'GH', flagEmoji: '🇬🇭', sortOrder: 18 },
  { name: 'South Africa', code: 'ZA', flagEmoji: '🇿🇦', sortOrder: 19 },
  { name: 'Ukraine', code: 'UA', flagEmoji: '🇺🇦', sortOrder: 20 },
];

const services = [
  { name: 'WhatsApp', slug: 'whatsapp', icon: 'whatsapp', sortOrder: 1 },
  { name: 'Telegram', slug: 'telegram', icon: 'telegram', sortOrder: 2 },
  { name: 'Google', slug: 'google', icon: 'google', sortOrder: 3 },
  { name: 'Facebook', slug: 'facebook', icon: 'facebook', sortOrder: 4 },
  { name: 'Instagram', slug: 'instagram', icon: 'instagram', sortOrder: 5 },
  { name: 'Twitter / X', slug: 'twitter', icon: 'twitter', sortOrder: 6 },
  { name: 'TikTok', slug: 'tiktok', icon: 'tiktok', sortOrder: 7 },
  { name: 'Snapchat', slug: 'snapchat', icon: 'snapchat', sortOrder: 8 },
  { name: 'LinkedIn', slug: 'linkedin', icon: 'linkedin', sortOrder: 9 },
  { name: 'Discord', slug: 'discord', icon: 'discord', sortOrder: 10 },
  { name: 'Uber', slug: 'uber', icon: 'uber', sortOrder: 11 },
  { name: 'Amazon', slug: 'amazon', icon: 'amazon', sortOrder: 12 },
];

const settings = [
  { key: 'default_margin_percent', value: '30', description: 'Default margin percentage on provider cost' },
  { key: 'number_timeout_minutes', value: '20', description: 'Minutes before a number order expires' },
  { key: 'max_active_numbers', value: '5', description: 'Maximum active number orders per user' },
  { key: 'min_topup_usd', value: '2', description: 'Minimum top-up amount in USD' },
  { key: 'sms_retention_hours', value: '24', description: 'Hours to retain SMS content before deletion' },
  { key: 'primary_sms_provider', value: '5sim', description: 'Primary SMS provider (5sim or smsactivate)' },
  { key: 'paystack_enabled', value: 'true', description: 'Enable Paystack payment method' },
  { key: 'crypto_enabled', value: 'true', description: 'Enable crypto payment method' },
];

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: 'verifynow' });
  console.log('Connected!');

  // Seed platform settings
  console.log('Seeding platform settings...');
  for (const setting of settings) {
    await PlatformSettings.findOneAndUpdate(
      { key: setting.key },
      setting,
      { upsert: true, new: true }
    );
  }

  // Seed countries
  console.log('Seeding countries...');
  const countryDocs = [];
  for (const country of countries) {
    const doc = await Country.findOneAndUpdate(
      { code: country.code },
      country,
      { upsert: true, new: true }
    );
    countryDocs.push(doc);
  }

  // Seed services
  console.log('Seeding services...');
  const serviceDocs = [];
  for (const service of services) {
    const doc = await Service.findOneAndUpdate(
      { slug: service.slug },
      service,
      { upsert: true, new: true }
    );
    serviceDocs.push(doc);
  }

  // Seed pricing (sample prices per country/service)
  console.log('Seeding pricing...');
  const basePrices = {
    US: { whatsapp: 15, telegram: 12, google: 10, facebook: 8, instagram: 12, twitter: 10, tiktok: 15, snapchat: 12, linkedin: 8, discord: 8, uber: 20, amazon: 15 },
    GB: { whatsapp: 18, telegram: 15, google: 12, facebook: 10, instagram: 15, twitter: 12, tiktok: 18, snapchat: 15, linkedin: 10, discord: 10, uber: 22, amazon: 18 },
    IN: { whatsapp: 5, telegram: 4, google: 3, facebook: 3, instagram: 5, twitter: 4, tiktok: 6, snapchat: 5, linkedin: 3, discord: 3, uber: 8, amazon: 5 },
    NG: { whatsapp: 8, telegram: 6, google: 5, facebook: 5, instagram: 8, twitter: 6, tiktok: 10, snapchat: 8, linkedin: 5, discord: 5, uber: 12, amazon: 8 },
    RU: { whatsapp: 10, telegram: 8, google: 6, facebook: 6, instagram: 10, twitter: 8, tiktok: 12, snapchat: 10, linkedin: 6, discord: 6, uber: 15, amazon: 10 },
  };

  const defaultPrices = { whatsapp: 10, telegram: 8, google: 7, facebook: 6, instagram: 10, twitter: 8, tiktok: 12, snapchat: 10, linkedin: 6, discord: 6, uber: 15, amazon: 10 };

  for (const countryDoc of countryDocs) {
    const countryPrices = basePrices[countryDoc.code] || defaultPrices;
    for (const serviceDoc of serviceDocs) {
      const providerCost = countryPrices[serviceDoc.slug] || 10;
      const marginPercent = 30;
      const finalPrice = Math.ceil(providerCost * (1 + marginPercent / 100));

      await NumberPricing.findOneAndUpdate(
        { countryId: countryDoc._id, serviceId: serviceDoc._id },
        {
          countryId: countryDoc._id,
          serviceId: serviceDoc._id,
          providerCost,
          marginPercent,
          finalPrice,
          isAvailable: true,
        },
        { upsert: true, new: true }
      );
    }
  }

  // Seed admin user
  console.log('Seeding admin user...');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@verifynow.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';
  const adminName = process.env.ADMIN_NAME || 'Admin';

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await User.create({
      email: adminEmail,
      passwordHash,
      name: adminName,
      role: 'ADMIN',
      isEmailVerified: true,
      provider: 'LOCAL',
    });
    console.log(`Admin user created: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  // Seed test user
  console.log('Seeding test user...');
  const testEmail = 'test@example.com';
  const existingTest = await User.findOne({ email: testEmail });
  if (!existingTest) {
    const passwordHash = await bcrypt.hash('Test1234!', 12);
    await User.create({
      email: testEmail,
      passwordHash,
      name: 'Test User',
      role: 'USER',
      isEmailVerified: true,
      provider: 'LOCAL',
      creditBalance: 500,
    });
    console.log('Test user created: test@example.com / Test1234!');
  } else {
    console.log('Test user already exists');
  }

  console.log('\n✅ Seed complete!');
  console.log(`  Countries: ${countryDocs.length}`);
  console.log(`  Services: ${serviceDocs.length}`);
  console.log(`  Pricing entries: ${countryDocs.length * serviceDocs.length}`);
  console.log(`  Admin: ${adminEmail} / ${adminPassword}`);
  console.log('  Test user: test@example.com / Test1234!');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
