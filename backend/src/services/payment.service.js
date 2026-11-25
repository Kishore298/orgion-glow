const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const User = require('../models/User');
const WebhookEvent = require('../models/WebhookEvent');
const env = require('../config/env');
const { getRazorpay } = require('../config/razorpay');
const { toPaise, fromPaise } = require('../utils/currency');
const { ApiError } = require('../utils/apiResponse');
const { notify } = require('./notification.service');

function timingSafeCompare(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyCheckoutSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }, secret = env.RAZORPAY_KEY_SECRET) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !secret) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  return timingSafeCompare(expected, razorpay_signature);
}

function verifyWebhookSignature(rawBody, signature, secret = env.RAZORPAY_WEBHOOK_SECRET) {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeCompare(expected, signature);
}

/**
 * Re-validates order items in DB. Returns { valid, reason }.
 */
async function checkOrderItemsAvailability(order, ProductModel = Product) {
  const ids = order.items.map((i) => i.product);
  const products = await ProductModel.find({ _id: { $in: ids } });
  const map = new Map(products.map((p) => [String(p._id), p]));

  for (const item of order.items) {
    const p = map.get(String(item.product));
    if (!p || p.status !== 'active' || !p.inStock) {
      return {
        valid: false,
        reason: `Product "${item.name}" became unavailable or out of stock before payment completed`,
      };
    }
  }
  return { valid: true };
}

/**
 * Creates (or returns active) Razorpay order for a pending_payment Order.
 */
async function createRazorpayOrderForOrder(order, { forceNew = false } = {}) {
  if (order.paymentStatus === 'paid') {
    throw new ApiError(400, 'Order is already paid');
  }
  if (order.status === 'cancelled') {
    throw new ApiError(400, 'Cancelled order cannot be paid');
  }

  // Re-validate stock/active right before creating Razorpay order
  const avail = await checkOrderItemsAvailability(order);
  if (!avail.valid) {
    throw new ApiError(400, avail.reason);
  }

  // Guard: one active Razorpay order at a time unless retrying after failure
  if (!forceNew && order.payment?.razorpayOrderId && order.paymentStatus === 'pending') {
    return {
      razorpayOrderId: order.payment.razorpayOrderId,
      keyId: env.RAZORPAY_KEY_ID,
      amountPaise: toPaise(order.total),
      currency: 'INR',
    };
  }

  const rzp = getRazorpay();
  const rzpOrder = await rzp.orders.create({
    amount: toPaise(order.total),
    currency: 'INR',
    receipt: order.orderNumber,
    notes: {
      orderId: String(order._id),
      userId: String(order.user),
      orderNumber: order.orderNumber,
    },
  });

  order.payment = order.payment || {};
  order.payment.razorpayOrderId = rzpOrder.id;
  order.payment.amount = order.total;
  order.payment.status = 'created';
  order.payment.attempts = order.payment.attempts || [];
  order.payment.attempts.push({
    razorpayOrderId: rzpOrder.id,
    status: 'created',
    amount: order.total,
    at: new Date(),
  });
  if (order.status === 'expired') {
    order.status = 'pending_payment';
  }
  if (order.paymentStatus === 'failed' || order.paymentStatus === 'expired') {
    order.paymentStatus = 'pending';
  }
  order.expiresAt = new Date(Date.now() + 45 * 60 * 1000);
  await order.save();

  return {
    razorpayOrderId: rzpOrder.id,
    keyId: env.RAZORPAY_KEY_ID,
    amountPaise: rzpOrder.amount,
    currency: rzpOrder.currency,
  };
}

/**
 * Atomic, idempotent order confirmation once Razorpay payment is verified.
 */
