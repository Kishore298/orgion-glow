import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Edit3,
  History,
  Plus,
  Search,
  Ticket,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { formatDate, formatDateTime, formatINR } from '../lib/format';

const STATUS_BADGE = {
  active: 'bg-green-100 text-primary-dark border-green-200',
  inactive: 'bg-stone-100 text-text-muted border-border',
  scheduled: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-red-50 text-status-danger border-red-200',
  limit_reached: 'bg-orange-50 text-orange-700 border-orange-200',
};

const STATUS_LABEL = {
  active: 'Active',
  inactive: 'Inactive',
  scheduled: 'Scheduled',
  expired: 'Expired',
  limit_reached: 'Limit reached',
};

const EMPTY_FORM = {
  code: '',
  discountType: 'percentage',
  discountValue: '',
  maxDiscountCap: '',
  minOrderValue: '',
  perUserLimit: '',
  maxTotalUsage: '',
  startDate: '',
  expiryDate: '',
  description: '',
  isActive: true,
};

function toDateInputValue(iso) {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [formModal, setFormModal] = useState({ open: false, mode: 'create', editing: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [usageModalCoupon, setUsageModalCoupon] = useState(null);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['admin-coupons', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get(`/v1/admin/coupons?${params.toString()}`);
      return res.data?.data || [];
    },
  });

  const { data: usageData, isLoading: loadingUsages } = useQuery({
    queryKey: ['admin-coupon-usages', usageModalCoupon?._id],
    enabled: Boolean(usageModalCoupon?._id),
    queryFn: async () => {
      const res = await api.get(`/v1/admin/coupons/${usageModalCoupon._id}/usages`);
      return res.data?.data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    queryClient.invalidateQueries({ queryKey: ['admin-coupon-usages'] });
  };

  const openCreateModal = () => {
    setForm({ ...EMPTY_FORM });
    setFormModal({ open: true, mode: 'create', editing: null });
  };

  const openEditModal = (coupon) => {
    setForm({
      code: coupon.code || '',
      discountType: coupon.discountType || 'percentage',
      discountValue: coupon.discountValue ?? '',
      maxDiscountCap: coupon.maxDiscountCap ?? '',
      minOrderValue: coupon.minOrderValue ?? '',
      perUserLimit: coupon.perUserLimit ?? '',
      maxTotalUsage: coupon.maxTotalUsage ?? '',
      startDate: toDateInputValue(coupon.startDate),
      expiryDate: toDateInputValue(coupon.expiryDate),
      description: coupon.description || '',
      isActive: Boolean(coupon.isActive),
    });
    setFormModal({ open: true, mode: 'edit', editing: coupon });
  };

  const openDuplicateModal = (coupon) => {
    setForm({
      code: `${coupon.code}COPY`.slice(0, 20),
      discountType: coupon.discountType || 'percentage',
      discountValue: coupon.discountValue ?? '',
      maxDiscountCap: coupon.maxDiscountCap ?? '',
      minOrderValue: coupon.minOrderValue ?? '',
      perUserLimit: coupon.perUserLimit ?? '',
      maxTotalUsage: coupon.maxTotalUsage ?? '',
      startDate: toDateInputValue(coupon.startDate),
      expiryDate: toDateInputValue(coupon.expiryDate),
      description: coupon.description || '',
      isActive: true,
    });
    setFormModal({ open: true, mode: 'create', editing: null });
  };

  const closeFormModal = () => {
    setFormModal({ open: false, mode: 'create', editing: null });
  };

  const willHitLimitWarning = useMemo(() => {
    if (formModal.mode !== 'edit' || !formModal.editing) return false;
    const maxNum = form.maxTotalUsage === '' ? null : Number(form.maxTotalUsage);
    return (
      maxNum != null &&
      Number.isFinite(maxNum) &&
      maxNum > 0 &&
      Number(formModal.editing.usedCount || 0) >= maxNum
    );
  }, [formModal, form.maxTotalUsage]);

  const handleSave = async (e) => {
    e.preventDefault();
    const cleanedCode = String(form.code || '').trim().replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(cleanedCode)) {
      toast.error('Code must be 3–20 letters and numbers only, with no spaces');
      return;
    }
    const val = Number(form.discountValue);
    if (!Number.isFinite(val) || val <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }
    if (form.discountType === 'percentage' && val > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }

    const payload = {
      code: cleanedCode,
      discountType: form.discountType,
      discountValue: val,
      maxDiscountCap:
        form.discountType === 'percentage' && form.maxDiscountCap !== ''
          ? Number(form.maxDiscountCap)
          : null,
      minOrderValue: form.minOrderValue !== '' ? Number(form.minOrderValue) : null,
      perUserLimit: form.perUserLimit !== '' ? Number(form.perUserLimit) : null,
      maxTotalUsage: form.maxTotalUsage !== '' ? Number(form.maxTotalUsage) : null,
      startDate: form.startDate || null,
      expiryDate: form.expiryDate || null,
      description: form.description.trim(),
      isActive: Boolean(form.isActive),
    };

    setSaving(true);
    try {
      if (formModal.mode === 'edit' && formModal.editing) {
        const res = await api.put(`/v1/admin/coupons/${formModal.editing._id}`, payload);
        const warning = res.data?.data?.warning;
        if (warning) toast(warning, { icon: '⚠️', duration: 5000 });
        else toast.success('Coupon updated');
      } else {
        await api.post('/v1/admin/coupons', payload);
        toast.success(`Coupon ${cleanedCode} created`);
      }
      invalidate();
      closeFormModal();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (coupon) => {
    try {
      const res = await api.patch(`/v1/admin/coupons/${coupon._id}/status`, {
        isActive: !coupon.isActive,
      });
      toast.success(res.data?.message || 'Status updated');
      invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (coupon) => {
    const promptMsg =
      Number(coupon.usedCount || 0) > 0
        ? `Coupon "${coupon.code}" has already been used (${coupon.usedCount} times). It will be disabled instead of permanently deleted. Continue?`
        : `Delete coupon "${coupon.code}" permanently?`;
    if (!window.confirm(promptMsg)) return;

    try {
      const res = await api.delete(`/v1/admin/coupons/${coupon._id}`);
      toast.success(res.data?.message || 'Done');
      invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        <div>
          <span className="label-micro">Promotions</span>
          <h1 className="mt-0.5 font-serif text-xl sm:text-2xl font-semibold text-primary-dark">
            Coupons
          </h1>
        </div>
        <button type="button" onClick={openCreateModal} className="btn-primary text-xs sm:text-sm">
          <Plus size={16} /> New Coupon
        </button>
      </div>

      {/* Filters */}
      <div className="admin-card p-2.5 sm:p-4 grid grid-cols-12 gap-2 sm:gap-3">
        <div className="relative col-span-7 sm:col-span-8">
          <Search size={14} className="absolute left-3 top-3 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code (e.g. GLOW10)..."
            className="input-field pl-9 uppercase"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field col-span-5 sm:col-span-4"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="scheduled">Scheduled</option>
          <option value="expired">Expired</option>
          <option value="limit_reached">Limit reached</option>
        </select>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-surface-muted border-b border-border text-[10.5px] sm:text-[11px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-3 sm:px-4 py-3">Code</th>
                <th className="px-3 sm:px-4 py-3">Discount</th>
                <th className="px-3 sm:px-4 py-3 hidden sm:table-cell">Min Order</th>
                <th className="px-3 sm:px-4 py-3">Used / Max</th>
                <th className="px-3 sm:px-4 py-3 hidden md:table-cell">Per-User</th>
                <th className="px-3 sm:px-4 py-3 hidden lg:table-cell">Expiry</th>
                <th className="px-3 sm:px-4 py-3">Status</th>
                <th className="px-3 sm:px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-text-muted">
                    Loading coupons...
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-2">
                      <Ticket size={22} className="text-text-muted/60" />
                      <p>No coupons found. Create one to offer discounts at checkout.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                coupons.map((c) => {
                  const status = c.computedStatus || 'inactive';
                  const discountLabel =
                    c.discountType === 'percentage'
                      ? `${c.discountValue}%${
                          c.maxDiscountCap ? ` (up to ${formatINR(c.maxDiscountCap)})` : ''
                        }`
                      : formatINR(c.discountValue);

                  return (
                    <tr key={c._id} className="hover:bg-surface-muted/40">
                      <td className="px-3 sm:px-4 py-3">
                        <div className="font-mono font-semibold text-primary-dark">{c.code}</div>
                        {c.description && (
                          <p className="text-[11px] text-text-muted line-clamp-1 max-w-[200px]">
                            {c.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 font-sans tabular-nums">
                        <div className="font-medium text-text">{discountLabel}</div>
                        {Number(c.totalDiscountGiven || 0) > 0 && (
                          <p className="text-[11px] text-text-muted">
                            Given: {formatINR(c.totalDiscountGiven)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 hidden sm:table-cell font-sans tabular-nums text-text-muted">
                        {c.minOrderValue != null ? formatINR(c.minOrderValue) : 'None'}
                      </td>
                      <td className="px-3 sm:px-4 py-3 font-sans tabular-nums">
                        <button
                          type="button"
                          onClick={() => setUsageModalCoupon(c)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-medium text-primary hover:bg-primary-soft/60"
                          title="View usage history"
                        >
                          {c.usedCount || 0} / {c.maxTotalUsage ?? '∞'}
                          <History size={12} />
                        </button>
                      </td>
                      <td className="px-3 sm:px-4 py-3 hidden md:table-cell text-text-muted">
                        {c.perUserLimit ?? 'Unlimited'}
                      </td>
                      <td className="px-3 sm:px-4 py-3 hidden lg:table-cell text-xs text-text-muted">
                        {c.expiryDate ? formatDate(c.expiryDate) : 'Never'}
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                            STATUS_BADGE[status] || STATUS_BADGE.inactive
                          }`}
                        >
                          {STATUS_LABEL[status] || status}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setUsageModalCoupon(c)}
                            title="Usage history"
                            className="p-1.5 rounded-lg text-text-muted hover:bg-surface-muted hover:text-text"
                          >
                            <History size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            title="Edit coupon"
                            className="p-1.5 rounded-lg text-text-muted hover:bg-surface-muted hover:text-text"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDuplicateModal(c)}
                            title="Duplicate coupon"
                            className="p-1.5 rounded-lg text-text-muted hover:bg-surface-muted hover:text-text"
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(c)}
                            title={c.isActive ? 'Disable coupon' : 'Enable coupon'}
                            className={`p-1.5 rounded-lg hover:bg-surface-muted ${
                              c.isActive ? 'text-primary' : 'text-text-muted'
                            }`}
                          >
                            {c.isActive ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            title={Number(c.usedCount || 0) > 0 ? 'Disable (used coupon)' : 'Delete coupon'}
                            className="p-1.5 rounded-lg text-text-muted hover:bg-red-50 hover:text-status-danger"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Coupon Modal */}
      {formModal.open && (
        <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-black/45 p-4 overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="admin-card w-full max-w-2xl p-4 sm:p-6 space-y-3.5 sm:space-y-5 my-auto"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-semibold text-primary-dark">
                  {formModal.mode === 'edit' ? `Edit ${formModal.editing?.code}` : 'Create Coupon'}
                </h2>
                <p className="text-xs text-text-muted">
                  Discount is applied on product selling prices before shipping.
                </p>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                className="p-1.5 rounded-lg text-text-muted hover:bg-surface-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-micro block mb-1.5">
                  Code <span className="text-status-danger">*</span>
                </label>
                <input
                  required
                  value={form.code}
                  disabled={formModal.mode === 'edit' && Number(formModal.editing?.usedCount || 0) > 0}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20),
                    })
                  }
                  placeholder="GLOW10"
                  className="input-field font-mono uppercase disabled:opacity-60"
                />
                <p className="mt-1 text-[11px] text-text-muted">
                  {formModal.mode === 'edit' && Number(formModal.editing?.usedCount || 0) > 0
                    ? 'Code is locked because this coupon already has order usages.'
                    : 'Letters and numbers only, no spaces (3–20 chars).'}
                </p>
              </div>

              <div>
                <label className="label-micro block mb-1.5">
                  Discount Type <span className="text-status-danger">*</span>
                </label>
                <select
                  required
                  value={form.discountType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      discountType: e.target.value,
                      maxDiscountCap: e.target.value === 'flat' ? '' : form.maxDiscountCap,
                    })
                  }
                  className="input-field"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Amount (₹)</option>
                </select>
              </div>

              <div>
                <label className="label-micro block mb-1.5">
                  Discount Value ({form.discountType === 'percentage' ? '%' : '₹'}){' '}
                  <span className="text-status-danger">*</span>
                </label>
                <input
                  required
                  type="number"
                  min={0.01}
                  max={form.discountType === 'percentage' ? 100 : undefined}
                  step="0.01"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  placeholder={form.discountType === 'percentage' ? '10' : '100'}
                  className="input-field"
                />
              </div>

              {form.discountType === 'percentage' ? (
                <div>
                  <label className="label-micro block mb-1.5">Max Discount Cap (₹, optional)</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={form.maxDiscountCap}
                    onChange={(e) => setForm({ ...form, maxDiscountCap: e.target.value })}
                    placeholder="e.g. 150"
                    className="input-field"
                  />
                </div>
              ) : (
                <div className="flex items-end pb-2 text-xs text-text-muted">
                  Flat discounts automatically cap at the product subtotal.
                </div>
              )}

              <div>
                <label className="label-micro block mb-1.5">Minimum Order Value (₹, optional)</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={form.minOrderValue}
                  onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
                  placeholder="No minimum"
                  className="input-field"
                />
              </div>

              <div>
                <label className="label-micro block mb-1.5">Per-User Limit (optional)</label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={form.perUserLimit}
                  onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                  placeholder="Unlimited"
                  className="input-field"
                />
              </div>

              <div>
                <label className="label-micro block mb-1.5">Max Total Usage (optional)</label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={form.maxTotalUsage}
                  onChange={(e) => setForm({ ...form, maxTotalUsage: e.target.value })}
                  placeholder="Unlimited"
                  className="input-field"
                />
                {willHitLimitWarning && (
                  <p className="mt-1 text-[11px] font-medium text-amber-700">
                    Used count ({formModal.editing?.usedCount}) has reached this limit — saving will mark the coupon as Limit reached.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 self-end">
                <div>
                  <span className="text-sm font-medium block">Active</span>
                  <span className="text-[11px] text-text-muted">Allow customers to apply</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isActive}
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    form.isActive ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      form.isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="label-micro block mb-1.5">Start Date (optional)</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label-micro block mb-1.5">Expiry Date (optional)</label>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label-micro block mb-1.5">Description (optional)</label>
                <input
                  maxLength={240}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder='e.g. "10% off on orders above ₹499"'
                  className="input-field"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button type="button" onClick={closeFormModal} className="btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving
                  ? 'Saving...'
                  : formModal.mode === 'edit'
                  ? 'Save Changes'
                  : 'Create Coupon'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Usage History Modal */}
      {usageModalCoupon && (
        <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-black/45 p-4 overflow-y-auto">
          <div className="admin-card w-full max-w-2xl p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-primary-dark">
                  Usage History — <span className="font-mono">{usageModalCoupon.code}</span>
                </h2>
                {usageData?.summary && (
                  <p className="text-xs text-text-muted mt-0.5">
                    Used: <strong>{usageData.summary.totalUsedCount}</strong> · Released:{' '}
                    <strong>{usageData.summary.totalReleasedCount}</strong> · Total Discount Given:{' '}
                    <strong>{formatINR(usageData.summary.totalDiscountGiven)}</strong>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setUsageModalCoupon(null)}
                className="p-1.5 rounded-lg text-text-muted hover:bg-surface-muted"
              >
                <X size={18} />
              </button>
            </div>

            {loadingUsages ? (
              <p className="py-8 text-center text-sm text-text-muted">Loading usages...</p>
            ) : !usageData?.usages?.length ? (
              <p className="py-8 text-center text-sm text-text-muted">
                No orders have used this coupon yet.
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted border-b border-border uppercase text-text-muted">
                    <tr>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Order</th>
                      <th className="px-3 py-2.5">Discount</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {usageData.usages.map((u) => (
                      <tr key={u._id}>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-text">{u.user?.name || 'Customer'}</div>
                          <div className="text-[11px] text-text-muted">{u.user?.mobile || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-primary">
                          {u.order?.orderNumber || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-sans tabular-nums font-semibold">
                          {formatINR(u.discountAmount)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                              u.status === 'used'
                                ? 'bg-green-100 text-primary-dark'
                                : 'bg-stone-100 text-text-muted'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-text-muted">
                          {formatDateTime(u.usedAt || u.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
