const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const CouponUsage = require('../models/CouponUsage');
const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');
const {
  normalizeCouponCode,
  computeCouponStatus,
  validateCouponForCart,
} = require('../services/coupon.service');

const ADMIN_CODE_REGEX = /^[A-Z0-9]{3,20}$/;

function parseDateInput(raw, isEndOfDay = false) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return isEndOfDay
      ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
      : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  }
  const dt = new Date(str);
  if (Number.isNaN(dt.getTime())) {
    throw new ApiError(400, 'Invalid date value provided');
  }
  return dt;
}

function parseOptionalNumber(raw, { min = 0, integer = false, label = 'Value' } = {}) {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < min || (integer && !Number.isInteger(num))) {
    throw new ApiError(400, `${label} must be ${integer ? 'a whole number ' : ''}at least ${min}`);
  }
  return num;
}

function buildValidatedCouponData(body, existingCoupon = null) {
  const code = normalizeCouponCode(body.code ?? existingCoupon?.code);
  if (!code || !ADMIN_CODE_REGEX.test(code)) {
    throw new ApiError(
      400,
      'Coupon code must be 3–20 characters using letters and numbers only, with no spaces'
    );
  }

  if (existingCoupon && existingCoupon.usedCount > 0 && code !== existingCoupon.code) {
    throw new ApiError(400, 'Cannot change the code of a coupon that has already been used');
  }

  const discountType = body.discountType || body.discount_type;
  if (!['percentage', 'flat'].includes(discountType)) {
    throw new ApiError(400, 'Discount type is required (percentage or flat)');
  }

  const discountValue = Number(body.discountValue ?? body.discount_value);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw new ApiError(400, 'Discount value must be greater than 0');
  }
  if (discountType === 'percentage' && discountValue > 100) {
    throw new ApiError(400, 'Percentage discount cannot be above 100%');
  }

  const maxDiscountCap =
    discountType === 'percentage'
      ? parseOptionalNumber(body.maxDiscountCap ?? body.max_discount_cap, {
          min: 1,
          label: 'Max discount cap',
        })
      : null;

  const minOrderValue = parseOptionalNumber(body.minOrderValue ?? body.min_order_value, {
    min: 0,
    label: 'Minimum order value',
  });
  const perUserLimit = parseOptionalNumber(body.perUserLimit ?? body.per_user_limit, {
    min: 1,
    integer: true,
    label: 'Per-user limit',
  });
  const maxTotalUsage = parseOptionalNumber(body.maxTotalUsage ?? body.max_total_usage, {
    min: 1,
    integer: true,
    label: 'Max total usage',
  });

  const startDate = parseDateInput(body.startDate ?? body.start_date, false);
  const expiryDate = parseDateInput(body.expiryDate ?? body.expiry_date, true);
  if (startDate && expiryDate && expiryDate <= startDate) {
    throw new ApiError(400, 'Expiry date must be after the start date');
  }

  const description = String(body.description || '').trim().slice(0, 240);
  let isActive =
    body.isActive !== undefined
      ? Boolean(body.isActive)
      : body.is_active !== undefined
      ? Boolean(body.is_active)
      : existingCoupon
      ? existingCoupon.isActive
      : true;

  let disabledByLimit = existingCoupon ? Boolean(existingCoupon.disabledByLimit) : false;
  let warning = '';

  if (existingCoupon && maxTotalUsage != null && existingCoupon.usedCount >= maxTotalUsage) {
    isActive = false;
    disabledByLimit = true;
    warning = `Max total usage (${maxTotalUsage}) is at or below current used count (${existingCoupon.usedCount}). Coupon marked as Limit reached.`;
  } else if (
    existingCoupon &&
    disabledByLimit &&
    (maxTotalUsage == null || existingCoupon.usedCount < maxTotalUsage)
  ) {
    isActive = true;
    disabledByLimit = false;
  }

  return {
    data: {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountCap,
      minOrderValue,
      perUserLimit,
      maxTotalUsage,
      startDate,
      expiryDate,
      isActive,
      disabledByLimit,
    },
    warning,
  };
}

function serializeAdminCoupon(coupon, usageAgg = null) {
  const obj = coupon.toObject ? coupon.toObject() : { ...coupon };
  return {
    ...obj,
    computedStatus: computeCouponStatus(obj),
    totalDiscountGiven: Number(usageAgg?.totalDiscountGiven || 0),
  };
}

// --- ADMIN ENDPOINTS ---
const createAdminCoupon = asyncHandler(async (req, res) => {
  const { data } = buildValidatedCouponData(req.body);
  const dup = await Coupon.findOne({ code: data.code }).lean();
  if (dup) {
    throw new ApiError(409, `Coupon code "${data.code}" already exists`);
  }

  const created = await Coupon.create(data);
  return sendSuccess(res, serializeAdminCoupon(created), 'Coupon created', 201);
});

