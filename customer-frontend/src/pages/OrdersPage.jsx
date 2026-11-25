import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Package, Truck } from 'lucide-react';
import api from '../lib/api';
import { formatDate, formatINR, handleImageError, isFallbackLogo, resolveImageUrl } from '../lib/format';
import { PageSkeleton } from '../components/common/Skeletons';

const STATUS_STYLE = {
  confirmed: 'bg-primary-soft text-primary-dark',
  processing: 'bg-amber-50 text-status-warning',
  shipped: 'bg-blue-50 text-status-info',
  out_for_delivery: 'bg-blue-50 text-status-info',
  delivered: 'bg-primary-soft text-status-success',
  cancelled: 'bg-red-50 text-status-danger',
  pending_payment: 'bg-surface-muted text-text-muted',
  expired: 'bg-surface-muted text-text-muted',
};

export default function OrdersPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', page],
    queryFn: async () => {
      const res = await api.get(`/v1/orders/mine?page=${page}&limit=10`);
      return res.data?.data;
    },
  });

  if (isLoading) return <PageSkeleton />;

  const orders = data?.items || [];
  const totalPages = data?.totalPages || 1;

  return (
    <>
      <Helmet>
        <title>My Orders — ORGION</title>
      </Helmet>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-3 sm:pt-4 pb-10">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <span className="label-micro">Order History</span>
            <h1 className="mt-0.5 font-serif text-3xl sm:text-4xl font-semibold text-primary-dark">My Orders</h1>
          </div>
          <Link to="/account" className="btn-ghost text-xs">
            Back to Account
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="luxury-card mt-6 py-16 text-center">
            <Package size={38} className="mx-auto text-sage" strokeWidth={1.3} />
            <p className="mt-4 font-serif text-2xl text-text">No orders placed yet</p>
            <Link to="/shop" className="btn-primary mt-6">
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {orders.map((order) => (
              <Link
                key={order.orderNumber}
                to={`/account/orders/${order.orderNumber}`}
                className="luxury-card block p-3.5 sm:p-5 transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text">{order.orderNumber}</p>
                    <p className="text-xs text-text-muted">{formatDate(order.createdAt)}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {order.tracking?.trackingId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-[11px] font-medium text-text border border-border">
                        <Truck size={12} className="text-primary" />
                        ST Courier: {order.tracking.trackingId}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider ${
                        STATUS_STYLE[order.status] || 'bg-surface-muted text-text-muted'
                      }`}
                    >
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <div className="flex items-center gap-2.5">
                    {(order.items || []).slice(0, 4).map((item, idx) => (
                      <img
                        key={idx}
                        src={resolveImageUrl(item.image, 150)}
                        alt={item.name}
                        onError={handleImageError}
                        className={`h-11 w-11 rounded-xl border border-border bg-surface-muted ${
                          isFallbackLogo(item.image) ? 'object-contain p-1' : 'object-cover'
                        }`}
                      />
                    ))}
                    <span className="text-xs text-text-muted">
                      {order.items.length} item{order.items.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="font-sans text-lg font-semibold tabular-nums text-primary">
                    {formatINR(order.total)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`h-9 w-9 rounded-lg text-xs font-medium ${
                  p === page ? 'bg-primary text-white' : 'border border-border bg-surface'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
