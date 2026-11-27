import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Sparkles, Tag } from 'lucide-react';
import api from '../lib/api';
import ProductCard from '../components/common/ProductCard';
import { ProductCardSkeleton } from '../components/common/Skeletons';
import BackButton from '../components/common/BackButton';

export default function OffersPage() {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products', { offer: true }],
    queryFn: async () => {
      const res = await api.get('/v1/products?offer=true&limit=48&sort=featured');
      return res.data?.data;
    },
    refetchOnMount: 'always',
    retry: 2,
  });

  const items = data?.items || [];
  const showLoading = isLoading || (isFetching && items.length === 0);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-3 sm:pt-4 pb-8 sm:pb-10">
      <Helmet>
        <title>Special Offers — ORGION</title>
        <meta
          name="description"
          content="Explore curated offers on ORGION homemade herbal soaps, night creams, and botanical lip balms."
        />
      </Helmet>

      {/* Header */}
      <BackButton fallbackTo="/" label="Back" className="mb-1.5 sm:mb-2" />
      <div className="mb-4 sm:mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-3.5 sm:pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 sm:px-3 py-0.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-primary mb-1.5">
            <Tag size={12} /> Curated Offers
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-text">
            Special Offers
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-text-muted max-w-xl">
            Small-batch botanical favourites available on special seasonal offer.
          </p>
        </div>

        <Link
          to="/shop"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0"
        >
          Browse all products <ArrowRight size={15} />
        </Link>
      </div>

      {/* Product grid */}
      {showLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="luxury-card mx-auto max-w-lg px-4 sm:px-6 py-8 sm:py-12 text-center space-y-2.5 sm:space-y-3">
          <div className="mx-auto flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Sparkles size={20} />
          </div>
          <h2 className="font-serif text-lg sm:text-xl font-semibold text-text">
            New offers arriving soon
          </h2>
          <p className="text-xs sm:text-sm text-text-muted">
            We are crafting our next batch of seasonal specials. Meanwhile, explore our full botanical range.
          </p>
          <div className="pt-1.5 sm:pt-2">
            <Link to="/shop" className="btn-primary inline-flex items-center gap-2">
              Shop All Products <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
          {items.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
