import { create } from 'zustand';
import api, { setInMemoryToken } from '../lib/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  isHydrated: false,
  isLoading: false,

  setSession: (user, accessToken) => {
    if (accessToken) setInMemoryToken(accessToken);
    set({ user, isHydrated: true });
  },

  clearSession: () => {
    setInMemoryToken(null);
    set({ user: null, isHydrated: true });
  },

  hydrate: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const res = await api.get('/v1/auth/me');
      set({ user: res.data?.data?.user || null, isHydrated: true, isLoading: false });
    } catch (err) {
      const status = err?.response?.status;
      // Preserve active in-memory user on transient network/5xx/rate-limit errors
      if (status === 401 || status === 403 || !get().user) {
        set({ user: null, isHydrated: true, isLoading: false });
      } else {
        set({ isHydrated: true, isLoading: false });
      }
    }
  },

  logout: async () => {
    try {
      const token = localStorage.getItem('orgion_fcm_token');
      if (token) {
        await api.delete('/v1/notifications/push-token', { data: { token } }).catch(() => {});
        localStorage.removeItem('orgion_fcm_token');
      }
      await api.post('/v1/auth/logout');
    } catch {
      // ignore
    } finally {
      setInMemoryToken(null);
      set({ user: null });
    }
  },
}));
