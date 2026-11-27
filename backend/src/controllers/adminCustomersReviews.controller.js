const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { recalcProductRating } = require('../services/rating.service');
const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

// --- CUSTOMERS ---
const listAdminCustomers = asyncHandler(async (req, res) => {
  const { search, blocked, page = '1', limit = '20' } = req.query;
  const match = { role: 'customer' };

  if (blocked === 'true') match.isBlocked = true;
  if (blocked === 'false') match.isBlocked = false;
  if (search && search.trim()) {
    const q = search.trim();
    match.$or = [
      { name: { $regex: q, $options: 'i' } },
      { mobile: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [items, total] = await Promise.all([
    User.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: (pageNum - 1) * limitNum },
      { $limit: limitNum },
      {
        $lookup: {
          from: 'orders',
          let: { uid: '$_id', umobile: { $ifNull: ['$mobile', ''] } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$user', '$$uid'] },
                    {
                      $and: [
                        { $ne: ['$$umobile', ''] },
                        { $eq: ['$addressSnapshot.mobile', '$$umobile'] },
                      ],
                    },
                  ],
                },
                paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] },
              },
            },
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalSpent: { $sum: '$total' },
                lastOrderDate: { $max: '$createdAt' },
              },
            },
          ],
          as: 'orderStats',
        },
      },
      {
        $project: {
          name: 1,
          mobile: 1,
          email: 1,
          isBlocked: 1,
          createdAt: 1,
          lastLoginAt: 1,
          totalOrders: { $ifNull: [{ $arrayElemAt: ['$orderStats.totalOrders', 0] }, 0] },
          totalSpent: { $ifNull: [{ $arrayElemAt: ['$orderStats.totalSpent', 0] }, 0] },
          lastOrderDate: { $arrayElemAt: ['$orderStats.lastOrderDate', 0] },
        },
      },
    ]),
    User.countDocuments(match),
  ]);

  return sendSuccess(res, {
    items,
    total,
    page: pageNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
  });
});

