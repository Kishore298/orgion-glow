const Order = require('../models/Order');
const Counter = require('../models/Counter');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { roundMoney } = require('../utils/currency');
const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');
const { calculateShipping } = require('../services/shipping.service');
const { validateCouponForCart } = require('../services/coupon.service');
const { createRazorpayOrderForOrder } = require('../services/payment.service');
const { generateInvoicePdfBuffer } = require('../services/invoice.service');
const { recalcProductRating } = require('../services/rating.service');

function buildOrderRefQuery(ref, userId) {
  const isOid = /^[0-9a-fA-F]{24}$/.test(String(ref || ''));
  return {
    ...(isOid ? { _id: ref } : { orderNumber: String(ref || '').toUpperCase() }),
    ...(userId ? { user: userId } : {}),
  };
}

async function generateOrderNumber(deps = {}) {
  const CounterModel = deps.Counter || Counter;
  const OrderModel = deps.Order || Order;
  const now = deps.now || new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const counterId = `order-${yy}`;

  for (let i = 0; i < 5; i += 1) {
    const counter = await CounterModel.findByIdAndUpdate(
      counterId,
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const candidate = `ORGION-${yy}-${String(counter.seq).padStart(5, '0')}`;
    const exists = await OrderModel.exists({ orderNumber: candidate });
    if (!exists) return candidate;
  }

  return `ORGION-${yy}-${Date.now().toString().slice(-5)}`;
}

function formatReviewerShortName(fullName) {
  const parts = String(fullName || 'Customer').trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || '';
  return `${parts[0]} ${lastInitial}.`;
}

const checkout = asyncHandler(async (req, res) => {
  const { cartItems, addressId, address, saveAddress, email, coupon_code, couponCode } = req.body;

  // Ensure customer has an email (prompt legacy users if missing)
  if (!req.user.email) {
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      req.user.email = String(email).trim().toLowerCase();
      await req.user.save();
    } else {
      throw new ApiError(400, 'Please provide your email address to receive order updates.');
    }
  }

  // Resolve delivery address
  let resolvedAddress = null;
  if (addressId) {
    const saved = req.user.addresses.id(addressId);
    if (!saved) throw new ApiError(404, 'Selected address not found');
    resolvedAddress = {
      fullName: saved.fullName,
      mobile: saved.mobile,
      line1: saved.line1,
      line2: saved.line2 || '',
      landmark: saved.landmark || '',
      city: saved.city,
      state: saved.state,
      pincode: saved.pincode,
      type: saved.type || 'Home',
    };
  } else if (address) {
    resolvedAddress = {
      fullName: address.fullName,
      mobile: address.mobile,
      line1: address.line1,
      line2: address.line2 || '',
      landmark: address.landmark || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      type: address.type || 'Home',
    };
    if (saveAddress) {
      if (req.user.addresses.length === 0 || address.isDefault) {
        req.user.addresses.forEach((a) => {
          a.isDefault = false;
        });
        resolvedAddress.isDefault = true;
      }
      req.user.addresses.push(resolvedAddress);
      await req.user.save();
    }
  } else {
    throw new ApiError(400, 'Delivery address is required');
  }

  // Re-fetch products from DB and compute prices & categories strictly server-side
  const productIds = cartItems.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } }).populate('category', 'name slug');
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const orderItems = [];
  let subtotal = 0;
  let totalWeight = 0;

  for (const ci of cartItems) {
    const prod = productMap.get(String(ci.productId));
    if (!prod || prod.status !== 'active') {
      throw new ApiError(400, 'One or more items in your bag are no longer available');
    }
    if (!prod.inStock || Number(prod.price) <= 0) {
      throw new ApiError(400, `"${prod.name}" is currently unavailable for purchase`);
    }

    const qty = Math.min(20, Math.max(1, Number(ci.qty)));
    const primaryImg = prod.images?.find((i) => i.isPrimary)?.url || prod.images?.[0]?.url || '';
    subtotal = roundMoney(subtotal + prod.price * qty);
    totalWeight += Number(prod.weight || 0) * qty;

    orderItems.push({
      product: prod._id,
      name: prod.name,
      slug: prod.slug,
      image: primaryImg,
      price: prod.price,
      qty,
      weight: prod.weight || 0,
    });
  }

  const shipping = await calculateShipping(
    {
      pincode: resolvedAddress.pincode,
      state: resolvedAddress.state,
      subtotal,
      weight: totalWeight,
      items: orderItems,
    },
    { productMap }
  );

  if (shipping.resolvedState) {
    resolvedAddress.state = shipping.resolvedState;
  }

  if (!shipping.serviceable) {
    throw new ApiError(400, shipping.message || 'Delivery is currently unavailable to this pincode');
  }

  const shippingCharge = roundMoney(shipping.charge);

  // Server-side coupon validation (never trust client discount values)
  const rawCouponCode = coupon_code || couponCode || '';
  let appliedCouponCode = '';
  let couponDiscountAmount = 0;
  if (rawCouponCode && rawCouponCode.trim()) {
    const couponResult = await validateCouponForCart(
      { code: rawCouponCode, userId: req.user._id, items: orderItems },
      { subtotal, productMap }
    );
    appliedCouponCode = couponResult.coupon.code;
    couponDiscountAmount = couponResult.discountAmount;
  }

  const total = roundMoney(Math.max(0, subtotal - couponDiscountAmount) + shippingCharge);

  // Reuse an active unpaid pending_payment order for this customer instead of creating duplicates
  let order = await Order.findOne({
    user: req.user._id,
    status: 'pending_payment',
    paymentStatus: { $in: ['pending', 'failed'] },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  let razorpay;
  if (order) {
    const amountChanged = roundMoney(order.total) !== total;
    order.items = orderItems;
    order.addressSnapshot = resolvedAddress;
    order.subtotal = subtotal;
    order.shippingCharge = shippingCharge;
    order.couponCode = appliedCouponCode;
    order.couponDiscountAmount = couponDiscountAmount;
    order.discount = couponDiscountAmount;
    order.total = total;
    order.expiresAt = new Date(Date.now() + 45 * 60 * 1000);
    await order.save();
    razorpay = await createRazorpayOrderForOrder(order, { forceNew: amountChanged });
  } else {
    const orderNumber = await generateOrderNumber();
    order = await Order.create({
      orderNumber,
      user: req.user._id,
      items: orderItems,
      addressSnapshot: resolvedAddress,
      subtotal,
      shippingCharge,
      couponCode: appliedCouponCode,
      couponDiscountAmount,
      discount: couponDiscountAmount,
      total,
      status: 'pending_payment',
      statusHistory: [
        {
          status: 'pending_payment',
          at: new Date(),
          by: req.user._id,
          note: 'Order initiated at checkout',
        },
      ],
      paymentStatus: 'pending',
      expiresAt: new Date(Date.now() + 45 * 60 * 1000),
    });
    razorpay = await createRazorpayOrderForOrder(order);
  }

  return sendSuccess(
    res,
    {
      order,
      razorpay,
      prefill: {
        name: req.user.name,
        email: req.user.email,
        contact: req.user.mobile,
      },
    },
    'Order created, proceed to payment',
    201
  );
});

