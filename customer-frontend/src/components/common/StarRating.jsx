import React from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ rating = 0, count, size = 14, showValue = false }) {
  const numericRating = Number(rating || 0);
  const rounded = Math.round(numericRating * 2) / 2;

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="flex items-center gap-0.5" aria-label={`Rated ${numericRating.toFixed(1)} out of 5`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.round(rounded);
          return (
            <Star
              key={star}
              size={size}
              className={filled ? 'fill-gold text-gold' : 'fill-transparent text-text-muted/55'}
            />
          );
        })}
      </div>
      {showValue && (
        <span className="text-xs font-semibold tabular-nums text-text">
          {numericRating.toFixed(1)}
        </span>
      )}
      {count !== undefined && (
        <span className="text-[11px] text-text-muted">({count})</span>
      )}
    </div>
  );
}
