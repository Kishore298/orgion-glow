import { create } from 'zustand';
import api, {
  clearAdminTokens,
  registerAdminAuthFailureHandler,
  setAdminToken,
} from '../lib/api';

export const useAdminAuthStore = create((set, get) => ({
  user: null,
  isHydrated: false,

  setSession: (user, accessToken, refreshToken) => {
    if (accessToken) setAdminToken(accessToken, refreshToken);
    set({ user, isHydrated: true });
  },

  clearSession: () => {
    clearAdminTokens();
    set({ user: null, isHydrated: true });
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
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403 || !get().user) {
        set({ user: null, isHydrated: true });
      } else {
        set({ isHydrated: true });
      }
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
      clearAdminTokens();
      set({ user: null });
    }
  },
}));

registerAdminAuthFailureHandler(() => {
  useAdminAuthStore.getState().clearSession();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
});
