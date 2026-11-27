const PDFDocument = require('pdfkit');
const { siteConfig } = require('../config/site.config');

/**
 * Generates a compact 3 × 6 inch (216 × 432 pt) ORGION Invoice PDF as a Buffer.
 */
function formatPdfMoney(amount) {
  const num = Number(amount || 0);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  return `Rs. ${formatted}`;
}

function generateInvoicePdfBuffer(order) {
  return new Promise((resolve, reject) => {
    try {
      // 3 in x 6 in = 216 pt x 432 pt
      const doc = new PDFDocument({ size: [216, 432], margin: 12 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primary = '#3D6B40';
      const muted = '#555550';
      const dark = '#111111';
      const border = '#D8D4CC';
      const width = 192; // 216 - 2*12

      // Header: Shop name
      doc
        .fillColor(primary)
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(siteConfig.storeName || 'ORGION', 12, 12, { align: 'center', width, characterSpacing: 2 });

      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(7.5)
        .text(`${siteConfig.tagline} · Nagercoil`, 12, 29, { align: 'center', width });

      doc.moveTo(12, 42).lineTo(204, 42).strokeColor(dark).lineWidth(0.8).stroke();

      // Order Number & Meta
      const dateStr = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const addr = order.addressSnapshot || {};

      doc
        .fillColor(dark)
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(`Order: ${order.orderNumber}`, 12, 48, { width });

      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(7.5)
        .text(`Date: ${dateStr}  |  ${String(order.paymentStatus || '').toUpperCase()}`, 12, 60, { width })
        .text(`Customer: ${addr.fullName || 'Customer'}`, 12, 70, { width });

      doc.moveTo(12, 83).lineTo(204, 83).strokeColor(border).lineWidth(0.6).stroke();

      // Table Header
      let y = 89;
      doc
        .fillColor(muted)
        .font('Helvetica-Bold')
        .fontSize(7)
        .text('ITEM', 12, y, { width: 92 })
        .text('QTY', 106, y, { width: 20, align: 'right' })
        .text('PRICE', 128, y, { width: 36, align: 'right' })
        .text('AMT', 166, y, { width: 38, align: 'right' });

      y += 11;
      doc.moveTo(12, y).lineTo(204, y).strokeColor(dark).lineWidth(0.6).stroke();
      y += 5;

      for (const item of order.items || []) {
        if (y > 360) {
          doc.addPage({ size: [216, 432], margin: 12 });
          y = 14;
        }
        const lineTotal = Number(item.price || 0) * Number(item.qty || 1);
        const startY = y;
        doc
          .fillColor(dark)
          .font('Helvetica')
          .fontSize(7.5)
          .text(String(item.name || ''), 12, startY, { width: 92 });
        const rowBottom = doc.y;

        doc
          .text(String(item.qty || 1), 106, startY, { width: 20, align: 'right' })
          .text(formatPdfMoney(item.price), 128, startY, { width: 36, align: 'right' })
          .text(formatPdfMoney(lineTotal), 166, startY, { width: 38, align: 'right' });

        y = Math.max(rowBottom, startY + 11) + 4;
        doc.moveTo(12, y - 2).lineTo(204, y - 2).strokeColor(border).lineWidth(0.4).stroke();
      }

      // Shipping & Total
      y += 6;
      doc.moveTo(12, y).lineTo(204, y).strokeColor(dark).lineWidth(0.8).stroke();
      y += 6;

      const drawRow = (label, value, bold = false, color = dark) => {
        doc
          .fillColor(color)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(bold ? 9.5 : 8)
          .text(label, 90, y, { width: 64, align: 'right' })
          .text(value, 156, y, { width: 48, align: 'right' });
        y += bold ? 15 : 12;
      };

      const couponAmt = Number(order.couponDiscountAmount || order.discount || 0);
      drawRow(
        'Shipping',
        Number(order.shippingCharge || 0) === 0 ? 'Free' : formatPdfMoney(order.shippingCharge)
      );
      if (couponAmt > 0) {
        drawRow(
          order.couponCode ? `Coupon (${order.couponCode})` : 'Discount',
          `- ${formatPdfMoney(couponAmt)}`
        );
      }
      drawRow('Total', formatPdfMoney(order.total), true, primary);

      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(7)
        .text('Thank you for choosing ORGION.', 12, Math.min(410, y + 8), {
          align: 'center',
          width,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateInvoicePdfBuffer,
};
