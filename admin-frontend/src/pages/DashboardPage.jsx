import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  IndianRupee,
  ShoppingBag,
  Users,
  Star,
  AlertTriangle,
  PackageX,
  ArrowRight,
  Truck,
} from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { formatDate, formatINR } from '../lib/format';

const ALLOWED_STATUS_TRANSITIONS = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  expired: ['confirmed'],
};

const CHART_COLORS = ['#3D6B40', '#C9A66B', '#9DB09A', '#2F5632', '#6B6B66', '#2B6CB0'];

function StatCard({ label, value, sub, icon: Icon }) {
  return (
    <div className="admin-card px-3.5 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon size={14} />
            </span>
          )}
          <span className="label-micro truncate">{label}</span>
        </div>
        <p className="font-sans text-lg sm:text-xl font-semibold tabular-nums text-primary-dark shrink-0">
          {value}
        </p>
      </div>
      {sub && <p className="mt-1 text-[11px] text-text-muted leading-snug">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [range, setRange] = useState('30d');
  const [granularity, setGranularity] = useState('daily');
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const handleInlineStatusChange = async (order, newStatus) => {
    if (!newStatus || newStatus === order.status) return;
    setUpdatingOrderId(order._id);
    try {
      await api.patch(`/v1/admin/orders/${order.orderNumber}/status`, { status: newStatus });
      toast.success(`${order.orderNumber} updated to ${newStatus.replace(/_/g, ' ')}`);
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard', range, granularity],
    queryFn: async () => {
      const res = await api.get(`/v1/admin/dashboard?range=${range}&granularity=${granularity}`);
      return res.data?.data;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 rounded bg-surface-muted" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-surface-muted" />
          ))}
        </div>
      </div>
    );
  }

  const { cards, charts, recentOrders, needsAttention, latestReviews } = data;
  const attentionCount =
    (needsAttention.needsReviewOrders?.length || 0) +
    (needsAttention.failedPaymentOrders?.length || 0) +
    (needsAttention.missingTrackingOrders?.length || 0) +
    (needsAttention.failedNotifications?.length || 0);

  return (
    <div className="space-y-3.5 sm:space-y-4 lg:space-y-5">
      {/* Header + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        <div>
          <span className="label-micro">Analytics & Overview</span>
          <h1 className="mt-0.5 font-serif text-xl sm:text-2xl font-semibold text-primary-dark">Dashboard</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="input-field w-auto"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>

          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value)}
            className="input-field w-auto"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      {/* Quick Link Tiles */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
        {[
          { to: '/orders', label: 'Orders' },
          { to: '/products', label: 'Products' },
          { to: '/categories', label: 'Categories' },
          { to: '/customers', label: 'Customers' },
          { to: '/reviews', label: 'Reviews' },
        ].map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="admin-card px-2.5 py-2 sm:px-3.5 sm:py-2.5 flex items-center justify-between text-xs sm:text-sm font-medium text-text hover:border-primary transition"
          >
            <span className="truncate">{q.label}</span>
            <ArrowRight size={13} className="text-primary shrink-0" />
          </Link>
        ))}
      </div>

      {/* Stat Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <StatCard
          label="Revenue (Total)"
          value={formatINR(cards.revenue.total)}
          sub={`Today: ${formatINR(cards.revenue.today)} · 7d: ${formatINR(cards.revenue.last7d)} · 30d: ${formatINR(cards.revenue.last30d)}`}
          icon={IndianRupee}
        />
        <StatCard
          label="Orders"
          value={cards.totalOrders}
          sub={`New today: ${cards.newOrdersToday} · Paid: ${cards.totalPaidOrders}`}
          icon={ShoppingBag}
        />
        <StatCard
          label="Avg Order Value"
          value={formatINR(cards.averageOrderValue)}
          sub={`Confirmed: ${cards.ordersByStatus.confirmed || 0} · Processing: ${cards.ordersByStatus.processing || 0} · Shipped: ${cards.ordersByStatus.shipped || 0} · Delivered: ${cards.ordersByStatus.delivered || 0}`}
          icon={Truck}
        />
        <StatCard
          label="Customers & Reviews"
          value={`${cards.totalCustomers} Customers`}
          sub={`+${cards.newCustomers30d} in 30d · ${cards.totalReviews} reviews (${cards.overallAverageRating} ★) · ${cards.productsOutOfStock} OOS`}
          icon={Users}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 lg:gap-5">
        <div className="admin-card p-3.5 sm:p-5">
          <h2 className="font-serif text-base sm:text-lg font-semibold text-text mb-2.5 sm:mb-3">Revenue Over Time</h2>
          <div className="h-60 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.revenueOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECE8E1" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3D6B40"
                  fill="#E3F0E6"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-card p-3.5 sm:p-5">
          <h2 className="font-serif text-base sm:text-lg font-semibold text-text mb-2.5 sm:mb-3">Orders Over Time</h2>
          <div className="h-60 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.revenueOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECE8E1" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="orders" fill="#C9A66B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5">
        <div className="admin-card p-3.5 sm:p-5">
          <h2 className="font-serif text-base sm:text-lg font-semibold text-text mb-2.5 sm:mb-3">Top-Selling Products</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.topSellingProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ECE8E1" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Bar dataKey="revenue" fill="#3D6B40" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-card p-3.5 sm:p-5 lg:p-6">
          <h2 className="font-serif text-lg sm:text-xl font-semibold text-text mb-3 sm:mb-4">Sales by Category</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.salesByCategory}
                  dataKey="revenue"
                  nameKey="category"
                  outerRadius={80}
                  label={({ category }) => category}
                >
                  {charts.salesByCategory.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-card p-3.5 sm:p-5 lg:p-6">
          <h2 className="font-serif text-lg sm:text-xl font-semibold text-text mb-3 sm:mb-4">
            Orders by State & Method
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <p className="label-micro mb-1.5">Payment Methods</p>
              <div className="flex flex-wrap gap-2">
                {charts.paymentMethodSplit.map((m) => (
                  <span
                    key={m.method}
                    className="rounded-full bg-surface-muted border border-border px-2.5 py-1 font-medium"
                  >
                    {m.method}: {m.count} ({formatINR(m.revenue)})
                  </span>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <p className="label-micro mb-1.5">Top States</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {charts.ordersByState.map((s) => (
                  <div key={s.state} className="flex justify-between">
                    <span className="text-text">{s.state}</span>
                    <span className="text-text-muted">
                      {s.orders} orders · {formatINR(s.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Needs Attention + Latest Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-5 lg:gap-6">
        <div className="lg:col-span-7 admin-card p-3.5 sm:p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-status-warning" />
              <h2 className="font-serif text-xl font-semibold text-text">
                Needs Attention ({attentionCount})
              </h2>
            </div>
            <span className="text-xs text-text-muted">
              <PackageX size={13} className="inline mr-1" />
              {cards.productsOutOfStock} out-of-stock product(s)
            </span>
          </div>

          {attentionCount === 0 ? (
            <p className="text-sm text-text-muted py-6">All caught up — no flagged items.</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {needsAttention.needsReviewOrders.map((o) => (
                <Link
                  key={o._id}
                  to={`/orders/${o.orderNumber}`}
                  className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/70 px-4 py-2.5 hover:bg-red-50"
                >
                  <div>
                    <span className="font-semibold text-status-danger">{o.orderNumber}</span>{' '}
                    <span className="text-text">· Needs Review ({o.needsReviewReason})</span>
                  </div>
                  <span className="font-sans font-medium tabular-nums text-text">{formatINR(o.total)}</span>
                </Link>
              ))}

              {needsAttention.missingTrackingOrders.map((o) => (
                <Link
                  key={o._id}
                  to={`/orders/${o.orderNumber}`}
                  className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 hover:bg-amber-50"
                >
                  <div>
                    <span className="font-semibold text-status-warning">{o.orderNumber}</span>{' '}
                    <span className="text-text">· Missing ST Courier Tracking ID ({o.status})</span>
                  </div>
                  <span className="font-medium text-text">{o.addressSnapshot?.fullName}</span>
                </Link>
              ))}

              {needsAttention.failedPaymentOrders.map((o) => (
                <Link
                  key={o._id}
                  to={`/orders/${o.orderNumber}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-muted px-4 py-2.5"
                >
                  <div>
                    <span className="font-semibold text-text">{o.orderNumber}</span>{' '}
                    <span className="text-text-muted">
                      · Failed Payment ({o.payment?.errorDescription || 'Declined'})
                    </span>
                  </div>
                  <span className="font-sans tabular-nums">{formatINR(o.total)}</span>
                </Link>
              ))}

              {needsAttention.failedNotifications.map((n) => (
                <Link
                  key={n._id}
                  to={n.order?.orderNumber ? `/orders/${n.order.orderNumber}` : '/orders'}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-muted px-4 py-2.5"
                >
                  <div>
                    <span className="font-semibold text-status-danger">
                      {n.channel.toUpperCase()} Failed
                    </span>{' '}
                    <span>
                      · {n.order?.orderNumber || 'Order'} ({n.error})
                    </span>
                  </div>
                  <span className="text-text-muted">{formatDate(n.createdAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 admin-card p-3.5 sm:p-5 lg:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="font-serif text-lg sm:text-xl font-semibold text-text">Latest Reviews</h2>
            <Link to="/reviews" className="text-xs font-medium text-primary hover:underline">
              Manage all
            </Link>
          </div>
          <div className="space-y-3">
            {latestReviews.map((r) => (
              <div key={r._id} className="rounded-xl border border-border bg-surface-muted p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-text truncate">{r.reviewerName}</span>
                    {r.status === 'pending' && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                        Pending
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-gold font-semibold shrink-0">
                    <Star size={12} className="fill-gold" /> {r.rating}
                  </span>
                </div>
                <p className="mt-1 text-text-muted line-clamp-2">{r.comment || '(No comment)'}</p>
                <p className="mt-1 text-[11px] text-primary">{r.product?.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="admin-card p-3.5 sm:p-5 lg:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="font-serif text-lg sm:text-xl font-semibold text-text">Recent Orders</h2>
          <Link to="/orders" className="text-xs font-medium text-primary hover:underline">
            View all orders
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-text-muted">
                <th className="py-2.5 pr-4">Order</th>
                <th className="py-2.5 pr-4">Date</th>
                <th className="py-2.5 pr-4">Customer</th>
                <th className="py-2.5 pr-4">Total</th>
                <th className="py-2.5 pr-4">Payment</th>
                <th className="py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentOrders.map((o) => {
                const allowedNext = ALLOWED_STATUS_TRANSITIONS[o.status] || [];
                return (
                  <tr
                    key={o._id}
                    onClick={() => navigate(`/orders/${o.orderNumber}`)}
                    className="cursor-pointer hover:bg-surface-muted/80"
                  >
                    <td className="py-3 pr-4 font-medium">
                      <Link
                        to={`/orders/${o.orderNumber}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-xs text-text-muted">{formatDate(o.createdAt)}</td>
                    <td className="py-3 pr-4">{o.addressSnapshot?.fullName}</td>
                    <td className="py-3 pr-4 font-sans font-medium tabular-nums">{formatINR(o.total)}</td>
                    <td className="py-3 pr-4 text-xs uppercase">{o.paymentStatus}</td>
                    <td className="py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                      {allowedNext.length === 0 ? (
                        <span className="uppercase">{o.status.replace(/_/g, ' ')}</span>
                      ) : (
                        <select
                          aria-label={`Change status for ${o.orderNumber}`}
                          value={o.status}
                          disabled={updatingOrderId === o._id}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleInlineStatusChange(o, e.target.value)}
                          className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-medium uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                        >
                          <option value={o.status}>{o.status.replace(/_/g, ' ')}</option>
                          {allowedNext.map((st) => (
                            <option key={st} value={st}>
                              → {st.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
