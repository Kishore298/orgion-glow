const ORDER_STATUSES = [
  'pending_payment',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'expired',
];

const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
  'expired',
];

/**
 * Valid admin/system order status transitions.
 * Note: pending_payment -> confirmed happens on payment verify/webhook;
 * pending_payment -> expired happens via expiry cron.
 */
const ALLOWED_STATUS_TRANSITIONS = {
  pending_payment: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  expired: ['confirmed'], // only if late payment confirmed via Razorpay recovery
};

function canTransitionOrderStatus(fromStatus, toStatus) {
  if (!ORDER_STATUSES.includes(toStatus)) return false;
  if (fromStatus === toStatus) return false;
  const allowed = ALLOWED_STATUS_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

module.exports = {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  ALLOWED_STATUS_TRANSITIONS,
  canTransitionOrderStatus,
};
