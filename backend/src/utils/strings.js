function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const TRACKING_ID_REGEX = /^[A-Z0-9-]{6,30}$/;

function normalizeTrackingId(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().toUpperCase();
}

function isValidTrackingId(normalized) {
  return TRACKING_ID_REGEX.test(normalized);
}

module.exports = {
  slugify,
  TRACKING_ID_REGEX,
  normalizeTrackingId,
  isValidTrackingId,
};
