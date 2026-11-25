import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { formatDate, formatINR } from '../lib/format';
import { useAdminAuthStore } from '../stores/adminAuthStore';

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const adminUser = useAdminAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [blocked, setBlocked] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', search, blocked, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (blocked) params.set('blocked', blocked);
      const res = await api.get(`/v1/admin/customers?${params.toString()}`);
      return res.data?.data;
    },
  });

  const handleToggleBlock = async (cust) => {
    try {
      await api.patch(`/v1/admin/customers/${cust._id}/block`, { isBlocked: !cust.isBlocked });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      toast.success(cust.isBlocked ? 'Customer unblocked' : 'Customer blocked');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const customers = data?.items || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-3.5 sm:space-y-4 lg:space-y-6">
      <div>
        <span className="label-micro">Audience</span>
        <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-semibold text-primary-dark">Customers</h1>
      </div>

      <div className="admin-card p-2.5 sm:p-4 grid grid-cols-12 gap-2 sm:gap-3">
        <div className="relative col-span-7 sm:col-span-8">
          <Search size={14} className="absolute left-2.5 sm:left-3 top-2.5 sm:top-3 text-text-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name, mobile, email..."
            className="input-field pl-8 sm:pl-9"
          />
        </div>
        <select
          value={blocked}
          onChange={(e) => {
            setBlocked(e.target.value);
            setPage(1);
          }}
          className="input-field col-span-5 sm:col-span-4"
        >
          <option value="">All Statuses</option>
          <option value="false">Active</option>
          <option value="true">Blocked</option>
        </select>
      </div>

      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-surface-muted border-b border-border text-[10.5px] sm:text-[11px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Customer</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Joined</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Orders</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Total Spent</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Last Order</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3">Status</th>
                <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c._id} className="hover:bg-surface-muted/50">
                    <td className="px-4 py-3">
                      <Link to={`/customers/${c.mobile}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                      <p className="text-xs text-text-muted">
                        {c.mobile} · {c.email || 'no email'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">{c.totalOrders}</td>
                    <td className="px-4 py-3 font-sans font-semibold tabular-nums text-primary">
                      {formatINR(c.totalSpent)}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">{formatDate(c.lastOrderDate)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          c.isBlocked
                            ? 'bg-red-50 text-status-danger'
                            : 'bg-primary-soft text-status-success'
                        }`}
                      >
                        {c.isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {adminUser?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleToggleBlock(c)}
                          className="btn-ghost min-h-[30px] px-3 text-xs"
                        >
                          {c.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      )}
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
    </div>
  );
}
