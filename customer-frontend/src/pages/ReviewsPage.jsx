import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { BadgeCheck, MessageCircle, X } from 'lucide-react';
import api from '../lib/api';
import { formatDate, resolveImageUrl } from '../lib/format';
import StarRating from '../components/common/StarRating';

export default function ReviewsPage() {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [page, setPage] = useState(1);
  const [lightboxImg, setLightboxImg] = useState(null);

  const { data: productsData } = useQuery({
    queryKey: ['products', 'all-mini'],
    queryFn: async () => {
      const res = await api.get('/v1/products?limit=48');
      return res.data?.data?.items || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', 'public', selectedProduct, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (selectedProduct) params.set('product', selectedProduct);
      const res = await api.get(`/v1/reviews?${params.toString()}`);
      return res.data?.data;
    },
  });

  const products = productsData || [];
  const reviews = data?.items || [];
  const totalPages = data?.totalPages || 1;

  return (
    <>
      <Helmet>
        <title>Customer Reviews — ORGION</title>
        <meta
          name="description"
          content="Read verified customer ratings and real WhatsApp feedback for ORGION herbal skincare and lip care."
        />
      </Helmet>

      <div className="mx-auto max-w-6xl px-6 pt-5 pb-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-8">
          <div>
            <span className="label-micro">Community Love</span>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-primary-dark">
              Customer Reviews
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Verified post-delivery ratings and heartfelt WhatsApp notes from our patrons across India.
            </p>
          </div>

          <div className="sm:w-64">
            <label htmlFor="filter-product" className="label-micro block mb-1.5">
              Filter by Product
            </label>
            <select
              id="filter-product"
              value={selectedProduct}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                setPage(1);
              }}
              className="input-field"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-3xl bg-surface-muted animate-pulse" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-20 text-center text-text-muted">No reviews found for this selection.</div>
        ) : (
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((rev) => (
              <div key={rev._id} className="luxury-card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StarRating rating={rev.rating} size={15} />
                    {rev.source === 'whatsapp' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-medium text-primary-dark">
                        <MessageCircle size={11} />
                        Customer feedback via WhatsApp
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-medium text-primary-dark">
                        <BadgeCheck size={12} />
                        Verified Purchase
                      </span>
                    )}
                  </div>

                  {rev.comment && (
                    <p className="mt-4 text-sm leading-relaxed text-text">“{rev.comment}”</p>
                  )}

                  {rev.screenshot && (
                    <button
                      type="button"
                      onClick={() => setLightboxImg(resolveImageUrl(rev.screenshot, 1200))}
                      className="mt-3 block overflow-hidden rounded-xl border border-border"
                    >
                      <img
                        src={resolveImageUrl(rev.screenshot, 300)}
                        alt="WhatsApp review screenshot"
                        className="h-24 w-24 object-cover"
                      />
                    </button>
                  )}

                  {rev.adminReply && (
                    <div className="mt-4 rounded-xl bg-surface-muted p-3 text-xs text-text-muted border border-border">
                      <strong className="text-primary-dark">ORGION Team:</strong> {rev.adminReply}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-text">{rev.reviewerName}</span>
                    {rev.reviewerLocation && (
                      <span className="text-text-muted"> · {rev.reviewerLocation}</span>
                    )}
                    <span className="block text-text-muted mt-0.5">{formatDate(rev.reviewDate)}</span>
                  </div>
                  {rev.product && (
                    <Link
                      to={`/product/${rev.product.slug}`}
                      className="font-medium text-primary hover:underline text-right"
                    >
                      {rev.product.name}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-10 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`h-10 w-10 rounded-[10px] text-sm font-medium ${
                  p === page ? 'bg-primary text-white' : 'border border-border bg-surface text-text'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setLightboxImg(null)}
        >
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setLightboxImg(null)}
            className="absolute right-5 top-5 rounded-full bg-white/15 p-2 text-white"
          >
            <X size={22} />
          </button>
          <img
            src={lightboxImg}
            alt="Screenshot preview"
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      )}
    </>
  );
}
