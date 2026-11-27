import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { SlidersHorizontal, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../lib/api';
import { formatINR } from '../lib/format';
import ProductCard from '../components/common/ProductCard';
import { ProductCardSkeleton } from '../components/common/Skeletons';
import BackButton from '../components/common/BackButton';
import { LUXURY_EASE } from '../components/common/MotionPrimitives';

export default function ShopPage() {
  const { slug: categorySlugParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const search = searchParams.get('search') || '';
  const selectedCats = categorySlugParam
    ? [categorySlugParam]
    : (searchParams.get('category') || '').split(',').filter(Boolean);
  const maxPriceParam = searchParams.get('maxPrice') || '';
  const inStockOnly = searchParams.get('inStock') === 'true';
  const sort = searchParams.get('sort') || 'featured';
  const page = Number(searchParams.get('page') || 1);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/v1/categories');
      return res.data?.data || [];
    },
  });

  const activeCategory = categorySlugParam
    ? categories.find((c) => c.slug === categorySlugParam)
    : null;

  const isShopAllGrouped = !categorySlugParam && selectedCats.length === 0;

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: [
      'products',
      {
        search,
        category: selectedCats.join(','),
        maxPrice: maxPriceParam,
        inStock: inStockOnly,
        sort,
        page: isShopAllGrouped ? 1 : page,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedCats.length) params.set('category', selectedCats.join(','));
      if (maxPriceParam) params.set('maxPrice', maxPriceParam);
      if (inStockOnly) params.set('inStock', 'true');
      if (sort) params.set('sort', sort);
      params.set('page', isShopAllGrouped ? '1' : String(page));
      params.set('limit', isShopAllGrouped ? '48' : '12');

      const res = await api.get(`/v1/products?${params.toString()}`);
      return res.data?.data;
    },
    refetchOnMount: 'always',
    retry: 2,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const catalogMaxPrice = data?.catalogMaxPrice || 2000;

  const [sliderValue, setSliderValue] = useState(
    maxPriceParam ? Number(maxPriceParam) : catalogMaxPrice
  );

  useEffect(() => {
    setSliderValue(maxPriceParam ? Number(maxPriceParam) : catalogMaxPrice);
  }, [maxPriceParam, catalogMaxPrice]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    next.set('page', '1');
    setSearchParams(next);
  };

  const toggleCategoryFilter = (catSlug) => {
    const current = new Set(selectedCats);
    if (current.has(catSlug)) current.delete(catSlug);
    else current.add(catSlug);
    updateParam('category', [...current].join(','));
  };

  const activeFilterCount =
    (categorySlugParam ? 0 : selectedCats.length) +
    (maxPriceParam ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (search ? 1 : 0);

  // Group items by category for Shop All page
  const groupedSections = (() => {
    if (!isShopAllGrouped) return [];
    const byCatId = new Map();
    for (const item of items) {
      const catId = String(item.category?._id || 'other');
      if (!byCatId.has(catId)) {
        byCatId.set(catId, {
          category: item.category || { _id: 'other', name: 'Other Formulations', slug: '' },
          products: [],
        });
      }
      byCatId.get(catId).products.push(item);
    }
    const ordered = [];
    for (const cat of categories) {
      const group = byCatId.get(String(cat._id));
      if (group && group.products.length > 0) {
        ordered.push(group);
        byCatId.delete(String(cat._id));
      }
    }
    for (const remaining of byCatId.values()) {
      ordered.push(remaining);
    }
    return ordered;
  })();

  const pageTitle = activeCategory ? activeCategory.name : 'Shop All';

  return (
    <>
      <Helmet>
        <title>{pageTitle} — ORGION</title>
        <meta
          name="description"
          content={
            activeCategory?.description ||
            'Browse ORGION homemade herbal lip care and botanical skin care essentials.'
          }
        />
      </Helmet>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-3 sm:pt-4 pb-8 sm:pb-10">
        <BackButton fallbackTo="/" label="Back" className="mb-1.5 sm:mb-2" />
        {/* Top Heading + Side-aligned Filter Bar */}
        <div className="border-b border-border pb-3.5 sm:pb-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 sm:gap-4">
            <div>
              <span className="label-micro">ORGION Collection</span>
              <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary-dark">
                {pageTitle}
              </h1>
              <p className="mt-1 max-w-xl text-xs sm:text-sm text-text-muted">
                {activeCategory?.description ||
                  'Handmade small-batch skincare and lip care crafted with carefully selected ingredients.'}
              </p>
            </div>

            {/* Filters beside heading on the top right */}
            <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
              <span className="text-xs text-text-muted mr-1">
                {total} product{total === 1 ? '' : 's'}
              </span>

              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                className={`btn-ghost min-h-[38px] px-3.5 text-xs ${filtersOpen || activeFilterCount > 0 ? 'border-primary text-primary' : ''
                  }`}
              >
                <SlidersHorizontal size={14} />
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>

              <select
                aria-label="Sort products"
                value={sort}
                onChange={(e) => updateParam('sort', e.target.value)}
                className="rounded-[10px] border border-border bg-surface px-3 h-[38px] text-xs font-medium text-text focus:border-primary focus:outline-none"
              >
                <option value="featured">Sort: Featured</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="newest">Newest</option>
                <option value="rating">Top Rated</option>
              </select>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  className="inline-flex items-center gap-1 rounded-[10px] px-2.5 h-[38px] text-xs font-medium text-text-muted hover:text-status-danger"
                >
                  <X size={13} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Expandable Top Filter Strip */}
          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: LUXURY_EASE }}
                className="overflow-hidden"
              >
                <div className="mt-5 rounded-2xl border border-border bg-surface p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {!categorySlugParam && (
                    <div className="md:col-span-5">
                      <p className="label-micro mb-2">Category</p>
                      <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => {
                          const active = selectedCats.includes(cat.slug);
                          return (
                            <button
                              key={cat._id}
                              type="button"
                              onClick={() => toggleCategoryFilter(cat.slug)}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition ${active
                                ? 'bg-primary text-white'
                                : 'border border-border bg-surface-muted text-text hover:border-primary'
                                }`}
                            >
                              {cat.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className={categorySlugParam ? 'md:col-span-7' : 'md:col-span-4'}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="label-micro">Max Price</span>
                      <span className="text-xs font-semibold tabular-nums text-primary">
                        Up to {formatINR(sliderValue)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={catalogMaxPrice}
                      step={25}
                      value={sliderValue}
                      onChange={(e) => setSliderValue(Number(e.target.value))}
                      onMouseUp={() =>
                        updateParam(
                          'maxPrice',
                          sliderValue >= catalogMaxPrice ? '' : String(sliderValue)
                        )
                      }
                      onTouchEnd={() =>
                        updateParam(
                          'maxPrice',
                          sliderValue >= catalogMaxPrice ? '' : String(sliderValue)
                        )
                      }
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>

                  <div className="md:col-span-3 flex items-center md:justify-end">
                    <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer rounded-xl border border-border bg-surface-muted px-3.5 py-2">
                      <input
                        type="checkbox"
                        checked={inStockOnly}
                        onChange={(e) => updateParam('inStock', e.target.checked ? 'true' : '')}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span>In Stock Only</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Products Display */}
        <div className="mt-4 sm:mt-5">
          {isLoading || (isFetching && items.length === 0) ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {[0, 1, 2, 3].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : isError && items.length === 0 ? (
            <div className="luxury-card py-12 px-6 text-center">
              <p className="font-serif text-xl sm:text-2xl text-text">Could not load products right now</p>
              <p className="mt-1.5 text-xs sm:text-sm text-text-muted">
                Please check your connection and try again.
              </p>
              <button type="button" onClick={() => refetch()} className="btn-primary mt-5">
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="luxury-card py-12 px-6 text-center">
              <p className="font-serif text-xl sm:text-2xl text-text">No formulations match your filters</p>
              <p className="mt-1.5 text-xs sm:text-sm text-text-muted">
                Try adjusting your price range or clearing active filters.
              </p>
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="btn-primary mt-5"
              >
                Reset Filters
              </button>
            </div>
          ) : isShopAllGrouped ? (
            <div className="space-y-6 sm:space-y-8">
              {groupedSections.map(({ category: cat, products }) => (
                <section key={cat._id}>
                  <div className="mb-3 sm:mb-4 pb-1.5 border-b border-border/70">
                    <h2 className="font-serif text-xl sm:text-2xl font-semibold text-primary-dark">
                      {cat.name}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-text-muted mt-0.5">
                      {products.length} product{products.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                    {products.map((prod) => (
                      <ProductCard key={prod._id} product={prod} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
                {items.map((prod) => (
                  <ProductCard key={prod._id} product={prod} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        const next = new URLSearchParams(searchParams);
                        next.set('page', String(p));
                        setSearchParams(next);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`h-10 w-10 rounded-[10px] text-sm font-medium transition ${p === page
                        ? 'bg-primary text-white'
                        : 'border border-border bg-surface text-text hover:bg-surface-muted'
                        }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
