const { getStoreSettings, DEFAULT_SHIPPING } = require('../models/StoreSettings');
const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const getAdminSiteSettings = asyncHandler(async (req, res) => {
  const settings = await getStoreSettings();
  const sortedAnnouncements = [...(settings.announcements || [])].sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  );
  return sendSuccess(res, {
    heroImage: settings.heroImage || { url: '', publicId: '', alt: '' },
    announcements: sortedAnnouncements,
    shipping: { ...DEFAULT_SHIPPING, ...(settings.shipping?.toObject ? settings.shipping.toObject() : settings.shipping) },
  });
});

const updateHeroImage = asyncHandler(async (req, res) => {
  const { url = '', publicId = '', alt = '' } = req.body || {};
  const settings = await getStoreSettings();
  settings.heroImage = {
    url: String(url || '').trim(),
    publicId: String(publicId || '').trim(),
    alt: String(alt || '').trim().slice(0, 200),
  };
  await settings.save();
  return sendSuccess(res, settings.heroImage, 'Hero image updated');
});

const updateShippingSettings = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const settings = await getStoreSettings();
  const numericFields = [
    'soapWeightG',
    'creamWeightG',
    'lipBalmWeightG',
    'outerPackagingG',
    'zone1RatePerKg',
    'zone2RatePerKg',
    'zone3RatePerKg',
  ];

  const nextShipping = {
    ...DEFAULT_SHIPPING,
    ...(settings.shipping?.toObject ? settings.shipping.toObject() : settings.shipping),
  };

  for (const field of numericFields) {
    if (body[field] !== undefined) {
      const val = Number(body[field]);
      if (!Number.isFinite(val) || val < 0) {
        throw new ApiError(400, `Invalid value for ${field}`);
      }
      nextShipping[field] = val;
    }
  }

  settings.shipping = nextShipping;
  await settings.save();
  return sendSuccess(res, settings.shipping, 'Shipping settings updated');
});

const createAnnouncement = asyncHandler(async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) {
    throw new ApiError(400, 'Announcement text is required');
  }
  const settings = await getStoreSettings();
  const maxOrder = (settings.announcements || []).reduce(
    (max, a) => Math.max(max, Number(a.sortOrder || 0)),
    -1
  );
  settings.announcements.push({
    text: text.slice(0, 220),
    isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true,
    sortOrder: maxOrder + 1,
  });
  await settings.save();
  const sorted = [...settings.announcements].sort((a, b) => a.sortOrder - b.sortOrder);
  return sendSuccess(res, sorted, 'Announcement added', 201);
});

const updateAnnouncement = asyncHandler(async (req, res) => {
  const settings = await getStoreSettings();
  const item = settings.announcements.id(req.params.id);
  if (!item) {
    throw new ApiError(404, 'Announcement not found');
  }

  if (req.body?.text !== undefined) {
    const trimmed = String(req.body.text).trim();
    if (!trimmed) throw new ApiError(400, 'Announcement text cannot be empty');
    item.text = trimmed.slice(0, 220);
  }
  if (req.body?.isActive !== undefined) {
    item.isActive = Boolean(req.body.isActive);
  }

  await settings.save();
  const sorted = [...settings.announcements].sort((a, b) => a.sortOrder - b.sortOrder);
  return sendSuccess(res, sorted, 'Announcement updated');
});

const reorderAnnouncements = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const settings = await getStoreSettings();
  items.forEach(({ id, sortOrder }, idx) => {
    const item = settings.announcements.id(id);
    if (item) {
      item.sortOrder = sortOrder !== undefined ? Number(sortOrder) : idx;
    }
  });
  await settings.save();
  const sorted = [...settings.announcements].sort((a, b) => a.sortOrder - b.sortOrder);
  return sendSuccess(res, sorted, 'Announcement order updated');
});

const deleteAnnouncement = asyncHandler(async (req, res) => {
  const settings = await getStoreSettings();
  const item = settings.announcements.id(req.params.id);
  if (!item) {
    throw new ApiError(404, 'Announcement not found');
  }
  item.deleteOne();
  await settings.save();
  const sorted = [...settings.announcements].sort((a, b) => a.sortOrder - b.sortOrder);
  return sendSuccess(res, sorted, 'Announcement deleted');
});

module.exports = {
  getAdminSiteSettings,
  updateHeroImage,
  updateShippingSettings,
  createAnnouncement,
  updateAnnouncement,
  reorderAnnouncements,
  deleteAnnouncement,
};
