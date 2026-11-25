const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');
const {
  verifyClientPayment,
  verifyWebhookSignature,
  processWebhookEvent,
} = require('../services/payment.service');

const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const result = await verifyClientPayment({
    userId: req.user._id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  return sendSuccess(
    res,
    {
      order: result.order,
      alreadyConfirmed: result.alreadyConfirmed,
    },
    'Payment verified and order confirmed'
  );
});

const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody;

  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new ApiError(400, 'Invalid webhook signature');
  }

  const eventType = req.body?.event;
  const eventId =
    req.headers['x-razorpay-event-id'] ||
    `${eventType}:${req.body?.payload?.payment?.entity?.id || req.body?.payload?.refund?.entity?.id || req.body?.created_at}`;

  const result = await processWebhookEvent({
    eventId,
    eventType,
    payload: req.body?.payload || {},
  });

  return res.status(200).json({ success: true, ...result });
});

module.exports = {
  verifyPayment,
  handleWebhook,
};
