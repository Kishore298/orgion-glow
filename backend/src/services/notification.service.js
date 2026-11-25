const nodemailer = require('nodemailer');
const NotificationLog = require('../models/NotificationLog');
const User = require('../models/User');
const env = require('../config/env');
const { siteConfig } = require('../config/site.config');
const { formatINR } = require('../utils/currency');
const { getFirebaseMessaging } = require('../config/firebase');
const {
  orderConfirmedTemplate,
  orderStatusChangedTemplate,
  trackingUpdatedTemplate,
  paymentFailedTemplate,
} = require('../templates/email/orderTemplates');

let transporter = null;

function getMailTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

function buildEmailContent(event, payload) {
  const { order, customerName, newStatus, alsoShipped, refundAmount } = payload;
  switch (event) {
    case 'ORDER_CONFIRMED':
      return orderConfirmedTemplate({ order, customerName });
    case 'ORDER_STATUS_CHANGED':
      return orderStatusChangedTemplate({ order, newStatus, customerName, refundAmount });
    case 'TRACKING_UPDATED':
      return trackingUpdatedTemplate({ order, customerName, alsoShipped });
    case 'PAYMENT_FAILED':
      return paymentFailedTemplate({ order, customerName });
    default:
      throw new Error(`Unsupported notification event: ${event}`);
  }
}

function buildPushContent(event, payload) {
  const { order } = payload;
  const orderId = String(order._id);
  const orderRef = order.orderNumber || orderId;
  const trackingId = order.tracking?.trackingId || '';
  const baseUrl = (siteConfig.clientCustomerUrl || 'http://localhost:5173').replace(/\/$/, '');
  const adminBaseUrl = (siteConfig.clientAdminUrl || 'http://localhost:5174').replace(/\/$/, '');

  if (event === 'TRACKING_UPDATED') {
    return {
      title: 'Your ORGION order is on its way',
      body: `ST Courier tracking ID: ${trackingId}. Tap to view tracking.`,
      icon: `${baseUrl}/orgion-logo.png`,
      badge: `${baseUrl}/orgion-favicon.png`,
      data: {
        orderId,
        orderNumber: orderRef,
        link: `/account/orders/${orderRef}`,
      },
    };
  }

  if (event === 'ADMIN_NEW_ORDER') {
    const itemCount = (order.items || []).reduce((sum, i) => sum + Number(i.qty || 1), 0);
    const customer = order.addressSnapshot?.fullName || 'Customer';
    return {
      title: `New Order Received: ${orderRef}`,
      body: `${customer} ordered ${itemCount} item${itemCount === 1 ? '' : 's'} · ${formatINR(order.total)}`,
      icon: `${adminBaseUrl}/orgion-logo.png`,
      badge: `${adminBaseUrl}/orgion-favicon.png`,
      data: {
        orderId,
        orderNumber: orderRef,
        link: `/orders/${orderRef}`,
      },
    };
  }

  return null;
}

