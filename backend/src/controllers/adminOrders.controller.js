const Order = require('../models/Order');
const NotificationLog = require('../models/NotificationLog');
const { siteConfig } = require('../config/site.config');
const { canTransitionOrderStatus } = require('../utils/orderTransitions');
const { normalizeTrackingId, isValidTrackingId } = require('../utils/strings');
const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');
const { notify, resendNotificationLog } = require('../services/notification.service');
const { initiateAdminRefund } = require('../services/payment.service');
const { releaseCouponUsageForOrder } = require('../services/coupon.service');
const { generateInvoicePdfBuffer } = require('../services/invoice.service');

function orderRefQuery(ref) {
  return /^[0-9a-fA-F]{24}$/.test(String(ref || ''))
    ? { _id: ref }
    : { orderNumber: String(ref || '').toUpperCase() };
}

function escapeCsvCell(val) {
  const str = String(val ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

const listAdminOrders = asyncHandler(async (req, res) => {
  const {
    status,
    paymentStatus,
    from,
    to,
    state,
    missingTracking,
    needsReview,
    search,
    page = '1',
    limit = '20',
    export: exportType,
  } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (paymentStatus) {
    filter.paymentStatus = paymentStatus;
  } else {
    filter.paymentStatus = { $in: ['paid', 'partially_refunded', 'refunded'] };
  }
  if (state) filter['addressSnapshot.state'] = new RegExp(`^${state.trim()}$`, 'i');
  if (needsReview === 'true') filter.needsReview = true;
  if (missingTracking === 'true') {
    filter.status = { $in: ['confirmed', 'processing'] };
    filter.$or = [{ 'tracking.trackingId': '' }, { 'tracking.trackingId': { $exists: false } }];
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  if (search && search.trim()) {
    const q = search.trim();
    const orClauses = [
      { orderNumber: { $regex: q, $options: 'i' } },
      { 'addressSnapshot.fullName': { $regex: q, $options: 'i' } },
      { 'addressSnapshot.mobile': { $regex: q, $options: 'i' } },
      { 'tracking.trackingId': { $regex: q, $options: 'i' } },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: orClauses }];
      delete filter.$or;
    } else {
      filter.$or = orClauses;
    }
  }

  if (exportType === 'csv') {
    const rows = await Order.find(filter).sort({ createdAt: -1 }).limit(2000).lean();
    const headers = [
      'Order Number',
      'Date',
      'Customer',
      'Mobile',
      'City',
      'State',
      'Pincode',
      'Items',
      'Total (INR)',
      'Payment Status',
      'Payment Method',
      'Order Status',
      'ST Courier Tracking ID',
    ];
    const csvLines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((o) =>
        [
          o.orderNumber,
          new Date(o.createdAt).toISOString(),
          o.addressSnapshot?.fullName,
          o.addressSnapshot?.mobile,
          o.addressSnapshot?.city,
          o.addressSnapshot?.state,
          o.addressSnapshot?.pincode,
          (o.items || []).map((i) => `${i.name} x${i.qty}`).join('; '),
          o.total,
          o.paymentStatus,
          o.payment?.method || '',
          o.status,
          o.tracking?.trackingId || '',
        ]
          .map(escapeCsvCell)
          .join(',')
      ),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orgion-orders.csv"');
    return res.send(csvLines.join('\n'));
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [items, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name mobile email')
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

const getAdminOrderDetail = asyncHandler(async (req, res) => {
  const order = await Order.findOne(orderRefQuery(req.params.id))
    .populate('user', 'name mobile email isBlocked')
    .lean();
  if (!order) throw new ApiError(404, 'Order not found');

  const notificationLogs = await NotificationLog.find({ order: order._id })
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, {
    order,
    notificationLogs,
    stCourierTrackingUrl: siteConfig.stCourierTrackingUrl,
  });
});

const updateAdminOrderStatus = asyncHandler(async (req, res) => {
  const { status: newStatus, note = '' } = req.body;
  const order = await Order.findOne(orderRefQuery(req.params.id));
  if (!order) throw new ApiError(404, 'Order not found');

  if (!canTransitionOrderStatus(order.status, newStatus)) {
    throw new ApiError(400, `Cannot transition order from "${order.status}" to "${newStatus}"`);
  }

  order.status = newStatus;
  if (newStatus === 'delivered' && !order.deliveredAt) {
    order.deliveredAt = new Date();
  }
  order.statusHistory.push({
    status: newStatus,
    at: new Date(),
    by: req.user._id,
    note,
  });
  await order.save();

  if (newStatus === 'cancelled') {
    await releaseCouponUsageForOrder(order._id);
  }

  const latestEntry = order.statusHistory[order.statusHistory.length - 1];
  notify('ORDER_STATUS_CHANGED', {
    order,
    newStatus,
    dedupeSuffix: String(latestEntry._id),
  });

  return sendSuccess(res, order, `Order marked as ${newStatus.replace(/_/g, ' ')}`);
});

/**
 * Core logic for ST Courier tracking updates (Section 7.4).
 * Separated with optional deps injection so unit tests verify exact notification semantics.
 */
async function updateOrderTrackingCore(
  { orderId, rawTrackingId, alsoMarkShipped = false, adminUserId },
  deps = {}
) {
  const OrderModel = deps.Order || Order;
  const notifier = deps.notify || notify;

  const order = OrderModel.findOne
    ? await OrderModel.findOne(orderRefQuery(orderId))
    : await OrderModel.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const normalized = normalizeTrackingId(rawTrackingId);
  const current = order.tracking?.trackingId || '';

  // Clearing ID is allowed and sends NO notification
  if (normalized === '') {
    if (current === '') {
      return { order, changed: false, notified: false };
    }
    order.tracking = {
      courier: 'ST Courier',
      trackingId: '',
      updatedAt: new Date(),
      updatedBy: adminUserId,
    };
    order.trackingHistory.push({
      courier: 'ST Courier',
      trackingId: '',
      updatedAt: new Date(),
      updatedBy: adminUserId,
    });
    await order.save();
    return { order, changed: true, notified: false };
  }

  if (!isValidTrackingId(normalized)) {
    throw new ApiError(
      400,
      'Tracking ID must be 6–30 characters using uppercase letters, digits, or hyphens only'
    );
  }

  // Unchanged tracking ID -> do nothing and send nothing
  if (normalized === current) {
    return { order, changed: false, notified: false };
  }

  order.tracking = {
    courier: 'ST Courier',
    trackingId: normalized,
    updatedAt: new Date(),
    updatedBy: adminUserId,
  };
  order.trackingHistory.push({
    courier: 'ST Courier',
    trackingId: normalized,
    updatedAt: new Date(),
    updatedBy: adminUserId,
  });

  let markedShipped = false;
  if (alsoMarkShipped && ['confirmed', 'processing'].includes(order.status)) {
    order.status = 'shipped';
    order.statusHistory.push({
      status: 'shipped',
      at: new Date(),
      by: adminUserId,
      note: `Shipped via ST Courier (${normalized})`,
    });
    markedShipped = true;
  }

  await order.save();

  // Send ONE combined TRACKING_UPDATED notification (push + email)
  const latestHistoryId = order.trackingHistory[order.trackingHistory.length - 1]?._id || normalized;
  notifier('TRACKING_UPDATED', {
    order,
    alsoShipped: markedShipped,
    dedupeSuffix: `${normalized}:${String(latestHistoryId)}`,
  });

  return { order, changed: true, notified: true, markedShipped };
}

const updateAdminOrderTracking = asyncHandler(async (req, res) => {
  const { trackingId, alsoMarkShipped = false } = req.body;
  const result = await updateOrderTrackingCore({
    orderId: req.params.id,
    rawTrackingId: trackingId,
    alsoMarkShipped: Boolean(alsoMarkShipped),
    adminUserId: req.user._id,
  });

  const msg = !result.changed
    ? 'Tracking ID unchanged'
    : result.notified
    ? result.markedShipped
      ? 'Tracking saved, order marked as Shipped, and customer notified'
      : 'Tracking ID saved and customer notified'
    : 'Tracking ID cleared';

  return sendSuccess(res, result.order, msg);
});

const updateAdminOrderNotes = asyncHandler(async (req, res) => {
  const order = await Order.findOne(orderRefQuery(req.params.id));
  if (!order) throw new ApiError(404, 'Order not found');
  if (req.body.notes !== undefined) order.notes = req.body.notes;
  if (req.body.needsReview !== undefined) {
    order.needsReview = Boolean(req.body.needsReview);
    if (!order.needsReview) order.needsReviewReason = '';
  }
  await order.save();
  return sendSuccess(res, order, 'Order notes updated');
});

const refundAdminOrder = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;
  const order = await initiateAdminRefund({
    orderId: req.params.id,
    amount,
    reason,
    adminUserId: req.user._id,
  });
  return sendSuccess(res, order, 'Refund initiated via Razorpay');
});

const resendOrderConfirmation = asyncHandler(async (req, res) => {
  const order = await Order.findOne(orderRefQuery(req.params.id));
  if (!order) throw new ApiError(404, 'Order not found');
  notify('ORDER_CONFIRMED', {
    order,
    dedupeSuffix: `manual:${Date.now()}`,
  });
  return sendSuccess(res, null, 'Order confirmation email queued');
});

const resendOrderNotification = asyncHandler(async (req, res) => {
  const result = await resendNotificationLog(req.params.logId);
  if (!result) throw new ApiError(404, 'Notification log not found');
  return sendSuccess(res, result, result.ok ? 'Notification resent' : `Resend failed: ${result.error}`);
});

const downloadAdminInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findOne(orderRefQuery(req.params.id)).lean();
  if (!order) throw new ApiError(404, 'Order not found');
  const pdfBuffer = await generateInvoicePdfBuffer(order);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ORGION-Invoice-${order.orderNumber}.pdf"`);
  return res.send(pdfBuffer);
});

module.exports = {
  listAdminOrders,
  getAdminOrderDetail,
  updateAdminOrderStatus,
  updateAdminOrderTracking,
  updateOrderTrackingCore,
  updateAdminOrderNotes,
  refundAdminOrder,
  resendOrderConfirmation,
  resendOrderNotification,
  downloadAdminInvoice,
};
