import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Bell, Check, Download, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import {
  formatINR,
  handleImageError,
  isFallbackLogo,
  resolveImageUrl,
} from '../lib/format';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { enablePushNotifications, isPushActiveForUser } from '../lib/firebase';

export default function OrderSuccessPage() {
  const { orderRef } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearCart = useCartStore((s) => s.clearCart);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pushDismissed, setPushDismissed] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);

  useEffect(() => {
    let timer;
    let attempts = 0;

    async function fetchOrPoll() {
      try {
        const res = await api.get(`/v1/orders/${orderRef}`);
        const ord = res.data?.data?.order;
        if (!ord) {
          setLoading(false);
          return;
        }
        setOrder(ord);

        if (ord.paymentStatus === 'paid') {
          clearCart();
          setLoading(false);
          return;
        }

        if (ord.paymentStatus === 'failed' || ord.paymentStatus === 'expired') {
          navigate(`/order-failed?order=${ord.orderNumber}&reason=${ord.paymentStatus}`, {
            replace: true,
          });
          return;
        }

        if (attempts < 8) {
          attempts += 1;
          timer = setTimeout(fetchOrPoll, 2000);
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    }

    fetchOrPoll();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderRef, searchParams]);

  const handleDownloadInvoice = async () => {
    try {
      const ref = order?.orderNumber || orderRef;
      const res = await api.get(`/v1/orders/${ref}/invoice`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `ORGION-Invoice-${order?.orderNumber || orderRef}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleEnablePush = async () => {
    setEnablingPush(true);
    const result = await enablePushNotifications();
    setEnablingPush(false);
    if (result.ok) {
      useAuthStore.setState((s) => ({
        user: s.user ? { ...s.user, hasPushEnabled: true } : s.user,
      }));
      toast.success('Shipping updates enabled on this device!');
      setPushDismissed(true);
    } else {
      toast.error(result.reason);
    }
  };

  if (loading || (order && order.paymentStatus === 'pending')) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <Loader2 size={36} className="mx-auto animate-spin text-primary" />
        <h1 className="mt-5 font-serif text-3xl text-primary-dark">Confirming your payment</h1>
        <p className="mt-2 text-sm text-text-muted">
          Please stay on this page for a moment while we finalize your order with Razorpay.
        </p>
      </div>
    );
  }

  if (!order || order.paymentStatus !== 'paid') {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-primary-dark">Payment verification pending</h1>
        <p className="mt-2 text-sm text-text-muted">
          We haven’t received payment confirmation yet. If your payment succeeded, your order will confirm automatically.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to={`/order-failed?order=${orderRef}`} className="btn-primary">
            Retry Payment
          </Link>
          <Link to="/account/orders" className="btn-ghost">
            View Orders
          </Link>
        </div>
      </div>
    );
  }

  const addr = order.addressSnapshot || {};

  return (
    <>
      <Helmet>
        <title>Order Confirmed ({order.orderNumber}) — ORGION</title>
      </Helmet>

      <div className="mx-auto max-w-4xl px-6 pt-6 pb-16">
        <div className="luxury-card p-7 sm:p-12 text-center">
          {/* Botanical check illustration */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-soft border border-sage/40">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">
              <Check size={24} strokeWidth={2.5} />
            </div>
          </div>

          <h1 className="mt-6 font-serif text-3xl sm:text-4xl font-semibold text-primary-dark">
            Order Successfully Placed
          </h1>
          <p className="mt-2 text-sm sm:text-base text-text-muted">
            Thank you for choosing ORGION. Your journey to a natural glow starts here.
          </p>
          {user?.email && (
            <p className="mt-1.5 text-xs text-text-muted">
              A confirmation email has been sent to{' '}
              <span className="font-medium text-text">{user.email}</span>
            </p>
          )}

          {/* Side-by-side muted cards: items-start so Order Summary grows dynamically with items */}
          <div className="mt-9 grid grid-cols-1 md:grid-cols-2 gap-6 items-start text-left">
            <div className="rounded-2xl border border-border bg-surface-muted p-6 space-y-4">
              <div>
                <p className="label-micro">Order ID</p>
                <p className="mt-0.5 font-semibold text-text">{order.orderNumber}</p>
              </div>
              <div>
                <p className="label-micro">Customer</p>
                <p className="mt-0.5 text-sm text-text">{addr.fullName}</p>
              </div>
              <div>
                <p className="label-micro">Delivery Address</p>
                <p className="mt-0.5 text-sm leading-relaxed text-text-muted">
                  {addr.line1}
                  {addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} - {addr.pincode}
                </p>
              </div>
              <div>
                <p className="label-micro">Payment</p>
                <p className="mt-0.5 text-sm text-text uppercase">
                  {order.payment?.method || 'Online'}
                  {order.payment?.cardLast4 ? ` •••• ${order.payment.cardLast4}` : ''}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface-muted p-6">
              <p className="label-micro mb-3.5">Order Summary</p>

              <ul className="divide-y divide-border/70 text-sm">
                {order.items.map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={resolveImageUrl(item.image, 150)}
                        alt={item.name}
                        onError={handleImageError}
                        className={`h-11 w-11 shrink-0 rounded-xl border border-border bg-surface ${
                          isFallbackLogo(item.image) ? 'object-contain p-1' : 'object-cover'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text leading-snug line-clamp-2">
                          {item.name}
                        </p>
                        <p className="text-xs text-text-muted">Qty {item.qty}</p>
                      </div>
                    </div>
                    <span className="font-sans font-medium tabular-nums text-text shrink-0">
                      {formatINR(item.price * item.qty)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-border pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-text-muted">
                  <span>Shipping</span>
                  <span className="font-sans tabular-nums">
                    {Number(order.shippingCharge || 0) === 0
                      ? 'Free'
                      : formatINR(order.shippingCharge)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline pt-1">
                  <span className="font-semibold text-text">Total</span>
                  <span className="font-sans text-xl font-semibold tabular-nums text-primary">
                    {formatINR(order.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/shop" className="btn-primary">
              Continue Shopping
            </Link>
            <Link to={`/account/orders/${order.orderNumber}`} className="btn-ghost">
              View Order
            </Link>
            <button type="button" onClick={handleDownloadInvoice} className="btn-ghost">
              <Download size={16} />
              Download Invoice
            </button>
          </div>

          {/* Soft dismissible push notification prompt */}
          {!pushDismissed && !isPushActiveForUser(user) && (
            <div className="mt-8 mx-auto max-w-lg rounded-2xl border border-border bg-primary-soft/50 px-5 py-3.5 flex items-center justify-between gap-4 text-left">
              <div className="flex items-center gap-3">
                <Bell size={18} className="text-primary shrink-0" />
                <p className="text-xs sm:text-sm text-primary-dark">
                  Get shipping updates on this device when ST Courier dispatches your order.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={enablingPush}
                  onClick={handleEnablePush}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
                >
                  {enablingPush ? 'Enabling...' : 'Enable'}
                </button>
                <button
                  type="button"
                  aria-label="Dismiss notification prompt"
                  onClick={() => setPushDismissed(true)}
                  className="p-1 text-text-muted hover:text-text"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
