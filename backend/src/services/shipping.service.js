const { siteConfig } = require('../config/site.config');
const { roundMoney } = require('../utils/currency');

/**
 * Pluggable Shipping Service (Section 5).
 *
 * TODO: The shipping calculation rules are not finalized yet. When ready, replace
 * ONLY the body of calculateShipping() with the real rate/zone/weight logic —
 * no controller, route, or frontend changes are required.
 *
 * @param {object} params
 * @param {string} [params.pincode]
 * @param {string} [params.state]
 * @param {number} [params.subtotal]
 * @param {number} [params.weight]
 * @param {Array}  [params.items]
 * @returns {Promise<{ serviceable: boolean, charge: number, freeShippingApplied: boolean, etaDays: number|null, message?: string }>}
 */
async function calculateShipping({ pincode, state, subtotal = 0, weight = 0, items = [] } = {}) {
  // Stub contract: serviceable everywhere with static SHIPPING_STUB_CHARGE (default 0)
  const stubCharge = roundMoney(siteConfig.SHIPPING_STUB_CHARGE || 0);
  return {
    serviceable: true,
    charge: stubCharge,
    freeShippingApplied: false,
    etaDays: null,
    message: stubCharge === 0 ? 'Standard delivery' : undefined,
  };
}

module.exports = {
  calculateShipping,
};
