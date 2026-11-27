const mongoose = require('mongoose');
const Product = require('../models/Product');
const { getStoreSettings, DEFAULT_SHIPPING } = require('../models/StoreSettings');
const { roundMoney } = require('../utils/currency');

const pincodeStateCache = new Map();
const MAX_PINCODE_CACHE = 2000;

const ZONE_1_STATES = new Set(['tamil nadu']);
const ZONE_2_STATES = new Set([
  'karnataka',
  'andhra pradesh',
  'kerala',
  'puducherry',
  'pondicherry',
  'telangana',
]);

function classifyPackedItemWeightG(itemOrProduct = {}, rules = DEFAULT_SHIPPING) {
  const categorySlug = String(itemOrProduct.category?.slug || itemOrProduct.categorySlug || '').toLowerCase();
  const categoryName = String(itemOrProduct.category?.name || itemOrProduct.categoryName || '').toLowerCase();
  const name = String(itemOrProduct.name || '').toLowerCase();
  const slug = String(itemOrProduct.slug || '').toLowerCase();
  const tags = Array.isArray(itemOrProduct.tags)
    ? itemOrProduct.tags.map((t) => String(t).toLowerCase()).join(' ')
    : '';
  const haystack = `${categorySlug} ${categoryName} ${name} ${slug} ${tags}`;

  if (/\blip\b|balm|lip-care|lip care/.test(haystack)) {
    return Number(rules.lipBalmWeightG ?? DEFAULT_SHIPPING.lipBalmWeightG);
  }
  if (/cream|lotion|moistur|night\s*cream/.test(haystack)) {
    return Number(rules.creamWeightG ?? DEFAULT_SHIPPING.creamWeightG);
  }
  if (/soap|bar|cleanser/.test(haystack)) {
    return Number(rules.soapWeightG ?? DEFAULT_SHIPPING.soapWeightG);
  }
  const explicitWeight = Number(itemOrProduct.weight || 0);
  if (explicitWeight > 0) return explicitWeight;
  return Number(rules.soapWeightG ?? DEFAULT_SHIPPING.soapWeightG);
}

function getZoneAndRate(stateName, rules = DEFAULT_SHIPPING) {
  const normalized = String(stateName || '').trim().toLowerCase();
  if (ZONE_1_STATES.has(normalized)) {
    return {
      zone: 1,
      zoneName: 'Zone 1 (Tamil Nadu)',
      ratePerKg: Number(rules.zone1RatePerKg ?? DEFAULT_SHIPPING.zone1RatePerKg),
    };
  }
  if (ZONE_2_STATES.has(normalized)) {
    return {
      zone: 2,
      zoneName: 'Zone 2 (Karnataka / Andhra Pradesh / Kerala / Puducherry / Telangana)',
      ratePerKg: Number(rules.zone2RatePerKg ?? DEFAULT_SHIPPING.zone2RatePerKg),
    };
  }
  return {
    zone: 3,
    zoneName: 'Zone 3 (Rest of India)',
    ratePerKg: Number(rules.zone3RatePerKg ?? DEFAULT_SHIPPING.zone3RatePerKg),
  };
}

async function resolveStateFromPincode(pincode, fallbackState = '', deps = {}) {
  const cleanPin = String(pincode || '').trim();
  if (!/^[1-9]\d{5}$/.test(cleanPin)) {
    return String(fallbackState || '').trim();
  }

  if (!deps.skipCache && pincodeStateCache.has(cleanPin)) {
    return pincodeStateCache.get(cleanPin);
  }

  const fetcher = deps.fetch || (typeof fetch === 'function' ? fetch : null);
  if (!fetcher) {
    return String(fallbackState || '').trim();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs || 3500);
  try {
    const resp = await fetcher(`https://api.postalpincode.in/pincode/${cleanPin}`, {
      signal: controller.signal,
    });
    if (!resp?.ok) {
      return String(fallbackState || '').trim();
    }
    const json = await resp.json();
    const postOffice = json?.[0]?.PostOffice?.[0];
    const resolved = String(postOffice?.State || '').trim();
    if (resolved) {
      if (pincodeStateCache.size >= MAX_PINCODE_CACHE) {
        const firstKey = pincodeStateCache.keys().next().value;
        pincodeStateCache.delete(firstKey);
      }
      pincodeStateCache.set(cleanPin, resolved);
      return resolved;
    }
  } catch {
    // Fallback gracefully to provided/manual state if India Post API fails or is slow
  } finally {
    clearTimeout(timeout);
  }

  return String(fallbackState || '').trim();
}

/**
 * Calculates shipping using packed item weights + flat packaging, India Post state verification,
 * and weight slabs rounded up to next whole kg.
 */
async function calculateShipping(
  { pincode, state, subtotal = 0, weight = 0, items = [] } = {},
  deps = {}
) {
  let rules = deps.shippingRules;
  if (!rules) {
    const settings = await getStoreSettings().catch(() => null);
    rules = {
      ...DEFAULT_SHIPPING,
      ...(settings?.shipping?.toObject ? settings.shipping.toObject() : settings?.shipping || {}),
    };
  }

  const productIds = (items || [])
    .map((i) => i.productId || i.product)
    .filter(Boolean);

  let productMap = deps.productMap || new Map();
  if (
    !deps.productMap &&
    productIds.length > 0 &&
    mongoose.connection.readyState === 1
  ) {
    const dbProducts = await Product.find({ _id: { $in: productIds } })
      .populate('category', 'name slug')
      .lean();
    productMap = new Map(dbProducts.map((p) => [String(p._id), p]));
  }

  let totalWeightG = 0;
  if (Array.isArray(items) && items.length > 0) {
    for (const item of items) {
      const qty = Math.max(1, Number(item.qty || 1));
      const pid = String(item.productId || item.product || '');
      const dbProd = productMap.get(pid);
      const unitWeightG = classifyPackedItemWeightG(dbProd || item, rules);
      totalWeightG += unitWeightG * qty;
    }
    totalWeightG += Number(rules.outerPackagingG ?? DEFAULT_SHIPPING.outerPackagingG);
  } else if (Number(weight || 0) > 0) {
    totalWeightG = Number(weight);
  } else {
    totalWeightG = Number(rules.outerPackagingG ?? DEFAULT_SHIPPING.outerPackagingG);
  }

  const resolvedState = await resolveStateFromPincode(pincode, state, deps);
  const detectedState = resolvedState || String(state || '').trim();
  const { zone, zoneName, ratePerKg } = getZoneAndRate(detectedState, rules);
  const slabs = totalWeightG > 0 ? Math.ceil(totalWeightG / 1000) : 1;
  const charge = roundMoney(slabs * ratePerKg);
  const weightNote =
    totalWeightG < 1000
      ? 'below 1 kg'
      : totalWeightG === 1000
      ? '1 kg slab'
      : `${slabs} kg slab`;

  return {
    serviceable: true,
    charge,
    freeShippingApplied: false,
    etaDays: null,
    weightG: totalWeightG,
    slabs,
    ratePerKg,
    zone,
    zoneName,
    resolvedState: detectedState,
    message: `${detectedState || zoneName} · ${totalWeightG}g parcel - ${weightNote}`,
  };
}

module.exports = {
  calculateShipping,
  classifyPackedItemWeightG,
  getZoneAndRate,
  resolveStateFromPincode,
  pincodeStateCache,
};
