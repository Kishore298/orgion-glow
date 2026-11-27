import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Plus, Minus, Trash2, ShoppingBag, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../lib/api';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { formatINR, handleImageError, isFallbackLogo, resolveImageUrl } from '../../lib/format';
import { LUXURY_EASE } from '../common/MotionPrimitives';

export default function MiniCartDrawer() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    items,
    subtotal,
    notices,
    miniCartOpen,
    closeMiniCart,
    updateQty,
    removeItem,
    dismissNotices,
  } = useCartStore();

  const hasOutOfStock = items.some((i) => i.inStock === false);

  const handleQtyChange = async (item, nextQty) => {
    try {
      if (nextQty <= 0) {
        await removeItem(item.productId, Boolean(user));
        toast.success(`${item.name} removed from cart`, { id: 'cart-action' });
      } else {
        await updateQty(item.productId, nextQty, Boolean(user));
        toast.success(`${item.name} quantity updated to ${nextQty}`, { id: 'cart-action' });
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRemove = async (item) => {
    try {
      await removeItem(item.productId, Boolean(user));
      toast.success(`${item.name} removed from cart`, { id: 'cart-action' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <AnimatePresence>
      {miniCartOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Shopping bag"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 bg-black/35 backdrop-blur-[1px]"
            onClick={closeMiniCart}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.32, ease: LUXURY_EASE }}
            className="relative z-10 flex h-full w-full max-w-md flex-col bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-5 bg-surface">
              <div className="flex items-center gap-2">
                <ShoppingBag size={19} className="text-primary" />
                <h2 className="font-serif text-xl font-semibold text-text">Your Bag</h2>
              </div>
              <button
                type="button"
                aria-label="Close bag"
                onClick={closeMiniCart}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text"
              >
                <X size={20} />
              </button>
            </div>

            {notices.length > 0 && (
              <div className="mx-5 mt-4 rounded-xl border border-status-warning/30 bg-amber-50 p-3 text-xs text-status-warning">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    {notices.map((n, idx) => (
                      <p key={idx} className="flex items-center gap-1.5">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{n}</span>
                      </p>
                    ))}
                  </div>
                  <button type="button" onClick={dismissNotices} className="text-xs underline">
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {items.length === 0 ? (
                <div className="py-20 text-center">
                  <ShoppingBag size={36} className="mx-auto text-sage" strokeWidth={1.3} />
                  <p className="mt-4 font-serif text-xl text-text">Your bag is empty</p>
                  <p className="mt-1 text-sm text-text-muted">
                    Explore our botanical lip care and skin rituals.
                  </p>
                  <Link to="/shop" onClick={closeMiniCart} className="btn-primary mt-6">
                    Shop Collection
                  </Link>
                </div>
              ) : (
                items.map((item) => (
                  <motion.div
                    layout
                    key={item.productId}
                    className="flex gap-4 rounded-2xl border border-border bg-surface p-3.5"
                  >
                    <Link
                      to={`/product/${item.slug}`}
                      onClick={closeMiniCart}
                      className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-muted border border-border flex items-center justify-center"
                    >
                      <img
                        src={resolveImageUrl(item.image, 300)}
                        alt={item.name}
                        onError={handleImageError}
                        className={`h-full w-full ${
                          isFallbackLogo(item.image) ? 'object-contain p-2' : 'object-cover'
                        } ${item.inStock === false ? 'grayscale opacity-70' : ''}`}
                      />
                    </Link>
                    <div className="flex flex-1 flex-col justify-between min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/product/${item.slug}`}
                          onClick={closeMiniCart}
                          className="font-serif text-base font-medium text-text truncate hover:text-primary"
                        >
                          {item.name}
                        </Link>
                        <button
                          type="button"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => handleRemove(item)}
                          className="text-text-muted hover:text-status-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {item.inStock === false && (
                        <span className="text-[11px] font-medium text-status-danger">
                          Currently out of stock
                        </span>
                      )}

                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-lg border border-border bg-surface-muted">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => handleQtyChange(item, item.qty - 1)}
                            className="px-2 py-1 text-text-muted hover:text-text"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="px-2.5 text-xs font-medium">{item.qty}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => handleQtyChange(item, item.qty + 1)}
                            className="px-2 py-1 text-text-muted hover:text-text"
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        <span className="font-sans text-sm font-semibold tabular-nums text-primary">
                          {formatINR(Number(item.price) * Number(item.qty))}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-border bg-surface p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Subtotal</span>
                  <span className="font-sans text-xl font-semibold tabular-nums text-primary">
                    {formatINR(subtotal)}
                  </span>
                </div>
                <p className="text-xs text-text-muted">Shipping calculated at checkout.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/cart" onClick={closeMiniCart} className="btn-ghost">
                    View Bag
                  </Link>
                  <button
                    type="button"
                    disabled={hasOutOfStock}
                    onClick={() => {
                      closeMiniCart();
                      navigate('/checkout');
                    }}
                    className="btn-primary"
                  >
                    Checkout
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
