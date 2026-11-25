const express = require('express');
const catalogController = require('../controllers/catalog.controller');

const router = express.Router();

router.get('/categories', catalogController.listCategories);
router.get('/categories/:slug', catalogController.getCategoryBySlug);
router.get('/products', catalogController.listProducts);
router.get('/products/:slug', catalogController.getProductBySlug);
router.get('/products/:slug/reviews', catalogController.getProductReviews);
router.get('/reviews', catalogController.listPublicReviews);

module.exports = router;
