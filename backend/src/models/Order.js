const mongoose = require('mongoose');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../utils/orderTransitions');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    slug: { type: String, default: '' },
    image: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    weight: { type: Number, default: 0 },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, default: '' },
  },
  { _id: true }
);

const paymentAttemptSchema = new mongoose.Schema(
  {
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    status: { type: String, default: 'created' },
    method: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    errorCode: { type: String, default: '' },
    errorDescription: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const refundRecordSchema = new mongoose.Schema(
  {
    razorpayRefundId: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['initiated', 'processed', 'failed'], default: 'initiated' },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    initiatedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
  },
  { _id: true }
);

const trackingHistorySchema = new mongoose.Schema(
  {
    courier: { type: String, default: 'ST Courier' },
    trackingId: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    addressSnapshot: {
      fullName: { type: String, required: true },
      mobile: { type: String, required: true },
      line1: { type: String, required: true },
      line2: { type: String, default: '' },
      landmark: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      type: { type: String, default: 'Home' },
    },
    subtotal: { type: Number, required: true, min: 0 },
    shippingCharge: { type: Number, required: true, min: 0, default: 0 },
    couponCode: { type: String, default: '', uppercase: true, trim: true },
    couponDiscountAmount: { type: Number, required: true, min: 0, default: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'pending_payment',
      index: true,
    },
    statusHistory: { type: [statusHistorySchema], default: [] },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'pending',
      index: true,
    },
    payment: {
      razorpayOrderId: { type: String, index: true, sparse: true },
      razorpayPaymentId: { type: String, index: true, sparse: true },
      signature: { type: String, default: '' },
      method: { type: String, default: '' },
      cardLast4: { type: String, default: '' },
      amount: { type: Number, default: 0 },
      fee: { type: Number, default: 0 },
      status: { type: String, default: 'pending' },
      errorCode: { type: String, default: '' },
      errorDescription: { type: String, default: '' },
      paidAt: { type: Date },
      attempts: { type: [paymentAttemptSchema], default: [] },
      refunds: { type: [refundRecordSchema], default: [] },
    },
    tracking: {
      courier: { type: String, default: 'ST Courier' },
      trackingId: { type: String, default: '', index: true },
      updatedAt: { type: Date },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    trackingHistory: { type: [trackingHistorySchema], default: [] },
    deliveredAt: { type: Date },
    reviewPrompt: {
      dismissCount: { type: Number, default: 0 },
      lastPromptedAt: { type: Date },
    },
    needsReview: { type: Boolean, default: false, index: true },
    needsReviewReason: { type: String, default: '' },
    notes: { type: String, default: '' },
    expiresAt: { type: Date, index: true },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1, status: 1, deliveredAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
