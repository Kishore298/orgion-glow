import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Minus, Plus, Trash2, ShoppingBag, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../lib/api';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { formatINR, handleImageError, isFallbackLogo, resolveImageUrl } from '../lib/format';
import BackButton from '../components/common/BackButton';

export default function CartPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { items, subtotal, notices, loadCart, updateQty, removeItem, dismissNotices } =
    useCartStore();

  useEffect(() => {
    loadCart(Boolean(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

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
    <>
      <Helmet>
        <title>Your Bag — ORGION</title>
      </Helmet>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-3 sm:pt-4 pb-8 sm:pb-10">
        <BackButton fallbackTo="/shop" label="Back" className="mb-1.5 sm:mb-2" />
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-primary-dark">
          Your Bag
        </h1>

        {notices.length > 0 && (
          <div className="mt-6 rounded-2xl border border-status-warning/30 bg-amber-50 p-4 text-sm text-status-warning flex items-start justify-between gap-4">
            <div className="space-y-1">
              {notices.map((n, idx) => (
                <p key={idx} className="flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{n}</span>
                </p>
              ))}
            </div>
            <button type="button" onClick={dismissNotices} className="text-xs underline shrink-0">
              Dismiss
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="luxury-card mt-5 sm:mt-8 py-12 sm:py-16 px-4 sm:px-6 text-center">
            <ShoppingBag size={36} className="mx-auto text-sage" strokeWidth={1.3} />
            <p className="mt-3 sm:mt-4 font-serif text-xl sm:text-2xl text-text">Your bag is currently empty</p>
            <p className="mt-1.5 text-xs sm:text-sm text-text-muted">
              Discover our handcrafted lip balms and herbal facial care.
            </p>
            <Link to="/shop" className="btn-primary mt-5 sm:mt-6">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="mt-4 sm:mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            <div className="lg:col-span-8 space-y-3">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="luxury-card flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3.5 sm:p-4"
                >
                  <Link
                    to={`/product/${item.slug}`}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-surface-muted border border-border flex items-center justify-center"
                  >
                    <img
                      src={resolveImageUrl(item.image, 300)}
                      alt={item.name}
                      onError={handleImageError}
                      className={`h-full w-full ${isFallbackLogo(item.image) ? 'object-contain p-2.5' : 'object-cover'
                        } ${item.inStock === false ? 'grayscale opacity-70' : ''}`}
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/product/${item.slug}`}
                      className="font-serif text-xl font-medium text-text hover:text-primary"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-sm text-text-muted">{formatINR(item.price)} each</p>
                    {item.inStock === false && (
                      <p className="mt-1 text-xs font-medium text-status-danger">
                        Currently out of stock — please remove to proceed
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-5 self-end sm:self-center">
                    <div className="inline-flex items-center rounded-[10px] border border-border bg-surface-muted">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => handleQtyChange(item, item.qty - 1)}
                        className="px-3 py-2 text-text-muted hover:text-text"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="px-3 text-sm font-medium">{item.qty}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => handleQtyChange(item, item.qty + 1)}
                        className="px-3 py-2 text-text-muted hover:text-text"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <span className="w-24 text-right font-sans text-base font-semibold tabular-nums text-primary">
                      {formatINR(Number(item.price) * Number(item.qty))}
                    </span>

                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => handleRemove(item)}
                      className="p-1.5 text-text-muted hover:text-status-danger"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-4">
              <div className="luxury-card bg-surface-muted p-4 sm:p-6 space-y-3 sm:space-y-4 sticky top-20 sm:top-24">
                <h2 className="font-serif text-xl sm:text-2xl font-semibold text-text">Summary</h2>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Subtotal</span>
                  <span className="font-sans font-semibold tabular-nums text-text">
                    {formatINR(subtotal)}
                  </span>
                </div>
                <p className="text-xs text-text-muted border-t border-border pt-3">
                  Shipping calculated at checkout based on delivery address.
                </p>
                <button
                  type="button"
                  disabled={hasOutOfStock}
                  onClick={() => navigate('/checkout')}
                  className="btn-primary w-full"
                >
                  Proceed to Checkout
                </button>
                <Link to="/shop" className="btn-ghost w-full">
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
