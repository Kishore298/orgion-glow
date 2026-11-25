const rateLimit = require('express-rate-limit');

const buildLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });

const authLimiter = buildLimiter(
  15 * 60 * 1000,
  40,
  'Too many authentication attempts. Please try again after 15 minutes.'
);

const paymentLimiter = buildLimiter(
  15 * 60 * 1000,
  60,
  'Too many payment requests. Please wait a moment and try again.'
);

const reviewLimiter = buildLimiter(
  15 * 60 * 1000,
  30,
  'Too many review submissions. Please wait a moment.'
);

const contactLimiter = buildLimiter(
  60 * 60 * 1000,
  10,
  'Too many messages sent. Please try again later.'
);

const apiLimiter = buildLimiter(
  15 * 60 * 1000,
  600,
  'Too many requests. Please slow down.'
);

module.exports = {
  authLimiter,
  paymentLimiter,
  reviewLimiter,
  contactLimiter,
  apiLimiter,
};
