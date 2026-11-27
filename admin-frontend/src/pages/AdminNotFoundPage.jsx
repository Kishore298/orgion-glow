import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';

export default function AdminNotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:py-24 text-center">
      <div className="admin-card p-8 sm:p-10">
        <img
          src="/orgion-logo.png"
          alt="ORGION — The Secret Glow"
          className="mx-auto h-14 w-auto object-contain"
        />

        <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-primary-dark">
          <Leaf size={13} className="text-primary" />
          <span>404 · Not Found</span>
        </div>

        <h1 className="mt-4 font-serif text-3xl font-semibold text-primary-dark">
          This page has wandered off
        </h1>
        <p className="mt-2.5 text-sm text-text-muted">
          The admin console route you requested doesn’t exist or may have moved.
        </p>

        <div className="mt-6">
          <Link to="/" className="btn-primary w-full sm:w-auto">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