const retryPayment = asyncHandler(async (req, res) => {
  const order = await Order.findOne(buildOrderRefQuery(req.params.id, req.user._id));
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.paymentStatus === 'paid') {
    throw new ApiError(400, 'This order is already paid');
  }

  if (order.couponCode) {
    await validateCouponForCart(
      { code: order.couponCode, userId: req.user._id, items: order.items },
      { subtotal: order.subtotal }
    );
  }

  const razorpay = await createRazorpayOrderForOrder(order, { forceNew: true });
  return sendSuccess(res, {
    order,
    razorpay,
    prefill: {
      name: req.user.name,
      email: req.user.email,
      contact: req.user.mobile,
    },
  });
});

const getMyOrders = asyncHandler(async (req, res) => {
  const pageNum = Math.max(1, parseInt(req.query.page || '1', 10));
  const limitNum = Math.min(30, Math.max(1, parseInt(req.query.limit || '10', 10)));

  const filter = {
    user: req.user._id,
    paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] },
  };
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    items,
    total,
    page: pageNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
  });
});

const getOrderDetail = asyncHandler(async (req, res) => {
  const order = await Order.findOne(buildOrderRefQuery(req.params.id, req.user._id)).lean();
  if (!order) throw new ApiError(404, 'Order not found');

  const existingReviews = await Review.find({
    order: order._id,
    source: 'customer',
  })
    .select('product rating comment reviewDate')
    .lean();

  const ratedByProduct = {};
  for (const r of existingReviews) {
    ratedByProduct[String(r.product)] = r;
  }

  return sendSuccess(res, { order, ratedByProduct });
});

const getOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findOne(buildOrderRefQuery(req.params.id, req.user._id))
    .select('orderNumber status paymentStatus total')
    .lean();
  if (!order) throw new ApiError(404, 'Order not found');
  return sendSuccess(res, order);
});

const downloadInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findOne(buildOrderRefQuery(req.params.id, req.user._id)).lean();
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.paymentStatus === 'pending' || order.paymentStatus === 'expired') {
    throw new ApiError(400, 'Invoice is available once payment is confirmed');
  }

  const pdfBuffer = await generateInvoicePdfBuffer(order);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ORGION-Invoice-${order.orderNumber}.pdf"`);
  return res.send(pdfBuffer);
});

const getPendingReviews = asyncHandler(async (req, res) => {
  const snoozeCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const deliveredOrders = await Order.find({
    user: req.user._id,
    status: 'delivered',
    'reviewPrompt.dismissCount': { $lt: 3 },
    $or: [
      { 'reviewPrompt.lastPromptedAt': { $exists: false } },
      { 'reviewPrompt.lastPromptedAt': null },
      { 'reviewPrompt.lastPromptedAt': { $lte: snoozeCutoff } },
    ],
  })
    .sort({ deliveredAt: -1, updatedAt: -1 })
    .limit(5)
    .lean();

  for (const order of deliveredOrders) {
    const existingReviews = await Review.find({
      order: order._id,
      source: 'customer',
    })
      .select('product')
      .lean();
    const ratedSet = new Set(existingReviews.map((r) => String(r.product)));
    const unratedItems = (order.items || []).filter((i) => !ratedSet.has(String(i.product)));
    if (unratedItems.length > 0) {
      return sendSuccess(res, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        deliveredAt: order.deliveredAt,
        unratedItems,
      });
    }
  }

  return sendSuccess(res, null);
});

const dismissReviewPrompt = asyncHandler(async (req, res) => {
  const order = await Order.findOneAndUpdate(
    buildOrderRefQuery(req.params.id, req.user._id),
    {
      $inc: { 'reviewPrompt.dismissCount': 1 },
      $set: { 'reviewPrompt.lastPromptedAt': new Date() },
    },
    { new: true }
  ).select('reviewPrompt');

  if (!order) throw new ApiError(404, 'Order not found');
  return sendSuccess(res, order.reviewPrompt, 'Review reminder snoozed');
});

/**
 * Customer post-delivery rating submission (Section 3.7B).
 * Enforces: delivered-only, item belongs to order, once per product per order (409 on duplicate).
 */
async function submitOrderItemReviewCore({ user, orderId, productId, rating, comment }, deps = {}) {
  const OrderModel = deps.Order || Order;
  const ReviewModel = deps.Review || Review;
  const recalc = deps.recalcProductRating || recalcProductRating;

  const order = await OrderModel.findOne(buildOrderRefQuery(orderId, user._id));
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  if (order.status !== 'delivered') {
    throw new ApiError(400, 'Products can only be rated after the order has been delivered');
  }

  const orderedItem = (order.items || []).find(
    (item) =>
      String(item.product) === String(productId) ||
      (item.slug && String(item.slug) === String(productId))
  );
  if (!orderedItem) {
    throw new ApiError(400, 'This product was not part of the specified order');
  }

  const existing = await ReviewModel.findOne({
    order: order._id,
    product: orderedItem.product,
    source: 'customer',
  });
  if (existing) {
    throw new ApiError(409, 'You have already rated this product for this order');
  }

  let review;
  try {
    review = await ReviewModel.create({
      product: orderedItem.product,
      source: 'customer',
      rating: Number(rating),
      comment: String(comment || '').trim().slice(0, 500),
      reviewerName: formatReviewerShortName(user.name),
      reviewerLocation: order.addressSnapshot?.city || '',
      reviewDate: new Date(),
      isFeatured: false,
      user: user._id,
      order: order._id,
      isVerifiedPurchase: true,
      status: 'visible',
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'You have already rated this product for this order');
    }
    throw err;
  }

  await recalc(orderedItem.product);
  return review;
}

const submitOrderItemReview = asyncHandler(async (req, res) => {
  const { orderId, productId } = req.params;
  const { rating, comment } = req.body;
  const review = await submitOrderItemReviewCore({
    user: req.user,
    orderId,
    productId,
    rating,
    comment,
  });
  return sendSuccess(res, review, 'Thank you for your rating!', 201);
});

module.exports = {
  checkout,
  retryPayment,
  getMyOrders,
  getOrderDetail,
  getOrderStatus,
  downloadInvoice,
  getPendingReviews,
  dismissReviewPrompt,
  submitOrderItemReview,
  submitOrderItemReviewCore,
  formatReviewerShortName,
  generateOrderNumber,
};
