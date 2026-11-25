import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  formatINR,
  handleImageError,
  isFallbackLogo,
  resolveImageUrl,
} from '../../lib/format';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { LUXURY_EASE } from './MotionPrimitives';

export default function ProductCard({ product }) {
  const addItem = useCartStore((s) => s.addItem);
  const user = useAuthStore((s) => s.user);
  const [adding, setAdding] = useState(false);

  const primaryImg =
    product.images?.find((img) => img.isPrimary)?.url || product.images?.[0]?.url || '';
  const usingLogoFallback = isFallbackLogo(primaryImg);
  const hasPrice = Number(product.price || 0) > 0;
  const canPurchase = product.inStock && hasPrice;
  const avgRating = Number(product.ratingAvg || 0).toFixed(1);

  const handleAdd = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canPurchase || adding) return;
    setAdding(true);
    try {
      await addItem(product, 1, Boolean(user), true);
      toast.success(`${product.name} added to bag`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not add item');
    } finally {
      setAdding(false);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.22, ease: LUXURY_EASE }}
      className="luxury-card group relative flex h-full cursor-pointer flex-col overflow-hidden transition-shadow duration-300 hover:shadow-md"
    >
      {/* Full-card link so clicking anywhere except Add to Cart opens details */}
      <Link
        to={`/product/${product.slug}`}
        aria-label={product.name}
        className="absolute inset-0 z-10"
      />

      <div className="relative block aspect-[4/3.2] sm:aspect-[4/3.4] overflow-hidden bg-surface-muted">
        <img
          src={resolveImageUrl(primaryImg, 600)}
          alt={product.name}
          loading="lazy"
          onError={handleImageError}
          className={`h-full w-full transition-transform duration-500 group-hover:scale-105 ${
            usingLogoFallback ? 'object-contain p-4 sm:p-7 opacity-90' : 'object-cover'
          } ${!product.inStock ? 'grayscale opacity-75' : ''}`}
        />
        <div className="absolute left-2 top-2 sm:left-2.5 sm:top-2.5 flex flex-wrap gap-1">
          {!product.inStock ? (
            <span className="rounded-full bg-text/80 px-2 py-0.5 text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-white">
              Out of Stock
            </span>
          ) : !hasPrice ? (
            <span className="rounded-full bg-surface/95 border border-border px-2 py-0.5 text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Coming Soon
            </span>
          ) : product.isBestseller ? (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-primary-dark">
              Bestseller
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-2 sm:p-3">
        <div className="flex items-start justify-between gap-1.5">
          <h3 className="font-serif text-[13.5px] sm:text-[15px] font-medium leading-tight text-text transition-colors group-hover:text-primary line-clamp-2">
            {product.name}
          </h3>
          <span
            aria-label={`Average rating ${avgRating}`}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-surface-muted px-1.5 py-0.5 font-sans text-[10.5px] sm:text-[11px] font-semibold tabular-nums text-text"
          >
            <Star size={10} className="fill-gold text-gold" />
            {avgRating}
          </span>
        </div>

        <p className="mt-0.5 line-clamp-2 text-[11px] sm:text-xs leading-tight sm:leading-snug text-text-muted">
          {product.shortDescription || product.description}
        </p>

        <div className="mt-1 flex items-baseline gap-1.5 font-sans">
          {hasPrice ? (
            <>
              <span className="text-[13px] sm:text-[14.5px] font-semibold tabular-nums text-primary">
                {formatINR(product.price)}
              </span>
              {product.mrp && product.mrp > product.price && (
                <span className="text-[10px] sm:text-[11px] tabular-nums text-text-muted line-through">
                  {formatINR(product.mrp)}
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] sm:text-xs font-medium text-text-muted">TBA</span>
          )}
        </div>

        <div className="relative z-20 mt-auto pt-1.5 sm:pt-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            disabled={!canPurchase || adding}
            onClick={handleAdd}
            className="btn-primary w-full min-h-[34px] sm:min-h-[36px] px-2.5 py-1.5 text-[11px] sm:text-xs"
          >
            <ShoppingBag size={13} />
            {!product.inStock
              ? 'Out of Stock'
              : !hasPrice
              ? 'Coming Soon'
              : adding
              ? 'Adding...'
              : 'Add to Cart'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
