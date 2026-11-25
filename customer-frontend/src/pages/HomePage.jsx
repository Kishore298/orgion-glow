import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, MessageCircle, Leaf, FlaskConical, HeartHandshake } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';
import { handleImageError, isFallbackLogo, resolveImageUrl } from '../lib/format';
import ProductCard from '../components/common/ProductCard';
import WhyUsSection from '../components/common/WhyUsSection';
import StarRating from '../components/common/StarRating';
import { ProductCardSkeleton } from '../components/common/Skeletons';
import {
  LUXURY_EASE,
  RevealSection,
  RevealStaggerGrid,
  RevealStaggerItem,
} from '../components/common/MotionPrimitives';

export default function HomePage() {
  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['categories', 'home'],
    queryFn: async () => {
      const res = await api.get('/v1/categories');
      return res.data?.data || [];
    },
  });

  const { data: bestsellersData, isLoading: prodLoading } = useQuery({
    queryKey: ['products', 'home-bestsellers'],
    queryFn: async () => {
      const res = await api.get('/v1/products?limit=4&sort=featured');
      return res.data?.data?.items || [];
    },
  });

  const { data: featuredReviewsData } = useQuery({
    queryKey: ['reviews', 'featured-home'],
    queryFn: async () => {
      const res = await api.get('/v1/reviews?featured=true&limit=6');
      return res.data?.data?.items || [];
    },
  });

  const bestsellers = bestsellersData || [];
  const featuredReviews = featuredReviewsData || [];
  const homeCategories =
    categories.filter((c) => c.isFeatured).length > 0
      ? categories.filter((c) => c.isFeatured)
      : categories;

  return (
    <>
      <Helmet>
        <title>ORGION — The Secret Glow | Herbal Lip & Skin Care</title>
        <meta
          name="description"
          content="Quiet luxury meets nature. Handcrafted herbal lip care and skin care made in small batches in India."
        />
      </Helmet>

      {/* Hero Section: Side-by-side starting from tablet (md:768px+), crisp vertical stack on mobile */}
      <section className="relative overflow-hidden bg-surface-muted/70 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 md:py-10 lg:py-14">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 lg:gap-12 items-center">
            {/* Left half: Pill, Heading, Copy, CTAs, Trust Pills */}
            <div className="md:col-span-6 text-left">
              <motion.span
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: LUXURY_EASE }}
                className="inline-block rounded-full bg-primary-soft px-3 py-1 text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.12em] text-primary-dark"
              >
                100% Herbal · Small-Batch India
              </motion.span>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.08, ease: LUXURY_EASE }}
                className="mt-3 sm:mt-4 font-serif text-3xl sm:text-4xl lg:text-6xl font-semibold tracking-tight text-primary-dark leading-[1.08]"
              >
                The Secret Glow
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.16, ease: LUXURY_EASE }}
                className="mt-3 sm:mt-4 max-w-lg text-sm md:text-base lg:text-lg leading-relaxed text-text-muted"
              >
                Quiet luxury meets nature. Handmade, chemical-free herbal skincare and lip care crafted with carefully selected ingredients in Nagercoil.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.24, ease: LUXURY_EASE }}
                className="mt-5 sm:mt-7 flex flex-row flex-wrap items-center gap-2.5 sm:gap-3.5"
              >
                <Link to="/shop" className="btn-primary flex-1 sm:flex-none px-5 sm:px-8 min-h-[40px] sm:min-h-[44px] text-xs sm:text-sm">
                  Shop Now
                </Link>
                <a
                  href="#curated-essentials"
                  className="btn-ghost flex-1 sm:flex-none px-4 sm:px-8 min-h-[40px] sm:min-h-[44px] text-xs sm:text-sm"
                >
                  Explore Collections
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.32, ease: LUXURY_EASE }}
                className="mt-5 sm:mt-7 flex flex-wrap items-center gap-2"
              >
                {[
                  { label: '100% Herbal', icon: Leaf },
                  { label: 'Chemical Free', icon: FlaskConical },
                  { label: 'Trusted by Thousands', icon: HeartHandshake },
                ].map(({ label, icon: Icon }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium text-text shadow-sm"
                  >
                    <Icon size={13} className="text-primary shrink-0" />
                    <span>{label}</span>
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Right half: Studio photograph showcasing all ORGION products */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.12, ease: LUXURY_EASE }}
              className="md:col-span-6"
            >
              <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border bg-surface shadow-soft aspect-[4/3] md:aspect-[4/3.6] lg:aspect-[5/4]">
                <img
                  src="/hero-products.jpg"
                  alt="ORGION handcrafted skincare collection: GlowX Soap, Avoglow Night Cream, and Pigment Free Lip Balm"
                  className="h-full w-full object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Curated Essentials: 2x2 compact grid on mobile */}
      <section id="curated-essentials" className="scroll-mt-24 mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-16 lg:py-20">
        <RevealSection className="flex items-end justify-between gap-4">
          <div>
            <span className="label-micro">Botanical Categories</span>
            <h2 className="mt-1 font-serif text-2xl sm:text-4xl font-semibold text-primary-dark">
              Curated Essentials
            </h2>
          </div>
          <Link
            to="/shop"
            className="text-xs sm:text-sm font-medium text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            View all <ArrowRight size={14} />
          </Link>
        </RevealSection>

        <RevealStaggerGrid className="mt-6 sm:mt-10 grid grid-cols-2 gap-3 sm:gap-6 md:gap-8 items-stretch">
          {catLoading
            ? [0, 1].map((idx) => (
                <div key={idx} className="h-44 sm:h-64 rounded-2xl sm:rounded-3xl bg-surface-muted animate-pulse" />
              ))
            : homeCategories.slice(0, 4).map((cat) => {
                const usingLogo = isFallbackLogo(cat.image);
                return (
                  <RevealStaggerItem key={cat._id}>
                    <Link
                      to={`/category/${cat.slug}`}
                      className="luxury-card group relative overflow-hidden flex h-full flex-col sm:flex-row items-stretch transition-shadow hover:shadow-md"
                    >
                      <div className="aspect-[4/3] sm:w-5/12 sm:aspect-auto overflow-hidden bg-surface-muted flex items-center justify-center">
                        <img
                          src={resolveImageUrl(cat.image, 700)}
                          alt={cat.name}
                          loading="lazy"
                          onError={handleImageError}
                          className={`h-full w-full transition-transform duration-500 group-hover:scale-105 ${
                            usingLogo ? 'object-contain p-4 sm:p-8' : 'object-cover'
                          }`}
                        />
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-3 sm:p-6 lg:p-7">
                        <div>
                          <span className="inline-block rounded-full bg-primary-soft px-2 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-medium uppercase tracking-wider text-primary-dark">
                            Collection
                          </span>
                          <h3 className="mt-1.5 sm:mt-3 font-serif text-base sm:text-2xl font-semibold text-text">
                            {cat.name}
                          </h3>
                          <p className="mt-1 sm:mt-2 text-[11px] sm:text-sm text-text-muted line-clamp-2 sm:line-clamp-3">
                            {cat.description ||
                              'Pure small-batch herbal care crafted for daily nourishment.'}
                          </p>
                        </div>
                        <span className="mt-3 sm:mt-6 inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
                          Explore <ArrowRight size={13} />
                        </span>
                      </div>
                    </Link>
                  </RevealStaggerItem>
                );
              })}
        </RevealStaggerGrid>
      </section>

      {/* Our Formulations (Equal-height compact product cards) */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-12 sm:pb-16 lg:pb-20">
        <RevealSection className="flex items-end justify-between gap-4">
          <div>
            <span className="label-micro">Most Loved Rituals</span>
            <h2 className="mt-1 font-serif text-2xl sm:text-4xl font-semibold text-primary-dark">
              Our Formulations
            </h2>
          </div>
          <Link
            to="/shop"
            className="text-xs sm:text-sm font-medium text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            Shop all <ArrowRight size={14} />
          </Link>
        </RevealSection>

        <RevealStaggerGrid className="mt-6 sm:mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 items-stretch">
          {prodLoading
            ? [0, 1, 2].map((i) => <ProductCardSkeleton key={i} />)
            : bestsellers.map((product) => (
                <RevealStaggerItem key={product._id}>
                  <ProductCard product={product} />
                </RevealStaggerItem>
              ))}
        </RevealStaggerGrid>
      </section>

      {/* Why ORGION */}
      <WhyUsSection />

      {/* Our Story Section */}
      <section id="our-story" className="scroll-mt-24 mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
        <RevealSection className="luxury-card p-5 sm:p-10 lg:p-12 bg-surface">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-center">
            <div className="md:col-span-4 flex flex-col items-center justify-center rounded-2xl bg-surface-muted p-5 sm:p-8 border border-border">
              <img
                src="/orgion-logo.png"
                alt="ORGION — The Secret Glow"
                className="h-16 sm:h-24 w-auto object-contain"
              />
              <span className="mt-3 sm:mt-4 label-micro text-center">Est. August 2023</span>
            </div>
            <div className="md:col-span-8">
              <span className="label-micro">Our Story</span>
              <h2 className="mt-1.5 font-serif text-2xl sm:text-4xl font-semibold text-primary-dark">
                About Orgion
              </h2>
              <p className="mt-3 sm:mt-4 text-xs sm:text-base leading-relaxed text-text-muted">
                Founded in August 2023 by Jenny and Vino, Orgion is a skincare brand born from a passion for creating our own skincare products. We focus on making handmade skincare products with carefully selected ingredients, love, and dedication. What started as a small business has grown into a brand serving customers across India. Our goal is to make skincare simple, accessible, and enjoyable for everyone while building trust through quality and care.
              </p>
              <Link
                to="/our-story"
                className="mt-4 sm:mt-6 inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-primary hover:underline"
              >
                Read more about our craft <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </RevealSection>
      </section>

      {/* What Our Customers Say (Featured WhatsApp Reviews) */}
      {featuredReviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-12 sm:pb-20">
          <RevealSection className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="label-micro">Real Voices</span>
              <h2 className="mt-1 font-serif text-2xl sm:text-4xl font-semibold text-primary-dark">
                What Our Customers Say
              </h2>
            </div>
            <Link
              to="/reviews"
              className="text-xs sm:text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View all reviews <ArrowRight size={14} />
            </Link>
          </RevealSection>

          <RevealStaggerGrid className="mt-6 sm:mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {featuredReviews.slice(0, 6).map((rev) => (
              <RevealStaggerItem key={rev._id}>
                <div className="luxury-card p-5 sm:p-6 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <StarRating rating={rev.rating} size={14} showValue />
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-[10px] font-medium text-primary-dark">
                        <MessageCircle size={11} />
                        Customer feedback via WhatsApp
                      </span>
                    </div>
                    <p className="mt-3 sm:mt-4 text-xs sm:text-sm leading-relaxed text-text">
                      “{rev.comment}”
                    </p>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-border text-xs">
                    <p className="font-semibold text-text">
                      {rev.reviewerName}
                      {rev.reviewerLocation ? (
                        <span className="font-normal text-text-muted"> · {rev.reviewerLocation}</span>
                      ) : null}
                    </p>
                    {rev.product && (
                      <Link
                        to={`/product/${rev.product.slug}`}
                        className="mt-1 inline-block text-primary hover:underline"
                      >
                        on {rev.product.name}
                      </Link>
                    )}
                  </div>
                </div>
              </RevealStaggerItem>
            ))}
          </RevealStaggerGrid>
        </section>
      )}
    </>
  );
}