async function createLogEntryIfUnique({ order, user, event, channel, dedupeKey, payload }) {
  try {
    const log = await NotificationLog.create({
      order: order?._id,
      user: user?._id || order?.user,
      event,
      channel,
      dedupeKey,
      status: 'queued',
      attempts: 0,
      payload,
    });
    return log;
  } catch (err) {
    if (err.code === 11000) {
      return null;
    }
    throw err;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendEmailWithRetry(log, emailAddress, content, deps = {}) {
  const mailer = deps.mailer !== undefined ? deps.mailer : getMailTransporter();
  if (!emailAddress) {
    await NotificationLog.findByIdAndUpdate(log._id, {
      status: 'failed',
      attempts: 1,
      error: 'Customer email address is missing',
    });
    return { ok: false, error: 'Customer email address is missing' };
  }

  let lastError = null;
  const maxAttempts = deps.maxAttempts || 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      let info;
      if (!mailer) {
        if (env.NODE_ENV !== 'test') {
          console.log(`[Email:dev-stub] To=${emailAddress} | Subject="${content.subject}"`);
        }
        info = { messageId: `dev-stub-${Date.now()}` };
      } else {
        info = await mailer.sendMail({
          from: env.EMAIL_FROM,
          to: emailAddress,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
      }

      await NotificationLog.findByIdAndUpdate(log._id, {
        status: 'sent',
        attempts: attempt,
        error: '',
        providerMessageId: info?.messageId || '',
        sentAt: new Date(),
      });
      return { ok: true, messageId: info?.messageId };
    } catch (err) {
      lastError = err.message || 'SMTP delivery failed';
      if (attempt < maxAttempts && !deps.skipBackoff) {
        await sleep(300 * attempt);
      }
    }
  }

  await NotificationLog.findByIdAndUpdate(log._id, {
    status: 'failed',
    attempts: maxAttempts,
    error: lastError,
  });
  return { ok: false, error: lastError };
}

async function sendPushToTokens(log, tokens, ownerUserIds, pushContent, deps = {}) {
  const messaging = deps.messaging !== undefined ? deps.messaging : getFirebaseMessaging();
  const UserModel = deps.User || User;

  if (!tokens || tokens.length === 0) {
    await NotificationLog.findByIdAndUpdate(log._id, {
      status: 'failed',
      attempts: 1,
      error: 'No registered push tokens',
    });
    return { ok: false, error: 'No registered push tokens' };
  }

  if (!messaging) {
    if (env.NODE_ENV !== 'test') {
      console.log(`[Push:dev-stub] Tokens=${tokens.length} | Title="${pushContent.title}"`);
    }
    await NotificationLog.findByIdAndUpdate(log._id, {
      status: 'sent',
      attempts: 1,
      providerMessageId: `dev-push-${Date.now()}`,
      sentAt: new Date(),
    });
    return { ok: true };
  }

  try {
    const resp = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: pushContent.title,
        body: pushContent.body,
      },
      webpush: {
        notification: {
          icon: pushContent.icon || '/orgion-logo.png',
          badge: pushContent.badge || '/orgion-favicon.png',
        },
        fcmOptions: {
          link: pushContent.data?.link || '/',
        },
      },
      data: pushContent.data,
    });

    const invalidTokens = [];
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token')
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    if (invalidTokens.length > 0 && ownerUserIds.length > 0) {
      await UserModel.updateMany(
        { _id: { $in: ownerUserIds } },
        { $pull: { fcmTokens: { token: { $in: invalidTokens } } } }
      );
    }

    if (resp.successCount > 0) {
      await NotificationLog.findByIdAndUpdate(log._id, {
        status: 'sent',
        attempts: 1,
        providerMessageId: `${resp.successCount}/${tokens.length} delivered`,
        sentAt: new Date(),
      });
      return { ok: true, successCount: resp.successCount };
    }

    const firstErr = resp.responses.find((r) => !r.success)?.error?.message || 'FCM send failed';
    await NotificationLog.findByIdAndUpdate(log._id, {
      status: 'failed',
      attempts: 1,
      error: firstErr,
    });
    return { ok: false, error: firstErr };
  } catch (err) {
    await NotificationLog.findByIdAndUpdate(log._id, {
      status: 'failed',
      attempts: 1,
      error: err.message || 'FCM multicast error',
    });
    return { ok: false, error: err.message };
  }
}

/**
 * Synchronous implementation (awaited in tests & retries, wrapped via setImmediate in notify()).
 */
