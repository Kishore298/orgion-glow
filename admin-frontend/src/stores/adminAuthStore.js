import { create } from 'zustand';
import api, { setAdminToken } from '../lib/api';

export const useAdminAuthStore = create((set) => ({
  user: null,
  isHydrated: false,

  setSession: (user, accessToken) => {
    if (accessToken) setAdminToken(accessToken);
    set({ user, isHydrated: true });
  },

  hydrate: async () => {
    try {
      const res = await api.get('/v1/auth/me');
      const user = res.data?.data?.user;
      if (user && ['admin', 'staff'].includes(user.role)) {
        set({ user, isHydrated: true });
      } else {
        set({ user: null, isHydrated: true });
      }
    } catch {
      set({ user: null, isHydrated: true });
    }
  },

  logout: async () => {
    try {
      const token = localStorage.getItem('orgion_admin_fcm_token');
      if (token) {
        await api.delete('/v1/notifications/push-token', { data: { token } }).catch(() => {});
        localStorage.removeItem('orgion_admin_fcm_token');
      }
      await api.post('/v1/auth/logout');
    } catch {
      // ignore
    } finally {
      setAdminToken(null);
      set({ user: null });
    }
  },
}));
