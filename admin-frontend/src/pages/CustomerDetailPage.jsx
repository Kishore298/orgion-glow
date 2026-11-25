import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../lib/api';
import { formatDate, formatINR } from '../lib/format';

export default function CustomerDetailPage() {
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customer', id],
    queryFn: async () => {
      const res = await api.get(`/v1/admin/customers/${id}`);
      return res.data?.data;
    },
  });

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-text-muted">Loading customer profile...</div>;
  }

  const { customer, orders, ratingsGiven, analytics } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/customers" className="text-xs text-primary hover:underline">
          ← Back to Customers
        </Link>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-primary-dark">{customer.name}</h1>
        <p className="text-xs text-text-muted">
          {customer.mobile} · {customer.email || 'No email'} · Joined {formatDate(customer.createdAt)}
        </p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="admin-card p-5">
          <span className="label-micro">Lifetime Value</span>
          <p className="mt-2 font-sans text-2xl font-semibold tabular-nums text-primary-dark">
            {formatINR(analytics.lifetimeValue)}
          </p>
          <p className="mt-1 text-xs text-text-muted">{analytics.totalPaidOrders} paid orders</p>
        </div>
        <div className="admin-card p-5">
          <span className="label-micro">Avg Order Value</span>
          <p className="mt-2 font-sans text-2xl font-semibold tabular-nums text-primary-dark">
            {formatINR(analytics.averageOrderValue)}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Freq: {analytics.orderFrequencyDays ? `${analytics.orderFrequencyDays}d` : '—'}
          </p>
        </div>
        <div className="admin-card p-5">
          <span className="label-micro">Favorite Category</span>
          <p className="mt-2 font-serif text-xl font-semibold text-text">
            {analytics.favoriteCategory || '—'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Cancelled: {analytics.cancelledCount} · Ratings: {analytics.ratingsCount}
          </p>
        </div>
        <div className="admin-card p-5">
          <span className="label-micro">Order Span</span>
          <p className="mt-2 text-xs text-text">First: {formatDate(analytics.firstOrderDate)}</p>
          <p className="mt-1 text-xs text-text">Last: {formatDate(analytics.lastOrderDate)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 admin-card p-6">
          <h2 className="font-serif text-xl font-semibold text-text mb-4">Spend Over Time</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.spendOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECE8E1" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Bar dataKey="amount" fill="#3D6B40" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 admin-card p-6 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-text">Favorite Products & Addresses</h2>
          <div className="space-y-1.5 text-xs">
            {analytics.favoriteProducts.map((fp, i) => (
              <div key={i} className="flex justify-between">
                <span>{fp.name}</span>
                <span className="font-semibold">{fp.qty} units</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-3 space-y-2 text-xs">
            <p className="label-micro">Saved Addresses</p>
            {(customer.addresses || []).map((a) => (
              <div key={a._id} className="rounded-xl bg-surface-muted p-2.5 text-text-muted">
                <strong className="text-text">{a.fullName}</strong> ({a.type}) — {a.line1},{' '}
                {a.city}, {a.state} - {a.pincode}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Order history + Ratings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 admin-card p-6">
          <h2 className="font-serif text-xl font-semibold text-text mb-4">Order History</h2>
          <div className="space-y-2.5 text-sm">
            {orders.map((o) => (
              <Link
                key={o._id}
                to={`/orders/${o.orderNumber}`}
                className="flex items-center justify-between rounded-xl border border-border bg-surface-muted p-3 hover:border-primary"
              >
                <div>
                  <span className="font-medium text-primary">{o.orderNumber}</span>
                  <span className="ml-2 text-xs text-text-muted">{formatDate(o.createdAt)}</span>
                </div>
                <div className="text-right">
                  <span className="font-sans font-semibold tabular-nums">{formatINR(o.total)}</span>
                  <span className="ml-2 text-xs uppercase text-text-muted">{o.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 admin-card p-6">
          <h2 className="font-serif text-xl font-semibold text-text mb-4">Ratings Given</h2>
          {ratingsGiven.length === 0 ? (
            <p className="text-xs text-text-muted">No ratings submitted yet.</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {ratingsGiven.map((r) => (
                <div key={r._id} className="rounded-xl bg-surface-muted p-3">
                  <p className="font-semibold text-text">
                    {r.product?.name} · {'★'.repeat(r.rating)}
                  </p>
                  {r.comment && <p className="mt-1 text-text-muted">“{r.comment}”</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
