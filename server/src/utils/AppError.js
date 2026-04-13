class AppError extends Error {
  constructor(code, statusCode, message) {
    super(message || code);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

module.exports = AppError;
