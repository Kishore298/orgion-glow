import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const ADMIN_ACCESS_TOKEN_KEY = 'orgion_admin_access_token';
const ADMIN_REFRESH_TOKEN_KEY = 'orgion_admin_refresh_token';

function readAdminStorage(key) {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key) || sessionStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

function writeAdminStorage(key, val) {
  try {
    if (typeof window === 'undefined') return;
    if (val) {
      localStorage.setItem(key, val);
      sessionStorage.setItem(key, val);
    } else {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore storage restrictions
  }
}

let inMemoryToken = readAdminStorage(ADMIN_ACCESS_TOKEN_KEY);
let inMemoryRefreshToken = readAdminStorage(ADMIN_REFRESH_TOKEN_KEY);
let adminAuthFailureHandler = null;

export function registerAdminAuthFailureHandler(fn) {
  adminAuthFailureHandler = fn;
}

export function setAdminToken(token, refreshToken) {
  inMemoryToken = token || null;
  writeAdminStorage(ADMIN_ACCESS_TOKEN_KEY, inMemoryToken);
  if (refreshToken !== undefined) {
    inMemoryRefreshToken = refreshToken || null;
    writeAdminStorage(ADMIN_REFRESH_TOKEN_KEY, inMemoryRefreshToken);
  }
}

export function clearAdminTokens() {
  inMemoryToken = null;
  inMemoryRefreshToken = null;
  writeAdminStorage(ADMIN_ACCESS_TOKEN_KEY, null);
  writeAdminStorage(ADMIN_REFRESH_TOKEN_KEY, null);
}

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'X-Orgion-Portal': 'admin',
  },
});

api.interceptors.request.use((config) => {
  config.headers['X-Orgion-Portal'] = 'admin';
  const token = inMemoryToken || readAdminStorage(ADMIN_ACCESS_TOKEN_KEY);
  if (token) {
    inMemoryToken = token;
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let refreshPromise = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original?._retry &&
      !original?.url?.includes('/auth/login') &&
      !original?.url?.includes('/auth/refresh')
    ) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          const fallbackRefresh = inMemoryRefreshToken || readAdminStorage(ADMIN_REFRESH_TOKEN_KEY);
          refreshPromise = axios
            .post(
              `${API_BASE}/v1/auth/refresh`,
              fallbackRefresh ? { refreshToken: fallbackRefresh } : {},
              {
                withCredentials: true,
                headers: { 'X-Orgion-Portal': 'admin' },
              }
            )
            .finally(() => {
              refreshPromise = null;
            });
        }
        const refreshRes = await refreshPromise;
        const newToken = refreshRes.data?.data?.accessToken;
        const newRefresh = refreshRes.data?.data?.refreshToken;
        if (newToken) {
          setAdminToken(newToken, newRefresh);
          original.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(original);
      } catch (refreshErr) {
        clearAdminTokens();
        const isInitialHydrate = original?.url?.includes('/auth/me');
        if (!isInitialHydrate && typeof adminAuthFailureHandler === 'function') {
          adminAuthFailureHandler();
          const redirectedErr = error;
          redirectedErr.isAuthRedirect = true;
          return Promise.reject(redirectedErr);
        }
        return Promise.reject(refreshErr || error);
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(err, fallback = 'Action failed') {
  return err?.response?.data?.message || err?.message || fallback;
}

export default api;
