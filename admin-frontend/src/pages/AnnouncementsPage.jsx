import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [dragIdx, setDragIdx] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-site-settings'],
    queryFn: async () => {
      const res = await api.get('/v1/admin/site-settings');
      return res.data?.data;
    },
  });

  const announcements = data?.announcements || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] });

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = newText.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await api.post('/v1/admin/announcements', { text: trimmed, isActive: true });
      setNewText('');
      toast.success('Announcement added');
      invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const handleSaveEdit = async (id) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    try {
      await api.patch(`/v1/admin/announcements/${id}`, { text: trimmed });
      setEditingId(null);
      setEditText('');
      toast.success('Announcement updated');
      invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleToggleVisible = async (item) => {
    try {
      await api.patch(`/v1/admin/announcements/${item._id}`, { isActive: !item.isActive });
      toast.success(item.isActive ? 'Announcement hidden' : 'Announcement shown');
      invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete announcement "${item.text}"?`)) return;
    try {
      await api.delete(`/v1/admin/announcements/${item._id}`);
      toast.success('Announcement deleted');
      invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const persistOrder = async (reordered) => {
    try {
      await api.patch('/v1/admin/announcements/reorder', {
        items: reordered.map((a, idx) => ({ id: a._id, sortOrder: idx })),
      });
      toast.success('Order updated');
      invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleMove = async (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= announcements.length) return;
    const next = [...announcements];
    [next[idx], next[target]] = [next[target], next[idx]];
    await persistOrder(next);
  };

  const handleDropReorder = async (dropIdx) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const next = [...announcements];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(dropIdx, 0, moved);
    setDragIdx(null);
    await persistOrder(next);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <span className="label-micro">Storefront Banner</span>
        <h1 className="mt-0.5 font-serif text-xl sm:text-2xl font-semibold text-primary-dark">
          Announcements
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-text-muted">
          Messages scroll in the top marquee bar. If none are active, the bar is hidden automatically.
        </p>
      </div>

      {/* Add new announcement */}
      <form onSubmit={handleAdd} className="admin-card p-3.5 sm:p-5 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        <div className="relative flex-1">
          <Megaphone size={15} className="absolute left-3 top-2.5 sm:top-3 text-text-muted" />
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            maxLength={220}
            placeholder="e.g. Free shipping updates • New Lip Balms are here"
            className="input-field pl-9"
          />
        </div>
        <button type="submit" disabled={adding || !newText.trim()} className="btn-primary shrink-0">
          <Plus size={15} /> {adding ? 'Adding...' : 'Add Message'}
        </button>
      </form>

      {/* Existing announcements */}
      <div className="admin-card p-3.5 sm:p-5 space-y-2.5">
        <p className="text-xs text-text-muted">
          Drag by the grip handle or use the up/down arrows to change display order.
        </p>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-text-muted">Loading announcements...</p>
        ) : announcements.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">
            No announcements yet. Add one above to show the top marquee bar.
          </p>
        ) : (
          <div className="space-y-2">
            {announcements.map((item, idx) => (
              <div
                key={item._id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropReorder(idx)}
                className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 rounded-xl border p-3 transition ${
                  item.isActive
                    ? 'border-border bg-surface-muted'
                    : 'border-dashed border-border bg-surface opacity-70'
                }`}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <GripVertical size={17} className="text-text-muted cursor-grab shrink-0" />
                  {editingId === item._id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        maxLength={220}
                        autoFocus
                        className="input-field flex-1"
                      />
                      <button
                        type="button"
                        aria-label="Save announcement"
                        onClick={() => handleSaveEdit(item._id)}
                        className="btn-primary min-h-[34px] px-2.5"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel edit"
                        onClick={() => {
                          setEditingId(null);
                          setEditText('');
                        }}
                        className="btn-ghost min-h-[34px] px-2.5"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text break-words">{item.text}</p>
                      <span
                        className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                          item.isActive
                            ? 'bg-primary-soft text-primary-dark'
                            : 'bg-surface-muted text-text-muted border border-border'
                        }`}
                      >
                        {item.isActive ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                  )}
                </div>

                {editingId !== item._id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, -1)}
                      className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-text disabled:opacity-35"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={idx === announcements.length - 1}
                      onClick={() => handleMove(idx, 1)}
                      className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-text disabled:opacity-35"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={item.isActive ? 'Hide announcement' : 'Show announcement'}
                      onClick={() => handleToggleVisible(item)}
                      className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-primary"
                      title={item.isActive ? 'Hide' : 'Show'}
                    >
                      {item.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button
                      type="button"
                      aria-label="Edit announcement"
                      onClick={() => {
                        setEditingId(item._id);
                        setEditText(item.text);
                      }}
                      className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-primary"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete announcement"
                      onClick={() => handleDelete(item)}
                      className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-status-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
