import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Search, AlertTriangle, Truck, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { formatDate, formatINR } from '../lib/format';
import { printOrderInvoices, printOrderLabels } from '../lib/printDocuments';

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

const STATUS_BADGE_CLASS = {
  pending_payment: 'bg-surface-muted text-text-muted border-border',
  confirmed: 'bg-primary-soft text-primary-dark border-primary/20',
  processing: 'bg-amber-50 text-status-warning border-amber-200',
  shipped: 'bg-blue-50 text-status-info border-blue-200',
  out_for_delivery: 'bg-blue-50 text-status-info border-blue-200',
  delivered: 'bg-primary-soft text-status-success border-primary/25',
  cancelled: 'bg-red-50 text-status-danger border-red-200',
  expired: 'bg-surface-muted text-text-muted border-border',
};

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [state, setState] = useState('');
  const [missingTracking, setMissingTracking] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);

  const buildQueryString = (extra = {}) => {
    const params = new URLSearchParams({ page: String(page), limit: '20', ...extra });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (paymentStatus) params.set('paymentStatus', paymentStatus);
    if (state) params.set('state', state);
    if (missingTracking) params.set('missingTracking', 'true');
    if (needsReview) params.set('needsReview', 'true');
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  };

  const { data, isLoading } = useQuery({
    queryKey: [
      'admin-orders',
      search,
      status,
      paymentStatus,
      state,
      missingTracking,
      needsReview,
      from,
      to,
      page,
    ],
    queryFn: async () => {
      const res = await api.get(`/v1/admin/orders?${buildQueryString()}`);
      return res.data?.data;
    },
  });

  const handleExportCsv = async () => {
    const res = await api.get(`/v1/admin/orders?${buildQueryString({ export: 'csv' })}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orgion-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInlineStatusChange = async (order, newStatus) => {
    if (!newStatus || newStatus === order.status) return;
    setUpdatingOrderId(order._id);
    try {
      await api.patch(`/v1/admin/orders/${order.orderNumber}/status`, { status: newStatus });
      toast.success(`${order.orderNumber} updated to ${newStatus.replace(/_/g, ' ')}`);
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const orders = data?.items || [];
  const totalPages = data?.totalPages || 1;
  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o._id));
  const allOnPageSelected =
    orders.length > 0 && orders.every((o) => selectedOrderIds.includes(o._id));

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrderIds(orders.map((o) => o._id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        <div>
          <span className="label-micro">Fulfilment</span>
          <h1 className="mt-0.5 font-serif text-xl sm:text-2xl font-semibold text-primary-dark">Orders</h1>
        </div>
        <button type="button" onClick={handleExportCsv} className="btn-ghost text-xs">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="admin-card p-2.5 sm:p-4 space-y-2 sm:space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          <div className="relative col-span-2 lg:col-span-2">
            <Search size={14} className="absolute left-2.5 sm:left-3 top-2.5 sm:top-3 text-text-muted" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Order no, customer, mobile, tracking..."
              className="input-field pl-8 sm:pl-9"
            />
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="input-field"
          >
            <option value="">All Statuses</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>

          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
            className="input-field"
          >
            <option value="">All Successful Payments</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="partially_refunded">Partially Refunded</option>
            <option value="refunded">Refunded</option>
            <option value="expired">Expired</option>
          </select>

          <input
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
            placeholder="State (e.g. Tamil Nadu)"
            className="input-field col-span-2 lg:col-span-1"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] sm:text-xs pt-0.5">
          <div className="flex flex-1 sm:flex-initial items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-text-muted shrink-0">From:</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input-field flex-1 min-w-0 sm:w-auto py-1 text-[11px] sm:text-xs"
            />
            <span className="text-text-muted shrink-0">To:</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input-field flex-1 min-w-0 sm:w-auto py-1 text-[11px] sm:text-xs"
            />
          </div>

          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={missingTracking}
              onChange={(e) => {
                setMissingTracking(e.target.checked);
                setPage(1);
              }}
              className="rounded text-primary"
            />
            <span>Missing tracking ID</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={needsReview}
              onChange={(e) => {
                setNeedsReview(e.target.checked);
                setPage(1);
              }}
              className="rounded text-primary"
            />
            <span>Needs review only</span>
          </label>
        </div>
      </div>

      {/* Bulk print toolbar when orders selected */}
      {selectedOrders.length > 0 && (
        <div className="admin-card px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-primary-soft/50 border-primary/25">
          <span className="text-xs font-semibold text-primary-dark">
            {selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => printOrderLabels(selectedOrders)}
              className="btn-primary min-h-[34px] px-3 text-xs"
            >
              <Printer size={14} /> Print Labels (3×6)
            </button>
            <button
              type="button"
              onClick={() => printOrderInvoices(selectedOrders)}
              className="btn-ghost min-h-[34px] px-3 text-xs bg-surface"
            >
              <Printer size={14} /> Print Invoices (3×6)
            </button>
            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="text-xs text-text-muted hover:text-text px-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-surface-muted border-b border-border text-[10.5px] sm:text-[11px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-3 py-2.5 sm:py-3 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all orders"
                    checked={allOnPageSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="rounded text-primary cursor-pointer"
                  />
                </th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Order</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Date</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Customer</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Items</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Total</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Payment</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Status</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">ST Courier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                    No matching orders.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const allowedNext = ALLOWED_STATUS_TRANSITIONS[o.status] || [];
                  const isSelected = selectedOrderIds.includes(o._id);
                  return (
                    <tr
                      key={o._id}
                      onClick={() => navigate(`/orders/${o.orderNumber}`)}
                      className={`cursor-pointer transition-colors hover:bg-surface-muted/80 ${
                        o.needsReview ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td
                        className="px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select order ${o.orderNumber}`}
                          checked={isSelected}
                          onChange={() => toggleSelectOne(o._id)}
                          className="rounded text-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <Link
                          to={`/orders/${o.orderNumber}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline"
                        >
                          {o.orderNumber}
                        </Link>
                        {o.needsReview && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-status-danger">
                            <AlertTriangle size={10} /> Review
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">{formatDate(o.createdAt)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-text">{o.addressSnapshot?.fullName}</p>
                        <p className="text-xs text-text-muted">{o.addressSnapshot?.mobile}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {o.items.reduce((s, i) => s + i.qty, 0)} items
                      </td>
                      <td className="px-4 py-3 font-sans font-semibold tabular-nums text-text">
                        {formatINR(o.total)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="uppercase font-medium">{o.paymentStatus}</span>
                        {o.payment?.method && (
                          <span className="block text-[11px] text-text-muted uppercase">
                            {o.payment.method}
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {allowedNext.length === 0 ? (
                          <span
                            className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase ${
                              STATUS_BADGE_CLASS[o.status] || 'bg-surface-muted text-text-muted border-border'
                            }`}
                          >
                            {o.status.replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <select
                            aria-label={`Change status for ${o.orderNumber}`}
                            value={o.status}
                            disabled={updatingOrderId === o._id}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleInlineStatusChange(o, e.target.value)}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer ${
                              STATUS_BADGE_CLASS[o.status] || 'bg-surface text-text border-border'
                            }`}
                          >
                            <option value={o.status}>
                              {o.status.replace(/_/g, ' ')}
                            </option>
                            {allowedNext.map((st) => (
                              <option key={st} value={st} className="bg-surface text-text">
                                → {st.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {o.tracking?.trackingId ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 font-mono text-[11px] text-primary-dark">
                            <Truck size={11} /> {o.tracking.trackingId}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
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
  );
}
