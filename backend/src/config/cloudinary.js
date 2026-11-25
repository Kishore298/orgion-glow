const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('./env');

const hasCloudinary = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Uploads an image buffer to Cloudinary (or local /uploads fallback if configured).
 * @param {Buffer} buffer
 * @param {object} options
 * @returns {Promise<{url: string, publicId: string}>}
 */
async function uploadImageBuffer(buffer, { folder = 'orgion', originalname = 'image.jpg' } = {}) {
  if (hasCloudinary && env.UPLOAD_STORAGE !== 'local') {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (err, result) => {
          if (err) return reject(err);
          return resolve({ url: result.secure_url, publicId: result.public_id });
        }
      );
      stream.end(buffer);
    });
  }

  // Local disk fallback when UPLOAD_STORAGE=local or Cloudinary keys absent
  const uploadsDir = path.resolve(__dirname, '../../uploads', folder);
  fs.mkdirSync(uploadsDir, { recursive: true });
  const ext = path.extname(originalname) || '.jpg';
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const fullPath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(fullPath, buffer);
  return {
    url: `/uploads/${folder}/${filename}`,
    publicId: `local:${folder}/${filename}`,
  };
}

module.exports = {
  cloudinary,
  hasCloudinary,
  uploadImageBuffer,
};
