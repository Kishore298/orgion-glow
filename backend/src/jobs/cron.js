const cron = require('node-cron');
const Order = require('../models/Order');
const Review = require('../models/Review');
const env = require('../config/env');
const { getRazorpay } = require('../config/razorpay');
const { confirmOrderPaidAtomically } = require('../services/payment.service');
const { releaseCouponUsageForOrder } = require('../services/coupon.service');
const { notifyNow, retryFailedNotifications } = require('../services/notification.service');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Job 1: Every 15 min — expire abandoned pending_payment orders older than 45 min,
 * checking Razorpay first in case a payment actually succeeded.
 */
async function runExpireAbandonedOrders() {
  const cutoff = new Date(Date.now() - 45 * 60 * 1000);
  const candidates = await Order.find({
    status: 'pending_payment',
    paymentStatus: { $in: ['pending', 'failed'] },
    createdAt: { $lt: cutoff },
  }).limit(50);

  let rzp = null;
  try {
    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      rzp = getRazorpay();
    }
  } catch {
    rzp = null;
  }

  for (const order of candidates) {
    try {
      if (rzp && order.payment?.razorpayOrderId) {
        const paymentsResp = await rzp.orders.fetchPayments(order.payment.razorpayOrderId);
        const captured = (paymentsResp?.items || []).find((p) => p.status === 'captured');
        if (captured) {
          await confirmOrderPaidAtomically(order._id, {
            razorpayOrderId: order.payment.razorpayOrderId,
            razorpayPaymentId: captured.id,
            method: captured.method || '',
            cardLast4: captured.card?.last4 || '',
            amountPaise: captured.amount,
            feePaise: captured.fee || 0,
            source: 'reconciliation',
          });
          continue;
        }
      }

      order.status = 'expired';
      order.paymentStatus = 'expired';
      order.statusHistory.push({
        status: 'expired',
        at: new Date(),
        note: 'Auto-expired after abandonment window',
      });
      await order.save();
      await releaseCouponUsageForOrder(order._id);
    } catch (err) {
      console.error(`[Cron:ExpireOrders] Order ${order.orderNumber} error:`, err.message);
    }
  }
}

/**
 * Job 2: Nightly reconciliation — fetch recent Razorpay payments (last 36h)
 * and reconcile any order paid on Razorpay but still pending/expired in DB.
 */
async function runNightlyReconciliation() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return;
  try {
    const rzp = getRazorpay();
    const fromSec = Math.floor((Date.now() - 36 * 60 * 60 * 1000) / 1000);
    const resp = await rzp.payments.all({ from: fromSec, count: 100 });

    for (const payment of resp?.items || []) {
      if (payment.status !== 'captured' || !payment.order_id) continue;
      const order = await Order.findOne({ 'payment.razorpayOrderId': payment.order_id });
      if (order && order.paymentStatus !== 'paid') {
        await confirmOrderPaidAtomically(order._id, {
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id,
          method: payment.method || '',
          cardLast4: payment.card?.last4 || '',
          amountPaise: payment.amount,
          feePaise: payment.fee || 0,
          source: 'reconciliation',
        });
      }
    }
  } catch (err) {
    console.error('[Cron:Reconciliation] Error:', err.message);
  }
}

/**
 * Job 3: Weekly rating reminder — sends one reminder email every 7th day after delivery
 * until every purchased item in the delivered order has been rated by the customer.
 */
async function runWeeklyRatingReminders(deps = {}) {
  const OrderModel = deps.Order || Order;
  const ReviewModel = deps.Review || Review;
  const notifyFn = deps.notifyNow || notifyNow;
  const now = deps.now || new Date();

  const sevenDaysAgo = new Date(now.getTime() - WEEK_MS);
  const deliveredOrders = await OrderModel.find({
    status: 'delivered',
    $or: [
      { deliveredAt: { $lte: sevenDaysAgo } },
      { deliveredAt: { $exists: false }, updatedAt: { $lte: sevenDaysAgo } },
      { deliveredAt: null, updatedAt: { $lte: sevenDaysAgo } },
    ],
  })
    .populate('user', 'name email isBlocked')
    .limit(200)
    .lean();

  if (!deliveredOrders || deliveredOrders.length === 0) {
    return { checked: 0, sent: 0 };
  }

  const orderIds = deliveredOrders.map((o) => o._id);
  const existingReviews = await ReviewModel.find({
    order: { $in: orderIds },
    source: 'customer',
  })
    .select('order product')
    .lean();

  const ratedByOrder = new Map();
  for (const r of existingReviews || []) {
    const key = String(r.order);
    if (!ratedByOrder.has(key)) ratedByOrder.set(key, new Set());
    ratedByOrder.get(key).add(String(r.product));
  }

  let sent = 0;
  for (const order of deliveredOrders) {
    try {
      const deliveredDate = new Date(order.deliveredAt || order.updatedAt || order.createdAt);
      const elapsedMs = now.getTime() - deliveredDate.getTime();
      const weekNumber = Math.floor(elapsedMs / WEEK_MS);
      if (weekNumber < 1) continue;

      if (order.user?.isBlocked) continue;
      if (order.user && !order.user.email) continue;

      const ratedSet = ratedByOrder.get(String(order._id)) || new Set();
      const unratedItems = (order.items || []).filter((item) => !ratedSet.has(String(item.product)));
      if (unratedItems.length === 0) continue;

      const res = await notifyFn('RATING_REMINDER', {
        order,
        user: order.user,
        unratedItems,
        weekNumber,
        emailDedupeKey: `${order._id}:RATING_REMINDER:week-${weekNumber}:email`,
      });
      if (res?.email?.ok) sent += 1;
    } catch (err) {
      console.error(`[Cron:WeeklyRatingReminder] Order ${order.orderNumber} error:`, err.message);
    }
  }

  return { checked: deliveredOrders.length, sent };
}

function startCronJobs() {
  if (env.NODE_ENV === 'test') return;

  cron.schedule('*/15 * * * *', () => {
    runExpireAbandonedOrders().catch((e) => console.error('[Cron:ExpireOrders]', e));
  });

  cron.schedule('0 * * * *', () => {
    retryFailedNotifications().catch((e) => console.error('[Cron:RetryNotifications]', e));
    runWeeklyRatingReminders().catch((e) => console.error('[Cron:WeeklyRatingReminders]', e));
  });

  cron.schedule('30 2 * * *', () => {
    runNightlyReconciliation().catch((e) => console.error('[Cron:Reconciliation]', e));
  });

  console.log(
    '[Cron] Scheduled order expiry (15m), notification retry & rating reminders (1h), and reconciliation (02:30)'
  );
}

module.exports = {
  startCronJobs,
  runExpireAbandonedOrders,
  runNightlyReconciliation,
  runWeeklyRatingReminders,
};
