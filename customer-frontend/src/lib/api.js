import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const ACCESS_TOKEN_KEY = 'orgion_customer_access_token';
const REFRESH_TOKEN_KEY = 'orgion_customer_refresh_token';

function readStorage(key) {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key) || sessionStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

function writeStorage(key, val) {
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

let inMemoryToken = readStorage(ACCESS_TOKEN_KEY);
let inMemoryRefreshToken = readStorage(REFRESH_TOKEN_KEY);
let authFailureHandler = null;

export function registerAuthFailureHandler(fn) {
  authFailureHandler = fn;
}

export function setInMemoryToken(token, refreshToken) {
  inMemoryToken = token || null;
  writeStorage(ACCESS_TOKEN_KEY, inMemoryToken);
  if (refreshToken !== undefined) {
    inMemoryRefreshToken = refreshToken || null;
    writeStorage(REFRESH_TOKEN_KEY, inMemoryRefreshToken);
  }
}

export function clearStoredTokens() {
  inMemoryToken = null;
  inMemoryRefreshToken = null;
  writeStorage(ACCESS_TOKEN_KEY, null);
  writeStorage(REFRESH_TOKEN_KEY, null);
}

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = inMemoryToken || readStorage(ACCESS_TOKEN_KEY);
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
      !original?.url?.includes('/auth/register') &&
      !original?.url?.includes('/auth/refresh')
    ) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          const fallbackRefresh = inMemoryRefreshToken || readStorage(REFRESH_TOKEN_KEY);
          refreshPromise = axios
            .post(
              `${API_BASE}/v1/auth/refresh`,
              fallbackRefresh ? { refreshToken: fallbackRefresh } : {},
              { withCredentials: true }
            )
            .finally(() => {
              refreshPromise = null;
            });
        }
        const refreshRes = await refreshPromise;
        const newToken = refreshRes.data?.data?.accessToken;
        const newRefresh = refreshRes.data?.data?.refreshToken;
        if (newToken) {
          setInMemoryToken(newToken, newRefresh);
          original.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(original);
      } catch (refreshErr) {
        clearStoredTokens();
        const isInitialHydrate = original?.url?.includes('/auth/me');
        if (!isInitialHydrate && typeof authFailureHandler === 'function') {
          authFailureHandler();
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

export function getErrorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || err?.message || fallback;
}

export default api;
