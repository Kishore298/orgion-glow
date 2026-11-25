const env = require('../config/env');

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyPattern || {});
    message = fields.length
      ? `Duplicate value for ${fields.join(', ')}`
      : 'Duplicate record already exists';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    const errs = Object.values(err.errors || {}).map((e) => e.message);
    message = errs[0] || 'Validation error';
    details = errs;
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.message || 'File upload failed';
  }

  if (statusCode >= 500) {
    console.error('[Error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(env.NODE_ENV === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
