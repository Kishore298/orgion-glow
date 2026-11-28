const express = require('express');
const orderController = require('../controllers/order.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { paymentLimiter, reviewLimiter } = require('../middleware/rateLimit.middleware');
const { checkoutSchema, customerReviewSchema } = require('../validators/schemas');

const router = express.Router();

router.use(authenticate);
router.post('/checkout', paymentLimiter, validate(checkoutSchema), orderController.checkout);
router.get('/pending-reviews', orderController.getPendingReviews);
router.get('/reviewable-items', orderController.getReviewableItems);
router.get('/mine', orderController.getMyOrders);
router.get('/:id', orderController.getOrderDetail);
router.get('/:id/status', orderController.getOrderStatus);
router.get('/:id/invoice', orderController.downloadInvoice);
router.post('/:id/retry-payment', paymentLimiter, orderController.retryPayment);
router.post('/:id/review-prompt/dismiss', orderController.dismissReviewPrompt);
router.post(
  '/:orderId/items/:productId/review',
  reviewLimiter,
  validate(customerReviewSchema),
  orderController.submitOrderItemReview
);

module.exports = router;
