const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  verifyCheckoutSignature,
  verifyWebhookSignature,
  confirmOrderPaidAtomically,
  verifyClientPayment,
} = require('../src/services/payment.service');
const { canTransitionOrderStatus } = require('../src/utils/orderTransitions');
const { calculateShipping } = require('../src/services/shipping.service');
const { updateOrderTrackingCore } = require('../src/controllers/adminOrders.controller');
const { submitOrderItemReviewCore } = require('../src/controllers/order.controller');
const { recalcProductRating } = require('../src/services/rating.service');
const NotificationLog = require('../src/models/NotificationLog');
const { notifyNow } = require('../src/services/notification.service');

describe('ORGION Core Business Rules & Integrations', () => {
  describe('1. Razorpay Signature & Payment Verification', () => {
    it('verifies valid HMAC-SHA256 checkout and webhook signatures', () => {
      const secret = 'rzp_test_secret_123';
      const orderId = 'order_abc123';
      const paymentId = 'pay_xyz789';
      const sig = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      assert.equal(
        verifyCheckoutSignature(
          { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig },
          secret
        ),
        true
      );
      assert.equal(
        verifyCheckoutSignature(
          { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: 'tampered' },
          secret
        ),
        false
      );

      const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
      const whSecret = 'wh_secret_999';
      const whSig = crypto.createHmac('sha256', whSecret).update(rawBody).digest('hex');
      assert.equal(verifyWebhookSignature(rawBody, whSig, whSecret), true);
      assert.equal(verifyWebhookSignature(rawBody, 'bad_sig', whSecret), false);
    });

    it('rejects invalid signature in verifyClientPayment', async () => {
      await assert.rejects(
        () =>
          verifyClientPayment({
            userId: 'u1',
            razorpay_order_id: 'order_1',
            razorpay_payment_id: 'pay_1',
            razorpay_signature: 'invalid_sig',
          }),
        (err) => err.statusCode === 400
      );
    });

    it('rejects amount mismatch and flags order needsReview', async () => {
      let flaggedUpdate = null;
      const FakeOrder = {
        findById: async () => ({
          _id: 'o1',
          user: 'u1',
          total: 500,
          paymentStatus: 'pending',
          items: [],
        }),
        findByIdAndUpdate: async (id, update) => {
          flaggedUpdate = update;
        },
      };

      await assert.rejects(
        () =>
          confirmOrderPaidAtomically(
            'o1',
            { razorpayOrderId: 'rzp_o1', razorpayPaymentId: 'rzp_p1', amountPaise: 100 },
            { Order: FakeOrder }
          ),
        (err) => err.statusCode === 400
      );
      assert.equal(flaggedUpdate.needsReview, true);
    });

    it('confirms order atomically once even when verify & webhook race', async () => {
      let currentPaymentStatus = 'pending';
      let cartClearedCount = 0;
      const notifiedEvents = [];

      const FakeOrder = {
        findById: async () => ({
          _id: 'o1',
          orderNumber: 'ORG-10001',
          user: 'u1',
          total: 349,
          paymentStatus: currentPaymentStatus,
          items: [{ product: 'p1', name: 'Lip Butter', qty: 1 }],
          statusHistory: [{ _id: 'sh1', status: 'confirmed' }],
        }),
        findOneAndUpdate: async (query) => {
          if (!query.paymentStatus.$in.includes(currentPaymentStatus)) {
            return null; // lost race
          }
          currentPaymentStatus = 'paid';
          return {
            _id: 'o1',
            orderNumber: 'ORG-10001',
            user: 'u1',
            total: 349,
            paymentStatus: 'paid',
            status: 'confirmed',
            statusHistory: [{ _id: 'sh1', status: 'confirmed' }],
          };
        },
      };
      const FakeProduct = {
        find: async () => [{ _id: 'p1', status: 'active', inStock: true }],
      };
      const FakeCart = {
        findOneAndUpdate: async () => {
          cartClearedCount += 1;
        },
      };
      const fakeNotify = (event) => {
        notifiedEvents.push(event);
      };

      const [r1, r2] = await Promise.all([
        confirmOrderPaidAtomically(
          'o1',
          { razorpayOrderId: 'rzp_o1', razorpayPaymentId: 'rzp_p1', amountPaise: 34900 },
          { Order: FakeOrder, Product: FakeProduct, Cart: FakeCart, notify: fakeNotify }
        ),
        confirmOrderPaidAtomically(
          'o1',
          { razorpayOrderId: 'rzp_o1', razorpayPaymentId: 'rzp_p1', amountPaise: 34900 },
          { Order: FakeOrder, Product: FakeProduct, Cart: FakeCart, notify: fakeNotify }
        ),
      ]);

      assert.equal(cartClearedCount, 1);
      assert.deepEqual(notifiedEvents, ['ORDER_CONFIRMED', 'ADMIN_NEW_ORDER']);
      assert.equal([r1.alreadyConfirmed, r2.alreadyConfirmed].filter((x) => !x).length, 1);
    });
  });

  describe('2. Order State Transitions', () => {
    it('allows valid transitions and rejects invalid transitions', () => {
      assert.equal(canTransitionOrderStatus('confirmed', 'processing'), true);
      assert.equal(canTransitionOrderStatus('confirmed', 'shipped'), true);
      assert.equal(canTransitionOrderStatus('shipped', 'delivered'), true);
      assert.equal(canTransitionOrderStatus('delivered', 'shipped'), false);
      assert.equal(canTransitionOrderStatus('cancelled', 'confirmed'), false);
      assert.equal(canTransitionOrderStatus('confirmed', 'confirmed'), false);
    });
  });

  describe('3. Weight & Zone Shipping Calculation Rules', () => {
    it('returns the exact contract shape and calculates packed weight slabs & zones accurately', async () => {
      const noNetworkFetch = async () => ({ ok: false });

      // 3 soaps (375g) + 2 creams (80g) + 1 lip balm (40g) + 200g outer packaging = 695g (1 slab)
      const items = [
        { name: 'GlowX Soap', qty: 3 },
        { name: 'Avoglow Night Cream', qty: 2 },
        { name: 'Pigment Free Lip Balm', qty: 1 },
      ];

      const tnQuote = await calculateShipping(
        { pincode: '629001', state: 'Tamil Nadu', items },
        { fetch: noNetworkFetch, skipCache: true }
      );
      assert.equal(tnQuote.serviceable, true);
      assert.equal(tnQuote.weightG, 695);
      assert.equal(tnQuote.slabs, 1);
      assert.equal(tnQuote.zone, 1);
      assert.equal(tnQuote.charge, 50);
      assert.equal(tnQuote.freeShippingApplied, false);
      assert.equal(tnQuote.etaDays, null);

      const telangana695 = await calculateShipping(
        { pincode: '500001', state: 'Telangana', items },
        { fetch: noNetworkFetch, skipCache: true }
      );
      assert.equal(telangana695.zone, 2);
      assert.equal(telangana695.charge, 90);

      const exact1Kg = await calculateShipping(
        { pincode: '600001', state: 'Tamil Nadu', weight: 1000, items: [] },
        { fetch: noNetworkFetch, skipCache: true }
      );
      assert.equal(exact1Kg.slabs, 1);
      assert.equal(exact1Kg.charge, 50);

      const kar1400 = await calculateShipping(
        { pincode: '560038', state: 'Karnataka', weight: 1400, items: [] },
        { fetch: noNetworkFetch, skipCache: true }
      );
      assert.equal(kar1400.slabs, 2);
      assert.equal(kar1400.zone, 2);
      assert.equal(kar1400.charge, 180);

      const pudu2500 = await calculateShipping(
        { pincode: '605001', state: 'Puducherry', weight: 2500, items: [] },
        { fetch: noNetworkFetch, skipCache: true }
      );
      assert.equal(pudu2500.slabs, 3);
      assert.equal(pudu2500.zone, 2);
      assert.equal(pudu2500.charge, 270);

      const mh2500 = await calculateShipping(
        { pincode: '400001', state: 'Maharashtra', weight: 2500, items: [] },
        { fetch: noNetworkFetch, skipCache: true }
      );
      assert.equal(mh2500.slabs, 3);
      assert.equal(mh2500.zone, 3);
      assert.equal(mh2500.charge, 360);
    });
  });

  describe('4. ST Courier Tracking Update Notification Rules', () => {
    function makeOrderDoc(initialTrackingId = '', initialStatus = 'confirmed') {
      return {
        _id: 'ord_1',
        status: initialStatus,
        tracking: { courier: 'ST Courier', trackingId: initialTrackingId },
        trackingHistory: [],
        statusHistory: [],
        save: async function save() {
          return this;
        },
      };
    }

    it('sends exactly one notification on new tracking ID, none when unchanged, none when cleared', async () => {
      let notifications = [];
      const orderDoc = makeOrderDoc('', 'confirmed');
      const FakeOrder = { findById: async () => orderDoc };
      const fakeNotify = (event, payload) => notifications.push({ event, payload });

      // 1. New tracking ID (lowercase trimmed -> normalized)
      const res1 = await updateOrderTrackingCore(
        { orderId: 'ord_1', rawTrackingId: ' stc123456 ', alsoMarkShipped: false, adminUserId: 'a1' },
        { Order: FakeOrder, notify: fakeNotify }
      );
      assert.equal(res1.changed, true);
      assert.equal(res1.notified, true);
      assert.equal(orderDoc.tracking.trackingId, 'STC123456');
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0].event, 'TRACKING_UPDATED');

      // 2. Unchanged tracking ID -> no-op, no notification
      const res2 = await updateOrderTrackingCore(
        { orderId: 'ord_1', rawTrackingId: 'STC123456', alsoMarkShipped: false, adminUserId: 'a1' },
        { Order: FakeOrder, notify: fakeNotify }
      );
      assert.equal(res2.changed, false);
      assert.equal(res2.notified, false);
      assert.equal(notifications.length, 1);

      // 3. Clearing tracking ID -> allowed, no notification
      const res3 = await updateOrderTrackingCore(
        { orderId: 'ord_1', rawTrackingId: '', alsoMarkShipped: false, adminUserId: 'a1' },
        { Order: FakeOrder, notify: fakeNotify }
      );
      assert.equal(res3.changed, true);
      assert.equal(res3.notified, false);
      assert.equal(notifications.length, 1);
    });

    it('sends ONE combined notification when alsoMarkShipped is checked', async () => {
      let notifications = [];
      const orderDoc = makeOrderDoc('', 'processing');
      const FakeOrder = { findById: async () => orderDoc };
      const fakeNotify = (event, payload) => notifications.push({ event, payload });

      const res = await updateOrderTrackingCore(
        { orderId: 'ord_1', rawTrackingId: 'STC998877', alsoMarkShipped: true, adminUserId: 'a1' },
        { Order: FakeOrder, notify: fakeNotify }
      );
      assert.equal(res.markedShipped, true);
      assert.equal(orderDoc.status, 'shipped');
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0].event, 'TRACKING_UPDATED');
      assert.equal(notifications[0].payload.alsoShipped, true);
    });
  });

  describe('5. Notification Dedupe', () => {
    it('prevents duplicate sends for the same dedupeKey', async () => {
      const seenKeys = new Set();
      let mailSentCount = 0;

      const origCreate = NotificationLog.create;
      const origUpdate = NotificationLog.findByIdAndUpdate;

      NotificationLog.create = async (doc) => {
        if (seenKeys.has(doc.dedupeKey)) {
          const dupErr = new Error('Duplicate');
          dupErr.code = 11000;
          throw dupErr;
        }
        seenKeys.add(doc.dedupeKey);
        return { _id: 'log_1', ...doc };
      };
      NotificationLog.findByIdAndUpdate = async () => ({});

      const fakeMailer = {
        sendMail: async () => {
          mailSentCount += 1;
          return { messageId: 'msg_1' };
        },
      };

      const payload = {
        order: {
          _id: 'o1',
          orderNumber: 'ORG-11111',
          total: 500,
          shippingCharge: 0,
          items: [{ name: 'Lip Balm', price: 500, qty: 1 }],
          addressSnapshot: { fullName: 'Test', mobile: '9999999999', line1: 'A', city: 'B', state: 'C', pincode: '560001' },
        },
        user: { _id: 'u1', name: 'Ananya', email: 'ananya@example.com' },
        emailDedupeKey: 'o1:confirmed:email',
      };

      try {
        const first = await notifyNow('ORDER_CONFIRMED', payload, {
          mailer: fakeMailer,
          skipBackoff: true,
        });
        const second = await notifyNow('ORDER_CONFIRMED', payload, {
          mailer: fakeMailer,
          skipBackoff: true,
        });
        assert.equal(first.email.ok, true);
        assert.equal(second.email.deduped, true);
        assert.equal(mailSentCount, 1);
      } finally {
        NotificationLog.create = origCreate;
        NotificationLog.findByIdAndUpdate = origUpdate;
      }
    });

    it('sends ADMIN_NEW_ORDER push notification to active admin/staff tokens once', async () => {
      const seenKeys = new Set();
      const sentMulticasts = [];

      const origCreate = NotificationLog.create;
      const origUpdate = NotificationLog.findByIdAndUpdate;

      NotificationLog.create = async (doc) => {
        if (seenKeys.has(doc.dedupeKey)) {
          const dupErr = new Error('Duplicate');
          dupErr.code = 11000;
          throw dupErr;
        }
        seenKeys.add(doc.dedupeKey);
        return { _id: 'log_admin_1', ...doc };
      };
      NotificationLog.findByIdAndUpdate = async () => ({});

      const FakeUser = {
        find: async () => [
          { _id: 'admin_1', fcmTokens: [{ token: 'token_admin_a' }, { token: 'token_admin_b' }] },
        ],
        updateMany: async () => ({}),
      };

      const fakeMessaging = {
        sendEachForMulticast: async (msg) => {
          sentMulticasts.push(msg);
          return { successCount: msg.tokens.length, responses: msg.tokens.map(() => ({ success: true })) };
        },
      };

      const orderPayload = {
        order: {
          _id: 'ord_99',
          orderNumber: 'ORG-99001',
          total: 278,
          items: [{ name: 'GlowX Soap', qty: 2 }],
          addressSnapshot: { fullName: 'Ananya' },
        },
        dedupeSuffix: 'sh_99',
      };

      try {
        const first = await notifyNow('ADMIN_NEW_ORDER', orderPayload, {
          User: FakeUser,
          messaging: fakeMessaging,
        });
        const second = await notifyNow('ADMIN_NEW_ORDER', orderPayload, {
          User: FakeUser,
          messaging: fakeMessaging,
        });

        assert.equal(first.push.ok, true);
        assert.equal(second.push.deduped, true);
        assert.equal(sentMulticasts.length, 1);
        assert.deepEqual(sentMulticasts[0].tokens, ['token_admin_a', 'token_admin_b']);
        assert.equal(sentMulticasts[0].data.link, '/orders/ORG-99001');
      } finally {
        NotificationLog.create = origCreate;
        NotificationLog.findByIdAndUpdate = origUpdate;
      }
    });
  });

  describe('6. Post-Delivery Customer Rating & Product Rating Recalculation', () => {
    it('enforces delivered-only rule and review-once (409) rule', async () => {
      let existingReview = null;
      let recalcCalledWith = null;

      const FakeOrder = {
        findOne: async (query) => {
          const ref = String(query._id || query.orderNumber || '').toLowerCase();
          if (ref === 'undelivered') {
            return { _id: 'undelivered', user: 'u1', status: 'shipped', items: [{ product: 'p1' }] };
          }
          return {
            _id: 'delivered_1',
            orderNumber: 'ORG-DELIVERED',
            user: 'u1',
            status: 'delivered',
            addressSnapshot: { city: 'Bengaluru' },
            items: [{ product: 'p1' }],
          };
        },
      };

      const FakeReview = {
        findOne: async () => existingReview,
        create: async (doc) => {
          existingReview = { _id: 'rev_1', ...doc };
          return existingReview;
        },
      };

      // Reject undelivered order
      await assert.rejects(
        () =>
          submitOrderItemReviewCore(
            { user: { _id: 'u1', name: 'Ananya Sharma' }, orderId: 'undelivered', productId: 'p1', rating: 5 },
            { Order: FakeOrder, Review: FakeReview, recalcProductRating: async () => {} }
          ),
        (err) => err.statusCode === 400
      );

      // Accept first rating on delivered order
      const created = await submitOrderItemReviewCore(
        { user: { _id: 'u1', name: 'Ananya Sharma' }, orderId: 'delivered_1', productId: 'p1', rating: 5, comment: 'Lovely!' },
        {
          Order: FakeOrder,
          Review: FakeReview,
          recalcProductRating: async (pid) => {
            recalcCalledWith = pid;
          },
        }
      );
      assert.equal(created.reviewerName, 'Ananya S.');
      assert.equal(created.isVerifiedPurchase, true);
      assert.equal(created.status, 'pending');
      assert.equal(recalcCalledWith, 'p1');

      // Reject second rating for same (order, product) with 409
      await assert.rejects(
        () =>
          submitOrderItemReviewCore(
            { user: { _id: 'u1', name: 'Ananya Sharma' }, orderId: 'delivered_1', productId: 'p1', rating: 4 },
            { Order: FakeOrder, Review: FakeReview, recalcProductRating: async () => {} }
          ),
        (err) => err.statusCode === 409
      );
    });

    it('recalculates ratingAvg, ratingCount, and breakdown from visible reviews only', async () => {
      let updatedDoc = null;
      const FakeReview = {
        aggregate: async () => [
          { _id: 5, count: 2 },
          { _id: 4, count: 1 },
        ],
      };
      const FakeProduct = {
        findByIdAndUpdate: async (id, update) => {
          updatedDoc = update;
        },
      };

      const result = await recalcProductRating('507f1f77bcf86cd799439011', {
        Review: FakeReview,
        Product: FakeProduct,
      });

      // (5*2 + 4*1) / 3 = 14 / 3 = 4.666 -> 4.7
      assert.equal(result.ratingAvg, 4.7);
      assert.equal(result.ratingCount, 3);
      assert.deepEqual(result.ratingBreakdown, { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 });
      assert.equal(updatedDoc.ratingAvg, 4.7);
    });
  });

  describe('7. Sequential Order Number Format', () => {
    it('generates sequential ORGION-26-00001, ORGION-26-00002 order numbers', async () => {
      const { generateOrderNumber } = require('../src/controllers/order.controller');
      const seqMap = new Map();
      const FakeCounter = {
        findByIdAndUpdate: async (id, update) => {
          const next = (seqMap.get(id) || 0) + (update?.$inc?.seq || 1);
          seqMap.set(id, next);
          return { _id: id, seq: next };
        },
      };
      const FakeOrder = { exists: async () => false };
      const fixedNow = new Date('2026-11-25T10:00:00Z');

      const first = await generateOrderNumber({ Counter: FakeCounter, Order: FakeOrder, now: fixedNow });
      const second = await generateOrderNumber({ Counter: FakeCounter, Order: FakeOrder, now: fixedNow });

      assert.equal(first, 'ORGION-26-00001');
      assert.equal(second, 'ORGION-26-00002');
    });
  });

  describe('8. Coupon Validation, Discount Calculation, Concurrency & Release', () => {
    const {
      normalizeCouponCode,
      computeCouponStatus,
      calculateCouponDiscount,
      validateCouponForCart,
      consumeCouponForOrder,
      releaseCouponUsageForOrder,
    } = require('../src/services/coupon.service');

    it('normalizes codes cleanly and computes status priority including limit_reached', () => {
      assert.equal(normalizeCouponCode(' glow 10 '), 'GLOW10');
      const now = new Date('2026-11-27T12:00:00Z');
      assert.equal(
        computeCouponStatus({ isActive: true, usedCount: 0, maxTotalUsage: 10 }, now),
        'active'
      );
      assert.equal(
        computeCouponStatus({ isActive: false, usedCount: 0, maxTotalUsage: 10 }, now),
        'inactive'
      );
      assert.equal(
        computeCouponStatus(
          { isActive: false, disabledByLimit: true, usedCount: 5, maxTotalUsage: 5 },
          now
        ),
        'limit_reached'
      );
      assert.equal(
        computeCouponStatus({ isActive: true, startDate: '2026-12-01T00:00:00Z' }, now),
        'scheduled'
      );
      assert.equal(
        computeCouponStatus({ isActive: true, expiryDate: '2026-11-01T00:00:00Z' }, now),
        'expired'
      );
    });

    it('calculates percentage cap, flat cap at subtotal, and rounds to 2 decimals', () => {
      assert.equal(
        calculateCouponDiscount(
          { discountType: 'percentage', discountValue: 10, maxDiscountCap: 150 },
          1000
        ),
        100
      );
      assert.equal(
        calculateCouponDiscount(
          { discountType: 'percentage', discountValue: 20, maxDiscountCap: 150 },
          2000
        ),
        150
      );
      assert.equal(
        calculateCouponDiscount({ discountType: 'flat', discountValue: 200 }, 139),
        139
      );
    });

    it('enforces server validation rules in exact order and friendly shortfall errors', async () => {
      const now = new Date('2026-11-27T12:00:00Z');
      const baseCoupon = {
        _id: 'c1',
        code: 'GLOW10',
        discountType: 'percentage',
        discountValue: 10,
        maxDiscountCap: 150,
        minOrderValue: 500,
        perUserLimit: 1,
        maxTotalUsage: 5,
        usedCount: 1,
        isActive: true,
      };
      const FakeCoupon = { findOne: async ({ code }) => (code === 'GLOW10' ? { ...baseCoupon } : null) };
      const FakeUsage = { countDocuments: async () => 0 };

      // 1. Unauthenticated
      await assert.rejects(
        () => validateCouponForCart({ code: 'GLOW10', userId: null, items: [{ productId: 'p1', qty: 1 }] }, { subtotal: 600, Coupon: FakeCoupon, CouponUsage: FakeUsage, now }),
        (err) => err.statusCode === 401 && err.message === 'Please sign in to use a coupon'
      );

      // 2. Invalid code
      await assert.rejects(
        () => validateCouponForCart({ code: 'NOPE', userId: 'u1', items: [{ productId: 'p1', qty: 1 }] }, { subtotal: 600, Coupon: FakeCoupon, CouponUsage: FakeUsage, now }),
        (err) => err.message === 'Invalid coupon code'
      );

      // 8. Minimum order shortfall
      await assert.rejects(
        () => validateCouponForCart({ code: 'GLOW10', userId: 'u1', items: [{ productId: 'p1', qty: 1 }] }, { subtotal: 350, Coupon: FakeCoupon, CouponUsage: FakeUsage, now }),
        (err) => err.message === 'Add ₹150 more to use this coupon'
      );

      // Valid case
      const ok = await validateCouponForCart(
        { code: ' glow10 ', userId: 'u1', items: [{ productId: 'p1', qty: 1 }] },
        { subtotal: 1000, Coupon: FakeCoupon, CouponUsage: FakeUsage, now }
      );
      assert.equal(ok.discountAmount, 100);
      assert.equal(ok.finalProductTotal, 900);
    });

    it('prevents concurrent over-usage, auto-disables at max limit, and releases on cancel/refund', async () => {
      const couponState = {
        _id: 'c1',
        code: 'LAST1',
        discountType: 'flat',
        discountValue: 50,
        maxTotalUsage: 1,
        perUserLimit: 1,
        usedCount: 0,
        isActive: true,
        disabledByLimit: false,
      };
      const usageRows = [];

      const FakeCoupon = {
        findOne: async ({ code }) => (code === 'LAST1' ? couponState : null),
        findOneAndUpdate: async (query, update) => {
          if (update.$inc?.usedCount === 1) {
            if (!couponState.isActive) return null;
            if (couponState.maxTotalUsage != null && couponState.usedCount >= couponState.maxTotalUsage) {
              return null;
            }
            couponState.usedCount += 1;
            return { ...couponState };
          }
          if (update.$inc?.usedCount === -1) {
            if (couponState.usedCount <= 0) return null;
            couponState.usedCount -= 1;
            return { ...couponState };
          }
          return null;
        },
        findByIdAndUpdate: async (id, update) => {
          Object.assign(couponState, update.$set || {});
          return couponState;
        },
      };

      const FakeUsage = {
        findOne: async ({ order, status }) =>
          usageRows.find((u) => u.order === order && u.status === status) || null,
        countDocuments: async ({ user, status }) =>
          usageRows.filter((u) => u.user === user && u.status === status).length,
        create: async (doc) => {
          const row = { _id: `u_${usageRows.length + 1}`, ...doc };
          usageRows.push(row);
          return row;
        },
        findOneAndUpdate: async ({ order, status }, update) => {
          const row = usageRows.find((u) => u.order === order && u.status === status);
          if (!row) return null;
          Object.assign(row, update.$set || {});
          return row;
        },
      };

      // User 1 and User 2 race for the last remaining coupon use
      const [first, second] = await Promise.allSettled([
        consumeCouponForOrder(
          { couponCode: 'LAST1', userId: 'user_1', orderId: 'ord_1', discountAmount: 50 },
          { Coupon: FakeCoupon, CouponUsage: FakeUsage }
        ),
        consumeCouponForOrder(
          { couponCode: 'LAST1', userId: 'user_2', orderId: 'ord_2', discountAmount: 50 },
          { Coupon: FakeCoupon, CouponUsage: FakeUsage }
        ),
      ]);

      const fulfilled = [first, second].filter((r) => r.status === 'fulfilled');
      const rejected = [first, second].filter((r) => r.status === 'rejected');
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.equal(rejected[0].reason.message, 'This coupon is no longer available');
      assert.equal(couponState.usedCount, 1);
      assert.equal(couponState.isActive, false);
      assert.equal(couponState.disabledByLimit, true);

      // Releasing ord_1 frees the coupon again and restores active status
      const winningOrderId = fulfilled[0].value.usage.order;
      const rel = await releaseCouponUsageForOrder(winningOrderId, {
        Coupon: FakeCoupon,
        CouponUsage: FakeUsage,
      });
      assert.equal(rel.released, true);
      assert.equal(couponState.usedCount, 0);
      assert.equal(couponState.isActive, true);
      assert.equal(couponState.disabledByLimit, false);
    });
  });

  describe('9. Weekly Rating Reminder Emails (Every 7th Day Until Rated)', () => {
    it('sends weekly reminder starting day 7 and stops once all items are rated', async () => {
      const { runWeeklyRatingReminders } = require('../src/jobs/cron');
      const deliveredAt = new Date('2026-11-01T10:00:00Z');
      const sentCalls = [];
      const seenDedupeKeys = new Set();

      const sampleOrder = {
        _id: 'ord_weekly_1',
        orderNumber: 'ORGION-26-00099',
        status: 'delivered',
        deliveredAt,
        user: { _id: 'u_99', name: 'Kavya', email: 'kavya@example.com', isBlocked: false },
        items: [{ product: 'p_soap', name: 'GlowX Soap' }],
      };

      let ratedProducts = [];
      const FakeOrder = {
        find: () => ({
          populate: () => ({
            limit: () => ({
              lean: async () => [sampleOrder],
            }),
          }),
        }),
      };
      const FakeReview = {
        find: () => ({
          select: () => ({
            lean: async () => ratedProducts.map((pid) => ({ order: 'ord_weekly_1', product: pid })),
          }),
        }),
      };
      const fakeNotifyNow = async (event, payload) => {
        if (seenDedupeKeys.has(payload.emailDedupeKey)) {
          return { email: { deduped: true } };
        }
        seenDedupeKeys.add(payload.emailDedupeKey);
        sentCalls.push({ event, weekNumber: payload.weekNumber, unrated: payload.unratedItems.length });
        return { email: { ok: true } };
      };

      // Day 6: < 7 days -> no reminder
      const day6 = await runWeeklyRatingReminders({
        Order: FakeOrder,
        Review: FakeReview,
        notifyNow: fakeNotifyNow,
        now: new Date('2026-11-07T09:59:59Z'),
      });
      assert.equal(day6.sent, 0);

      // Day 7: week 1 reminder sent once, repeated check deduped
      const day7 = await runWeeklyRatingReminders({
        Order: FakeOrder,
        Review: FakeReview,
        notifyNow: fakeNotifyNow,
        now: new Date('2026-11-08T10:00:00Z'),
      });
      const day7Repeat = await runWeeklyRatingReminders({
        Order: FakeOrder,
        Review: FakeReview,
        notifyNow: fakeNotifyNow,
        now: new Date('2026-11-09T10:00:00Z'),
      });
      assert.equal(day7.sent, 1);
      assert.equal(day7Repeat.sent, 0);
      assert.equal(sentCalls[0].weekNumber, 1);

      // Day 14: week 2 reminder sent because still unrated
      const day14 = await runWeeklyRatingReminders({
        Order: FakeOrder,
        Review: FakeReview,
        notifyNow: fakeNotifyNow,
        now: new Date('2026-11-15T10:00:00Z'),
      });
      assert.equal(day14.sent, 1);
      assert.equal(sentCalls[1].weekNumber, 2);

      // Customer rates product -> Day 21 sends nothing
      ratedProducts = ['p_soap'];
      const day21 = await runWeeklyRatingReminders({
        Order: FakeOrder,
        Review: FakeReview,
        notifyNow: fakeNotifyNow,
        now: new Date('2026-11-22T10:00:00Z'),
      });
      assert.equal(day21.sent, 0);
      assert.equal(sentCalls.length, 2);
    });
  });
});
