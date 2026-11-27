const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    shortDescription: { type: String, default: '', maxlength: 300 },
    description: { type: String, default: '' },
    benefits: { type: [String], default: [] },
    keyIngredients: { type: [String], default: [] },
    howToUse: { type: String, default: '' },
    images: { type: [productImageSchema], default: [] },
    weight: { type: Number, min: 0 }, // grams, used by future shipping rules
    tags: { type: [String], default: [] },
    isBestseller: { type: Boolean, default: false, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isOffer: { type: Boolean, default: false, index: true },
    relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    inStock: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      enum: ['active', 'draft'],
      default: 'active',
      index: true,
    },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    ratingBreakdown: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 },
    },
    seo: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
    },
    details: {
      brand: { type: String, default: 'Orgion' },
      productName: { type: String, default: '' },
      skinType: { type: String, default: 'Suitable for all skin types' },
      closingLine: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', shortDescription: 'text', tags: 'text' });
productSchema.index({ price: 1, ratingAvg: -1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
