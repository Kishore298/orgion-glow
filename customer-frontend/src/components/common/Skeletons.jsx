import React from 'react';

export function ProductCardSkeleton() {
  return (
    <div className="luxury-card overflow-hidden animate-pulse">
      <div className="aspect-[4/4.2] bg-surface-muted" />
      <div className="p-5 space-y-3">
        <div className="flex justify-between gap-4">
          <div className="h-5 w-2/3 rounded bg-surface-muted" />
          <div className="h-5 w-14 rounded bg-surface-muted" />
        </div>
        <div className="h-4 w-full rounded bg-surface-muted" />
        <div className="h-4 w-1/2 rounded bg-surface-muted" />
        <div className="h-11 w-full rounded-[10px] bg-surface-muted mt-2" />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 animate-pulse space-y-6">
      <div className="h-10 w-64 rounded bg-surface-muted" />
      <div className="h-4 w-96 rounded bg-surface-muted" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
        <ProductCardSkeleton />
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </div>
    </div>
  );
}
