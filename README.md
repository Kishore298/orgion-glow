# ORGION — Herbal Lip Care & Skin Care E-Commerce + Admin Console

Production-ready MERN e-commerce platform for **ORGION**, an artisanal Indian herbal lip care and skin care brand with small-batch manufacturing. Designed with a **"Quiet luxury meets nature"** aesthetic (`#FAF8F5` warm off-white, `#3D6B40` botanical leaf green, `Playfair Display` headings, and `Inter` UI typography).

---

## Project Structure

```
orgion/
├── backend/              # Node.js + Express + MongoDB + Mongoose REST API (/api/v1)
│   ├── server.js         # Entry point, DB connection, cron jobs
│   ├── src/
│   │   ├── config/       # env, db, static site.config.js, cloudinary, firebase, razorpay
│   │   ├── controllers/  # Auth, addresses, catalog, cart, orders, payments, admin ops
│   │   ├── jobs/         # node-cron: order expiry, Razorpay reconciliation, notification retry
│   │   ├── middleware/   # JWT cookie/bearer auth, role guards, Zod validation, rate limits, multer
│   │   ├── models/       # User, Category, Product, Cart, Order, Review, NotificationLog, WebhookEvent
│   │   ├── routes/       # Express routers under /api/v1
│   │   ├── scripts/      # email:preview renderer
│   │   ├── seed/         # Demo admin, staff, customer, 2 categories, 10 products, 9 WhatsApp reviews
│   │   ├── services/     # payment, shipping stub, notification (SMTP+FCM), invoice PDF, rating, OTP
│   │   ├── templates/    # Responsive branded HTML + plain-text email templates
│   │   ├── utils/        # INR currency helpers, transitions, slug/tracking validators
│   │   └── validators/   # Zod request schemas
│   └── test/             # Node native test suite (`npm test`)
├── customer-frontend/    # React 18 + Vite + Tailwind + TanStack Query + Zustand + Firebase Web SDK
└── admin-frontend/       # React 18 + Vite + Tailwind + TanStack Query + Recharts
```

---

## Quick Start

### Prerequisites
- Node.js `v18+` (tested on `v24`)
- MongoDB Atlas or local MongoDB URI configured in `backend/.env`

### 1. Backend Setup (`http://localhost:5000`)
```bash
cd backend
cp .env.example .env   # Update MONGODB_URI, JWT secrets, Razorpay keys, SMTP/Firebase if ready
npm install
npm run seed           # Seeds admin, staff, sample customer, categories, 10 products, 9 WhatsApp reviews
npm test               # Runs automated unit & business-rule tests
npm run email:preview  # Renders all email templates to backend/tmp/email-previews/
npm run dev            # Starts API with file watching
```

### 2. Customer Storefront (`http://localhost:5173`)
```bash
cd customer-frontend
cp .env.example .env
npm install
npm run dev
```

### 3. Admin Operations Console (`http://localhost:5174`)
```bash
cd admin-frontend
cp .env.example .env
npm install
npm run dev
```

---

## Seeded Demo Credentials

| Role | Mobile | Password | App |
|---|---|---|---|
| **Admin** | `9360910640` | `Admin@12345` | Admin Console (`http://localhost:5174`) |
| **Staff** | `9876500002` | `Staff@12345` | Admin Console (`http://localhost:5174`) |

---

## Key Features Implemented

- **Authentication & Security**: Access token in `httpOnly` cookie + refresh token rotation, `helmet`, `cors` allow-list, `express-mongo-sanitize`, dedicated rate limiters on auth/payment/reviews/contact, Zod input validation on every endpoint, OTP-ready forgot-password abstraction.
- **Razorpay (INR) Production Flow**: Server-side price & shipping computation, HMAC-SHA256 verification + Razorpay payment fetch, raw-body webhook handler (`/api/v1/payments/webhook`), atomic `findOneAndUpdate` idempotency, retry flow, abandoned order expiry cron (15m), nightly Razorpay reconciliation cron, and full/partial admin refunds.
- **Pluggable Shipping Stub**: Isolated in `backend/src/services/shipping.service.js` (`calculateShipping`), wired into `POST /api/v1/shipping/calculate` and server checkout without hardcoded rate tables or admin shipping UI.
- **Static Site Config**: Managed in `backend/src/config/site.config.js` (`storeName`, WhatsApp number, support details, GSTIN, business address, `SHIPPING_STUB_CHARGE`, `stCourierTrackingUrl`), with public subset exposed at `GET /api/v1/site-config`.
- **ST Courier Tracking & Notifications**: Admin tracking ID update (normalized uppercase 6–30 chars) with optional one-click `"Also mark as Shipped"` sends a single combined `TRACKING_UPDATED` notification (Email + Firebase Push), logged in `NotificationLog` with unique `dedupeKey`, 3-attempt backoff, hourly retry cron, and manual resend.
- **Reviews & Ratings**: Unified `Review` model for admin-curated WhatsApp reviews (`source: "whatsapp"`) and post-delivery customer ratings (`source: "customer"`), enforced once per `(order, product)` via partial unique index, live immediately without approval queues, with `recalcProductRating()` updating denormalized product averages and breakdowns, plus global delivered-order rating modal with 24h snooze & max 3 dismissals.
- **PDF Invoices**: Generated server-side with `pdfkit` at `/api/v1/orders/:id/invoice` and `/api/v1/admin/orders/:id/invoice`.