async function confirmOrderPaidAtomically(orderId, paymentDetails, deps = {}) {
  const OrderModel = deps.Order || Order;
  const CartModel = deps.Cart || Cart;
  const ProductModel = deps.Product || Product;
  const notifier = deps.notify || notify;

  const existing = await OrderModel.findById(orderId);
  if (!existing) {
    throw new ApiError(404, 'Order not found');
  }

  // Already confirmed — idempotent return
  if (existing.paymentStatus === 'paid') {
    return { order: existing, alreadyConfirmed: true };
  }

  // Amount check (compare in paise to prevent float drift)
  const expectedPaise = toPaise(existing.total);
  const paidPaise = Number(paymentDetails.amountPaise || 0);
  if (paidPaise !== expectedPaise) {
    await OrderModel.findByIdAndUpdate(orderId, {
      needsReview: true,
      needsReviewReason: `Amount mismatch: expected ${expectedPaise} paise, got ${paidPaise} paise`,
    });
    throw new ApiError(400, 'Payment amount mismatch detected. Order flagged for review.');
  }

  // Check if items went out of stock in the meantime -> accept captured payment, flag needsReview
  const avail = await checkOrderItemsAvailability(existing, ProductModel);
  const statusEntry = {
    status: 'confirmed',
    at: new Date(),
    note: paymentDetails.source === 'webhook' ? 'Confirmed via Razorpay webhook' : 'Confirmed via payment verification',
  };

  const updated = await OrderModel.findOneAndUpdate(
    {
      _id: orderId,
      paymentStatus: { $in: ['pending', 'failed', 'expired'] },
    },
    {
      $set: {
        status: 'confirmed',
        paymentStatus: 'paid',
        'payment.razorpayOrderId': paymentDetails.razorpayOrderId || existing.payment?.razorpayOrderId,
        'payment.razorpayPaymentId': paymentDetails.razorpayPaymentId,
        'payment.signature': paymentDetails.signature || existing.payment?.signature || '',
        'payment.method': paymentDetails.method || '',
        'payment.cardLast4': paymentDetails.cardLast4 || '',
        'payment.amount': fromPaise(paidPaise),
        'payment.fee': fromPaise(paymentDetails.feePaise || 0),
        'payment.status': 'captured',
        'payment.errorCode': '',
        'payment.errorDescription': '',
        'payment.paidAt': new Date(),
        ...(avail.valid
          ? {}
          : {
              needsReview: true,
              needsReviewReason: avail.reason,
            }),
      },
      $push: {
        statusHistory: statusEntry,
        'payment.attempts': {
          razorpayOrderId: paymentDetails.razorpayOrderId,
          razorpayPaymentId: paymentDetails.razorpayPaymentId,
          status: 'captured',
          method: paymentDetails.method || '',
          amount: fromPaise(paidPaise),
          at: new Date(),
        },
      },
    },
    { new: true }
  );

  // Race lost to another concurrent request (webhook vs client verify)
  if (!updated) {
    const fresh = await OrderModel.findById(orderId);
    return { order: fresh, alreadyConfirmed: true };
  }

  // Clear customer's cart once
  await CartModel.findOneAndUpdate({ user: updated.user }, { $set: { items: [] } });

  // Retire any older unpaid pending_payment checkout drafts for this customer
  if (typeof OrderModel.updateMany === 'function') {
    await OrderModel.updateMany(
      {
        user: updated.user,
        _id: { $ne: updated._id },
        status: 'pending_payment',
        paymentStatus: { $in: ['pending', 'failed'] },
      },
      {
        $set: { status: 'expired', paymentStatus: 'expired' },
      }
    );
  }

  // Notify customer once (deduped in NotificationLog) and notify admins of the new paid order
  const confirmedEntry = updated.statusHistory[updated.statusHistory.length - 1];
  const dedupeSuffix = String(confirmedEntry?._id || 'confirmed');
  notifier('ORDER_CONFIRMED', {
    order: updated,
    dedupeSuffix,
  });
  notifier('ADMIN_NEW_ORDER', {
    order: updated,
    dedupeSuffix,
  });

  return { order: updated, alreadyConfirmed: false };
}

/**
 * Client-side payment verification endpoint handler logic.
 */
