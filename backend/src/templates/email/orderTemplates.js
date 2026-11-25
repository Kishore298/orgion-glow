const { renderEmailLayout } = require('./layout');
const { siteConfig } = require('../../config/site.config');
const { formatINR } = require('../../utils/currency');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildItemsTableHtml(order) {
  const rows = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #ECE8E1;font-size:14px;color:#1C1C1C;">
          <span style="color:#C9A66B;margin-right:6px;">&#8226;</span>${escapeHtml(item.name)} &times; ${item.qty}
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #ECE8E1;font-size:14px;color:#1C1C1C;font-weight:500;">
          ${formatINR(Number(item.price) * Number(item.qty))}
        </td>
      </tr>`
    )
    .join('');

  return `
  <div style="background-color:#F7F5F2;border:1px solid #ECE8E1;border-radius:12px;padding:18px 20px;margin:20px 0;">
    <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6B6B66;font-weight:600;">Order Summary · ${escapeHtml(order.orderNumber)}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${rows}
      <tr>
        <td style="padding:10px 0 4px;font-size:13px;color:#6B6B66;">Shipping</td>
        <td align="right" style="padding:10px 0 4px;font-size:13px;color:#1C1C1C;">${Number(order.shippingCharge || 0) === 0 ? 'Free' : formatINR(order.shippingCharge)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0 0;font-size:16px;font-weight:600;color:#1C1C1C;">Total</td>
        <td align="right" style="padding:8px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;color:#3D6B40;">${formatINR(order.total)}</td>
      </tr>
    </table>
  </div>`;
}

function buildAddressHtml(order) {
  const a = order.addressSnapshot || {};
  return `
  <div style="background-color:#F7F5F2;border:1px solid #ECE8E1;border-radius:12px;padding:16px 20px;margin:16px 0;font-size:13px;line-height:1.6;color:#1C1C1C;">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6B6B66;font-weight:600;">Delivery Address</p>
    <strong>${escapeHtml(a.fullName)}</strong> (${escapeHtml(a.mobile)})<br/>
    ${escapeHtml(a.line1)}${a.line2 ? ', ' + escapeHtml(a.line2) : ''}${a.landmark ? ', Near ' + escapeHtml(a.landmark) : ''}<br/>
    ${escapeHtml(a.city)}, ${escapeHtml(a.state)} - ${escapeHtml(a.pincode)}
  </div>`;
}

function orderConfirmedTemplate({ order, customerName }) {
  const orderRef = order.orderNumber || order._id;
  const orderUrl = `${siteConfig.clientCustomerUrl}/account/orders/${orderRef}`;
  const invoiceUrl = `${siteConfig.clientCustomerUrl}/account/orders/${orderRef}?invoice=1`;
  const subject = `Order Confirmed: ${order.orderNumber} — ORGION`;

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1C1C1C;">
      Namaste ${escapeHtml(customerName || order.addressSnapshot?.fullName || 'Friend')},
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#6B6B66;">
      Thank you for choosing ORGION. Your order <strong>${escapeHtml(order.orderNumber)}</strong> has been confirmed and our artisans are preparing your herbal formulations with care.
    </p>
    <p style="margin:0 0 10px;font-size:13px;color:#6B6B66;">
      Payment method: <strong style="color:#1C1C1C;">${escapeHtml(String(order.payment?.method || 'Online').toUpperCase())}</strong>
      &nbsp;|&nbsp; <a href="${invoiceUrl}" style="color:#3D6B40;text-decoration:underline;">Download Invoice</a>
    </p>
    ${buildItemsTableHtml(order)}
    ${buildAddressHtml(order)}
  `;

  const text = [
    `ORGION — Order Confirmed (${order.orderNumber})`,
    `Thank you ${customerName || ''}! Your payment of ${formatINR(order.total)} is confirmed.`,
    ...order.items.map((i) => `- ${i.name} x ${i.qty}: ${formatINR(i.price * i.qty)}`),
    `Total: ${formatINR(order.total)}`,
    `View order: ${orderUrl}`,
  ].join('\n');

  return {
    subject,
    html: renderEmailLayout({
      preheader: `Your ORGION order ${order.orderNumber} is confirmed.`,
      heading: 'Order Successfully Placed',
      bodyHtml,
      ctaLabel: 'View Order',
      ctaUrl: orderUrl,
    }),
    text,
  };
}

function orderStatusChangedTemplate({ order, newStatus, customerName, refundAmount }) {
  const orderRef = order.orderNumber || order._id;
  const orderUrl = `${siteConfig.clientCustomerUrl}/account/orders/${orderRef}`;
  const rateUrl = `${siteConfig.clientCustomerUrl}/account/orders/${orderRef}#rate`;
  const trackingId = order.tracking?.trackingId;

  const copyMap = {
    processing: {
      subject: `Preparing Your Order ${order.orderNumber} — ORGION`,
      heading: 'Your Rituals Are Being Hand-Packed',
      lead: `Your order ${order.orderNumber} is now being freshly packed in small batches at our workshop.`,
      ctaLabel: 'View Order',
      ctaUrl: orderUrl,
    },
    shipped: {
      subject: `Shipped: Order ${order.orderNumber} is on its way — ORGION`,
      heading: 'Your ORGION Order Has Shipped',
      lead: `Wonderful news! Your order ${order.orderNumber} has been dispatched via ST Courier.`,
      ctaLabel: trackingId ? 'Track Your Order' : 'View Order',
      ctaUrl: orderUrl,
    },
    out_for_delivery: {
      subject: `Out for Delivery: ${order.orderNumber} — ORGION`,
      heading: 'Arriving Soon',
      lead: `Your ORGION package (${order.orderNumber}) is out for delivery today. Please keep your phone accessible.`,
      ctaLabel: 'View Order',
      ctaUrl: orderUrl,
    },
    delivered: {
      subject: `Delivered: How did you like your ORGION order ${order.orderNumber}?`,
      heading: 'Your Order Has Been Delivered',
      lead: `Your order ${order.orderNumber} has arrived. We hope your skin and lips love every drop of our botanical care!`,
      ctaLabel: 'Rate Your Products',
      ctaUrl: rateUrl,
    },
    cancelled: {
      subject: `Order Cancelled: ${order.orderNumber} — ORGION`,
      heading: 'Order Cancelled',
      lead: `Your order ${order.orderNumber} has been cancelled. If a payment was made, any applicable refund will be processed shortly.`,
      ctaLabel: 'View Order',
      ctaUrl: orderUrl,
    },
    refund_processed: {
      subject: `Refund Processed: ${order.orderNumber} — ORGION`,
      heading: 'Your Refund Has Been Processed',
      lead: `A refund of ${formatINR(refundAmount || order.total)} for order ${order.orderNumber} has been processed. It typically reflects in 5–7 business days.`,
      ctaLabel: 'View Order',
      ctaUrl: orderUrl,
    },
  };

  const meta = copyMap[newStatus] || {
    subject: `Order Update (${order.orderNumber}) — ORGION`,
    heading: `Order Status: ${String(newStatus).replace(/_/g, ' ')}`,
    lead: `Your order ${order.orderNumber} status has been updated to ${String(newStatus).replace(/_/g, ' ')}.`,
    ctaLabel: 'View Order',
    ctaUrl: orderUrl,
  };

  const trackingBlock =
    trackingId && (newStatus === 'shipped' || newStatus === 'out_for_delivery')
      ? `<div style="background-color:#E3F0E6;border:1px solid #C6DEC9;border-radius:12px;padding:16px 20px;margin:18px 0;">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#2F5632;font-weight:600;">ST Courier Tracking ID</p>
          <p style="margin:0;font-family:monospace;font-size:18px;font-weight:700;color:#2F5632;">${escapeHtml(trackingId)}</p>
          <p style="margin:8px 0 0;font-size:12px;color:#2F5632;">Track on ST Courier: <a href="${siteConfig.stCourierTrackingUrl}" style="color:#2F5632;font-weight:600;">${siteConfig.stCourierTrackingUrl}</a></p>
        </div>`
      : '';

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1C1C1C;">
      Namaste ${escapeHtml(customerName || order.addressSnapshot?.fullName || 'Friend')},
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#6B6B66;">${escapeHtml(meta.lead)}</p>
    ${trackingBlock}
    ${buildItemsTableHtml(order)}
  `;

  const text = [
    meta.heading,
    meta.lead,
    trackingId ? `ST Courier Tracking ID: ${trackingId} (${siteConfig.stCourierTrackingUrl})` : '',
    `${meta.ctaLabel}: ${meta.ctaUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject: meta.subject,
    html: renderEmailLayout({
      preheader: meta.lead,
      heading: meta.heading,
      bodyHtml,
      ctaLabel: meta.ctaLabel,
      ctaUrl: meta.ctaUrl,
    }),
    text,
  };
}

function trackingUpdatedTemplate({ order, customerName, alsoShipped = false }) {
  const orderRef = order.orderNumber || order._id;
  const orderUrl = `${siteConfig.clientCustomerUrl}/account/orders/${orderRef}`;
  const trackingId = order.tracking?.trackingId || '';
  const heading = alsoShipped ? 'Your ORGION Order Has Shipped' : 'Tracking Details Updated';
  const subject = alsoShipped
    ? `Shipped & Tracking Added: ${order.orderNumber} — ORGION`
    : `Tracking Updated for Order ${order.orderNumber} — ORGION`;

  const lead = alsoShipped
    ? `Your order ${order.orderNumber} has been marked as shipped and dispatched via ST Courier.`
    : `Your ST Courier tracking ID for order ${order.orderNumber} has been updated.`;

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1C1C1C;">
      Namaste ${escapeHtml(customerName || order.addressSnapshot?.fullName || 'Friend')},
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#6B6B66;">${escapeHtml(lead)}</p>
    <div style="background-color:#E3F0E6;border:1px solid #C6DEC9;border-radius:12px;padding:18px 20px;margin:18px 0;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#2F5632;font-weight:600;">ST Courier Tracking ID</p>
      <p style="margin:0;font-family:monospace;font-size:20px;font-weight:700;color:#2F5632;">${escapeHtml(trackingId)}</p>
      <p style="margin:8px 0 0;font-size:12px;color:#2F5632;">
        Paste your tracking ID on the ST Courier page if it isn't filled in automatically:
        <a href="${siteConfig.stCourierTrackingUrl}" style="color:#2F5632;font-weight:600;">Open ST Courier</a>
      </p>
    </div>
    ${buildItemsTableHtml(order)}
  `;

  const text = [
    heading,
    lead,
    `ST Courier Tracking ID: ${trackingId}`,
    `Track at: ${siteConfig.stCourierTrackingUrl}`,
    `View Order: ${orderUrl}`,
  ].join('\n');

  return {
    subject,
    html: renderEmailLayout({
      preheader: `ST Courier Tracking ID: ${trackingId}`,
      heading,
      bodyHtml,
      ctaLabel: 'Track Your Order',
      ctaUrl: orderUrl,
    }),
    text,
  };
}

function paymentFailedTemplate({ order, customerName }) {
  const orderRef = order.orderNumber || order._id;
  const orderUrl = `${siteConfig.clientCustomerUrl}/account/orders/${orderRef}`;
  const subject = `Payment Unsuccessful for Order ${order.orderNumber} — ORGION`;
  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1C1C1C;">
      Namaste ${escapeHtml(customerName || order.addressSnapshot?.fullName || 'Friend')},
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#6B6B66;">
      We noticed the payment for order <strong>${escapeHtml(order.orderNumber)}</strong> (${formatINR(order.total)}) could not be completed. If any amount was debited, your bank usually reverses it automatically within 3–5 business days.
    </p>
  `;
  return {
    subject,
    html: renderEmailLayout({
      preheader: `Payment incomplete for ${order.orderNumber}.`,
      heading: 'Payment Could Not Be Completed',
      bodyHtml,
      ctaLabel: 'View Order Details',
      ctaUrl: orderUrl,
    }),
    text: `Payment unsuccessful for order ${order.orderNumber}. View details: ${orderUrl}`,
  };
}

module.exports = {
  orderConfirmedTemplate,
  orderStatusChangedTemplate,
  trackingUpdatedTemplate,
  paymentFailedTemplate,
};
