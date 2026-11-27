import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Leaf,
  Minus,
  Plus,
  ShoppingBag,
  MessageCircle,
  BadgeCheck,
  X,
  ZoomIn,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import {
  formatINR,
  formatDate,
  handleImageError,
  isFallbackLogo,
  resolveImageUrl,
} from '../lib/format';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { useSiteConfig } from '../hooks/useSiteConfig';
import StarRating from '../components/common/StarRating';
import ProductCard from '../components/common/ProductCard';
import { showAddedToCartToast } from '../components/common/CartToast';
import BackButton from '../components/common/BackButton';
import WhatsAppButton from '../components/common/WhatsAppButton';
import { PageSkeleton } from '../components/common/Skeletons';

function AccordionItem({ title, isOpen, onToggle, children }) {
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-3 text-left"
      >
        <span className="font-serif text-base sm:text-lg font-medium text-text">{title}</span>
        <ChevronDown
          size={18}
          className={`text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-3.5 text-sm leading-relaxed text-text-muted">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const user = useAuthStore((s) => s.user);
  const addItem = useCartStore((s) => s.addItem);
  const siteConfig = useSiteConfig();

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [qty, setQty] = useState(1);
  const [openAccordion, setOpenAccordion] = useState('benefits');
  const [reviewSort, setReviewSort] = useState('newest');
  const [reviewPage, setReviewPage] = useState(1);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [adding, setAdding] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const res = await api.get(`/v1/products/${slug}`);
      return res.data?.data;
    },
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['product-reviews', slug, reviewSort, reviewPage],
    enabled: Boolean(product),
    queryFn: async () => {
      const res = await api.get(
        `/v1/products/${slug}/reviews?sort=${reviewSort}&page=${reviewPage}&limit=6`
      );
      return res.data?.data;
    },
  });

  useEffect(() => {
    setSelectedImageIdx(0);
    setQty(1);
    setReviewPage(1);
  }, [product?._id]);

  if (isLoading) return <PageSkeleton />;
  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-primary-dark">Product not found</h1>
        <Link to="/shop" className="btn-primary mt-6">
          Back to Shop
        </Link>
      </div>
    );
  }

  const images = product.images?.length ? product.images : [{ url: '' }];
  const activeImg = images[selectedImageIdx]?.url || images[0]?.url || '';
  const usingLogoFallback = isFallbackLogo(activeImg);

  const hasPrice = Number(product.price || 0) > 0;
  const canPurchase = product.inStock && hasPrice;

  const related = (product.relatedProducts || []).slice(0, 4);

  const handleAddToBag = async () => {
    if (!canPurchase || adding) return;
    setAdding(true);
    try {
      await addItem(product, qty, Boolean(user), false);
      showAddedToCartToast({ product, qty });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not add item');
    } finally {
      setAdding(false);
    }
  };

  const reviewSummary = reviewsData?.summary || {
    ratingAvg: product.ratingAvg || 0,
    ratingCount: product.ratingCount || 0,
    ratingBreakdown: product.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
  const reviews = reviewsData?.items || [];
  const totalReviewPages = reviewsData?.totalPages || 1;

  const descriptionParagraphs = String(product.description || product.shortDescription || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Dynamic SEO derived directly from product fields
  const dynamicSeoTitle = `${product.name}${product.category?.name ? ` | ${product.category.name}` : ''} — ORGION`;
  const dynamicSeoDescription =
    product.shortDescription ||
    String(product.description || '').replace(/\s+/g, ' ').slice(0, 158) ||
    `${product.name} handmade herbal skincare by ORGION.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: images.map((i) => resolveImageUrl(i.url, 900)),
    description: dynamicSeoDescription,
    brand: { '@type': 'Brand', name: 'ORGION' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: product.price,
      availability: canPurchase
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    ...(product.ratingCount > 0
      ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: product.ratingAvg,
          reviewCount: product.ratingCount,
        },
      }
      : {}),
  };

  return (
    <>
      <Helmet>
        <title>{dynamicSeoTitle}</title>
        <meta name="description" content={dynamicSeoDescription} />
        <meta property="og:title" content={dynamicSeoTitle} />
        <meta property="og:description" content={dynamicSeoDescription} />
        <meta property="og:image" content={resolveImageUrl(activeImg, 900)} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-3 sm:pt-4 pb-10 sm:pb-12">
        <BackButton fallbackTo="/shop" label="Back" />
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="label-micro flex items-center gap-2 mb-4 sm:mb-5">
          <Link to="/shop" className="hover:text-primary">Shop</Link>
          <span>/</span>
          {product.category && (
            <>
              <Link to={`/category/${product.category.slug}`} className="hover:text-primary">
                {product.category.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-text">{product.name}</span>
        </nav>

        {/* Main 2-col product layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
          {/* Gallery */}
          <div className="lg:col-span-6 space-y-3">
            <div
              onClick={() => !usingLogoFallback && setZoomed((z) => !z)}
              className={`group relative aspect-square overflow-hidden rounded-3xl border border-border bg-surface-muted flex items-center justify-center ${usingLogoFallback ? '' : 'cursor-zoom-in'
                }`}
            >
              <img
                src={resolveImageUrl(activeImg, 1000)}
                alt={product.name}
                onError={handleImageError}
                className={`h-full w-full transition-transform duration-500 ${usingLogoFallback
                  ? 'object-contain p-16'
                  : `object-cover ${zoomed ? 'scale-125' : 'group-hover:scale-105'}`
                  }`}
              />
              {!usingLogoFallback && (
                <span className="absolute bottom-3 right-3 rounded-full bg-surface/85 p-2 text-text-muted shadow-sm">
                  <ZoomIn size={16} />
                </span>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedImageIdx(idx);
                      setZoomed(false);
                    }}
                    className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${idx === selectedImageIdx
                      ? 'border-primary'
                      : 'border-border opacity-75 hover:opacity-100'
                      }`}
                  >
                    <img
                      src={resolveImageUrl(img.url, 300)}
                      alt={`${product.name} view ${idx + 1}`}
                      onError={handleImageError}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="lg:col-span-6">
            <div className="flex flex-wrap items-center gap-2">
              {product.isBestseller && (
                <span className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-primary-dark">
                  Bestseller
                </span>
              )}
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider ${!hasPrice
                  ? 'bg-surface-muted text-text-muted border border-border'
                  : product.inStock
                    ? 'bg-primary-soft text-status-success'
                    : 'bg-surface-muted text-status-danger'
                  }`}
              >
                {!hasPrice ? 'Coming Soon' : product.inStock ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>

              <h1 className="mt-2.5 font-serif text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary-dark leading-tight">
                {product.name}
              </h1>

                <div className="mt-1.5 flex items-center gap-3">
                  <a href="#reviews-section" className="hover:opacity-80">
                    <StarRating
                      rating={reviewSummary.ratingAvg}
                      count={reviewSummary.ratingCount}
                      showValue
                    />
                  </a>
                  {product.weight ? (
                    <span className="text-xs text-text-muted">Net Weight: {product.weight}g</span>
                  ) : null}
                </div>

                  <div className="mt-2.5 flex items-baseline gap-2.5 font-sans">
                    {hasPrice ? (
                <>
                          <span className="text-2xl sm:text-[28px] font-semibold tabular-nums text-primary">
                            {formatINR(product.price)}
                          </span>
                          {product.mrp && product.mrp > product.price && (
                              <span className="text-sm sm:text-base tabular-nums text-text-muted line-through">
                                {formatINR(product.mrp)}
                              </span>
                  )}
                            </>
                          ) : (
                            <span className="text-base sm:text-lg font-medium text-text-muted">
                              Price & full details coming soon
                            </span>
              )}
                          </div>

                            <div className="mt-2.5 space-y-2 text-sm sm:text-[15px] leading-relaxed text-text-muted">
                              {descriptionParagraphs.map((para, i) => (
                                <p key={i}>{para}</p>
                              ))}
                            </div>

                            {siteConfig.freeShippingThreshold !== null &&
                              siteConfig.freeShippingThreshold !== undefined && (
                                  <p className="mt-2 text-xs text-primary font-medium">
                                    Complimentary shipping on orders above{' '}
                                    {formatINR(siteConfig.freeShippingThreshold)}
                                  </p>
              )}

                                  {/* Qty + Add to Bag */}
                                      <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
                                        <div className="inline-flex h-11 items-center justify-between rounded-[10px] border border-border bg-surface px-2 sm:w-32">
                                          <button
                                            type="button"
                                            aria-label="Decrease quantity"
                                            disabled={!canPurchase || qty <= 1}
                                            onClick={() => setQty((q) => Math.max(1, q - 1))}
                                            className="p-2 text-text-muted hover:text-text disabled:opacity-40"
                                          >
                                            <Minus size={16} />
                                          </button>
                                          <span className="text-sm font-semibold">{qty}</span>
                                          <button
                                            type="button"
                                            aria-label="Increase quantity"
                                            disabled={!canPurchase || qty >= 20}
                                            onClick={() => setQty((q) => Math.min(20, q + 1))}
                                            className="p-2 text-text-muted hover:text-text disabled:opacity-40"
                                          >
                                            <Plus size={16} />
                                          </button>
                                        </div>

                                        <button
                                          type="button"
                                          disabled={!canPurchase || adding}
                                          onClick={handleAddToBag}
                                          className="btn-primary flex-1 h-11 text-sm sm:text-base font-sans"
                                        >
                                          <ShoppingBag size={17} />
                                          {!product.inStock
                                            ? 'Currently unavailable'
                                            : !hasPrice
                                              ? 'Coming Soon'
                                              : adding
                                                ? 'Adding...'
                                                : `Add to Bag — ${formatINR(product.price * qty)}`}
                                        </button>
                                      </div>

                                      {/* Accordions: Key Benefits, Key Ingredients, How to Use */}
                                        <div className="mt-5 border-t border-border">
                                          {product.benefits?.length > 0 && (
                                            <AccordionItem
                                              title="Key Benefits"
                                              isOpen={openAccordion === 'benefits'}
                                              onToggle={() =>
                                                setOpenAccordion(openAccordion === 'benefits' ? '' : 'benefits')
                                              }
                                            >
                                              <ul className="space-y-2">
                                                {product.benefits.map((b, i) => (
                                                  <li key={i} className="flex items-start gap-2.5">
                                                    <Leaf size={15} className="mt-0.5 shrink-0 text-primary" />
                                                    <span>{b}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </AccordionItem>
                                          )}

                                          {product.keyIngredients?.length > 0 && (
                                            <AccordionItem
                                              title="Key Ingredients"
                                              isOpen={openAccordion === 'ingredients'}
                                              onToggle={() =>
                                                setOpenAccordion(openAccordion === 'ingredients' ? '' : 'ingredients')
                                              }
                                            >
                                              <div className="flex flex-wrap gap-2">
                                                {product.keyIngredients.map((ing, i) => (
                                                  <span
                                                    key={i}
                                                    className="rounded-full border border-border bg-surface-muted px-3 py-1 text-xs text-text"
                                                  >
                                                    {ing}
                                                  </span>
                                                ))}
                                              </div>
                                            </AccordionItem>
                                          )}

                                          {product.howToUse && (
                                            <AccordionItem
                                              title="How to Use"
                                              isOpen={openAccordion === 'ritual'}
                                              onToggle={() =>
                                                setOpenAccordion(openAccordion === 'ritual' ? '' : 'ritual')
                                              }
                                            >
                                              <p>{product.howToUse}</p>
                                            </AccordionItem>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Product-level Reviews & Ratings */}
                                      <section id="reviews-section" className="mt-7 sm:mt-10 pt-5 sm:pt-7 border-t border-border">
                                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                                          <div>
                                            <span className="label-micro">Verified Feedback</span>
                                            <h2 className="mt-0.5 font-serif text-xl sm:text-2xl lg:text-3xl font-semibold text-primary-dark">
                                              Customer Reviews
                                            </h2>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <label htmlFor="review-sort" className="text-xs text-text-muted">
                                              Sort:
                                            </label>
                                            <select
                                              id="review-sort"
                                              value={reviewSort}
                                              onChange={(e) => {
                                                setReviewSort(e.target.value);
                                                setReviewPage(1);
                                              }}
                                              className="rounded-[10px] border border-border bg-surface px-3 py-2 text-xs text-text"
                                            >
                                              <option value="newest">Newest</option>
                                              <option value="highest">Highest Rating</option>
                                              <option value="lowest">Lowest Rating</option>
                                            </select>
                                          </div>
                                        </div>

                                        <div className="mt-4 sm:mt-6 grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 rounded-2xl sm:rounded-3xl border border-border bg-surface p-4 sm:p-6">
                                          <div className="md:col-span-4 flex flex-col justify-center items-center text-center border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-5">
                                            <span className="font-sans text-4xl sm:text-5xl font-semibold tabular-nums text-primary">
                                              {Number(reviewSummary.ratingAvg || 0).toFixed(1)}
                                            </span>
                                            <div className="mt-2">
                                              <StarRating rating={reviewSummary.ratingAvg} size={18} />
                                            </div>
                                            <p className="mt-2 text-xs text-text-muted">
                                              Based on {reviewSummary.ratingCount} review{reviewSummary.ratingCount === 1 ? '' : 's'}
                                            </p>
                                          </div>

                                          <div className="md:col-span-8 space-y-2.5 flex flex-col justify-center">
                                            {[5, 4, 3, 2, 1].map((star) => {
                                              const count = reviewSummary.ratingBreakdown?.[star] || 0;
                                              const pct =
                                                reviewSummary.ratingCount > 0
                                                  ? Math.round((count / reviewSummary.ratingCount) * 100)
                                                  : 0;
                                              return (
                                                <div key={star} className="flex items-center gap-3 text-xs">
                                                  <span className="w-10 text-right font-medium text-text">{star} ★</span>
                                                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                                                    <div
                                                      className="h-full rounded-full bg-gold transition-all"
                                                      style={{ width: `${pct}%` }}
                                                    />
                                                  </div>
                                                  <span className="w-10 text-text-muted">{count}</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>

                                        <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
                                          {reviews.length === 0 ? (
                                            <p className="py-8 text-center text-xs sm:text-sm text-text-muted">
                                              No reviews yet for this formulation.
                                            </p>
                                          ) : (
                                            reviews.map((rev) => (
                                              <div key={rev._id} className="luxury-card p-4 sm:p-5">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                  <div className="flex items-center gap-3">
                                                    <StarRating rating={rev.rating} size={15} showValue />
                                                    <span className="font-semibold text-sm text-text">{rev.reviewerName}</span>
                                                    {rev.reviewerLocation && (
                                                      <span className="text-xs text-text-muted">· {rev.reviewerLocation}</span>
                                                    )}
                                                  </div>

                                                  <div className="flex items-center gap-2">
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
                                                    <span className="text-xs text-text-muted">{formatDate(rev.reviewDate)}</span>
                                                  </div>
                                                </div>

                                                {rev.comment && (
                                                  <p className="mt-3 text-sm leading-relaxed text-text">{rev.comment}</p>
                                                )}

                                                {rev.screenshot && (
                                                  <button
                                                    type="button"
                                                    onClick={() => setLightboxImg(resolveImageUrl(rev.screenshot, 1200))}
                                                    className="mt-3 block overflow-hidden rounded-xl border border-border hover:opacity-90"
                                                  >
                                                    <img
                                                      src={resolveImageUrl(rev.screenshot, 300)}
                                                      alt="Customer WhatsApp feedback screenshot"
                                                      className="h-24 w-24 object-cover"
                                                    />
                                                  </button>
                                                )}

                                                {rev.adminReply && (
                                                  <div className="mt-4 rounded-xl bg-surface-muted p-3.5 text-xs text-text-muted border border-border">
                                                    <span className="font-semibold text-primary-dark">ORGION Team: </span>
                                                    {rev.adminReply}
                                                  </div>
                                                )}
                                              </div>
                                            ))
                                          )}
                                        </div>

                                        {totalReviewPages > 1 && (
                                          <div className="mt-6 flex justify-center gap-2">
                                            {Array.from({ length: totalReviewPages }, (_, i) => i + 1).map((p) => (
                                              <button
                                                key={p}
                                                type="button"
                                                onClick={() => setReviewPage(p)}
                                                className={`h-9 w-9 rounded-lg text-xs font-medium ${p === reviewPage
                                                  ? 'bg-primary text-white'
                                                  : 'border border-border bg-surface text-text'
                                                  }`}
                                              >
                                                {p}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </section>

                                      {/* Explore Other Collection */}
                                      {related.length > 0 && (
                                            <section className="mt-7 sm:mt-10">
                                              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-primary-dark">
                                                Explore Other Collection
                                              </h2>
                                                <div className="mt-3 sm:mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 items-stretch">
                                                  {related.map((rp) => (
                                                    <ProductCard key={rp._id} product={rp} />
                                                  ))}
                                                </div>
                                            </section>
        )}
                                          </div>

                                          {/* Screenshot Lightbox */}
                                          {lightboxImg && (
                                            <div
                                              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
                                              onClick={() => setLightboxImg(null)}
                                            >
                                              <button
                                                type="button"
                                                aria-label="Close image"
                                                onClick={() => setLightboxImg(null)}
                                                className="absolute right-5 top-5 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
                                              >
                                                <X size={22} />
                                              </button>
                                              <img
                                                src={lightboxImg}
                                                alt="Review screenshot preview"
                                                className="max-h-[85vh] max-w-full rounded-2xl object-contain"
                                              />
                                            </div>
                                          )}

                                          <WhatsAppButton productName={product.name} />
                                        </>
                                      );
}