async function notifyNow(event, payload, deps = {}) {
  const { order } = payload;
  if (!order) return { skipped: true };

  const UserModel = deps.User || User;
  const results = {};

  // Special event: ADMIN_NEW_ORDER -> push to all active admin & staff devices
  if (event === 'ADMIN_NEW_ORDER') {
    const adminUsers = await UserModel.find({
      role: { $in: ['admin', 'staff'] },
      isBlocked: false,
      'fcmTokens.0': { $exists: true },
    });

    const tokens = [
      ...new Set(
        adminUsers.flatMap((u) => (u.fcmTokens || []).map((t) => t.token).filter(Boolean))
      ),
    ];
    const adminIds = adminUsers.map((u) => u._id);

    const pushDedupeKey =
      payload.pushDedupeKey ||
      `${order._id}:ADMIN_NEW_ORDER:${payload.dedupeSuffix || 'confirmed'}:push`;

    const pushLog = await createLogEntryIfUnique({
      order,
      user: adminIds[0] || order.user,
      event,
      channel: 'push',
      dedupeKey: pushDedupeKey,
      payload: { event, orderNumber: order.orderNumber },
    });

    if (pushLog) {
      const pushContent = buildPushContent(event, payload);
      results.push = await sendPushToTokens(pushLog, tokens, adminIds, pushContent, deps);
    } else {
      results.push = { deduped: true };
    }
    return results;
  }

  const user =
    payload.user ||
    (order.user && order.user.email !== undefined
      ? order.user
      : await UserModel.findById(order.user));

  const customerName = payload.customerName || user?.name || order.addressSnapshot?.fullName;
  const enrichedPayload = { ...payload, customerName };

  // 1. Email channel (customer events)
  const emailDedupeKey =
    payload.emailDedupeKey ||
    `${order._id}:${event}:${payload.dedupeSuffix || 'default'}:email`;

  const emailLog = await createLogEntryIfUnique({
    order,
    user,
    event,
    channel: 'email',
    dedupeKey: emailDedupeKey,
    payload: {
      event,
      newStatus: payload.newStatus,
      alsoShipped: payload.alsoShipped,
      refundAmount: payload.refundAmount,
    },
  });

  if (emailLog) {
    const emailContent = buildEmailContent(event, enrichedPayload);
    results.email = await sendEmailWithRetry(emailLog, user?.email, emailContent, deps);
  } else {
    results.email = { deduped: true };
  }

  // 2. Push channel (TRACKING_UPDATED)
  const pushContent = buildPushContent(event, enrichedPayload);
  if (pushContent) {
    const pushDedupeKey =
      payload.pushDedupeKey ||
      `${order._id}:${event}:${payload.dedupeSuffix || order.tracking?.trackingId || 'default'}:push`;

    const pushLog = await createLogEntryIfUnique({
      order,
      user,
      event,
      channel: 'push',
      dedupeKey: pushDedupeKey,
      payload: { event, trackingId: order.tracking?.trackingId },
    });

    if (pushLog) {
      const customerTokens = (user?.fcmTokens || []).map((t) => t.token).filter(Boolean);
      results.push = await sendPushToTokens(
        pushLog,
        customerTokens,
        user?._id ? [user._id] : [],
        pushContent,
        deps
      );
    } else {
      results.push = { deduped: true };
    }
  }

  return results;
}

/**
 * Single public entry point: fires asynchronously AFTER DB commit so failures
 * never block or roll back orders, payments, or admin mutations.
 */
function notify(event, payload) {
  setImmediate(() => {
    notifyNow(event, payload).catch((err) => {
      console.error(`[Notification:${event}] Unhandled error:`, err.message);
    });
  });
}

async function resendNotificationLog(logId) {
  const Order = require('../models/Order');
  const log = await NotificationLog.findById(logId);
  if (!log) return null;
  const order = await Order.findById(log.order);
  if (!order) return null;

  if (log.event === 'ADMIN_NEW_ORDER') {
    const adminUsers = await User.find({
      role: { $in: ['admin', 'staff'] },
      isBlocked: false,
      'fcmTokens.0': { $exists: true },
    });
    const tokens = [
      ...new Set(
        adminUsers.flatMap((u) => (u.fcmTokens || []).map((t) => t.token).filter(Boolean))
      ),
    ];
    const pushContent = buildPushContent('ADMIN_NEW_ORDER', { order });
    return sendPushToTokens(
      log,
      tokens,
      adminUsers.map((u) => u._id),
      pushContent
    );
  }

  const user = await User.findById(log.user);
  const payload = {
    order,
    user,
    customerName: user?.name,
    newStatus: log.payload?.newStatus,
    alsoShipped: log.payload?.alsoShipped,
    refundAmount: log.payload?.refundAmount,
  };

  if (log.channel === 'email') {
    const content = buildEmailContent(log.event, payload);
    return sendEmailWithRetry(log, user?.email, content);
  }

  const pushContent = buildPushContent(log.event, payload);
  if (!pushContent) return { ok: false, error: 'Push not supported for event' };
  const tokens = (user?.fcmTokens || []).map((t) => t.token).filter(Boolean);
  return sendPushToTokens(log, tokens, user?._id ? [user._id] : [], pushContent);
}

async function retryFailedNotifications() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const failedLogs = await NotificationLog.find({
    status: 'failed',
    attempts: { $lt: 3 },
    createdAt: { $gte: cutoff },
  }).limit(30);

  for (const log of failedLogs) {
    try {
      await resendNotificationLog(log._id);
    } catch (err) {
      console.error('[Cron:NotificationRetry] Error:', err.message);
    }
  }
  return failedLogs.length;
}

module.exports = {
  notify,
  notifyNow,
  resendNotificationLog,
  retryFailedNotifications,
};
