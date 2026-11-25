import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Mail,
  RefreshCw,
  Truck,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { formatDateTime, formatINR, resolveImageUrl } from '../lib/format';
import { useAdminAuthStore } from '../stores/adminAuthStore';

const NEXT_STATUS_OPTIONS = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  expired: ['confirmed'],
};

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const adminUser = useAdminAuthStore((s) => s.user);

  const [trackingInput, setTrackingInput] = useState('');
  const [alsoMarkShipped, setAlsoMarkShipped] = useState(true);
  const [savingTracking, setSavingTracking] = useState(false);

  const [nextStatus, setNextStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [notes, setNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refunding, setRefunding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-order', id],
    queryFn: async () => {
      const res = await api.get(`/v1/admin/orders/${id}`);
      return res.data?.data;
    },
  });

  const order = data?.order;
  const notificationLogs = data?.notificationLogs || [];
  const stCourierTrackingUrl = data?.stCourierTrackingUrl;

  useEffect(() => {
    if (order) {
      setTrackingInput(order.tracking?.trackingId || '');
      setAlsoMarkShipped(['confirmed', 'processing'].includes(order.status));
      setNotes(order.notes || '');
      const allowed = NEXT_STATUS_OPTIONS[order.status] || [];
      setNextStatus(allowed[0] || '');
    }
  }, [order?._id, order?.status, order?.tracking?.trackingId]);

  if (isLoading || !order) {
    return <div className="p-6 text-sm text-text-muted">Loading order details...</div>;
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-order', id] });

  const handleSaveTracking = async (e) => {
    e.preventDefault();
    setSavingTracking(true);
    try {
      const res = await api.patch(`/v1/admin/orders/${order._id}/tracking`, {
        trackingId: trackingInput,
        alsoMarkShipped:
          ['confirmed', 'processing'].includes(order.status) && alsoMarkShipped,
      });
      toast.success(res.data?.message || 'Tracking updated');
      setTimeout(invalidate, 350);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingTracking(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!nextStatus) return;
    setUpdatingStatus(true);
    try {
      await api.patch(`/v1/admin/orders/${order._id}/status`, {
        status: nextStatus,
        note: statusNote,
      });
      toast.success('Order status updated');
      setStatusNote('');
      setTimeout(invalidate, 350);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveNotes = async (clearReview = false) => {
    try {
      await api.patch(`/v1/admin/orders/${order._id}/notes`, {
        notes,
        ...(clearReview ? { needsReview: false } : {}),
      });
      toast.success(clearReview ? 'Marked as reviewed' : 'Notes saved');
      invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRefund = async (e) => {
    e.preventDefault();
    setRefunding(true);
    try {
      await api.post(`/v1/admin/orders/${order._id}/refund`, {
        amount: refundAmount ? Number(refundAmount) : undefined,
        reason: refundReason,
      });
      toast.success('Refund initiated');
      setShowRefundModal(false);
      invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRefunding(false);
    }
  };

  const handleDownloadInvoice = async () => {
    const res = await api.get(`/v1/admin/orders/${order._id}/invoice`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ORGION-Invoice-${order.orderNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResendConfirmation = async () => {
    try {
      await api.post(`/v1/admin/orders/${order._id}/resend-confirmation`);
      toast.success('Confirmation email queued');
      setTimeout(invalidate, 400);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleResendLog = async (logId) => {
    try {
      const res = await api.post(`/v1/admin/orders/${order._id}/notifications/${logId}/resend`);
      toast.success(res.data?.message || 'Resent');
      invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const latestTrackEmail = notificationLogs.find(
    (l) => l.event === 'TRACKING_UPDATED' && l.channel === 'email'
  );
  const latestTrackPush = notificationLogs.find(
    (l) => l.event === 'TRACKING_UPDATED' && l.channel === 'push'
  );

  const allowedNext = NEXT_STATUS_OPTIONS[order.status] || [];
  const addr = order.addressSnapshot || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/orders" className="text-xs text-primary hover:underline">
            ← Back to Orders
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-serif text-3xl font-semibold text-primary-dark">
              {order.orderNumber}
            </h1>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium uppercase text-primary-dark">
              {order.status.replace(/_/g, ' ')}
            </span>
            <span className="rounded-full bg-surface-muted border border-border px-3 py-1 text-xs uppercase">
              {order.paymentStatus.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">Created {formatDateTime(order.createdAt)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={handleDownloadInvoice} className="btn-ghost text-xs">
            <Download size={14} /> Invoice PDF
          </button>
          <button type="button" onClick={handleResendConfirmation} className="btn-ghost text-xs">
            <Mail size={14} /> Resend Confirmation
          </button>
          {adminUser?.role === 'admin' &&
            ['paid', 'partially_refunded'].includes(order.paymentStatus) && (
              <button
                type="button"
                onClick={() => {
                  setRefundAmount('');
                  setShowRefundModal(true);
                }}
                className="btn-ghost text-xs text-status-danger border-red-200"
              >
                Initiate Refund
              </button>
            )}
        </div>
      </div>

      {order.needsReview && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm text-status-danger">
            <AlertTriangle size={18} />
            <div>
              <strong>Needs Review:</strong> {order.needsReviewReason || 'Flagged for admin check'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleSaveNotes(true)}
            className="rounded-lg bg-status-danger px-3 py-1.5 text-xs font-medium text-white"
          >
            Mark Reviewed
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 cols */}
        <div className="lg:col-span-8 space-y-6">
          {/* ST Courier Tracking Card (Core Feature) */}
          <form
            onSubmit={handleSaveTracking}
            className="admin-card border-primary/30 bg-primary-soft/20 p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-primary" />
                <h2 className="font-serif text-xl font-semibold text-primary-dark">
                  ST Courier Tracking
                </h2>
              </div>
              <span className="rounded-full bg-surface border border-border px-3 py-0.5 text-xs font-medium text-text-muted">
                Courier: ST Courier (fixed)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value.toUpperCase())}
                placeholder="Enter ST Courier Tracking ID (6–30 chars)"
                className="input-field flex-1 font-mono uppercase"
              />
              <button type="submit" disabled={savingTracking} className="btn-primary shrink-0">
                {savingTracking ? 'Saving...' : 'Save Tracking ID'}
              </button>
            </div>

            {['confirmed', 'processing'].includes(order.status) && (
              <label className="inline-flex items-center gap-2 text-xs text-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoMarkShipped}
                  onChange={(e) => setAlsoMarkShipped(e.target.checked)}
                  className="h-4 w-4 rounded text-primary"
                />
                <span>Also mark as Shipped (sends one combined notification)</span>
              </label>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border text-xs">
              {stCourierTrackingUrl && (
                <a
                  href={stCourierTrackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
                >
                  Customer tracking link preview <ExternalLink size={12} />
                </a>
              )}
              <div className="flex items-center gap-3 text-text-muted">
                {latestTrackEmail && (
                  <span>
                    Email:{' '}
                    <strong
                      className={
                        latestTrackEmail.status === 'sent'
                          ? 'text-status-success'
                          : 'text-status-danger'
                      }
                    >
                      {latestTrackEmail.status}
                    </strong>
                  </span>
                )}
                {latestTrackPush && (
                  <span>
                    Push:{' '}
                    <strong
                      className={
                        latestTrackPush.status === 'sent'
                          ? 'text-status-success'
                          : 'text-status-danger'
                      }
                    >
                      {latestTrackPush.status}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </form>

          {/* Items */}
          <div className="admin-card p-6">
            <h2 className="font-serif text-xl font-semibold text-text mb-4">Order Items</h2>
            <div className="divide-y divide-border">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 py-3 text-sm">
                  <img
                    src={resolveImageUrl(item.image, 150)}
                    alt={item.name}
                    className="h-12 w-12 rounded-xl object-cover border border-border"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-text">{item.name}</p>
                    <p className="font-sans text-xs tabular-nums text-text-muted">
                      {formatINR(item.price)} &times; {item.qty}
                    </p>
                  </div>
                  <span className="font-sans font-semibold tabular-nums">
                    {formatINR(item.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-text-muted">
                <span>Subtotal</span>
                <span className="font-sans tabular-nums">{formatINR(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Shipping</span>
                <span className="font-sans tabular-nums">{formatINR(order.shippingCharge)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base pt-1">
                <span>Total</span>
                <span className="font-sans text-xl font-semibold tabular-nums text-primary">
                  {formatINR(order.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment & Refunds */}
          <div className="admin-card p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold text-text">Razorpay Payment Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-surface-muted p-3">
                <p className="label-micro">Razorpay Order ID</p>
                <p className="mt-1 font-mono">{order.payment?.razorpayOrderId || '—'}</p>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <p className="label-micro">Razorpay Payment ID</p>
                <p className="mt-1 font-mono">{order.payment?.razorpayPaymentId || '—'}</p>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <p className="label-micro">Method</p>
                <p className="mt-1 uppercase font-medium">{order.payment?.method || '—'}</p>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <p className="label-micro">Paid At</p>
                <p className="mt-1">{formatDateTime(order.payment?.paidAt)}</p>
              </div>
            </div>

            {order.payment?.refunds?.length > 0 && (
              <div>
                <p className="label-micro mb-2">Refunds</p>
                <div className="space-y-2 text-xs">
                  {order.payment.refunds.map((r, i) => (
                    <div
                      key={i}
                      className="flex justify-between rounded-xl border border-border p-3"
                    >
                      <span>
                        {r.razorpayRefundId} · {r.reason || 'Refund'}
                      </span>
                      <span className="font-semibold uppercase">
                        {formatINR(r.amount)} ({r.status})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notification Log Panel */}
          <div className="admin-card p-6 space-y-3">
            <h2 className="font-serif text-xl font-semibold text-text">Notification Log</h2>
            {notificationLogs.length === 0 ? (
              <p className="text-xs text-text-muted">No notifications recorded yet.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {notificationLogs.map((log) => (
                  <div
                    key={log._id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      {log.status === 'sent' ? (
                        <CheckCircle2 size={15} className="text-status-success shrink-0" />
                      ) : (
                        <XCircle size={15} className="text-status-danger shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-text">
                          {log.event} · <span className="uppercase">{log.channel}</span>
                        </p>
                        <p className="text-text-muted">
                          {log.status} {log.error ? `— ${log.error}` : ''} ·{' '}
                          {formatDateTime(log.sentAt || log.createdAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResendLog(log._id)}
                      className="btn-ghost min-h-[30px] px-2.5 text-[11px]"
                    >
                      <RefreshCw size={12} /> Resend
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 4 cols */}
        <div className="lg:col-span-4 space-y-6">
          {/* Status update */}
          <div className="admin-card p-6 space-y-3">
            <h2 className="font-serif text-xl font-semibold text-text">Update Status</h2>
            {allowedNext.length === 0 ? (
              <p className="text-xs text-text-muted">
                This order is in a terminal state ({order.status}).
              </p>
            ) : (
              <>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  className="input-field"
                >
                  {allowedNext.map((st) => (
                    <option key={st} value={st}>
                      {st.replace(/_/g, ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
                <input
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Optional status note"
                  className="input-field"
                />
                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={handleUpdateStatus}
                  className="btn-primary w-full"
                >
                  {updatingStatus ? 'Updating...' : 'Apply Status Change'}
                </button>
              </>
            )}
          </div>

          {/* Customer & Address */}
          <div className="admin-card p-6 space-y-2 text-sm">
            <p className="label-micro">Customer & Shipping Address</p>
            {order.user && (
              <Link
                to={`/customers/${order.user.mobile}`}
                className="font-semibold text-primary hover:underline block"
              >
                {order.user.name} ({order.user.mobile})
              </Link>
            )}
            <p className="text-xs text-text-muted">{order.user?.email}</p>
            <div className="pt-2 border-t border-border text-xs text-text-muted space-y-0.5">
              <p className="font-medium text-text">{addr.fullName}</p>
              <p>
                {addr.line1}
                {addr.line2 ? `, ${addr.line2}` : ''}
              </p>
              <p>
                {addr.city}, {addr.state} - {addr.pincode}
              </p>
              <p>Mobile: {addr.mobile}</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="admin-card p-6 space-y-3">
            <p className="label-micro">Status History</p>
            <div className="space-y-2.5 text-xs">
              {(order.statusHistory || []).map((h, i) => (
                <div key={i} className="border-l-2 border-primary pl-3">
                  <p className="font-semibold uppercase text-text">
                    {h.status.replace(/_/g, ' ')}
                  </p>
                  <p className="text-text-muted">{formatDateTime(h.at)}</p>
                  {h.note && <p className="text-text-muted italic">{h.note}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Internal notes */}
          <div className="admin-card p-6 space-y-3">
            <p className="label-micro">Internal Notes</p>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              placeholder="Staff notes (not visible to customer)"
            />
            <button type="button" onClick={() => handleSaveNotes(false)} className="btn-ghost w-full">
              Save Notes
            </button>
          </div>
        </div>
      </div>

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <form onSubmit={handleRefund} className="admin-card w-full max-w-md p-6 space-y-4">
            <h3 className="font-serif text-2xl font-semibold text-text">Initiate Refund</h3>
            <p className="text-xs text-text-muted">
              Order total: {formatINR(order.total)}. Leave amount empty for full remaining refund.
            </p>
            <div>
              <label className="label-micro block mb-1.5">Amount (₹, optional)</label>
              <input
                type="number"
                min={1}
                max={order.total}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={String(order.total)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-micro block mb-1.5">Reason</label>
              <input
                required
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Damaged in transit / customer request"
                className="input-field"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={refunding} className="btn-primary flex-1">
                {refunding ? 'Processing...' : 'Confirm Refund'}
              </button>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
