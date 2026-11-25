const crypto = require('crypto');
const env = require('../config/env');

/**
 * OTP-ready abstraction so SMS OTP providers (MSG91, Twilio, etc.) can be
 * plugged in later without changing auth controllers.
 */
function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

async function sendOtp({ mobile, email, purpose = 'password_reset', otp }) {
  // TODO: Replace stub with SMS gateway integration (e.g. MSG91 / Twilio) in production.
  if (env.NODE_ENV !== 'test') {
    console.log(`[OTP:${purpose}] mobile=${mobile} email=${email || 'n/a'} otp=${otp}`);
  }
  return { sent: true, channel: 'stub' };
}

module.exports = {
  generateOtpCode,
  hashOtp,
  sendOtp,
};
