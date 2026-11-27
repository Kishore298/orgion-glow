const nodemailer = require('nodemailer');
const env = require('../config/env');
const { siteConfig, getPublicSiteConfig } = require('../config/site.config');
const { getStoreSettings, DEFAULT_SHIPPING } = require('../models/StoreSettings');
const { calculateShipping } = require('../services/shipping.service');
const { asyncHandler, sendSuccess } = require('../utils/apiResponse');

const getSiteConfig = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const settings = await getStoreSettings().catch(() => null);
  const activeAnnouncements = (settings?.announcements || [])
    .filter((a) => a.isActive)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map((a) => ({ _id: a._id, text: a.text, sortOrder: a.sortOrder }));

  const shippingConfig = {
    ...DEFAULT_SHIPPING,
    ...(settings?.shipping?.toObject ? settings.shipping.toObject() : settings?.shipping || {}),
  };

  return sendSuccess(res, {
    ...getPublicSiteConfig(),
    heroImage: settings?.heroImage || { url: '', publicId: '', alt: '' },
    announcements: activeAnnouncements,
    shippingRules: shippingConfig,
  });
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
