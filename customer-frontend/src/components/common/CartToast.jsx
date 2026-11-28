import React from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, ShoppingBag, X } from 'lucide-react';
import { handleImageError, isFallbackLogo, resolveImageUrl } from '../../lib/format';

export function showAddedToCartToast({ product, qty = 1 }) {
  if (!product) return;
  const imgUrl =
    product.images?.find((img) => img.isPrimary)?.url ||
    product.images?.[0]?.url ||
    product.image ||
    '';
  const usingFallback = isFallbackLogo(imgUrl);

  toast.custom(
    (t) => (
      <div
        className={`pointer-events-auto flex w-[min(92vw,370px)] items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-lg transition-all duration-300 ease-out ${
          t.visible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-2 scale-95 opacity-0'
        }`}
        role="status"
      >
        <img
          src={resolveImageUrl(imgUrl, 160)}
          alt={product.name}
          onError={handleImageError}
          className={`h-14 w-14 shrink-0 rounded-xl border border-border bg-surface-muted ${
            usingFallback ? 'object-contain p-1.5 opacity-90' : 'object-cover'
          }`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-dark">
              <ShoppingBag size={13} className="text-primary shrink-0" />
              Added to Cart
            </span>
            <button
              type="button"
              aria-label="Close notification"
              onClick={() => toast.dismiss(t.id)}
              className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
            >
              <X size={14} />
            </button>
          </div>

          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-text">
            {qty > 1 ? `${qty} × ` : ''}
            {product.name} added to your cart.
          </p>

          <Link
            to="/cart"
            onClick={() => toast.dismiss(t.id)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            View Cart <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    ),
    {
      duration: 2000,
      position: 'bottom-center',
    }
  );
}
