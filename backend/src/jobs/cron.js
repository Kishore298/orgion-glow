const cron = require('node-cron');
const Order = require('../models/Order');
const env = require('../config/env');
const { getRazorpay } = require('../config/razorpay');
const { confirmOrderPaidAtomically } = require('../services/payment.service');
const { retryFailedNotifications } = require('../services/notification.service');

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

function startCronJobs() {
  if (env.NODE_ENV === 'test') return;

  cron.schedule('*/15 * * * *', () => {
    runExpireAbandonedOrders().catch((e) => console.error('[Cron:ExpireOrders]', e));
  });

  cron.schedule('0 * * * *', () => {
    retryFailedNotifications().catch((e) => console.error('[Cron:RetryNotifications]', e));
  });

  cron.schedule('30 2 * * *', () => {
    runNightlyReconciliation().catch((e) => console.error('[Cron:Reconciliation]', e));
  });

  console.log('[Cron] Scheduled order expiry (15m), notification retry (1h), and reconciliation (02:30)');
}

module.exports = {
  startCronJobs,
  runExpireAbandonedOrders,
  runNightlyReconciliation,
};