async function verifyClientPayment({ userId, razorpay_order_id, razorpay_payment_id, razorpay_signature }, deps = {}) {
  const OrderModel = deps.Order || Order;
  const rzp = deps.razorpay || getRazorpay();

  if (!verifyCheckoutSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    throw new ApiError(400, 'Invalid payment signature');
  }

  const order = await OrderModel.findOne({ 'payment.razorpayOrderId': razorpay_order_id });
  if (!order) {
    throw new ApiError(404, 'Order not found for this payment');
  }
  if (String(order.user) !== String(userId)) {
    throw new ApiError(403, 'Unauthorized access to order payment');
  }

  const payment = await rzp.payments.fetch(razorpay_payment_id);
  if (!payment || !['captured', 'authorized'].includes(payment.status)) {
    throw new ApiError(400, `Payment not completed (status: ${payment?.status || 'unknown'})`);
  }
  if (payment.currency !== 'INR') {
    throw new ApiError(400, 'Unsupported payment currency');
  }

  return confirmOrderPaidAtomically(
    order._id,
    {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      signature: razorpay_signature,
      method: payment.method || '',
      cardLast4: payment.card?.last4 || '',
      amountPaise: payment.amount,
      feePaise: payment.fee || 0,
      source: 'verify',
    },
    deps
  );
}

/**
 * Razorpay Webhook processor (source of truth backup).
 */
async function processWebhookEvent({ eventId, eventType, payload }) {
  // Idempotent event tracking
  try {
    await WebhookEvent.create({ eventId, type: eventType });
  } catch (err) {
    if (err.code === 11000) {
      return { duplicate: true };
    }
    throw err;
  }

  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    const paymentEntity = payload?.payment?.entity;
    const orderEntity = payload?.order?.entity;
    const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
    const razorpayPaymentId = paymentEntity?.id;

    if (!razorpayOrderId) return { ignored: true };

    const order = await Order.findOne({
      $or: [
        { 'payment.razorpayOrderId': razorpayOrderId },
        { _id: paymentEntity?.notes?.orderId },
      ],
    });
    if (!order) return { ignored: true, reason: 'Order not found' };

    await confirmOrderPaidAtomically(order._id, {
      razorpayOrderId,
      razorpayPaymentId,
      method: paymentEntity?.method || '',
      cardLast4: paymentEntity?.card?.last4 || '',
      amountPaise: paymentEntity?.amount ?? orderEntity?.amount_paid ?? toPaise(order.total),
      feePaise: paymentEntity?.fee || 0,
      source: 'webhook',
    });

    return { handled: true };
  }

  if (eventType === 'payment.failed') {
    const paymentEntity = payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id;
    if (!razorpayOrderId) return { ignored: true };

    const order = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId });
    if (!order || order.paymentStatus === 'paid') return { ignored: true };

    order.paymentStatus = 'failed';
    order.payment.errorCode = paymentEntity?.error_code || '';
    order.payment.errorDescription = paymentEntity?.error_description || 'Payment failed';
    order.payment.attempts.push({
      razorpayOrderId,
      razorpayPaymentId: paymentEntity?.id || '',
      status: 'failed',
      method: paymentEntity?.method || '',
      amount: fromPaise(paymentEntity?.amount || 0),
      errorCode: paymentEntity?.error_code || '',
      errorDescription: paymentEntity?.error_description || '',
      at: new Date(),
    });
    await order.save();

    notify('PAYMENT_FAILED', {
      order,
      dedupeSuffix: 'payment_failed',
    });
    return { handled: true };
  }

  if (eventType === 'refund.processed' || eventType === 'refund.failed') {
    const refundEntity = payload?.refund?.entity;
    const razorpayPaymentId = refundEntity?.payment_id;
    const razorpayRefundId = refundEntity?.id;
    if (!razorpayPaymentId) return { ignored: true };

    const order = await Order.findOne({ 'payment.razorpayPaymentId': razorpayPaymentId });
    if (!order) return { ignored: true };

    const newRefundStatus = eventType === 'refund.processed' ? 'processed' : 'failed';
    const existingRefund = order.payment.refunds.find(
      (r) => r.razorpayRefundId === razorpayRefundId
    );
    const refundAmtInr = fromPaise(refundEntity?.amount || 0);

    if (existingRefund) {
      existingRefund.status = newRefundStatus;
      if (newRefundStatus === 'processed') existingRefund.processedAt = new Date();
    } else {
      order.payment.refunds.push({
        razorpayRefundId,
        amount: refundAmtInr,
        status: newRefundStatus,
        initiatedAt: new Date(),
        processedAt: newRefundStatus === 'processed' ? new Date() : undefined,
      });
    }

    if (newRefundStatus === 'processed') {
      const totalRefunded = order.payment.refunds
        .filter((r) => r.status === 'processed')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      order.paymentStatus = totalRefunded >= order.total ? 'refunded' : 'partially_refunded';
      await order.save();

      notify('ORDER_STATUS_CHANGED', {
        order,
        newStatus: 'refund_processed',
        refundAmount: refundAmtInr,
        dedupeSuffix: `refund:${razorpayRefundId}`,
      });
    } else {
      await order.save();
    }

    return { handled: true };
  }

  return { ignored: true };
}

