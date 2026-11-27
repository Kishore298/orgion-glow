const express = require('express');
const couponController = require('../controllers/coupon.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { couponValidateSchema } = require('../validators/schemas');
const { ApiError } = require('../utils/apiResponse');

const router = express.Router();

function authenticateForCoupon(req, res, next) {
  authenticate(req, res, (err) => {
    if (err && err.statusCode === 401) {
      return next(new ApiError(401, 'Please sign in to use a coupon'));
    }
    return next(err);
  });
}

router.post(
  '/validate',
  authenticateForCoupon,
  validate(couponValidateSchema),
  couponController.validateCustomerCoupon
);

module.exports = router;
