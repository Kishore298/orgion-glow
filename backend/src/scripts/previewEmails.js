const fs = require('fs');
const path = require('path');
const {
  orderConfirmedTemplate,
  orderStatusChangedTemplate,
  trackingUpdatedTemplate,
  paymentFailedTemplate,
} = require('../templates/email/orderTemplates');

const outDir = path.resolve(__dirname, '../../tmp/email-previews');
fs.mkdirSync(outDir, { recursive: true });

const sampleOrder = {
  _id: '674500000000000000000001',
  orderNumber: 'ORG-48219',
  subtotal: 1248,
  shippingCharge: 0,
  total: 1248,
  addressSnapshot: {
    fullName: 'Ananya Sharma',
    mobile: '9876500003',
    line1: '24, Palm Grove Residency, 12th Main',
    line2: 'Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038',
  },
  payment: { method: 'upi' },
  tracking: { courier: 'ST Courier', trackingId: 'STC994810293IN' },
  items: [
    { name: 'Beetroot & Rose Lip Butter', price: 349, qty: 1 },
    { name: 'Kumkumadi Radiance Facial Oil', price: 899, qty: 1 },
  ],
};

const previews = [
  ['01-order-confirmed.html', orderConfirmedTemplate({ order: sampleOrder, customerName: 'Ananya' })],
  [
    '02-status-processing.html',
    orderStatusChangedTemplate({ order: sampleOrder, newStatus: 'processing', customerName: 'Ananya' }),
  ],
  [
    '03-status-shipped.html',
    orderStatusChangedTemplate({ order: sampleOrder, newStatus: 'shipped', customerName: 'Ananya' }),
  ],
  [
    '04-status-out-for-delivery.html',
    orderStatusChangedTemplate({
      order: sampleOrder,
      newStatus: 'out_for_delivery',
      customerName: 'Ananya',
    }),
  ],
  [
    '05-status-delivered.html',
    orderStatusChangedTemplate({ order: sampleOrder, newStatus: 'delivered', customerName: 'Ananya' }),
  ],
  [
    '06-status-cancelled.html',
    orderStatusChangedTemplate({ order: sampleOrder, newStatus: 'cancelled', customerName: 'Ananya' }),
  ],
  [
    '07-status-refund-processed.html',
    orderStatusChangedTemplate({
      order: sampleOrder,
      newStatus: 'refund_processed',
      customerName: 'Ananya',
      refundAmount: 1248,
    }),
  ],
  [
    '08-tracking-updated-combined.html',
    trackingUpdatedTemplate({ order: sampleOrder, customerName: 'Ananya', alsoShipped: true }),
  ],
  [
    '09-payment-failed.html',
    paymentFailedTemplate({ order: sampleOrder, customerName: 'Ananya' }),
  ],
];

for (const [filename, content] of previews) {
  fs.writeFileSync(path.join(outDir, filename), content.html, 'utf8');
}

console.log(`Rendered ${previews.length} email preview files to ${outDir}`);
