require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function fixIndex() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'verifynow' });
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection('users');

  // Drop the non-sparse unique index so Mongoose recreates it correctly as sparse
  try {
    await collection.dropIndex('referralCode_1');
    console.log('Dropped referralCode_1 index');
  } catch (err) {
    if (err.code === 27) {
      console.log('Index referralCode_1 not found — already dropped or never existed');
    } else {
      throw err;
    }
  }

  // Recreate it correctly: unique + sparse (nulls are excluded from the index)
  await collection.createIndex(
    { referralCode: 1 },
    { unique: true, sparse: true, name: 'referralCode_1' }
  );
  console.log('Recreated referralCode_1 as sparse unique index');

  await mongoose.disconnect();
  console.log('Done');
}

fixIndex().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
