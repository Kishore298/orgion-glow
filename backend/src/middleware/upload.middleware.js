const multer = require('multer');
const { ApiError } = require('../utils/apiResponse');

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 8,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new ApiError(400, 'Only JPG, PNG, and WebP images are allowed'));
    }
    return cb(null, true);
  },
});

module.exports = { upload };
