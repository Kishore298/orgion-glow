const env = require('./env');

/**
 * Static site configuration (Section 13).
 * Not editable from the Admin Panel. Values with placeholders marked TODO should be
 * confirmed before going live in production.
 */
const siteConfig = {
  storeName: 'ORGION',
  tagline: 'Quiet Luxury Meets Nature',
  whatsappNumber: process.env.ORGION_WHATSAPP_NUMBER || '919360910640',
  whatsappDefaultMessage:
    'Hello ORGION! I would love to know more about your herbal skincare and lip care.',
  supportEmail: process.env.ORGION_SUPPORT_EMAIL || 'orgion.we@gmail.com',
  supportPhone: process.env.ORGION_SUPPORT_PHONE || '+91 93609 10640',
  socialLinks: {
    instagram: 'https://www.instagram.com/orgion.we',
  },
  // TODO: Replace with registered GSTIN before issuing GST tax invoices
  gstin: process.env.ORGION_GSTIN || '33ABCDE1234F1Z5',
  businessAddress: {
    companyName: 'ORGION',
    line1: 'Nagercoil',
    line2: 'Tamil Nadu, India',
    country: 'India',
  },
  // Used by future shipping logic; when null, UI hides "free shipping over ₹X" banner
  freeShippingThreshold: process.env.FREE_SHIPPING_THRESHOLD
    ? Number(process.env.FREE_SHIPPING_THRESHOLD)
    : null,
  // Placeholder stub shipping charge (INR) used by ShippingService until real rules are decided
  SHIPPING_STUB_CHARGE: process.env.SHIPPING_STUB_CHARGE
    ? Number(process.env.SHIPPING_STUB_CHARGE)
    : 0,
  // TODO: Confirm the official ST Courier tracking page URL
  stCourierTrackingUrl: 'https://stcourier.com/track/courier-tracking',
  clientCustomerUrl: env.CLIENT_CUSTOMER_URL,
  clientAdminUrl: env.CLIENT_ADMIN_URL,
};

/**
 * Public non-sensitive subset exposed via GET /api/v1/site-config.
 */
function getPublicSiteConfig() {
  return {
    storeName: siteConfig.storeName,
    tagline: siteConfig.tagline,
    whatsappNumber: siteConfig.whatsappNumber,
    whatsappDefaultMessage: siteConfig.whatsappDefaultMessage,
    supportEmail: siteConfig.supportEmail,
    supportPhone: siteConfig.supportPhone,
    businessAddress: siteConfig.businessAddress,
    socialLinks: siteConfig.socialLinks,
    freeShippingThreshold: siteConfig.freeShippingThreshold,
    stCourierTrackingUrl: siteConfig.stCourierTrackingUrl,
  };
}

module.exports = {
  siteConfig,
  getPublicSiteConfig,
};
