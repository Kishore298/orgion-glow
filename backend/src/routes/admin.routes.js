const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');
const dashboardCtrl = require('../controllers/adminDashboard.controller');
const catalogCtrl = require('../controllers/adminCatalog.controller');
const ordersCtrl = require('../controllers/adminOrders.controller');
const crCtrl = require('../controllers/adminCustomersReviews.controller');

const router = express.Router();

router.use(authenticate, requireRole('admin', 'staff'));

// Dashboard & Media
router.get('/dashboard', dashboardCtrl.getDashboardStats);
router.post('/upload', upload.single('image'), dashboardCtrl.uploadAdminImage);

// Categories
router.get('/categories', catalogCtrl.listAdminCategories);
router.post('/categories', catalogCtrl.createCategory);
router.patch('/categories/reorder', catalogCtrl.reorderCategories);
router.patch('/categories/:id', catalogCtrl.updateCategory);
router.delete('/categories/:id', requireRole('admin'), catalogCtrl.deleteCategory);

// Products
router.get('/products', catalogCtrl.listAdminProducts);
router.get('/products/:id', catalogCtrl.getAdminProduct);
router.post('/products', catalogCtrl.createProduct);
router.patch('/products/:id', catalogCtrl.updateProduct);
router.patch('/products/:id/stock', catalogCtrl.toggleProductStock);
router.delete('/products/:id', requireRole('admin'), catalogCtrl.deleteProduct);

// Orders
router.get('/orders', ordersCtrl.listAdminOrders);
router.get('/orders/:id', ordersCtrl.getAdminOrderDetail);
router.get('/orders/:id/invoice', ordersCtrl.downloadAdminInvoice);
router.patch('/orders/:id/status', ordersCtrl.updateAdminOrderStatus);
router.patch('/orders/:id/tracking', ordersCtrl.updateAdminOrderTracking);
router.patch('/orders/:id/notes', ordersCtrl.updateAdminOrderNotes);
router.post('/orders/:id/refund', requireRole('admin'), ordersCtrl.refundAdminOrder);
router.post('/orders/:id/resend-confirmation', ordersCtrl.resendOrderConfirmation);
router.post('/orders/:id/notifications/:logId/resend', ordersCtrl.resendOrderNotification);

// Customers
router.get('/customers', crCtrl.listAdminCustomers);
router.get('/customers/:id', crCtrl.getAdminCustomerDetail);
router.patch('/customers/:id/block', requireRole('admin'), crCtrl.toggleCustomerBlock);

// Reviews
router.get('/reviews', crCtrl.listAdminReviews);
router.post('/reviews', crCtrl.createWhatsappReview);
router.post('/reviews/bulk', crCtrl.bulkReviewAction);
router.patch('/reviews/:id', crCtrl.updateAdminReview);
router.delete('/reviews/:id', crCtrl.deleteAdminReview);

module.exports = router;
