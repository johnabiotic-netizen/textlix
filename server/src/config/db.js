const mongoose = require('mongoose');
const logger = require('./logger');

const fixReferralCodeIndex = async () => {
  try {
    const col = mongoose.connection.db.collection('users');
    const indexes = await col.indexes();
    const existing = indexes.find((i) => i.name === 'referralCode_1');
    if (existing && !existing.sparse) {
      await col.dropIndex('referralCode_1');
      await col.createIndex({ referralCode: 1 }, { unique: true, sparse: true });
      logger.info('Fixed referralCode index: recreated as sparse unique');
    }
  } catch (err) {
    logger.error('referralCode index fix failed:', err.message);
  }
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'verifynow',
    });
    logger.info('MongoDB connected');
    await fixReferralCodeIndex();
  } catch (err) {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

module.exports = connectDB;
