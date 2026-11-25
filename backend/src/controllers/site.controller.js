const nodemailer = require('nodemailer');
const env = require('../config/env');
const { siteConfig, getPublicSiteConfig } = require('../config/site.config');
const { calculateShipping } = require('../services/shipping.service');
const { asyncHandler, sendSuccess } = require('../utils/apiResponse');

const getSiteConfig = asyncHandler(async (req, res) => {
  return sendSuccess(res, getPublicSiteConfig());
});

const calculateShippingQuote = asyncHandler(async (req, res) => {
  const { pincode, state, subtotal, weight, items } = req.body || {};
  const result = await calculateShipping({ pincode, state, subtotal, weight, items });
  return sendSuccess(res, result);
});

const submitContact = asyncHandler(async (req, res) => {
  const { name, email, mobile, subject, message } = req.body;

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: siteConfig.supportEmail,
      replyTo: email,
      subject: `[ORGION Contact] ${subject} — ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nMobile: ${mobile || 'N/A'}\n\n${message}`,
    });
  } else if (env.NODE_ENV !== 'test') {
    console.log(`[Contact:dev-stub] From=${name} <${email}> Subject="${subject}"`);
  }

  return sendSuccess(
    res,
    null,
    'Thank you for reaching out! Our team will respond within 24 hours.'
  );
});

module.exports = {
  getSiteConfig,
  calculateShippingQuote,
  submitContact,
};
