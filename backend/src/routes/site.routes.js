const express = require('express');
const notificationController = require('../controllers/notification.controller');
const siteController = require('../controllers/site.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { contactLimiter } = require('../middleware/rateLimit.middleware');
const { contactSchema } = require('../validators/schemas');

const router = express.Router();

router.get('/site-config', siteController.getSiteConfig);
router.post('/shipping/calculate', siteController.calculateShippingQuote);
router.post('/contact', contactLimiter, validate(contactSchema), siteController.submitContact);

router.post('/notifications/push-token', authenticate, notificationController.registerPushToken);
router.delete('/notifications/push-token', authenticate, notificationController.removePushToken);

module.exports = router;
