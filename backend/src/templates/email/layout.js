const { siteConfig } = require('../../config/site.config');

/**
 * Shared branded responsive email layout (cream bg, green button, Georgia serif headings).
 */
function renderEmailLayout({ preheader = '', heading, bodyHtml, ctaLabel, ctaUrl }) {
  const year = new Date().getFullYear();
  const baseUrl = (siteConfig.clientCustomerUrl || 'http://localhost:5173').replace(/\/$/, '');
  const logoUrl = `${baseUrl}/orgion-logo.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/png" href="${baseUrl}/orgion-favicon.png" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF8F5;color:#1C1C1C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FAF8F5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #ECE8E1;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:26px 32px;border-bottom:1px solid #ECE8E1;text-align:center;background-color:#FAF8F5;">
              <a href="${baseUrl}" style="text-decoration:none;display:inline-block;">
                <img src="${logoUrl}" alt="ORGION — The Secret Glow" width="140" style="display:block;margin:0 auto;max-width:140px;height:auto;border:0;" />
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#2F5632;font-weight:600;">${heading}</h1>
              ${bodyHtml}
              ${
                ctaLabel && ctaUrl
                  ? `<div style="margin:28px 0 8px;text-align:center;">
                      <a href="${ctaUrl}" style="display:inline-block;background-color:#3D6B40;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:13px 28px;border-radius:10px;">${ctaLabel}</a>
                    </div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px;background-color:#F7F5F2;border-top:1px solid #ECE8E1;text-align:center;font-size:12px;color:#6B6B66;line-height:1.6;">
              <p style="margin:0;">Need help? Reply or reach us at <a href="mailto:${siteConfig.supportEmail}" style="color:#3D6B40;text-decoration:none;">${siteConfig.supportEmail}</a> · ${siteConfig.supportPhone}</p>
              <p style="margin:6px 0 0;">&copy; ${year} ${siteConfig.storeName}. ${siteConfig.businessAddress.line1}, ${siteConfig.businessAddress.line2}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { renderEmailLayout };
