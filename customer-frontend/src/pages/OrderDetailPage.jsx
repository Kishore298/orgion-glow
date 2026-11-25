import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Check, Copy, Download, ExternalLink, Star, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { formatDate, formatINR, handleImageError, isFallbackLogo, resolveImageUrl } from '../lib/format';
import { useSiteConfig } from '../hooks/useSiteConfig';
import { PageSkeleton } from '../components/common/Skeletons';

const TIMELINE_STEPS = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

function ProductRateRow({ orderRef, item, existingRating, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (existingRating) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-surface-muted p-4">
        <div className="flex items-center gap-3">
          <img
            src={resolveImageUrl(item.image, 150)}
            alt={item.name}
            onError={handleImageError}
            className={`h-14 w-14 rounded-xl border border-border bg-surface ${
              isFallbackLogo(item.image) ? 'object-contain p-1.5' : 'object-cover'
            }`}
          />
          <div>
            <p className="font-serif text-base font-medium text-text">{item.name}</p>
            <p className="mt-0.5 text-xs font-medium text-primary-dark">
              You rated this {'★'.repeat(existingRating.rating)}
              {'☆'.repeat(5 - existingRating.rating)}
            </p>
            {existingRating.comment && (
              <p className="mt-1 text-xs text-text-muted">“{existingRating.comment}”</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/v1/orders/${orderRef}/items/${item.slug || item.product}/review`, {
        rating,
        comment,
      });
      toast.success(`Thank you for rating ${item.name}!`);
      onSubmitted();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-surface p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={resolveImageUrl(item.image, 150)}
            alt={item.name}
            onError={handleImageError}
            className={`h-14 w-14 rounded-xl border border-border bg-surface ${
              isFallbackLogo(item.image) ? 'object-contain p-1.5' : 'object-cover'
            }`}
          />
          <div>
            <p className="font-serif text-base font-medium text-text">{item.name}</p>
            <p className="text-xs text-text-muted">Select your star rating</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`Rate ${star} stars`}
              onClick={() => setRating(star)}
              className="p-1"
            >
              <Star
                size={22}
                className={star <= rating ? 'fill-gold text-gold' : 'fill-transparent text-text-muted/55'}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional note on how this felt for your skin/lips (max 500 chars)"
          className="input-field flex-1"
        />
        <button type="submit" disabled={submitting} className="btn-primary shrink-0">
          {submitting ? 'Submitting...' : 'Submit Rating'}
        </button>
      </div>
    </form>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const siteConfig = useSiteConfig();

  const { data, isLoading } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: async () => {
      const res = await api.get(`/v1/orders/${id}`);
      return res.data?.data;
    },
  });

  useEffect(() => {
    if (location.hash === '#rate' && data?.order?.status === 'delivered') {
      setTimeout(() => {
        document.getElementById('rate')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [location.hash, data?.order?.status]);

  if (isLoading) return <PageSkeleton />;
  const order = data?.order;
  const ratedByProduct = data?.ratedByProduct || {};

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-primary-dark">Order not found</h1>
        <Link to="/account/orders" className="btn-primary mt-6">
          Back to Orders
        </Link>
      </div>
    );
  }

  const handleCopyTracking = async () => {
    const trackingId = order.tracking?.trackingId;
    if (!trackingId) return;
    try {
      await navigator.clipboard.writeText(trackingId);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = trackingId;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    toast.success('Tracking ID copied');
  };

  const handleDownloadInvoice = async () => {
    try {
      const ref = order?.orderNumber || id;
      const res = await api.get(`/v1/orders/${ref}/invoice`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ORGION-Invoice-${order.orderNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const activeStepIdx = TIMELINE_STEPS.findIndex((s) => s.key === order.status);
  const addr = order.addressSnapshot || {};

  return (
    <>
      <Helmet>
        <title>Order {order.orderNumber} — ORGION</title>
      </Helmet>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-3 sm:pt-4 pb-10 space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <Link to="/account/orders" className="text-xs text-primary hover:underline">
              ← Back to My Orders
            </Link>
            <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-primary-dark">
              {order.orderNumber}
            </h1>
            <p className="text-xs text-text-muted">Placed on {formatDate(order.createdAt)}</p>
          </div>

          <div className="flex items-center gap-2.5">
            {order.paymentStatus === 'paid' && (
              <button type="button" onClick={handleDownloadInvoice} className="btn-ghost text-xs">
                <Download size={15} /> Download Invoice
              </button>
            )}
            {['pending_payment', 'failed'].includes(order.status) && (
              <Link to={`/order-failed?order=${order.orderNumber}`} className="btn-primary text-xs">
                Complete Payment
              </Link>
            )}
          </div>
        </div>

        {/* Status Timeline */}
        <div className="luxury-card p-4 sm:p-5">
          <p className="label-micro mb-3 sm:mb-4">Order Progress</p>
          {order.status === 'cancelled' || order.status === 'expired' ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-status-danger">
              Order status: <strong className="uppercase">{order.status}</strong>
              {order.paymentStatus === 'refunded' || order.paymentStatus === 'partially_refunded'
                ? ` · Payment ${order.paymentStatus.replace(/_/g, ' ')}`
                : ''}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-4">
              {TIMELINE_STEPS.map((step, idx) => {
                const done = activeStepIdx >= idx;
                return (
                  <div key={step.key} className="flex items-center gap-2.5">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        done
                          ? 'bg-primary text-white'
                          : 'border border-border bg-surface-muted text-text-muted'
                      }`}
                    >
                      {done ? <Check size={14} /> : idx + 1}
                    </div>
                    <span
                      className={`text-xs font-medium ${done ? 'text-primary-dark' : 'text-text-muted'}`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ST Courier Tracking Card (shown ONLY when trackingId exists) */}
        {order.tracking?.trackingId && (
          <div className="luxury-card border-primary/30 bg-primary-soft/35 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-primary-dark">
                  <Truck size={18} />
                  <span className="label-micro text-primary-dark">ST Courier Tracking</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  <span className="rounded-lg bg-surface border border-border px-3.5 py-1.5 font-mono text-base font-semibold text-primary-dark">
                    {order.tracking.trackingId}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyTracking}
                    className="btn-ghost min-h-[36px] px-3 text-xs"
                  >
                    <Copy size={13} /> Copy ID
                  </button>
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  Paste your tracking ID on the ST Courier page if it isn’t filled in automatically.
                </p>
              </div>

              <a
                href={siteConfig.stCourierTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary shrink-0"
              >
                Track on ST Courier <ExternalLink size={15} />
              </a>
            </div>
          </div>
        )}

        {/* Items, Address, Payment: items-start so Items card height fits items dynamically */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-start">
          <div className="md:col-span-7 luxury-card p-4 sm:p-5 space-y-2.5">
            <h2 className="font-serif text-xl font-semibold text-text">Items</h2>
            <div className="divide-y divide-border">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <img
                    src={resolveImageUrl(item.image, 150)}
                    alt={item.name}
                    onError={handleImageError}
                    className={`h-12 w-12 shrink-0 rounded-xl border border-border bg-surface-muted ${
                      isFallbackLogo(item.image) ? 'object-contain p-1' : 'object-cover'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/product/${item.slug}`}
                      className="font-serif text-[15px] sm:text-base font-medium text-text hover:text-primary leading-snug"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs font-sans tabular-nums text-text-muted">
                      {formatINR(item.price)} &times; {item.qty}
                    </p>
                  </div>
                  <span className="font-sans font-semibold tabular-nums text-sm text-text shrink-0">
                    {formatINR(item.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-5 space-y-4">
            <div className="luxury-card bg-surface-muted p-4 sm:p-5 space-y-1.5 text-sm">
              <p className="label-micro">Delivery Address</p>
              <p className="font-semibold text-text">{addr.fullName}</p>
              <p className="text-text-muted leading-snug">
                {addr.line1}
                {addr.line2 ? `, ${addr.line2}` : ''}
              </p>
              <p className="text-text-muted">
                {addr.city}, {addr.state} - {addr.pincode}
              </p>
              <p className="text-text-muted">Mobile: {addr.mobile}</p>
            </div>

            <div className="luxury-card bg-surface-muted p-4 sm:p-5 space-y-2 text-sm">
              <p className="label-micro">Payment Summary</p>
              <div className="flex justify-between">
                <span className="text-text-muted">Status</span>
                <span className="font-medium uppercase">{order.paymentStatus.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Subtotal</span>
                <span className="font-sans tabular-nums">{formatINR(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Shipping</span>
                <span className="font-sans tabular-nums">
                  {order.shippingCharge === 0 ? 'Free' : formatINR(order.shippingCharge)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Total</span>
                <span className="font-sans text-lg font-semibold tabular-nums text-primary">
                  {formatINR(order.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rate your products (Delivered orders only) */}
        {order.status === 'delivered' && (
          <section id="rate" className="luxury-card p-4 sm:p-6 scroll-mt-24">
            <span className="label-micro">Delivered Order Feedback</span>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-primary-dark">
              Rate Your Products
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Share your experience once per product. Verified ratings publish immediately.
            </p>

            <div className="mt-4 space-y-3">
              {order.items.map((item) => (
                <ProductRateRow
                  key={item.product}
                  orderRef={order.orderNumber}
                  item={item}
                  existingRating={ratedByProduct[String(item.product)]}
                  onSubmitted={() =>
                    queryClient.invalidateQueries({ queryKey: ['order-detail', id] })
                  }
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
