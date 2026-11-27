const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const NotificationLog = require('../models/NotificationLog');
const { uploadImageBuffer } = require('../config/cloudinary');
const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

function getRangeStartDate(range, fromParam) {
  if (fromParam) {
    const d = new Date(fromParam);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const now = new Date();
  switch (range) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

const uploadAdminImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Please attach an image file');
  }
  const folder = req.body.folder ? `orgion/${req.body.folder}` : 'orgion';
  const uploaded = await uploadImageBuffer(req.file.buffer, {
    folder,
    originalname: req.file.originalname,
  });
  return sendSuccess(res, uploaded, 'Image uploaded', 201);
});

const getDashboardStats = asyncHandler(async (req, res) => {
  const { range = '30d', granularity = 'daily', from, to } = req.query;
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const rangeStart = getRangeStartDate(range, from);
  const rangeEnd = to ? new Date(to) : now;
  const dateMatch = rangeStart ? { createdAt: { $gte: rangeStart, $lte: rangeEnd } } : {};

  const paidMatch = {
    paymentStatus: { $in: ['paid', 'partially_refunded'] },
  };
  const successfulPaymentMatch = {
    paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] },
  };

  const dateFormatMap = {
    daily: '%Y-%m-%d',
    weekly: '%Y-W%V',
    monthly: '%Y-%m',
  };
  const dateFmt = dateFormatMap[granularity] || '%Y-%m-%d';

  const [
    revenueSummary,
    ordersByStatusRaw,
    newOrdersToday,
    failedPendingPayments,
    totalCustomers,
    newCustomers30d,
    outOfStockCount,
    reviewStats,
    revenueSeries,
    topProducts,
    salesByCategory,
    ordersByState,
    paymentMethodSplit,
    recentOrders,
    needsReviewOrders,
    failedPaymentOrders,
    missingTrackingOrders,
    failedNotifications,
    latestReviews,
  ] = await Promise.all([
    Order.aggregate([
      { $match: paidMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalPaidOrders: { $sum: 1 },
          todayRevenue: {
            $sum: { $cond: [{ $gte: ['$createdAt', todayStart] }, '$total', 0] },
          },
          revenue7d: {
            $sum: { $cond: [{ $gte: ['$createdAt', d7] }, '$total', 0] },
          },
          revenue30d: {
            $sum: { $cond: [{ $gte: ['$createdAt', d30] }, '$total', 0] },
          },
        },
      },
    ]),
    Order.aggregate([
      { $match: { ...successfulPaymentMatch, ...dateMatch } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Order.countDocuments({ ...successfulPaymentMatch, createdAt: { $gte: todayStart } }),
    Order.countDocuments({ paymentStatus: { $in: ['pending', 'failed'] } }),
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'customer', createdAt: { $gte: d30 } }),
    Product.countDocuments({ inStock: false, status: 'active' }),
    Review.aggregate([
      { $match: { status: 'visible' } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          avgRating: { $avg: '$rating' },
        },
      },
    ]),
    Order.aggregate([
      { $match: { ...paidMatch, ...dateMatch } },
      {
        $group: {
          _id: { $dateToString: { format: dateFmt, date: '$createdAt', timezone: 'Asia/Kolkata' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { ...paidMatch, ...dateMatch } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          unitsSold: { $sum: '$items.qty' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 6 },
    ]),
    Order.aggregate([
      { $match: { ...paidMatch, ...dateMatch } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'prod',
        },
      },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'prod.category',
          foreignField: '_id',
          as: 'cat',
        },
      },
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$cat.name', 'Uncategorized'] },
          revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
          units: { $sum: '$items.qty' },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Order.aggregate([
      { $match: { ...paidMatch, ...dateMatch } },
      {
        $group: {
          _id: { $ifNull: ['$addressSnapshot.state', 'Unknown'] },
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { orders: -1 } },
      { $limit: 8 },
    ]),
    Order.aggregate([
      { $match: { ...paidMatch, ...dateMatch } },
      {
        $group: {
          _id: { $ifNull: ['$payment.method', 'online'] },
          count: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
    ]),
    Order.find(successfulPaymentMatch)
      .populate('user', 'name mobile email')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    Order.find({ needsReview: true, paymentStatus: 'paid' })
      .sort({ createdAt: -1 })
      .limit(8)
      .select('orderNumber total status needsReviewReason addressSnapshot.fullName createdAt')
      .lean(),
    Order.find({ paymentStatus: 'failed' })
      .sort({ updatedAt: -1 })
      .limit(8)
      .select('orderNumber total payment.errorDescription addressSnapshot.fullName createdAt')
      .lean(),
    Order.find({
      ...successfulPaymentMatch,
      status: { $in: ['confirmed', 'processing'] },
      $or: [{ 'tracking.trackingId': '' }, { 'tracking.trackingId': { $exists: false } }],
    })
      .sort({ createdAt: 1 })
      .limit(8)
      .select('orderNumber status total addressSnapshot.fullName createdAt')
      .lean(),
    NotificationLog.find({ status: 'failed' })
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    Review.find()
      .populate('product', 'name slug')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const rev = revenueSummary[0] || {
    totalRevenue: 0,
    totalPaidOrders: 0,
    todayRevenue: 0,
    revenue7d: 0,
    revenue30d: 0,
  };

  const ordersByStatus = {};
  let totalOrdersInRange = 0;
  for (const row of ordersByStatusRaw) {
    ordersByStatus[row._id] = row.count;
    totalOrdersInRange += row.count;
  }

  const aov =
    rev.totalPaidOrders > 0 ? Math.round((rev.totalRevenue / rev.totalPaidOrders) * 100) / 100 : 0;
  const rStats = reviewStats[0] || { totalReviews: 0, avgRating: 0 };

  return sendSuccess(res, {
    cards: {
      revenue: {
        today: rev.todayRevenue,
        last7d: rev.revenue7d,
        last30d: rev.revenue30d,
        total: rev.totalRevenue,
      },
      totalOrders: totalOrdersInRange,
      totalPaidOrders: rev.totalPaidOrders,
      ordersByStatus,
      newOrdersToday,
      failedPendingPayments,
      totalCustomers,
      newCustomers30d,
      averageOrderValue: aov,
      productsOutOfStock: outOfStockCount,
      totalReviews: rStats.totalReviews,
      overallAverageRating: rStats.avgRating ? Math.round(rStats.avgRating * 10) / 10 : 0,
    },
    charts: {
      revenueOverTime: revenueSeries.map((r) => ({ period: r._id, revenue: r.revenue, orders: r.orders })),
      topSellingProducts: topProducts,
      salesByCategory: salesByCategory.map((c) => ({ category: c._id, revenue: c.revenue, units: c.units })),
      ordersByState: ordersByState.map((s) => ({ state: s._id, orders: s.orders, revenue: s.revenue })),
      paymentMethodSplit: paymentMethodSplit.map((m) => ({
        method: (m._id || 'online').toUpperCase(),
        count: m.count,
        revenue: m.revenue,
      })),
    },
    recentOrders,
    needsAttention: {
      needsReviewOrders,
      failedPaymentOrders,
      missingTrackingOrders,
      failedNotifications,
    },
    latestReviews,
  });
});

module.exports = {
  uploadAdminImage,
  getDashboardStats,
};
