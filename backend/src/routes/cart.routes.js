const express = require('express');
const cartController = require('../controllers/cart.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { cartItemSchema } = require('../validators/schemas');

const router = express.Router();

router.post('/validate', cartController.validateGuestCart);

router.use(authenticate);
router.get('/', cartController.getCart);
router.post('/sync', cartController.syncCart);
router.post('/items', validate(cartItemSchema), cartController.addToCart);
router.patch('/items/:productId', cartController.updateCartItem);
router.delete('/items/:productId', cartController.removeCartItem);

module.exports = router;
