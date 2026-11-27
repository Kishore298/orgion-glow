import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Star, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { formatINR, resolveImageUrl } from '../lib/format';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [inStock, setInStock] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await api.get('/v1/admin/categories');
      return res.data?.data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', search, category, inStock, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (inStock) params.set('inStock', inStock);
      if (status) params.set('status', status);
      const res = await api.get(`/v1/admin/products?${params.toString()}`);
      return res.data?.data;
    },
  });

  const handleToggleStock = async (prod) => {
    try {
      await api.patch(`/v1/admin/products/${prod._id}/stock`, { inStock: !prod.inStock });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success(`${prod.name} marked ${!prod.inStock ? 'In Stock' : 'Out of Stock'}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (prod) => {
    if (!window.confirm(`Delete product "${prod.name}"?`)) return;
    try {
      await api.delete(`/v1/admin/products/${prod._id}`);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('Product deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const products = data?.items || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        <div>
          <span className="label-micro">Formulations</span>
          <h1 className="mt-0.5 font-serif text-xl sm:text-2xl font-semibold text-primary-dark">Products</h1>
        </div>
        <Link to="/products/new" className="btn-primary">
          <Plus size={15} /> Add Product
        </Link>
      </div>

      {/* Filters */}
      <div className="admin-card p-2.5 sm:p-4 grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="relative col-span-3 sm:col-span-1">
          <Search size={14} className="absolute left-2.5 sm:left-3 top-2.5 sm:top-3 text-text-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search products..."
            className="input-field pl-8 sm:pl-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="input-field px-2 sm:px-3"
        >
          <option value="">Category</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={inStock}
          onChange={(e) => {
            setInStock(e.target.value);
            setPage(1);
          }}
          className="input-field px-2 sm:px-3"
        >
          <option value="">Stock</option>
          <option value="true">In Stock</option>
          <option value="false">Out of Stock</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="input-field px-2 sm:px-3"
        >
          <option value="">Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-surface-muted border-b border-border text-[10.5px] sm:text-[11px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3 min-w-[190px] sm:min-w-[230px] lg:min-w-[260px]">Product</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Category</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Price</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Rating</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Stock</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Status</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map((prod) => {
                  const thumb =
                    prod.images?.find((i) => i.isPrimary)?.url || prod.images?.[0]?.url;
                  return (
                    <tr key={prod._id} className="hover:bg-surface-muted/50">
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 min-w-[190px] sm:min-w-[230px] lg:min-w-[260px]">
                        <div className="flex items-center gap-3">
                          <img
                            src={resolveImageUrl(thumb, 150)}
                            alt={prod.name}
                            className="hidden md:block h-11 w-11 shrink-0 rounded-xl object-cover border border-border"
                          />
                          <div className="min-w-0">
                            <Link
                              to={`/products/${prod.slug}`}
                              className="block font-medium text-text hover:text-primary leading-snug"
                            >
                              {prod.name}
                            </Link>
                            <p className="hidden md:block text-xs text-text-muted">/{prod.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-xs text-text-muted whitespace-nowrap">
                        {prod.category?.name || '—'}
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-sans font-semibold tabular-nums text-primary whitespace-nowrap">
                        {formatINR(prod.price)}
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-xs whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Star size={13} className="fill-gold text-gold" />
                          {Number(prod.ratingAvg || 0).toFixed(1)}
                        </span>{' '}
                        <span className="text-text-muted">({prod.ratingCount || 0})</span>
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStock(prod)}
                          className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                            prod.inStock
                              ? 'bg-primary-soft text-status-success'
                              : 'bg-red-50 text-status-danger'
                          }`}
                        >
                          {prod.inStock ? 'In Stock' : 'Out of Stock'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs uppercase text-text-muted">
                        {prod.status}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/products/${prod.slug}`}
                            className="btn-ghost min-h-[32px] px-3 text-xs"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            aria-label={`Delete ${prod.name}`}
                            onClick={() => handleDelete(prod)}
                            className="p-1.5 text-text-muted hover:text-status-danger"
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