const listAdminCoupons = asyncHandler(async (req, res) => {
  const { search = '', status = '' } = req.query;
  const filter = {};
  if (search && search.trim()) {
    filter.code = { $regex: normalizeCouponCode(search), $options: 'i' };
  }

  const [coupons, usageAggs] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).lean(),
    CouponUsage.aggregate([
      { $match: { status: 'used' } },
      {
        $group: {
          _id: '$coupon',
          totalDiscountGiven: { $sum: '$discountAmount' },
        },
      },
    ]),
  ]);

  const aggMap = new Map(usageAggs.map((a) => [String(a._id), a]));
  let serialized = coupons.map((c) => serializeAdminCoupon(c, aggMap.get(String(c._id))));

  if (status && status !== 'all') {
    serialized = serialized.filter((c) => c.computedStatus === status);
  }

  return sendSuccess(res, serialized);
});

const updateAdminCoupon = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid coupon ID');
  }
  const existing = await Coupon.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Coupon not found');

  const { data, warning } = buildValidatedCouponData(req.body, existing);
  if (data.code !== existing.code) {
    const dup = await Coupon.findOne({ code: data.code, _id: { $ne: existing._id } }).lean();
    if (dup) throw new ApiError(409, `Coupon code "${data.code}" already exists`);
  }

  Object.assign(existing, data);
  await existing.save();

  const agg = await CouponUsage.aggregate([
    { $match: { coupon: existing._id, status: 'used' } },
    { $group: { _id: '$coupon', totalDiscountGiven: { $sum: '$discountAmount' } } },
  ]);

  return sendSuccess(
    res,
    { coupon: serializeAdminCoupon(existing, agg[0]), warning },
    warning || 'Coupon updated'
  );
});

const toggleAdminCouponStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid coupon ID');
  }
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');

  const nextState =
    req.body.isActive !== undefined ? Boolean(req.body.isActive) : !coupon.isActive;

  if (
    nextState &&
    coupon.maxTotalUsage != null &&
    Number(coupon.usedCount || 0) >= Number(coupon.maxTotalUsage)
  ) {
    throw new ApiError(
      400,
      'Cannot activate coupon because max total usage has been reached. Increase max total usage first.'
    );
  }

  coupon.isActive = nextState;
  coupon.disabledByLimit = false;
  await coupon.save();

  return sendSuccess(
    res,
    serializeAdminCoupon(coupon),
    coupon.isActive ? 'Coupon enabled' : 'Coupon disabled'
  );
});

const deleteAdminCoupon = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid coupon ID');
  }
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');

  const hasUsages =
    Number(coupon.usedCount || 0) > 0 || Boolean(await CouponUsage.exists({ coupon: coupon._id }));

  if (hasUsages) {
    coupon.isActive = false;
    await coupon.save();
    return sendSuccess(
      res,
      { disabledInstead: true, coupon: serializeAdminCoupon(coupon) },
      'Coupon has already been used and cannot be deleted — it has been disabled instead.'
    );
  }

  await Coupon.deleteOne({ _id: coupon._id });
  return sendSuccess(res, { deleted: true }, 'Coupon deleted');
});

const getAdminCouponUsages = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid coupon ID');
  }
  const coupon = await Coupon.findById(req.params.id).lean();
  if (!coupon) throw new ApiError(404, 'Coupon not found');

  const usages = await CouponUsage.find({ coupon: coupon._id })
    .populate('user', 'name mobile email')
    .populate('order', 'orderNumber total status paymentStatus createdAt')
    .sort({ usedAt: -1, createdAt: -1 })
    .lean();

  const activeUsages = usages.filter((u) => u.status === 'used');
  const totalDiscountGiven = activeUsages.reduce(
    (sum, u) => sum + Number(u.discountAmount || 0),
    0
  );

  return sendSuccess(res, {
    coupon: serializeAdminCoupon(coupon, { totalDiscountGiven }),
    summary: {
      totalUsedCount: activeUsages.length,
      totalReleasedCount: usages.length - activeUsages.length,
      totalDiscountGiven,
    },
    usages,
  });
});

// --- CUSTOMER VALIDATE ENDPOINT ---
const validateCustomerCoupon = asyncHandler(async (req, res) => {
  const { code, cart } = req.body;
  const result = await validateCouponForCart({
    code,
    userId: req.user._id,
    items: cart,
  });

  return sendSuccess(
    res,
    {
      valid: true,
      coupon: result.rules,
      subtotal: result.subtotal,
      discountAmount: result.discountAmount,
      finalProductTotal: result.finalProductTotal,
    },
    `Coupon ${result.rules.code} applied`
  );
});

module.exports = {
  createAdminCoupon,
  listAdminCoupons,
  updateAdminCoupon,
  toggleAdminCouponStatus,
  deleteAdminCoupon,
  getAdminCouponUsages,
  validateCustomerCoupon,
};
