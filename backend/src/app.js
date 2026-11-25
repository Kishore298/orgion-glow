const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const morgan = require('morgan');

const env = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimit.middleware');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');
const Product = require('./models/Product');
const Category = require('./models/Category');
const { siteConfig } = require('./config/site.config');

const authRoutes = require('./routes/auth.routes');
const addressRoutes = require('./routes/address.routes');
const catalogRoutes = require('./routes/catalog.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRoutes = require('./routes/order.routes');
const paymentRoutes = require('./routes/payment.routes');
const siteRoutes = require('./routes/site.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const allowedOrigins = [env.CLIENT_CUSTOMER_URL, env.CLIENT_ADMIN_URL].filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// Capture raw body for Razorpay webhook HMAC verification
app.use(
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      if (req.originalUrl && req.originalUrl.includes('/payments/webhook')) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(compression());

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Serve local uploaded images when UPLOAD_STORAGE=local
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', service: 'orgion-api' });
});
app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, status: 'ok', service: 'orgion-api' });
});

// Dynamic XML sitemap for SEO
app.get('/sitemap.xml', async (req, res) => {
  try {
    const base = siteConfig.clientCustomerUrl.replace(/\/$/, '');
    const [products, categories] = await Promise.all([
      Product.find({ status: 'active' }).select('slug updatedAt').lean(),
      Category.find({ isActive: true }).select('slug updatedAt').lean(),
    ]);

    const staticPaths = [
      '/',
      '/shop',
      '/reviews',
      '/our-story',
      '/terms-and-conditions',
      '/privacy-policy',
      '/shipping-returns',
      '/contact',
    ];

    const urls = [
      ...staticPaths.map((p) => `<url><loc>${base}${p}</loc></url>`),
      ...categories.map((c) => `<url><loc>${base}/category/${c.slug}</loc></url>`),
      ...products.map((p) => `<url><loc>${base}/product/${p.slug}</loc></url>`),
    ].join('');

    res.setHeader('Content-Type', 'application/xml');
    return res.send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
    );
  } catch (err) {
    return res.status(500).send('');
  }
});

app.use('/api/v1', apiLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1', catalogRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1', siteRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
