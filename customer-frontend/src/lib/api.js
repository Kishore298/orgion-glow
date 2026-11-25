import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SESSION_TOKEN_KEY = 'orgion_customer_access_token';

function readStoredToken() {
  try {
    return typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

let inMemoryToken = readStoredToken();
export function setInMemoryToken(token) {
  inMemoryToken = token || null;
  try {
    if (typeof window !== 'undefined') {
      if (inMemoryToken) sessionStorage.setItem(SESSION_TOKEN_KEY, inMemoryToken);
      else sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore storage restrictions
  }
}

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (inMemoryToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
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
          refreshPromise = axios
            .post(`${API_BASE}/v1/auth/refresh`, {}, { withCredentials: true })
            .finally(() => {
              refreshPromise = null;
            });
        }
        const refreshRes = await refreshPromise;
        const newToken = refreshRes.data?.data?.accessToken;
        if (newToken) {
          setInMemoryToken(newToken);
          original.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(original);
      } catch (refreshErr) {
        if (refreshErr?.response?.status === 401 || refreshErr?.response?.status === 403) {
          setInMemoryToken(null);
        }
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || err?.message || fallback;
}

export default api;
