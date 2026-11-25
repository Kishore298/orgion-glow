import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Star, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { resolveImageUrl } from '../../lib/format';
import { LUXURY_EASE } from '../common/MotionPrimitives';

const BLOCKED_PATH_PREFIXES = ['/checkout', '/order-success', '/order-failed'];
const FOCUS_THROTTLE_MS = 5 * 60 * 1000;

export default function DeliveredReviewModal() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();

  const [pendingOrder, setPendingOrder] = useState(null);
  const [open, setOpen] = useState(false);
  const shownThisSessionRef = useRef(false);
  const lastFetchRef = useRef(0);
  const rateBtnRef = useRef(null);

  const isBlockedRoute = BLOCKED_PATH_PREFIXES.some((p) =>
    location.pathname.startsWith(p)
  );

  const checkPendingReviews = async (force = false) => {
    if (!user || shownThisSessionRef.current || isBlockedRoute) return;
    const now = Date.now();
    if (!force && now - lastFetchRef.current < FOCUS_THROTTLE_MS) return;
    lastFetchRef.current = now;

    try {
      const res = await api.get('/v1/orders/pending-reviews');
      const data = res.data?.data;
      if (data && data.unratedItems?.length > 0) {
        shownThisSessionRef.current = true;
        setPendingOrder(data);
        setOpen(true);
      }
    } catch {
      // ignore silently
    }
  };

  useEffect(() => {
    if (user && !isBlockedRoute) {
      checkPendingReviews(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  useEffect(() => {
    const onFocus = () => checkPendingReviews(false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, isBlockedRoute]);

  useEffect(() => {
    if (open && rateBtnRef.current) {
      rateBtnRef.current.focus();
    }
  }, [open]);

  const handleDismiss = async () => {
    setOpen(false);
    if (!pendingOrder) return;
    try {
      await api.post(`/v1/orders/${pendingOrder.orderNumber}/review-prompt/dismiss`);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingOrder]);

  const handleRateNow = () => {
    setOpen(false);
    navigate(`/account/orders/${pendingOrder.orderNumber}#rate`);
  };

  return (
    <AnimatePresence>
      {open && pendingOrder && !isBlockedRoute && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivered-popup-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: LUXURY_EASE }}
            className="relative w-full max-w-md rounded-3xl border border-border bg-surface p-7 shadow-2xl"
          >
            <button
              type="button"
              aria-label="Close reminder"
              onClick={handleDismiss}
              className="absolute right-4 top-4 rounded-full p-1.5 text-text-muted hover:bg-surface-muted hover:text-text"
            >
              <X size={18} />
            </button>

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Star size={22} className="fill-gold text-gold" />
            </div>

            <p className="mt-4 text-center label-micro">Order Delivered</p>
            <h2
              id="delivered-popup-title"
              className="mt-1 text-center font-serif text-2xl font-semibold text-primary-dark"
            >
              Your order #{pendingOrder.orderNumber} has been delivered
            </h2>
            <p className="mt-2 text-center text-sm text-text-muted">
              How did you like your products? Your honest rating helps our herbal community.
            </p>

            <div className="mt-5 flex justify-center gap-3 overflow-x-auto py-1">
              {pendingOrder.unratedItems.slice(0, 4).map((item) => (
                <div key={item.product} className="w-16 shrink-0 text-center">
                  <img
                    src={resolveImageUrl(item.image, 200)}
                    alt={item.name}
                    className="h-16 w-16 rounded-xl border border-border object-cover"
                  />
                  <p className="mt-1 truncate text-[11px] text-text-muted">{item.name}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                ref={rateBtnRef}
                type="button"
                onClick={handleRateNow}
                className="btn-primary flex-1"
              >
                Rate now
              </button>
              <button type="button" onClick={handleDismiss} className="btn-ghost flex-1">
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
