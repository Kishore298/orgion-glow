const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { siteConfig } = require('../config/site.config');
const { formatINR } = require('../utils/currency');

/**
 * Generates an ORGION GST/Order Invoice PDF as a Buffer.
 * Uses INR formatting (avoiding unsupported glyph issues in built-in Helvetica by rendering "Rs." when needed,
 * or standard ASCII-safe formatting cleanly).
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
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primary = '#3D6B40';
      const muted = '#6B6B66';
      const dark = '#1C1C1C';
      const border = '#ECE8E1';

      // Header with brand logo
      const logoPath = path.resolve(__dirname, '../assets/orgion-logo.png');
      let headerInfoY = 78;
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 48, 42, { width: 105 });
        headerInfoY = 104;
      } else {
        doc
          .fillColor(primary)
          .font('Times-Bold')
          .fontSize(26)
          .text('ORGION', 48, 48, { characterSpacing: 4 });
      }

      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(9)
        .text(siteConfig.tagline, 48, headerInfoY)
        .text(siteConfig.businessAddress.companyName, 48, headerInfoY + 14)
        .text(siteConfig.businessAddress.line1, 48, headerInfoY + 26)
        .text(siteConfig.businessAddress.line2, 48, headerInfoY + 38)
        .text(`GSTIN: ${siteConfig.gstin}`, 48, headerInfoY + 50)
        .text(`Support: ${siteConfig.supportEmail} | ${siteConfig.supportPhone}`, 48, headerInfoY + 62);

      // Invoice metadata right side
      doc
        .fillColor(dark)
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('TAX INVOICE', 360, 48, { align: 'right', width: 185 });

      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor(muted)
        .text(`Order No: ${order.orderNumber}`, 360, 72, { align: 'right', width: 185 })
        .text(
          `Order Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}`,
          360,
          86,
          { align: 'right', width: 185 }
        )
        .text(`Payment Status: ${String(order.paymentStatus || '').toUpperCase()}`, 360, 100, {
          align: 'right',
          width: 185,
        })
        .text(
          `Payment Method: ${String(order.payment?.method || 'Online').toUpperCase()}`,
          360,
          114,
          { align: 'right', width: 185 }
        );

      // Divider
      doc.moveTo(48, 168).lineTo(547, 168).strokeColor(border).lineWidth(1).stroke();

      // Billing / Shipping Address
      const addr = order.addressSnapshot || {};
      doc
        .fillColor(muted)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('DELIVER TO', 48, 184);

      doc
        .fillColor(dark)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(addr.fullName || 'Valued Customer', 48, 200);

      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor(dark)
        .text(
          [addr.line1, addr.line2, addr.landmark ? `Near ${addr.landmark}` : '']
            .filter(Boolean)
            .join(', '),
          48,
          216,
          { width: 280 }
        )
        .text(`${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`, 48, 244)
        .text(`Mobile: ${addr.mobile || ''}`, 48, 258);

      if (order.tracking?.trackingId) {
        doc
          .fillColor(muted)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('SHIPPING CARRIER', 360, 184, { align: 'right', width: 185 });
        doc
          .fillColor(dark)
          .font('Helvetica')
          .fontSize(9.5)
          .text(`${order.tracking.courier || 'ST Courier'}`, 360, 200, {
            align: 'right',
            width: 185,
          })
          .text(`Tracking ID: ${order.tracking.trackingId}`, 360, 214, {
            align: 'right',
            width: 185,
          });
      }

      // Items Table Header
      let y = 295;
      doc.rect(48, y, 499, 24).fill('#F7F5F2');
      doc
        .fillColor(muted)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('ITEM', 58, y + 7, { width: 250 })
        .text('QTY', 320, y + 7, { width: 50, align: 'right' })
        .text('PRICE', 385, y + 7, { width: 70, align: 'right' })
        .text('TOTAL', 465, y + 7, { width: 72, align: 'right' });

      y += 32;

      for (const item of order.items || []) {
        if (y > 700) {
          doc.addPage();
          y = 48;
        }
        const lineTotal = Number(item.price || 0) * Number(item.qty || 1);
        doc
          .fillColor(dark)
          .font('Helvetica')
          .fontSize(10)
          .text(item.name, 58, y, { width: 250 })
          .text(String(item.qty), 320, y, { width: 50, align: 'right' })
          .text(formatPdfMoney(item.price), 385, y, { width: 70, align: 'right' })
          .text(formatPdfMoney(lineTotal), 465, y, { width: 72, align: 'right' });

        y += 24;
        doc.moveTo(48, y - 4).lineTo(547, y - 4).strokeColor(border).lineWidth(0.5).stroke();
      }

      // Totals
      y += 14;
      const drawTotalRow = (label, value, bold = false, color = dark) => {
        doc
          .fillColor(color)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(bold ? 12 : 10)
          .text(label, 350, y, { width: 105, align: 'right' })
          .text(value, 465, y, { width: 72, align: 'right' });
        y += bold ? 24 : 18;
      };

      drawTotalRow('Subtotal', formatPdfMoney(order.subtotal));
      drawTotalRow(
        'Shipping',
        Number(order.shippingCharge || 0) === 0 ? 'Free' : formatPdfMoney(order.shippingCharge)
      );
      if (Number(order.discount || 0) > 0) {
        drawTotalRow('Discount', `- ${formatPdfMoney(order.discount)}`);
      }
      doc.moveTo(350, y - 4).lineTo(547, y - 4).strokeColor(border).lineWidth(1).stroke();
      y += 6;
      drawTotalRow('Grand Total', formatPdfMoney(order.total), true, primary);

      // Footer
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(8.5)
        .text(
          `Thank you for choosing ORGION. Handcrafted in small batches with pure botanicals. (${formatINR(
            order.total
          )})`,
          48,
          755,
          { align: 'center', width: 499 }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateInvoicePdfBuffer,
};
