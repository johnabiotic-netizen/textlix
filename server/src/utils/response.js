const success = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({ success: true, data });
};

const error = (res, code, message, statusCode = 500) => {
  return res.status(statusCode).json({ success: false, error: { code, message } });
};

module.exports = { success, error };
