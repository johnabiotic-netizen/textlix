const logger = require('../config/logger');
const AppError = require('../utils/AppError');

const errorMiddleware = (err, req, res, next) => {
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  logger.error('Unhandled error:', err);

  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
};

module.exports = errorMiddleware;
