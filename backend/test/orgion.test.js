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

  describe('3. Pluggable Shipping Service Stub Contract', () => {
    it('returns the exact expected contract shape', async () => {
      const quote = await calculateShipping({
        pincode: '560038',
        state: 'Karnataka',
        subtotal: 899,
        weight: 100,
        items: [],
      });
      assert.equal(typeof quote.serviceable, 'boolean');
      assert.equal(typeof quote.charge, 'number');
      assert.equal(typeof quote.freeShippingApplied, 'boolean');
      assert.equal(quote.serviceable, true);
      assert.equal(quote.etaDays, null);
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
});
