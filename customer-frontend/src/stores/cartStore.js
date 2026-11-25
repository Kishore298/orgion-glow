import { create } from 'zustand';
import api from '../lib/api';
import { resolveImageUrl } from '../lib/format';

const GUEST_CART_KEY = 'orgion_guest_cart';

function readGuestCart() {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeGuestCart(items) {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

function computeLocalTotals(items) {
  const subtotal = items.reduce(
    (sum, item) => (item.inStock !== false ? sum + Number(item.price || 0) * Number(item.qty || 1) : sum),
    0
  );
  return { subtotal };
}

export const useCartStore = create((set, get) => ({
  items: readGuestCart(),
  subtotal: computeLocalTotals(readGuestCart()).subtotal,
  totalWeight: 0,
  notices: [],
  miniCartOpen: false,
  isSyncing: false,

  openMiniCart: () => set({ miniCartOpen: true }),
  closeMiniCart: () => set({ miniCartOpen: false }),
  dismissNotices: () => set({ notices: [] }),

  loadCart: async (isLoggedIn) => {
    set({ isSyncing: true });
    try {
      if (isLoggedIn) {
        const res = await api.get('/v1/cart');
        const d = res.data?.data || { items: [], subtotal: 0, totalWeight: 0, notices: [] };
        set({
          items: d.items,
          subtotal: d.subtotal,
          totalWeight: d.totalWeight,
          notices: d.notices || [],
          isSyncing: false,
        });
      } else {
        const guest = readGuestCart();
        if (guest.length === 0) {
          set({ items: [], subtotal: 0, totalWeight: 0, notices: [], isSyncing: false });
          return;
        }
        const res = await api.post('/v1/cart/validate', { items: guest });
        const d = res.data?.data || { items: [], subtotal: 0, totalWeight: 0, notices: [] };
        writeGuestCart(d.items);
        set({
          items: d.items,
          subtotal: d.subtotal,
          totalWeight: d.totalWeight,
          notices: d.notices || [],
          isSyncing: false,
        });
      }
    } catch {
      set({ isSyncing: false });
    }
  },

  syncGuestToUser: async () => {
    const guest = readGuestCart();
    try {
      const res = await api.post('/v1/cart/sync', { items: guest });
      const d = res.data?.data || { items: [], subtotal: 0, totalWeight: 0, notices: [] };
      localStorage.removeItem(GUEST_CART_KEY);
      set({
        items: d.items,
        subtotal: d.subtotal,
        totalWeight: d.totalWeight,
        notices: d.notices || [],
      });
    } catch {
      await get().loadCart(true);
    }
  },

  addItem: async (product, qty = 1, isLoggedIn = false, openDrawer = true) => {
    const productId = product._id || product.productId;
    if (isLoggedIn) {
      const res = await api.post('/v1/cart/items', { productId, qty });
      const d = res.data?.data;
      set({
        items: d.items,
        subtotal: d.subtotal,
        totalWeight: d.totalWeight,
        notices: d.notices || [],
        ...(openDrawer ? { miniCartOpen: true } : {}),
      });
      return;
    }

    const current = [...get().items];
    const existingIdx = current.findIndex((i) => String(i.productId) === String(productId));
    if (existingIdx >= 0) {
      current[existingIdx] = {
        ...current[existingIdx],
        qty: Math.min(20, current[existingIdx].qty + qty),
      };
    } else {
      const primaryImg =
        product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url || product.image || '';
      current.push({
        productId,
        slug: product.slug,
        name: product.name,
        price: product.price,
        mrp: product.mrp,
        image: resolveImageUrl(primaryImg, 400),
        inStock: product.inStock !== false,
        weight: product.weight || 0,
        qty,
        lineTotal: product.price * qty,
      });
    }
    writeGuestCart(current);
    set({
      items: current,
      subtotal: computeLocalTotals(current).subtotal,
      ...(openDrawer ? { miniCartOpen: true } : {}),
    });
  },

  updateQty: async (productId, qty, isLoggedIn = false) => {
    if (isLoggedIn) {
      const res = await api.patch(`/v1/cart/items/${productId}`, { qty });
      const d = res.data?.data;
      set({
        items: d.items,
        subtotal: d.subtotal,
        totalWeight: d.totalWeight,
        notices: d.notices || [],
      });
      return;
    }
    let next = get().items.map((i) =>
      String(i.productId) === String(productId)
        ? { ...i, qty: Math.min(20, qty), lineTotal: i.price * Math.min(20, qty) }
        : i
    );
    if (qty <= 0) {
      next = next.filter((i) => String(i.productId) !== String(productId));
    }
    writeGuestCart(next);
    set({ items: next, subtotal: computeLocalTotals(next).subtotal });
  },

  removeItem: async (productId, isLoggedIn = false) => {
    if (isLoggedIn) {
      const res = await api.delete(`/v1/cart/items/${productId}`);
      const d = res.data?.data;
      set({
        items: d.items,
        subtotal: d.subtotal,
        totalWeight: d.totalWeight,
        notices: d.notices || [],
      });
      return;
    }
    const next = get().items.filter((i) => String(i.productId) !== String(productId));
    writeGuestCart(next);
    set({ items: next, subtotal: computeLocalTotals(next).subtotal });
  },

  clearCart: () => {
    localStorage.removeItem(GUEST_CART_KEY);
    set({ items: [], subtotal: 0, totalWeight: 0, notices: [] });
  },
}));
