// Fuzzy-find a user by partial email match. Useful when the support
// query has a typo or formatting variation.
// Usage: railway run node scripts/find-user.js takeheed

const mongoose = require('mongoose');
const User = require('../src/models/User');

(async () => {
  const q = process.argv[2];
  if (!q) { console.error('usage: find-user.js <fragment>'); process.exit(1); }

  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({
    email: { $regex: q, $options: 'i' },
  }).select('email name creditBalance createdAt isBanned').limit(20);

  console.log(`Matches for "${q}": ${users.length}`);
  for (const u of users) {
    console.log(`  ${u.email.padEnd(40)} ${u.name?.padEnd(25) || ''} ${u.creditBalance}cr  joined=${u.createdAt.toISOString().slice(0, 10)}${u.isBanned ? ' BANNED' : ''}`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
