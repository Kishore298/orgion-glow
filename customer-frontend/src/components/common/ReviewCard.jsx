import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, MessageCircle } from 'lucide-react';
import StarRating from './StarRating';
import { formatDate, handleImageError, isFallbackLogo, resolveImageUrl } from '../../lib/format';

export default function ReviewCard({ review, onImageClick, showDate = false }) {
  const [expanded, setExpanded] = useState(false);

  const productImg =
    review.product?.images?.find((img) => img.isPrimary)?.url ||
    review.product?.images?.[0]?.url ||
    '';
  const displayImg = review.screenshot || productImg;
  const usingFallback = isFallbackLogo(displayImg);
  const comment = String(review.comment || '').trim();
  const isLongComment = comment.length > 130 || comment.split('\n').length > 3;

  return (
    <article className="luxury-card p-3.5 sm:p-4 flex flex-col justify-between h-full">
      <div>
        {/* Compact Header: Stars + Single-line Source Pill */}
        <div className="flex items-center justify-between gap-2">
          <StarRating rating={review.rating} size={13} showValue />
          {review.source === 'whatsapp' ? (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary-dark">
              <MessageCircle size={10} />
              WhatsApp Review
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary-dark">
              <BadgeCheck size={11} />
              Verified Buyer
            </span>
          )}
        </div>

        {/* Compact Body: Quote + Image side-by-side */}
        <div className="mt-2.5 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {comment ? (
              <>
                <p
                  className={`text-xs sm:text-[13px] leading-relaxed text-text break-words ${
                    !expanded && isLongComment ? 'line-clamp-3' : ''
                  }`}
                >
                  “{comment}”
                </p>
                {isLongComment && (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    {expanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs italic text-text-muted">Rated {review.rating} out of 5 stars</p>
            )}
          </div>

          {displayImg && (
            <button
              type="button"
              disabled={!review.screenshot || !onImageClick}
              onClick={() => review.screenshot && onImageClick?.(resolveImageUrl(review.screenshot, 1200))}
              aria-label={review.screenshot ? 'View review image' : review.product?.name || 'Product'}
              className={`h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-muted ${
                review.screenshot && onImageClick ? 'cursor-zoom-in hover:opacity-90' : 'cursor-default'
              }`}
            >
              <img
                src={resolveImageUrl(displayImg, 250)}
                alt={review.screenshot ? 'Customer feedback photo' : review.product?.name || 'ORGION product'}
                loading="lazy"
                onError={handleImageError}
                className={`h-full w-full ${
                  usingFallback ? 'object-contain p-1.5 opacity-90' : 'object-cover'
                }`}
              />
            </button>
          )}
        </div>

        {review.adminReply && (
          <div className="mt-2.5 rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-[11px] leading-snug text-text-muted">
            <strong className="text-primary-dark">ORGION Team:</strong> {review.adminReply}
          </div>
        )}
      </div>

      {/* Compact Footer */}
      <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-2 text-[11px]">
        <div className="min-w-0 truncate">
          <span className="font-semibold text-text">{review.reviewerName}</span>
          {review.reviewerLocation && (
            <span className="text-text-muted"> · {review.reviewerLocation}</span>
          )}
          {showDate && review.reviewDate && (
            <span className="block text-[10px] text-text-muted">{formatDate(review.reviewDate)}</span>
          )}
        </div>

        {review.product && (
          <Link
            to={`/product/${review.product.slug}`}
            title={review.product.name}
            className="shrink-0 max-w-[140px] sm:max-w-[175px] truncate font-medium text-primary hover:underline text-right"
          >
            {review.product.name}
          </Link>
        )}
      </div>
    </article>
  );
}