const getAdminCustomerDetail = asyncHandler(async (req, res) => {
  const ref = req.params.id;
  const query = /^[0-9a-fA-F]{24}$/.test(String(ref))
    ? { _id: ref, role: 'customer' }
    : { mobile: String(ref), role: 'customer' };
  const customer = await User.findOne(query).lean();
  if (!customer) throw new ApiError(404, 'Customer not found');

  const [orders, ratingsGiven] = await Promise.all([
    Order.find({
      $or: [
        { user: customer._id },
        ...(customer.mobile ? [{ 'addressSnapshot.mobile': customer.mobile }] : []),
      ],
      paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] },
    })
      .sort({ createdAt: -1 })
      .lean(),
    Review.find({ user: customer._id, source: 'customer' })
      .populate('product', 'name slug')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const paidOrders = orders.filter((o) => ['paid', 'partially_refunded'].includes(o.paymentStatus));
  const cancelledCount = orders.filter((o) => o.status === 'cancelled').length;
  const lifetimeValue = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const averageOrderValue = paidOrders.length
    ? Math.round((lifetimeValue / paidOrders.length) * 100) / 100
    : 0;

  const sortedPaid = [...paidOrders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const firstOrderDate = sortedPaid[0]?.createdAt || null;
  const lastOrderDate = sortedPaid[sortedPaid.length - 1]?.createdAt || null;

  let orderFrequencyDays = null;
  if (sortedPaid.length > 1) {
    const spanDays =
      (new Date(lastOrderDate).getTime() - new Date(firstOrderDate).getTime()) /
      (1000 * 60 * 60 * 24);
    orderFrequencyDays = Math.round(spanDays / (sortedPaid.length - 1));
  }

  // Favorite products & spend over time
  const productCounts = new Map();
  const productIds = new Set();
  const monthlySpend = new Map();

  for (const o of paidOrders) {
    const monthKey = new Date(o.createdAt).toISOString().slice(0, 7);
    monthlySpend.set(monthKey, (monthlySpend.get(monthKey) || 0) + Number(o.total || 0));
    for (const item of o.items || []) {
      const pid = String(item.product);
      productIds.add(pid);
      const prev = productCounts.get(pid) || { name: item.name, qty: 0 };
      prev.qty += item.qty;
      productCounts.set(pid, prev);
    }
  }

  const prods = await Product.find({ _id: { $in: [...productIds] } })
    .populate('category', 'name')
    .lean();
  const catCounts = new Map();
  for (const p of prods) {
    const catName = p.category?.name || 'Other';
    const qty = productCounts.get(String(p._id))?.qty || 0;
    catCounts.set(catName, (catCounts.get(catName) || 0) + qty);
  }

  const favoriteCategory =
    [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const favoriteProducts = [...productCounts.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  const spendOverTime = [...monthlySpend.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, amount]) => ({ month, amount }));

  return sendSuccess(res, {
    customer,
    orders,
    ratingsGiven,
    analytics: {
      lifetimeValue,
      totalPaidOrders: paidOrders.length,
      averageOrderValue,
      orderFrequencyDays,
      firstOrderDate,
      lastOrderDate,
      favoriteCategory,
      favoriteProducts,
      cancelledCount,
      ratingsCount: ratingsGiven.length,
      spendOverTime,
    },
  });
});

const toggleCustomerBlock = asyncHandler(async (req, res) => {
  const customer = await User.findOne({ _id: req.params.id, role: 'customer' });
  if (!customer) throw new ApiError(404, 'Customer not found');
  customer.isBlocked =
    req.body.isBlocked !== undefined ? Boolean(req.body.isBlocked) : !customer.isBlocked;
  await customer.save();
  return sendSuccess(
    res,
    customer,
    customer.isBlocked ? 'Customer account blocked' : 'Customer account unblocked'
  );
});

// --- REVIEWS ---
const listAdminReviews = asyncHandler(async (req, res) => {
  const { source, product, rating, status, isFeatured, search, page = '1', limit = '20' } =
    req.query;
  const filter = {};
  if (source) filter.source = source;
  if (product) filter.product = product;
  if (rating) filter.rating = Number(rating);
  if (status) filter.status = status;
  if (isFeatured === 'true') filter.isFeatured = true;
  if (isFeatured === 'false') filter.isFeatured = false;
  if (search && search.trim()) {
    const q = search.trim();
    filter.$or = [
      { reviewerName: { $regex: q, $options: 'i' } },
      { comment: { $regex: q, $options: 'i' } },
      { reviewerLocation: { $regex: q, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [items, total] = await Promise.all([
    Review.find(filter)
      .populate('product', 'name slug images')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Review.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    items,
    total,
    page: pageNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
  });
});

const createWhatsappReview = asyncHandler(async (req, res) => {
  const {
    product,
    reviewerName,
    reviewerLocation,
    rating,
    comment,
    screenshot,
    reviewDate,
    isFeatured,
  } = req.body;

  if (!product || !mongoose.Types.ObjectId.isValid(product)) {
    throw new ApiError(400, 'Valid product is required');
  }
  const prodExists = await Product.exists({ _id: product });
  if (!prodExists) throw new ApiError(404, 'Selected product not found');

  if (!reviewerName || !reviewerName.trim()) {
    throw new ApiError(400, 'Reviewer name is required');
  }
  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5) {
    throw new ApiError(400, 'Rating must be between 1 and 5');
  }

  const review = await Review.create({
    product,
    source: 'whatsapp',
    rating: numRating,
    comment: String(comment || '').trim(),
    reviewerName: reviewerName.trim(),
    reviewerLocation: String(reviewerLocation || '').trim(),
    screenshot: screenshot || '',
    reviewDate: reviewDate ? new Date(reviewDate) : new Date(),
    isFeatured: Boolean(isFeatured),
    isVerifiedPurchase: false,
    status: 'visible',
    createdBy: req.user._id,
  });

  await recalcProductRating(product);
  const populated = await Review.findById(review._id).populate('product', 'name slug').lean();
  return sendSuccess(res, populated, 'WhatsApp review added', 201);
});

const updateAdminReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError(404, 'Review not found');

  const oldProductId = String(review.product);

  if (review.source === 'customer') {
    // Customer-source ratings: admin may only moderate visibility, feature flag, or reply
    if (req.body.status && ['visible', 'hidden'].includes(req.body.status)) {
      review.status = req.body.status;
    }
    if (req.body.isFeatured !== undefined) review.isFeatured = Boolean(req.body.isFeatured);
    if (req.body.adminReply !== undefined) review.adminReply = String(req.body.adminReply).trim();
  } else {
    // WhatsApp-source review: full edit allowed
    const fields = [
      'product',
      'reviewerName',
      'reviewerLocation',
      'rating',
      'comment',
      'screenshot',
      'reviewDate',
      'isFeatured',
      'status',
      'adminReply',
    ];
    for (const key of fields) {
      if (req.body[key] !== undefined) {
        review[key] = req.body[key];
      }
    }
  }

  await review.save();
  await recalcProductRating(review.product);
  if (String(review.product) !== oldProductId) {
    await recalcProductRating(oldProductId);
  }

  const populated = await Review.findById(review._id).populate('product', 'name slug').lean();
  return sendSuccess(res, populated, 'Review updated');
});

const deleteAdminReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError(404, 'Review not found');
  const productId = review.product;
  await review.deleteOne();
  await recalcProductRating(productId);
  return sendSuccess(res, null, 'Review deleted');
});

const bulkReviewAction = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, 'Select at least one review');
  }

  const reviews = await Review.find({ _id: { $in: ids } }).select('product');
  const affectedProducts = [...new Set(reviews.map((r) => String(r.product)))];

  if (action === 'hide') {
    await Review.updateMany({ _id: { $in: ids } }, { $set: { status: 'hidden' } });
  } else if (action === 'show') {
    await Review.updateMany({ _id: { $in: ids } }, { $set: { status: 'visible' } });
  } else if (action === 'feature') {
    await Review.updateMany({ _id: { $in: ids } }, { $set: { isFeatured: true } });
  } else if (action === 'unfeature') {
    await Review.updateMany({ _id: { $in: ids } }, { $set: { isFeatured: false } });
  } else if (action === 'delete') {
    await Review.deleteMany({ _id: { $in: ids } });
  } else {
    throw new ApiError(400, 'Unsupported bulk action');
  }

  await Promise.all(affectedProducts.map((pid) => recalcProductRating(pid)));
  return sendSuccess(res, { affected: reviews.length }, 'Bulk review action completed');
});

module.exports = {
  listAdminCustomers,
  getAdminCustomerDetail,
  toggleCustomerBlock,
  listAdminReviews,
  createWhatsappReview,
  updateAdminReview,
  deleteAdminReview,
  bulkReviewAction,
};
