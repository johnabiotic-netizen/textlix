const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'verifynow',
    });
    logger.info('MongoDB connected');
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
