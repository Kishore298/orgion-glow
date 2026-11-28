import React, { useState } from 'react';
import { Star } from 'lucide-react';

/**
 * Interactive 1-5 star rating input.
 * Starts blank when value is 0; fills stars with gold on click (and hover preview).
 */
export default function StarRatingInput({ value = 0, onChange, size = 24, disabled = false }) {
  const [hovered, setHovered] = useState(0);
  const activeValue = hovered || Number(value || 0);

  return (
    <div
      className="inline-flex items-center gap-1"
      role="radiogroup"
      aria-label="Star rating"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= activeValue;
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            role="radio"
            aria-checked={Number(value) === star}
            aria-label={`Rate ${star} out of 5 stars`}
            onMouseEnter={() => !disabled && setHovered(star)}
            onClick={() => !disabled && onChange?.(star)}
            className={`p-1 transition-transform ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-110 active:scale-95'
            }`}
          >
            <Star
              size={size}
              className={
                filled
                  ? 'fill-gold text-gold transition-colors'
                  : 'fill-transparent text-text-muted/55 transition-colors'
              }
            />
          </button>
        );
      })}
    </div>
  );
}
