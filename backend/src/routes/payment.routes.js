const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { paymentLimiter } = require('../middleware/rateLimit.middleware');
const { verifyPaymentSchema } = require('../validators/schemas');

const router = express.Router();

router.post(
  '/verify',
  authenticate,
  paymentLimiter,
  validate(verifyPaymentSchema),
  paymentController.verifyPayment
);
router.post('/webhook', paymentLimiter, paymentController.handleWebhook);

module.exports = router;
