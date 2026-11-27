import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, MessageSquarePlus, Star, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { resolveImageUrl } from '../lib/format';

export default function ProductEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    category: '',
    price: '',
    shortDescription: '',
    description: '',
    benefitsText: '',
    ingredientsText: '',
    howToUse: '',
    images: [],
    weight: '',
    tagsText: '',
    isBestseller: false,
    isFeatured: false,
    isOffer: false,
    inStock: true,
    status: 'active',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await api.get('/v1/admin/categories');
      return res.data?.data || [];
    },
  });

  const { data: existingProduct } = useQuery({
    queryKey: ['admin-product', id],
    enabled: !isNew,
    queryFn: async () => {
      const res = await api.get(`/v1/admin/products/${id}`);
      return res.data?.data;
    },
  });

  useEffect(() => {
    if (existingProduct) {
      setForm({
        name: existingProduct.name || '',
        slug: existingProduct.slug || '',
        category: existingProduct.category?._id || existingProduct.category || '',
        price: existingProduct.price ?? '',
        shortDescription: existingProduct.shortDescription || '',
        description: existingProduct.description || '',
        benefitsText: (existingProduct.benefits || []).join('\n'),
        ingredientsText: (existingProduct.keyIngredients || []).join(', '),
        howToUse: existingProduct.howToUse || '',
        images: existingProduct.images || [],
        weight: existingProduct.weight ?? '',
        tagsText: (existingProduct.tags || []).join(', '),
        isBestseller: Boolean(existingProduct.isBestseller),
        isFeatured: Boolean(existingProduct.isFeatured),
        isOffer: Boolean(existingProduct.isOffer),
        inStock: existingProduct.inStock !== false,
        status: existingProduct.status || 'active',
      });
    }
  }, [existingProduct]);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('image', file);
        fd.append('folder', 'products');
        const res = await api.post('/v1/admin/upload', fd);
        uploaded.push({
          url: res.data.data.url,
          publicId: res.data.data.publicId,
          isPrimary: form.images.length === 0 && uploaded.length === 0,
        });
      }
      setForm((f) => ({ ...f, images: [...f.images, ...uploaded] }));
      toast.success('Image(s) uploaded');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const setPrimaryImage = (idx) => {
    setForm((f) => ({
      ...f,
      images: f.images.map((img, i) => ({ ...img, isPrimary: i === idx })),
    }));
  };

  const moveImage = (idx, dir) => {
    const next = [...form.images];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setForm((f) => ({ ...f, images: next }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        category: form.category,
        price: Number(form.price),
        shortDescription: form.shortDescription,
        description: form.description,
        benefits: form.benefitsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        keyIngredients: form.ingredientsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        howToUse: form.howToUse,
        images: form.images,
        weight: form.weight ? Number(form.weight) : undefined,
        tags: form.tagsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        isBestseller: form.isBestseller,
        isFeatured: form.isFeatured,
        isOffer: form.isOffer,
        inStock: form.inStock,
        status: form.status,
      };

      if (isNew) {
        await api.post('/v1/admin/products', payload);
        toast.success('Product created');
      } else {
        await api.patch(`/v1/admin/products/${id}`, payload);
        toast.success('Product updated');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      navigate('/products');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <Link to="/products" className="text-xs text-primary hover:underline">
            ← Back to Products
          </Link>
          <h1 className="mt-1 font-serif text-xl sm:text-2xl font-semibold text-primary-dark">
            {isNew ? 'Add Product' : existingProduct?.name || 'Edit Product'}
          </h1>
        </div>

        {!isNew && existingProduct && (
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
            <div className="rounded-xl border border-border bg-surface px-3 sm:px-4 py-1.5 sm:py-2 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-text">
                <Star size={14} className="fill-gold text-gold" />
                {Number(existingProduct.ratingAvg || 0).toFixed(1)}
              </span>{' '}
              <span className="text-text-muted">({existingProduct.ratingCount || 0} reviews)</span>
            </div>
            <Link
              to={`/reviews?addFor=${existingProduct.slug}`}
              className="btn-ghost text-xs"
            >
              <MessageSquarePlus size={15} /> Add WhatsApp review for this product
            </Link>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-5 lg:gap-6">
        <div className="lg:col-span-8 space-y-3.5 sm:space-y-5 lg:space-y-6">
          <div className="admin-card p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-micro block mb-1.5">Product Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-micro block mb-1.5">Slug (optional)</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="label-micro block mb-1.5">Category</label>
                <select
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-micro block mb-1.5">Price (₹)</label>
                <input
                  required
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="label-micro block mb-1.5">Short Description</label>
              <input
                value={form.shortDescription}
                onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="label-micro block mb-1.5">Full Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-micro block mb-1.5">Benefits (one per line)</label>
                <textarea
                  rows={4}
                  value={form.benefitsText}
                  onChange={(e) => setForm({ ...form, benefitsText: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-micro block mb-1.5">Key Ingredients (comma-separated)</label>
                <textarea
                  rows={4}
                  value={form.ingredientsText}
                  onChange={(e) => setForm({ ...form, ingredientsText: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="label-micro block mb-1.5">How to Ritual / Use</label>
              <textarea
                rows={2}
                value={form.howToUse}
                onChange={(e) => setForm({ ...form, howToUse: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          {/* Images */}
          <div className="admin-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold text-text">Images</h2>
              <label className="btn-ghost cursor-pointer min-h-[36px] px-3 text-xs">
                <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Images'}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {form.images.map((img, idx) => (
                <div key={idx} className="rounded-xl border border-border p-2 bg-surface-muted space-y-2">
                  <img
                    src={resolveImageUrl(img.url, 300)}
                    alt={`Product ${idx + 1}`}
                    className="h-28 w-full rounded-lg object-cover"
                  />
                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPrimaryImage(idx)}
                      className={
                        img.isPrimary
                          ? 'font-semibold text-primary'
                          : 'text-text-muted hover:text-text'
                      }
                    >
                      {img.isPrimary ? 'Primary' : 'Set Primary'}
                    </button>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveImage(idx, -1)}>
                        <ArrowLeft size={12} />
                      </button>
                      <button type="button" onClick={() => moveImage(idx, 1)}>
                        <ArrowRight size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            images: f.images.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-status-danger"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="admin-card p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold text-text">Availability & Badges</h2>

            <div>
              <label className="label-micro block mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input-field"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-border p-3 cursor-pointer">
              <span className="text-sm font-medium">In Stock</span>
              <input
                type="checkbox"
                checked={form.inStock}
                onChange={(e) => setForm({ ...form, inStock: e.target.checked })}
                className="h-4 w-4 text-primary"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-border p-3 cursor-pointer">
              <span className="text-sm font-medium">Bestseller</span>
              <input
                type="checkbox"
                checked={form.isBestseller}
                onChange={(e) => setForm({ ...form, isBestseller: e.target.checked })}
                className="h-4 w-4 text-primary"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-border p-3 cursor-pointer">
              <span className="text-sm font-medium">Featured</span>
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                className="h-4 w-4 text-primary"
              />
            </label>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <span className="text-sm font-medium block">Mark as Offer</span>
                <span className="text-[11px] text-text-muted">Show in the storefront Offers page</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.isOffer}
                aria-label="Mark product as offer"
                onClick={() => setForm((f) => ({ ...f, isOffer: !f.isOffer }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                  form.isOffer ? 'bg-primary' : 'bg-border'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    form.isOffer ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="label-micro block mb-1.5">Weight (grams, optional)</label>
              <input
                type="number"
                min={0}
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="label-micro block mb-1.5">Tags (comma-separated)</label>
              <input
                value={form.tagsText}
                onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : isNew ? 'Create Product' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
