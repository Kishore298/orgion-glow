import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Plus, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { BRAND_LOGO_FALLBACK, resolveImageUrl } from '../lib/format';

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    image: '',
    isActive: true,
    isFeatured: false,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await api.get('/v1/admin/categories');
      return res.data?.data || [];
    },
  });

  const openCreateModal = () => {
    setEditing(null);
    setForm({
      name: '',
      slug: '',
      description: '',
      image: '',
      isActive: true,
      isFeatured: false,
    });
    setModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      image: cat.image || '',
      isActive: cat.isActive,
      isFeatured: cat.isFeatured,
    });
    setModalOpen(true);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('folder', 'categories');
      const res = await api.post('/v1/admin/upload', fd);
      setForm((f) => ({ ...f, image: res.data.data.url }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/v1/admin/categories/${editing._id}`, form);
        toast.success('Category updated');
      } else {
        await api.post('/v1/admin/categories', { ...form, sortOrder: categories.length });
        toast.success('Category created');
      }
      setModalOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await api.delete(`/v1/admin/categories/${cat._id}`);
      toast.success('Category deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDropReorder = async (dropIdx) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setDragIdx(null);

    try {
      await api.patch('/v1/admin/categories/reorder', {
        items: reordered.map((c, idx) => ({ id: c._id, sortOrder: idx })),
      });
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      toast.success('Order updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        <div>
          <span className="label-micro">Catalog Structure</span>
          <h1 className="mt-0.5 font-serif text-xl sm:text-2xl font-semibold text-primary-dark">Categories</h1>
        </div>
        <button type="button" onClick={openCreateModal} className="btn-primary">
          <Plus size={15} /> Add Category
        </button>
      </div>

      <div className="admin-card p-3 sm:p-5 lg:p-6">
        <p className="text-xs text-text-muted mb-3 sm:mb-4">
          Drag category cards by the grip handle to reorder display sequence.
        </p>

        {isLoading ? (
          <p className="text-sm text-text-muted py-8 text-center">Loading categories...</p>
        ) : categories.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-serif text-xl text-text">No categories yet</p>
            <button type="button" onClick={openCreateModal} className="btn-primary mt-4">
              <Plus size={15} /> Add Category
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
            {categories.map((cat, idx) => {
              const imgUrl = resolveImageUrl(cat.image, 200);
              const isLogo = !cat.image;
              return (
                <div
                  key={cat._id}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropReorder(idx)}
                  className="flex items-center gap-2.5 sm:gap-3.5 rounded-2xl border border-border bg-surface-muted p-2.5 sm:p-4 transition hover:border-primary/40"
                >
                  <GripVertical size={17} className="text-text-muted cursor-grab shrink-0" />
                  <img
                    src={imgUrl}
                    alt={cat.name}
                    onError={(e) => {
                      e.currentTarget.src = BRAND_LOGO_FALLBACK;
                    }}
                    className={`h-11 w-11 sm:h-14 sm:w-14 rounded-xl border border-border bg-surface shrink-0 ${
                      isLogo ? 'object-contain p-1.5' : 'object-cover'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm text-text truncate">{cat.name}</p>
                      {!cat.isActive && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-status-danger">
                          Inactive
                        </span>
                      )}
                      {cat.isFeatured && (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] text-primary-dark">
                          Featured
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      /{cat.slug} · {cat.productCount || 0} products
                    </p>
                    {cat.description && (
                      <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5">
                        {cat.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(cat)}
                      className="btn-ghost min-h-[32px] px-3 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${cat.name}`}
                      onClick={() => handleDelete(cat)}
                      className="p-2 text-text-muted hover:text-status-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-black/45 p-4">
          <div className="admin-card relative w-full max-w-lg p-6 sm:p-7">
            <button
              type="button"
              aria-label="Close modal"
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-text-muted hover:text-text"
            >
              <X size={18} />
            </button>

            <h2 className="font-serif text-2xl font-semibold text-primary-dark">
              {editing ? `Edit: ${editing.name}` : 'Add Category'}
            </h2>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="label-micro block mb-1.5">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                  placeholder="Lip Care"
                />
              </div>
              <div>
                <label className="label-micro block mb-1.5">Slug (optional, auto-generated)</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="input-field"
                  placeholder="lip-care"
                />
              </div>
              <div>
                <label className="label-micro block mb-1.5">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-micro block mb-1.5">Image (Optional — uses ORGION logo if empty)</label>
                <div className="flex items-center gap-3">
                  <input
                    value={form.image}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                    className="input-field flex-1"
                    placeholder="Image URL or upload"
                  />
                  <label className="btn-ghost cursor-pointer min-h-[38px] px-3 text-xs shrink-0">
                    <Upload size={14} /> {uploading ? '...' : 'Upload'}
                    <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="h-4 w-4 rounded text-primary"
                  />
                  <span>Active</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                    className="h-4 w-4 rounded text-primary"
                  />
                  <span>Featured on Home</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : editing ? 'Update Category' : 'Create Category'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-ghost flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
