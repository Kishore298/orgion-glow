import { formatDate, formatINR } from './format';

const STORE_FROM_ADDRESS = {
  company: 'ORGION',
  line1: 'Nagercoil',
  line2: 'Tamil Nadu, India',
  phone: '+91 93609 10640',
};

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function triggerDirectHtmlPrint(htmlContent, title) {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.title = title;

  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1000);
  };

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      cleanup();
    }
  }, 150);
}

const SHARED_3X6_STYLES = `
  @page {
    size: 3in 6in;
    margin: 0;
  }
  * {
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111111;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    width: 3in;
    height: 6in;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .sheet:last-child {
    page-break-after: auto;
    break-after: auto;
  }
`;

export function printOrderLabels(orders = []) {
  if (!orders.length) return;

  const sheets = orders
    .map((order) => {
      const addr = order.addressSnapshot || {};
      const streetLine = [addr.line1, addr.line2, addr.landmark ? `Near ${addr.landmark}` : '']
        .filter(Boolean)
        .join(', ');
      return `
        <section class="sheet label-sheet">
          <div class="addr-block from-block">
            <div class="addr-tag">FROM</div>
            <div class="from-name">${escapeHtml(STORE_FROM_ADDRESS.company)}</div>
            <div class="from-lines">${escapeHtml(STORE_FROM_ADDRESS.line1)}, ${escapeHtml(
        STORE_FROM_ADDRESS.line2
      )}</div>
            <div class="from-phone">Ph: ${escapeHtml(STORE_FROM_ADDRESS.phone)}</div>
          </div>

          <div class="divider"></div>

          <div class="addr-block to-block">
            <div class="addr-tag">TO</div>
            <div class="to-name">${escapeHtml(addr.fullName || 'Customer')}</div>
            <div class="to-lines">${escapeHtml(streetLine)}</div>
            <div class="to-city">${escapeHtml(addr.city || '')}, ${escapeHtml(
        addr.state || ''
      )}</div>
            <div class="to-pin">PIN: ${escapeHtml(addr.pincode || '')}</div>
            <div class="to-mobile">Ph: ${escapeHtml(addr.mobile || '')}</div>
          </div>
        </section>
      `;
    })
    .join('');

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>ORGION Shipping Labels (3x6)</title>
        <style>
          ${SHARED_3X6_STYLES}
          .label-sheet {
            padding: 0.24in;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .addr-tag {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.14em;
            color: #444444;
            margin-bottom: 6px;
          }
          .from-block {
            padding-top: 4px;
          }
          .from-name {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.04em;
            line-height: 1.2;
          }
          .from-lines, .from-phone {
            font-size: 14px;
            line-height: 1.4;
            margin-top: 3px;
            font-weight: 500;
          }
          .divider {
            border-top: 2px dashed #111111;
            margin: 12px 0;
          }
          .to-block {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .to-name {
            font-size: 21px;
            font-weight: 800;
            line-height: 1.25;
            margin-bottom: 6px;
          }
          .to-lines {
            font-size: 15.5px;
            font-weight: 500;
            line-height: 1.4;
            margin-bottom: 6px;
          }
          .to-city {
            font-size: 15.5px;
            font-weight: 600;
            line-height: 1.35;
          }
          .to-pin {
            font-size: 18px;
            font-weight: 800;
            margin-top: 6px;
            letter-spacing: 0.03em;
          }
          .to-mobile {
            font-size: 16px;
            font-weight: 700;
            margin-top: 6px;
          }
        </style>
      </head>
      <body>${sheets}</body>
    </html>
  `;

  triggerDirectHtmlPrint(html, 'ORGION Shipping Labels');
}

export function printOrderInvoices(orders = []) {
  if (!orders.length) return;

  const sheets = orders
    .map((order) => {
      const itemsHtml = (order.items || [])
        .map(
          (item) => `
            <tr>
              <td class="item-name">${escapeHtml(item.name)}</td>
              <td class="num">${escapeHtml(item.qty)}</td>
              <td class="num">${escapeHtml(formatINR(item.price))}</td>
              <td class="num">${escapeHtml(formatINR(Number(item.price || 0) * Number(item.qty || 1)))}</td>
            </tr>
          `
        )
        .join('');

      const shippingText =
        Number(order.shippingCharge || 0) === 0 ? 'Free' : formatINR(order.shippingCharge);
      const couponDiscount = Number(order.couponDiscountAmount || order.discount || 0);
      const discountRowHtml =
        couponDiscount > 0
          ? `<div class="row">
              <span>${escapeHtml(order.couponCode ? `Coupon (${order.couponCode})` : 'Discount')}</span>
              <span>- ${escapeHtml(formatINR(couponDiscount))}</span>
            </div>`
          : '';

      return `
        <section class="sheet invoice-sheet">
          <div class="inv-header">
            <div class="shop-name">ORGION</div>
            <div class="shop-sub">The Secret Glow · Nagercoil</div>
          </div>

          <div class="inv-meta">
            <div><strong>Order:</strong> ${escapeHtml(order.orderNumber)}</div>
            <div><strong>Date:</strong> ${escapeHtml(formatDate(order.createdAt))}</div>
            <div><strong>Customer:</strong> ${escapeHtml(order.addressSnapshot?.fullName || '')}</div>
          </div>

          <table class="inv-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="num">Qty</th>
                <th class="num">Price</th>
                <th class="num">Amt</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          <div class="inv-totals">
            <div class="row">
              <span>Shipping</span>
              <span>${escapeHtml(shippingText)}</span>
            </div>
            ${discountRowHtml}
            <div class="row grand">
              <span>Total</span>
              <span>${escapeHtml(formatINR(order.total))}</span>
            </div>
          </div>

          <div class="inv-footer">
            Thank you for choosing ORGION.
          </div>
        </section>
      `;
    })
    .join('');

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>ORGION Invoices (3x6)</title>
        <style>
          ${SHARED_3X6_STYLES}
          .invoice-sheet {
            padding: 0.16in;
            display: flex;
            flex-direction: column;
            font-size: 10.5px;
          }
          .inv-header {
            text-align: center;
            border-bottom: 1.5px solid #111111;
            padding-bottom: 6px;
          }
          .shop-name {
            font-size: 16px;
            font-weight: 800;
            letter-spacing: 0.14em;
          }
          .shop-sub {
            font-size: 9.5px;
            color: #444444;
            margin-top: 2px;
          }
          .inv-meta {
            padding: 7px 0;
            border-bottom: 1px dashed #666666;
            font-size: 10px;
            line-height: 1.45;
          }
          .inv-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            font-size: 10px;
          }
          .inv-table th {
            text-align: left;
            border-bottom: 1px solid #111111;
            padding: 3px 2px;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          .inv-table td {
            padding: 4px 2px;
            border-bottom: 1px solid #e5e5e5;
            vertical-align: top;
          }
          .inv-table .item-name {
            max-width: 1.35in;
            word-break: break-word;
            line-height: 1.25;
          }
          .inv-table .num {
            text-align: right;
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
          }
          .inv-totals {
            margin-top: auto;
            border-top: 1.5px solid #111111;
            padding-top: 6px;
            font-variant-numeric: tabular-nums;
          }
          .inv-totals .row {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            font-size: 10.5px;
          }
          .inv-totals .row.grand {
            font-size: 13px;
            font-weight: 800;
            border-top: 1px dashed #888888;
            margin-top: 3px;
            padding-top: 4px;
          }
          .inv-footer {
            margin-top: 8px;
            text-align: center;
            font-size: 9.5px;
            color: #444444;
          }
        </style>
      </head>
      <body>${sheets}</body>
    </html>
  `;

  triggerDirectHtmlPrint(html, 'ORGION Invoices');
}
