import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, EyeOff, PackageCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { formatDate, handleImageError, isFallbackLogo, resolveImageUrl } from '../../lib/format';
import StarRatingInput from './StarRatingInput';
import StarRating from './StarRating';

function getItemKey(item) {
  return `${item.orderNumber}:${item.productId}`;
}

function ReviewStatusBadge({ status }) {
  if (status === 'visible') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-medium text-primary-dark">
        <CheckCircle2 size={12} /> Published
      </span>
    );
  }
  if (status === 'hidden') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
        <EyeOff size={12} /> Hidden
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
      <Clock size={12} /> Pending Approval
    </span>
  );
}

export default function AddReviewModal({
  open,
  onClose,
  initialProductId = '',
  initialProductSlug = '',
  onSubmitted,
}) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const queryClient = useQueryClient();

  const [selectedKey, setSelectedKey] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['reviewable-items', user?._id],
    enabled: Boolean(open && user),
    queryFn: async () => {
      const res = await api.get('/v1/orders/reviewable-items');
      return res.data?.data || { items: [], hasInProgressOrders: false };
    },
  });

  const items = useMemo(() => data?.items || [], [data?.items]);
  const hasInProgressOrders = Boolean(data?.hasInProgressOrders);

  const matchingCurrentProduct = useMemo(() => {
    if (!initialProductId && !initialProductSlug) return true;
    return items.some(
      (i) =>
        (initialProductId && String(i.productId) === String(initialProductId)) ||
        (initialProductSlug && i.slug === initialProductSlug)
    );
  }, [items, initialProductId, initialProductSlug]);

  useEffect(() => {
    if (!open) return;
    if (items.length === 0) {
      setSelectedKey('');
      return;
    }

    const matchesInitial = (item) =>
      (initialProductId && String(item.productId) === String(initialProductId)) ||
      (initialProductSlug && item.slug === initialProductSlug);

    const preferred =
      items.find((i) => matchesInitial(i) && !i.existingReview) ||
      items.find((i) => matchesInitial(i)) ||
      items.find((i) => !i.existingReview) ||
      items[0];

    setSelectedKey(preferred ? getItemKey(preferred) : '');
    setRating(0);
    setComment('');
  }, [open, items, initialProductId, initialProductSlug]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const selectedItem = useMemo(
    () => items.find((i) => getItemKey(i) === selectedKey) || null,
    [items, selectedKey]
  );

  const handleSelectItem = (key) => {
    setSelectedKey(key);
    setRating(0);
    setComment('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem || selectedItem.existingReview) return;
    if (!rating || rating < 1 || rating > 5) {
      toast.error('Please click the stars to select your rating');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(
        `/v1/orders/${selectedItem.orderNumber}/items/${selectedItem.slug || selectedItem.productId}/review`,
        {
          rating,
          comment: comment.trim(),
        }
      );
      toast.success('Thank you! Your review has been sent for admin approval.');
      setRating(0);
      setComment('');
      await queryClient.invalidateQueries({ queryKey: ['reviewable-items', user?._id] });
      await queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      onSubmitted?.();
    } catch (err) {
      if (!err?.isAuthRedirect) {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const loginRedirect = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-review-modal-title"
    >
      <div
        className="luxury-card relative w-full max-w-lg p-5 sm:p-7 my-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close review modal"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <X size={18} />
        </button>

        <span className="label-micro">Verified Purchase Review</span>
        <h2
          id="add-review-modal-title"
          className="mt-1 font-serif text-2xl font-semibold text-primary-dark"
        >
          Review Your Purchased Products
        </h2>

        {!user ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-text-muted leading-relaxed">
              Please sign in to review products from your delivered ORGION orders.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Link to={loginRedirect} onClick={onClose} className="btn-primary flex-1 text-center">
                Sign In to Review
              </Link>
              <button type="button" onClick={onClose} className="btn-ghost flex-1">
                Cancel
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="mt-5 space-y-3">
            <div className="h-14 rounded-xl bg-surface-muted animate-pulse" />
            <div className="h-24 rounded-xl bg-surface-muted animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-border bg-surface-muted p-4 text-sm text-text-muted leading-relaxed">
              <div className="flex items-center gap-2 font-medium text-text mb-1">
                <PackageCheck size={16} className="text-primary shrink-0" />
                No delivered products available to review yet
              </div>
              {hasInProgressOrders
                ? 'Your order is on the way! You can review your purchased products once your order is delivered.'
                : 'Purchase our herbal skincare or lip care products and share your experience once your order is delivered.'}
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Link
                to={hasInProgressOrders ? '/account/orders' : '/shop'}
                onClick={onClose}
                className="btn-primary flex-1 text-center"
              >
                {hasInProgressOrders ? 'View My Orders' : 'Explore Products'}
              </Link>
              <button type="button" onClick={onClose} className="btn-ghost flex-1">
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {(initialProductId || initialProductSlug) && !matchingCurrentProduct && (
              <p className="rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-text-muted">
                You have not received this product in a delivered order yet. You can review another product you purchased below:
              </p>
            )}

            <div>
              <label htmlFor="purchased-product-select" className="label-micro block mb-1.5">
                Select Purchased Product ({items.length})
              </label>
              <select
                id="purchased-product-select"
                value={selectedKey}
                onChange={(e) => handleSelectItem(e.target.value)}
                className="input-field"
              >
                {items.map((item) => {
                  const key = getItemKey(item);
                  const statusLabel = item.existingReview
                    ? item.existingReview.status === 'visible'
                      ? ' — Published'
                      : ' — Submitted'
                    : '';
                  return (
                    <option key={key} value={key}>
                      {item.name} ({item.orderNumber}){statusLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedItem && (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-muted p-3">
                <img
                  src={resolveImageUrl(selectedItem.image, 150)}
                  alt={selectedItem.name}
                  onError={handleImageError}
                  className={`h-14 w-14 shrink-0 rounded-xl border border-border bg-surface ${
                    isFallbackLogo(selectedItem.image) ? 'object-contain p-1.5' : 'object-cover'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-base font-medium text-text truncate">{selectedItem.name}</p>
                  <p className="text-xs text-text-muted">
                    Order {selectedItem.orderNumber} · Delivered {formatDate(selectedItem.deliveredAt)}
                  </p>
                </div>
              </div>
            )}

            {selectedItem?.existingReview ? (
              <div className="rounded-2xl border border-border bg-surface-muted p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <StarRating rating={selectedItem.existingReview.rating} size={16} showValue />
                  <ReviewStatusBadge status={selectedItem.existingReview.status} />
                </div>
                {selectedItem.existingReview.comment && (
                  <p className="text-xs sm:text-sm text-text">“{selectedItem.existingReview.comment}”</p>
                )}
                <p className="text-[11px] text-text-muted">
                  {selectedItem.existingReview.status === 'visible'
                    ? 'Your review is live on the product page.'
                    : selectedItem.existingReview.status === 'pending'
                      ? 'Your review has been sent to our team and will publish on the product page once approved.'
                      : 'This review is currently hidden.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label-micro block mb-1.5">Your Rating</label>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2">
                    <StarRatingInput value={rating} onChange={setRating} size={24} disabled={submitting} />
                    <span className="text-xs text-text-muted">
                      {rating > 0 ? `${rating} / 5 stars` : 'Tap stars to rate'}
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="customer-review-comment" className="label-micro block mb-1.5">
                    Your Experience (Optional)
                  </label>
                  <textarea
                    id="customer-review-comment"
                    rows={3}
                    maxLength={500}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share how this felt for your skin or lips (max 500 chars)"
                    className="input-field"
                  />
                  <p className="mt-1 text-[11px] text-text-muted">
                    Verified reviews are published on the product page after admin approval.
                  </p>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
                  <button type="button" onClick={onClose} className="btn-ghost flex-1">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="btn-primary flex-1">
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
