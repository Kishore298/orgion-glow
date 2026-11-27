const Coupon = require('../models/Coupon');
const CouponUsage = require('../models/CouponUsage');
const Product = require('../models/Product');
const { roundMoney } = require('../utils/currency');
const { ApiError } = require('../utils/apiResponse');

const CODE_REGEX = /^[A-Z0-9_-]{3,20}$/;

function normalizeCouponCode(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function formatInrShort(amount) {
  const num = roundMoney(amount);
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

/**
 * Derives lifecycle status for admin display and lifecycle guards.
 */
function computeCouponStatus(coupon, now = new Date()) {
  if (!coupon) return 'inactive';
  if (
    coupon.maxTotalUsage != null &&
    Number(coupon.usedCount || 0) >= Number(coupon.maxTotalUsage)
  ) {
    return 'limit_reached';
  }
  if (!coupon.isActive) {
    return 'inactive';
  }
  if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
    return 'expired';
  }
  if (coupon.startDate && new Date(coupon.startDate) > now) {
    return 'scheduled';
  }
  return 'active';
}

/**
 * Calculates discount strictly against product selling subtotal (after product offers, before shipping).
 */
function calculateCouponDiscount(coupon, subtotal) {
  const cleanSub = Math.max(0, Number(subtotal || 0));
  if (!coupon || cleanSub <= 0) return 0;

  let raw = 0;
  if (coupon.discountType === 'percentage') {
    raw = (cleanSub * Number(coupon.discountValue || 0)) / 100;
    if (coupon.maxDiscountCap != null && Number(coupon.maxDiscountCap) > 0) {
      raw = Math.min(raw, Number(coupon.maxDiscountCap));
    }
  } else {
    raw = Number(coupon.discountValue || 0);
  }

  return roundMoney(Math.min(cleanSub, Math.max(0, raw)));
}

/**
 * Computes product subtotal from authoritative DB Product documents.
 */
async function computeCartSubtotalFromItems(items = [], deps = {}) {
  if (typeof deps.subtotal === 'number') {
    return { subtotal: roundMoney(deps.subtotal), productMap: deps.productMap || new Map() };
  }
  const ProductModel = deps.Product || Product;
  const cleanItems = Array.isArray(items) ? items : [];
  if (cleanItems.length === 0) {
    throw new ApiError(400, 'Your bag is empty');
  }

  let productMap = deps.productMap;
  if (!productMap) {
    const productIds = cleanItems.map((i) => i.productId || i.product).filter(Boolean);
    const products = await ProductModel.find({ _id: { $in: productIds } }).lean();
    productMap = new Map(products.map((p) => [String(p._id), p]));
  }

  let subtotal = 0;
  for (const ci of cleanItems) {
    const prod = productMap.get(String(ci.productId || ci.product));
    if (!prod || prod.status !== 'active') {
      throw new ApiError(400, 'One or more items in your bag are no longer available');
    }
    if (!prod.inStock || Number(prod.price) <= 0) {
      throw new ApiError(400, `"${prod.name}" is currently unavailable for purchase`);
    }
    const qty = Math.min(20, Math.max(1, Number(ci.qty || 1)));
    subtotal = roundMoney(subtotal + Number(prod.price) * qty);
  }

  return { subtotal, productMap };
}

/**
 * Validates coupon in exact server rule order (Part 5):
 * 1. Signed-in user check
 * 2. Code exists (case-insensitive via uppercase normalized lookup)
 * 3. Active (admin has not switched off / not limit-disabled)
 * 4. Start date reached
 * 5. Not expired
 * 6. Total usage not reached
 * 7. Per-user active usage limit not reached
 * 8. Product subtotal (after product offers) >= minOrderValue
 */
async function validateCouponForCart({ code, userId, items = [] }, deps = {}) {
  const CouponModel = deps.Coupon || Coupon;
  const CouponUsageModel = deps.CouponUsage || CouponUsage;
  const now = deps.now || new Date();

  // 1. User signed in
  if (!userId) {
    throw new ApiError(401, 'Please sign in to use a coupon');
  }

  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode || !CODE_REGEX.test(normalizedCode)) {
    throw new ApiError(400, 'Invalid coupon code');
  }

  const { subtotal } = await computeCartSubtotalFromItems(items, deps);

  // 2. Code exists (case-insensitive -> stored normalized uppercase)
  const coupon = await CouponModel.findOne({ code: normalizedCode });
  if (!coupon) {
    throw new ApiError(400, 'Invalid coupon code');
  }

  // If limit already reached (even when auto-deactivated), give the exact limit-reached message
  if (
    coupon.maxTotalUsage != null &&
    Number(coupon.usedCount || 0) >= Number(coupon.maxTotalUsage)
  ) {
    throw new ApiError(400, 'This coupon is no longer available');
  }

  // 3. Admin has not switched it off
  if (!coupon.isActive) {
    throw new ApiError(400, 'This coupon is not available');
  }

  // 4. Start date arrived
  if (coupon.startDate && new Date(coupon.startDate) > now) {
    throw new ApiError(400, 'This coupon is not active yet');
  }

  // 5. Not expired
  if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
    throw new ApiError(400, 'This coupon has expired');
  }

  // 6. Total usage check
  if (
    coupon.maxTotalUsage != null &&
    Number(coupon.usedCount || 0) >= Number(coupon.maxTotalUsage)
  ) {
    throw new ApiError(400, 'This coupon is no longer available');
  }

  // 7. Per-user active usage limit check
  if (coupon.perUserLimit != null) {
    const userUsedCount = await CouponUsageModel.countDocuments({
      coupon: coupon._id,
      user: userId,
      status: 'used',
    });
    const limitNum = Number(coupon.perUserLimit);
    if (userUsedCount >= limitNum) {
      throw new ApiError(
        400,
        limitNum === 1
          ? 'You have already used this coupon'
          : `You can use this coupon only ${limitNum} times`
      );
    }
  }

  // 8. Minimum order value check (after product offers, before shipping)
  if (coupon.minOrderValue != null && subtotal < Number(coupon.minOrderValue)) {
    const needed = roundMoney(Number(coupon.minOrderValue) - subtotal);
    throw new ApiError(400, `Add ₹${formatInrShort(needed)} more to use this coupon`);
  }

  const discountAmount = calculateCouponDiscount(coupon, subtotal);
  const finalProductTotal = roundMoney(Math.max(0, subtotal - discountAmount));

  return {
    coupon,
    subtotal,
    discountAmount,
    finalProductTotal,
    rules: {
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountCap: coupon.maxDiscountCap,
      minOrderValue: coupon.minOrderValue,
      startDate: coupon.startDate,
      expiryDate: coupon.expiryDate,
    },
  };
}

