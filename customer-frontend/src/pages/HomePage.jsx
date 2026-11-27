import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Leaf, FlaskConical, HeartHandshake, X } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';
import { handleImageError, isFallbackLogo, resolveImageUrl } from '../lib/format';
import { useSiteConfig } from '../hooks/useSiteConfig';
import ProductCard from '../components/common/ProductCard';
import WhyUsSection from '../components/common/WhyUsSection';
import ReviewCard from '../components/common/ReviewCard';
import { ProductCardSkeleton } from '../components/common/Skeletons';
import {
  LUXURY_EASE,
  RevealSection,
  RevealStaggerGrid,
  RevealStaggerItem,
} from '../components/common/MotionPrimitives';

export default function HomePage() {
  const siteConfig = useSiteConfig();
  const [lightboxImg, setLightboxImg] = useState(null);
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
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 md:py-7 lg:py-9">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-7 lg:gap-9 items-center">
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
                className="mt-2.5 sm:mt-3 font-serif text-2xl sm:text-3xl lg:text-5xl font-semibold tracking-tight text-primary-dark leading-[1.08]"
              >
                The Secret Glow
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.16, ease: LUXURY_EASE }}
                className="mt-2 sm:mt-3 max-w-lg text-xs sm:text-sm lg:text-base leading-relaxed text-text-muted"
              >
                Quiet luxury meets nature. Handmade, chemical-free herbal skincare and lip care crafted with carefully selected ingredients in Nagercoil.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.24, ease: LUXURY_EASE }}
                className="mt-4 sm:mt-5 flex flex-row flex-wrap items-center gap-2.5 sm:gap-3"
              >
                <Link to="/shop" className="btn-primary flex-1 sm:flex-none px-5 sm:px-7 min-h-[38px] sm:min-h-[42px] text-xs sm:text-sm">
                  Shop Now
                </Link>
                <a
                  href="#curated-essentials"
                  className="btn-ghost flex-1 sm:flex-none px-4 sm:px-7 min-h-[38px] sm:min-h-[42px] text-xs sm:text-sm"
                >
                  Explore Collections
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.32, ease: LUXURY_EASE }}
                className="mt-4 sm:mt-5 flex flex-wrap items-center gap-2"
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
                  src={
                    siteConfig.heroImage?.url
                      ? resolveImageUrl(siteConfig.heroImage.url, 1400)
                      : '/hero-products.jpg'
                  }
                  alt={
                    siteConfig.heroImage?.alt ||
                    'ORGION handcrafted skincare collection: GlowX Soap, Avoglow Night Cream, and Pigment Free Lip Balm'
                  }
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/hero-products.jpg';
                  }}
                  className="h-full w-full object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Curated Essentials: 2x2 compact grid on mobile */}
      <section id="curated-essentials" className="scroll-mt-24 mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-9 lg:py-11">
        <RevealSection className="flex items-end justify-between gap-3">
          <div>
            <span className="label-micro">Botanical Categories</span>
            <h2 className="mt-0.5 font-serif text-xl sm:text-2xl lg:text-3xl font-semibold text-primary-dark">
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

        <RevealStaggerGrid className="mt-4 sm:mt-5 grid grid-cols-2 gap-2.5 sm:gap-4 md:gap-5 items-stretch">
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
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-7 sm:pb-10 lg:pb-12">
        <RevealSection className="flex items-end justify-between gap-3">
          <div>
            <span className="label-micro">Most Loved Rituals</span>
            <h2 className="mt-0.5 font-serif text-xl sm:text-2xl lg:text-3xl font-semibold text-primary-dark">
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

        <RevealStaggerGrid className="mt-4 sm:mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 items-stretch">
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
      <section id="our-story" className="scroll-mt-24 mx-auto max-w-5xl px-4 sm:px-6 py-7 sm:py-10 lg:py-12">
        <RevealSection className="luxury-card p-4 sm:p-6 lg:p-8 bg-surface">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-center">
            <div className="md:col-span-4 flex flex-col items-center justify-center rounded-2xl bg-surface-muted p-4 sm:p-6 border border-border">
              <img
                src="/orgion-logo.png"
                alt="ORGION — The Secret Glow"
                className="h-14 sm:h-20 w-auto object-contain"
              />
              <span className="mt-2 sm:mt-3 label-micro text-center">Est. August 2023</span>
            </div>
            <div className="md:col-span-8">
              <span className="label-micro">Our Story</span>
              <h2 className="mt-1 font-serif text-xl sm:text-2xl lg:text-3xl font-semibold text-primary-dark">
                About Orgion
              </h2>
              <p className="mt-2 sm:mt-3 text-xs sm:text-sm lg:text-base leading-relaxed text-text-muted">
                Founded in August 2023 by Jenny and Vino, Orgion is a skincare brand born from a passion for creating our own skincare products. We focus on making handmade skincare products with carefully selected ingredients, love, and dedication. What started as a small business has grown into a brand serving customers across India. Our goal is to make skincare simple, accessible, and enjoyable for everyone while building trust through quality and care.
              </p>
            </div>
          </div>
        </RevealSection>
      </section>

      {/* What Our Customers Say (Featured WhatsApp Reviews) */}
      <section id="reviews" className="scroll-mt-24 mx-auto max-w-6xl px-4 sm:px-6 pb-8 sm:pb-10 lg:pb-12">
        <RevealSection className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5">
          <div>
            <span className="label-micro">Real Voices</span>
            <h2 className="mt-0.5 font-serif text-xl sm:text-2xl lg:text-3xl font-semibold text-primary-dark">
              What Our Customers Say
            </h2>
          </div>
          <Link
            to="/reviews"
            className="btn-ghost min-h-[36px] px-3.5 text-xs sm:text-sm self-start sm:self-auto"
          >
            View all reviews <ArrowRight size={14} />
          </Link>
        </RevealSection>

        {featuredReviews.length > 0 ? (
          <RevealStaggerGrid className="mt-4 sm:mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 items-stretch">
            {featuredReviews.slice(0, 6).map((rev) => (
              <RevealStaggerItem key={rev._id}>
                <ReviewCard review={rev} onImageClick={setLightboxImg} />
              </RevealStaggerItem>
            ))}
          </RevealStaggerGrid>
        ) : (
          <div className="luxury-card mt-5 p-6 text-center text-sm text-text-muted">
            See verified ratings and feedback from ORGION patrons across India.
          </div>
        )}
      </section>

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
            alt="Customer review screenshot"
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      )}
    </>
  );
}
