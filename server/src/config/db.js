const mongoose = require('mongoose');
const logger = require('./logger');

const repairReferralCodeIndex = async () => {
  try {
    const collection = mongoose.connection.collection('users');
    const indexes = await collection.indexes();
    const bad = indexes.find((i) => i.name === 'referralCode_1' && !i.sparse);
    if (bad) {
      await collection.dropIndex('referralCode_1');
      logger.info('Dropped non-sparse referralCode_1 index — Mongoose will recreate it as sparse');
    }
  } catch (err) {
    logger.warn('referralCode index repair skipped:', err.message);
  }
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'verifynow',
    });
    logger.info('MongoDB connected');
    await repairReferralCodeIndex();
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
