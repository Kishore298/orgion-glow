import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { X } from 'lucide-react';
import api from '../lib/api';
import ReviewCard from '../components/common/ReviewCard';
import BackButton from '../components/common/BackButton';

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

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-3 sm:pt-4 pb-8 sm:pb-10">
        <BackButton fallbackTo="/" label="Back" className="mb-1.5 sm:mb-2" />
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border pb-3.5 sm:pb-4">
          <div>
            <span className="label-micro">Community Love</span>
            <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-semibold text-primary-dark">
              Customer Reviews
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-text-muted">
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
          <div className="mt-4 sm:mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-36 rounded-2xl bg-surface-muted animate-pulse" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-muted">No reviews found for this selection.</div>
        ) : (
          <div className="mt-4 sm:mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-stretch">
            {reviews.map((rev) => (
              <ReviewCard
                key={rev._id}
                review={rev}
                showDate
                onImageClick={setLightboxImg}
              />
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
                className={`h-10 w-10 rounded-[10px] text-sm font-medium ${p === page ? 'bg-primary text-white' : 'border border-border bg-surface text-text'
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
          className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-black/75 p-4"
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