/**
 * Atomically records coupon usage when an order is paid/placed.
 * Guarantees two concurrent buyers cannot both consume the final use.
 */
async function consumeCouponForOrder(
  { couponCode, userId, orderId, discountAmount },
  deps = {}
) {
  const normalizedCode = normalizeCouponCode(couponCode);
  if (!normalizedCode) return { consumed: false };

  const CouponModel = deps.Coupon || Coupon;
  const CouponUsageModel = deps.CouponUsage || CouponUsage;
  const now = deps.now || new Date();

  const existingUsage = await CouponUsageModel.findOne({
    order: orderId,
    status: 'used',
  });
  if (existingUsage) {
    return { consumed: true, alreadyRecorded: true, usage: existingUsage };
  }

  const coupon = await CouponModel.findOne({ code: normalizedCode });
  if (!coupon) {
    throw new ApiError(400, 'Invalid coupon code');
  }

  if (coupon.perUserLimit != null) {
    const activeUses = await CouponUsageModel.countDocuments({
      coupon: coupon._id,
      user: userId,
      status: 'used',
    });
    const limitNum = Number(coupon.perUserLimit);
    if (activeUses >= limitNum) {
      throw new ApiError(
        400,
        limitNum === 1
          ? 'You have already used this coupon'
          : `You can use this coupon only ${limitNum} times`
      );
    }
  }

  // Atomic conditional increment preventing concurrency oversubscription
  const updatedCoupon = await CouponModel.findOneAndUpdate(
    {
      _id: coupon._id,
      isActive: true,
      $or: [
        { maxTotalUsage: null },
        { maxTotalUsage: { $exists: false } },
        { $expr: { $lt: ['$usedCount', '$maxTotalUsage'] } },
      ],
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );

  if (!updatedCoupon) {
    throw new ApiError(400, 'This coupon is no longer available');
  }

  // Auto-disable coupon once maxTotalUsage is reached
  if (
    updatedCoupon.maxTotalUsage != null &&
    Number(updatedCoupon.usedCount) >= Number(updatedCoupon.maxTotalUsage)
  ) {
    await CouponModel.findByIdAndUpdate(updatedCoupon._id, {
      $set: { isActive: false, disabledByLimit: true },
    });
  }

  const usage = await CouponUsageModel.create({
    coupon: updatedCoupon._id,
    user: userId,
    order: orderId,
    discountAmount: roundMoney(discountAmount || 0),
    status: 'used',
    usedAt: now,
  });

  return { consumed: true, coupon: updatedCoupon, usage };
}

/**
 * Releases an active coupon usage when an order fails payment, is cancelled, expires, or is fully refunded.
 * Idempotent: only releases once per order.
 */
async function releaseCouponUsageForOrder(orderId, deps = {}) {
  if (!orderId) return { released: false };
  const CouponModel = deps.Coupon || Coupon;
  const CouponUsageModel = deps.CouponUsage || CouponUsage;

  const usage = await CouponUsageModel.findOneAndUpdate(
    { order: orderId, status: 'used' },
    { $set: { status: 'released' } },
    { new: true }
  );

  if (!usage) {
    return { released: false };
  }

  const coupon = await CouponModel.findOneAndUpdate(
    { _id: usage.coupon, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
    { new: true }
  );

  if (
    coupon &&
    coupon.disabledByLimit &&
    (coupon.maxTotalUsage == null || Number(coupon.usedCount) < Number(coupon.maxTotalUsage))
  ) {
    await CouponModel.findByIdAndUpdate(coupon._id, {
      $set: { isActive: true, disabledByLimit: false },
    });
  }

  return { released: true, usage, coupon };
}

module.exports = {
  CODE_REGEX,
  normalizeCouponCode,
  computeCouponStatus,
  calculateCouponDiscount,
  validateCouponForCart,
  consumeCouponForOrder,
  releaseCouponUsageForOrder,
};
