const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 220 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true, timestamps: true }
);

const DEFAULT_SHIPPING = {
  soapWeightG: 125,
  creamWeightG: 40,
  lipBalmWeightG: 40,
  outerPackagingG: 200,
  zone1RatePerKg: 50,
  zone2RatePerKg: 90,
  zone3RatePerKg: 120,
};

const storeSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true, index: true },
    heroImage: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      alt: { type: String, default: '' },
    },
    announcements: { type: [announcementSchema], default: [] },
    shipping: {
      soapWeightG: { type: Number, default: DEFAULT_SHIPPING.soapWeightG, min: 0 },
      creamWeightG: { type: Number, default: DEFAULT_SHIPPING.creamWeightG, min: 0 },
      lipBalmWeightG: { type: Number, default: DEFAULT_SHIPPING.lipBalmWeightG, min: 0 },
      outerPackagingG: { type: Number, default: DEFAULT_SHIPPING.outerPackagingG, min: 0 },
      zone1RatePerKg: { type: Number, default: DEFAULT_SHIPPING.zone1RatePerKg, min: 0 },
      zone2RatePerKg: { type: Number, default: DEFAULT_SHIPPING.zone2RatePerKg, min: 0 },
      zone3RatePerKg: { type: Number, default: DEFAULT_SHIPPING.zone3RatePerKg, min: 0 },
    },
  },
  { timestamps: true }
);

async function getStoreSettings() {
  if (mongoose.connection.readyState !== 1) {
    return {
      heroImage: { url: '', publicId: '', alt: '' },
      announcements: [],
      shipping: { ...DEFAULT_SHIPPING },
    };
  }
  let doc = await StoreSettings.findOne({ key: 'default' });
  if (!doc) {
    doc = await StoreSettings.create({
      key: 'default',
      heroImage: { url: '', publicId: '', alt: '' },
      announcements: [],
      shipping: { ...DEFAULT_SHIPPING },
    });
  }
  return doc;
}

const StoreSettings = mongoose.model('StoreSettings', storeSettingsSchema);

module.exports = {
  StoreSettings,
  DEFAULT_SHIPPING,
  getStoreSettings,
};
