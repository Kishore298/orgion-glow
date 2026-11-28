import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  MessageCircle,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { formatDate, resolveImageUrl } from '../lib/format';

export default function AdminReviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    source: '',
    product: '',
    rating: '',
    status: '',
    isFeatured: '',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [form, setForm] = useState({
    product: '',
    reviewerName: '',
    reviewerLocation: '',
    rating: 5,
    comment: '',
    screenshot: '',
    reviewDate: new Date().toISOString().slice(0, 10),
    isFeatured: false,
    status: 'visible',
    adminReply: '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['admin-products-mini'],
    queryFn: async () => {
      const res = await api.get('/v1/admin/products?limit=100');
      return res.data?.data?.items || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      const res = await api.get(`/v1/admin/reviews?${params.toString()}`);
      return res.data?.data;
    },
  });

  useEffect(() => {
    const addFor = searchParams.get('addFor');
    if (addFor && products.length > 0) {
      const matched = products.find((p) => p.slug === addFor || p._id === addFor);
      if (matched) {
        setEditingReview(null);
        setForm((f) => ({ ...f, product: matched._id }));
        setModalOpen(true);
        searchParams.delete('addFor');
        setSearchParams(searchParams, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length]);

  const reviews = data?.items || [];
  const totalPages = data?.totalPages || 1;
  const pendingCount = data?.pendingCount || 0;

  const resetForm = (keepProduct = false) => {
    setEditingReview(null);
    setForm((f) => ({
      product: keepProduct ? f.product : '',
      reviewerName: '',
      reviewerLocation: '',
      rating: 5,
      comment: '',
      screenshot: '',
      reviewDate: new Date().toISOString().slice(0, 10),
      isFeatured: false,
      status: 'visible',
      adminReply: '',
    }));
  };

  const handleUploadScreenshot = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('folder', 'reviews');
      const res = await api.post('/v1/admin/upload', fd);
      setForm((f) => ({ ...f, screenshot: res.data.data.url }));
      toast.success('Screenshot uploaded');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleSaveReview = async (e, addAnother = false) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingReview) {
        const payload =
          editingReview.source === 'customer'
            ? {
                adminReply: form.adminReply,
                status: form.status,
              }
            : form;
        await api.patch(`/v1/admin/reviews/${editingReview._id}`, payload);
        toast.success('Review updated');
        setModalOpen(false);
        resetForm();
      } else {
        await api.post('/v1/admin/reviews', form);
        toast.success('WhatsApp review added');
        if (addAnother) {
          resetForm(true);
        } else {
          setModalOpen(false);
          resetForm();
        }
      }
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleBulk = async (action) => {
    if (selectedIds.length === 0) return;
    if (action === 'delete' && !window.confirm(`Delete ${selectedIds.length} review(s)?`)) return;
    try {
      await api.post('/v1/admin/reviews/bulk', { ids: selectedIds, action });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Bulk action applied');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const approveReview = async (rev) => {
    try {
      await api.patch(`/v1/admin/reviews/${rev._id}`, { status: 'visible' });
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Review approved & published to product page');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const toggleVisibility = async (rev) => {
    const next = rev.status === 'visible' ? 'hidden' : 'visible';
    try {
      await api.patch(`/v1/admin/reviews/${rev._id}`, { status: next });
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success(next === 'visible' ? 'Review approved & visible' : 'Review hidden');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const toggleFeatured = async (rev) => {
    try {
      const next = !rev.isFeatured;
      await api.patch(`/v1/admin/reviews/${rev._id}`, { isFeatured: next });
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success(next ? 'Review featured on homepage' : 'Review unfeatured');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (rev) => {
    if (!window.confirm('Delete this review?')) return;
    try {
      await api.delete(`/v1/admin/reviews/${rev._id}`);
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Review deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        <div>
          <span className="label-micro">Feedback Management</span>
          <h1 className="mt-0.5 font-serif text-xl sm:text-2xl font-semibold text-primary-dark">Reviews</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus size={15} /> Add WhatsApp Review
        </button>
      </div>

      {pendingCount > 0 && filters.status !== 'pending' && (
        <div className="admin-card px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-900">
            <Clock size={16} className="shrink-0 text-amber-700" />
            <span>
              <strong>{pendingCount}</strong> customer product review{pendingCount === 1 ? '' : 's'} awaiting approval.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setFilters((f) => ({ ...f, status: 'pending' }));
              setPage(1);
            }}
            className="btn-primary min-h-[32px] px-3 text-xs"
          >
            Review Pending
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="admin-card p-2.5 sm:p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
          <Search size={14} className="absolute left-2.5 sm:left-3 top-2.5 sm:top-3 text-text-muted" />
          <input
            value={filters.search}
            onChange={(e) => {
              setFilters({ ...filters, search: e.target.value });
              setPage(1);
            }}
            placeholder="Search reviewer or comment..."
            className="input-field pl-8 sm:pl-9"
          />
        </div>
        <select
          value={filters.source}
          onChange={(e) => setFilters({ ...filters, source: e.target.value })}
          className="input-field"
        >
          <option value="">All Sources</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="customer">Customer</option>
        </select>
        <select
          value={filters.product}
          onChange={(e) => setFilters({ ...filters, product: e.target.value })}
          className="input-field"
        >
          <option value="">All Products</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => {
            setFilters({ ...filters, status: e.target.value });
            setPage(1);
          }}
          className="input-field"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending Approval</option>
          <option value="visible">Approved / Visible</option>
          <option value="hidden">Hidden</option>
        </select>
        <select
          value={filters.isFeatured}
          onChange={(e) => setFilters({ ...filters, isFeatured: e.target.value })}
          className="input-field"
        >
          <option value="">All Featured</option>
          <option value="true">Featured on Home</option>
          <option value="false">Not Featured</option>
        </select>
      </div>

      {selectedIds.length > 0 && (
        <div className="admin-card px-4 py-3 flex flex-wrap items-center gap-3 text-xs bg-primary-soft/40">
          <span className="font-semibold">{selectedIds.length} selected</span>
          <button type="button" onClick={() => handleBulk('approve')} className="btn-ghost min-h-[30px] px-3 text-xs">
            Approve
          </button>
          <button type="button" onClick={() => handleBulk('hide')} className="btn-ghost min-h-[30px] px-3 text-xs">
            Hide
          </button>
          <button type="button" onClick={() => handleBulk('feature')} className="btn-ghost min-h-[30px] px-3 text-xs">
            Feature (WhatsApp)
          </button>
          <button
            type="button"
            onClick={() => handleBulk('delete')}
            className="btn-ghost min-h-[30px] px-3 text-xs text-status-danger"
          >
            Delete
          </button>
        </div>
      )}

      {/* Table */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-surface-muted border-b border-border text-[10.5px] sm:text-[11px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3 w-8">
                  <input
                    type="checkbox"
                    checked={reviews.length > 0 && selectedIds.length === reviews.length}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? reviews.map((r) => r._id) : [])
                    }
                  />
                </th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Product & Reviewer</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Rating & Comment</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Source</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Featured</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Visibility</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    Loading reviews...
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    No reviews match your filters.
                  </td>
                </tr>
              ) : (
                reviews.map((rev) => (
                  <tr key={rev._id} className="hover:bg-surface-muted/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(rev._id)}
                        onChange={(e) =>
                          setSelectedIds((ids) =>
                            e.target.checked
                              ? [...ids, rev._id]
                              : ids.filter((id) => id !== rev._id)
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary">{rev.product?.name}</p>
                      <p className="text-xs font-semibold text-text">
                        {rev.reviewerName}
                        {rev.reviewerLocation ? ` (${rev.reviewerLocation})` : ''}
                      </p>
                      <p className="text-[11px] text-text-muted">{formatDate(rev.reviewDate)}</p>
                    </td>
                    <td className="px-4 py-3 max-w-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gold">
                          {rev.rating} <Star size={12} className="fill-gold" />
                        </span>
                        {rev.screenshot && (
                          <img
                            src={resolveImageUrl(rev.screenshot, 120)}
                            alt="Screenshot"
                            className="h-8 w-8 rounded object-cover border border-border"
                          />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-text-muted line-clamp-2">
                        {rev.comment || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {rev.source === 'whatsapp' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] text-primary-dark">
                          <MessageCircle size={11} /> WhatsApp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] text-status-info">
                          <BadgeCheck size={11} /> Verified
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {rev.source === 'whatsapp' ? (
                        <input
                          type="checkbox"
                          checked={rev.isFeatured}
                          onChange={() => toggleFeatured(rev)}
                          aria-label="Toggle featured on home"
                        />
                      ) : (
                        <span className="text-[11px] text-text-muted" title="Customer reviews publish to product pages only">
                          Product only
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {rev.status === 'pending' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                            <Clock size={11} />
                            Pending
                          </span>
                          <button
                            type="button"
                            onClick={() => approveReview(rev)}
                            className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-white hover:bg-primary-dark"
                          >
                            <CheckCircle2 size={11} />
                            Approve
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleVisibility(rev)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            rev.status === 'visible'
                              ? 'bg-primary-soft text-status-success'
                              : 'bg-surface-muted text-text-muted'
                          }`}
                        >
                          {rev.status === 'visible' ? <Eye size={11} /> : <EyeOff size={11} />}
                          {rev.status === 'visible' ? 'Approved' : 'Hidden'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingReview(rev);
                            setForm({
                              product: rev.product?._id || '',
                              reviewerName: rev.reviewerName || '',
                              reviewerLocation: rev.reviewerLocation || '',
                              rating: rev.rating || 5,
                              comment: rev.comment || '',
                              screenshot: rev.screenshot || '',
                              reviewDate: rev.reviewDate
                                ? new Date(rev.reviewDate).toISOString().slice(0, 10)
                                : new Date().toISOString().slice(0, 10),
                              isFeatured: Boolean(rev.isFeatured),
                              status: rev.status || 'visible',
                              adminReply: rev.adminReply || '',
                            });
                            setModalOpen(true);
                          }}
                          className="btn-ghost min-h-[30px] px-2.5 text-xs"
                        >
                          {rev.source === 'customer' ? 'Moderate' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          aria-label="Delete review"
                          onClick={() => handleDelete(rev)}
                          className="p-1.5 text-text-muted hover:text-status-danger"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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

      {/* Add / Edit Review Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-black/45 p-4 overflow-y-auto">
          <div className="admin-card relative w-full max-w-lg p-6 sm:p-7 my-8">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-text-muted"
            >
              <X size={18} />
            </button>

            <h2 className="font-serif text-2xl font-semibold text-primary-dark">
              {editingReview
                ? editingReview.source === 'customer'
                  ? 'Moderate / Reply to Customer Rating'
                  : 'Edit WhatsApp Review'
                : 'Add WhatsApp Review'}
            </h2>

            <form onSubmit={(e) => handleSaveReview(e, false)} className="mt-5 space-y-4">
              {editingReview?.source === 'customer' ? (
                <>
                  <div className="rounded-xl bg-surface-muted p-4 text-xs space-y-1">
                    <p className="font-semibold">
                      {editingReview.reviewerName} · {'★'.repeat(editingReview.rating)}
                    </p>
                    <p className="text-text-muted">
                      {editingReview.comment || '(Customer submitted rating without comment)'}
                    </p>
                    <p className="text-[11px] text-text-muted italic">
                      Customer rating and text cannot be edited by admin.
                    </p>
                  </div>
                  <div>
                    <label className="label-micro block mb-1.5">Approval Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="input-field"
                    >
                      <option value="pending">Pending Approval</option>
                      <option value="visible">Approved (Publish to Product Page)</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-micro block mb-1.5">Public Admin Reply</label>
                    <textarea
                      rows={3}
                      value={form.adminReply}
                      onChange={(e) => setForm({ ...form, adminReply: e.target.value })}
                      className="input-field"
                      placeholder="Thank you for sharing your ritual!"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="label-micro block mb-1.5">Product (Required)</label>
                    <select
                      required
                      value={form.product}
                      onChange={(e) => setForm({ ...form, product: e.target.value })}
                      className="input-field"
                    >
                      <option value="">Select product...</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-micro block mb-1.5">Reviewer Name</label>
                      <input
                        required
                        value={form.reviewerName}
                        onChange={(e) => setForm({ ...form, reviewerName: e.target.value })}
                        className="input-field"
                        placeholder="Meera K."
                      />
                    </div>
                    <div>
                      <label className="label-micro block mb-1.5">City (Optional)</label>
                      <input
                        value={form.reviewerLocation}
                        onChange={(e) => setForm({ ...form, reviewerLocation: e.target.value })}
                        className="input-field"
                        placeholder="Chennai"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-micro block mb-1.5">Rating (1–5)</label>
                      <select
                        value={form.rating}
                        onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                        className="input-field"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} Stars
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label-micro block mb-1.5">Review Date</label>
                      <input
                        type="date"
                        value={form.reviewDate}
                        onChange={(e) => setForm({ ...form, reviewDate: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label-micro block mb-1.5">Comment Text</label>
                    <textarea
                      required
                      rows={3}
                      value={form.comment}
                      onChange={(e) => setForm({ ...form, comment: e.target.value })}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="label-micro block mb-1.5">WhatsApp Screenshot (Optional)</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={form.screenshot}
                        onChange={(e) => setForm({ ...form, screenshot: e.target.value })}
                        placeholder="Screenshot URL or upload"
                        className="input-field flex-1"
                      />
                      <label className="btn-ghost cursor-pointer min-h-[38px] px-3 text-xs shrink-0">
                        <Upload size={14} /> {uploading ? '...' : 'Upload'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadScreenshot}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="mt-1 text-[11px] text-text-muted">
                      Hide phone numbers and personal details in screenshots.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isFeatured}
                      onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                      className="rounded text-primary"
                    />
                    <span>Featured on Home (“What Our Customers Say”)</span>
                  </label>
                </>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : 'Save Review'}
                </button>
                {!editingReview && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={(e) => handleSaveReview(e, true)}
                    className="btn-ghost flex-1"
                  >
                    Save & Add Another
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