/**
 * Initiates a full or partial refund from Admin panel via Razorpay API.
 */
async function initiateAdminRefund({ orderId, amount, reason, adminUserId }) {
  const query = /^[0-9a-fA-F]{24}$/.test(String(orderId || ''))
    ? { _id: orderId }
    : { orderNumber: String(orderId || '').toUpperCase() };
  const order = await Order.findOne(query);
  if (!order) throw new ApiError(404, 'Order not found');
  if (!['paid', 'partially_refunded'].includes(order.paymentStatus)) {
    throw new ApiError(400, 'Only paid orders can be refunded');
  }
  if (!order.payment?.razorpayPaymentId) {
    throw new ApiError(400, 'Missing Razorpay payment ID for this order');
  }

  const alreadyRefunded = (order.payment.refunds || [])
    .filter((r) => r.status !== 'failed')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const maxRefundable = Number(order.total) - alreadyRefunded;
  const refundAmount = amount ? Number(amount) : maxRefundable;

  if (refundAmount <= 0 || refundAmount > maxRefundable + 0.01) {
    throw new ApiError(400, `Refund amount must be between ₹1 and ₹${maxRefundable.toFixed(2)}`);
  }

  const rzp = getRazorpay();
  const rzpRefund = await rzp.payments.refund(order.payment.razorpayPaymentId, {
    amount: toPaise(refundAmount),
    notes: {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      reason: reason || 'Admin refund',
    },
  });

  const status = rzpRefund.status === 'processed' ? 'processed' : 'initiated';
  order.payment.refunds.push({
    razorpayRefundId: rzpRefund.id,
    amount: refundAmount,
    reason: reason || 'Customer refund',
    status,
    initiatedBy: adminUserId,
    initiatedAt: new Date(),
    processedAt: status === 'processed' ? new Date() : undefined,
  });

  if (status === 'processed') {
    const newTotalRefunded = alreadyRefunded + refundAmount;
    order.paymentStatus = newTotalRefunded >= order.total ? 'refunded' : 'partially_refunded';
  }
  await order.save();

  if (status === 'processed') {
    notify('ORDER_STATUS_CHANGED', {
      order,
      newStatus: 'refund_processed',
      refundAmount,
      dedupeSuffix: `refund:${rzpRefund.id}`,
    });
  }

  return order;
}

module.exports = {
  verifyCheckoutSignature,
  verifyWebhookSignature,
  createRazorpayOrderForOrder,
  confirmOrderPaidAtomically,
  verifyClientPayment,
  processWebhookEvent,
  initiateAdminRefund,
};
