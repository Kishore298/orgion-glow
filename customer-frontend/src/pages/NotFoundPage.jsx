import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Leaf } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Page Not Found — ORGION</title>
      </Helmet>
      <div className="mx-auto max-w-xl px-5 sm:px-6 py-16 sm:py-24 text-center">
        <div className="luxury-card p-8 sm:p-12">
          <img
            src="/orgion-logo.png"
            alt="ORGION — The Secret Glow"
            className="mx-auto h-14 sm:h-16 w-auto object-contain"
          />

          <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-dark">
            <Leaf size={13} className="text-primary" />
            <span>404 · Not Found</span>
          </div>

          <h1 className="mt-4 font-serif text-3xl sm:text-4xl font-semibold text-primary-dark">
            This page has wandered off
          </h1>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-text-muted">
            The botanical path you were looking for may have moved or no longer exists. Explore our handmade herbal skincare and lip care instead.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/" className="btn-primary w-full sm:w-auto">
              Back to Home
            </Link>
            <Link to="/shop" className="btn-ghost w-full sm:w-auto">
              Shop Now
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
