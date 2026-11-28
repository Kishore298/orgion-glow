const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['whatsapp', 'customer'],
      required: true,
      index: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 2000 },
    reviewerName: { type: String, required: true, trim: true, maxlength: 100 },
    reviewerLocation: { type: String, default: '', trim: true, maxlength: 100 },
    screenshot: { type: String, default: '' },
    reviewDate: { type: Date, default: Date.now },
    isFeatured: { type: Boolean, default: false, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    isVerifiedPurchase: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['pending', 'visible', 'hidden'],
      default: 'visible',
      index: true,
    },
    adminReply: { type: String, default: '', trim: true, maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Enforces ONE customer rating per product per order
reviewSchema.index(
  { order: 1, product: 1 },
  {
    unique: true,
    partialFilterExpression: { source: 'customer' },
  }
);
reviewSchema.index({ product: 1, status: 1, reviewDate: -1 });

module.exports = mongoose.model('Review', reviewSchema);
