const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const BRAND_LOGO_FALLBACK = '/orgion-logo.png';

export function formatINR(amount) {
  const num = Number(amount || 0);
  if (!Number.isFinite(num)) return '₹0';
  return inrFormatter.format(num);
}

export function formatDate(dateInput) {
  if (!dateInput) return '—';
  return new Date(dateInput).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateInput) {
  if (!dateInput) return '—';
  return new Date(dateInput).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(
  /\/api\/?$/,
  ''
);

export function resolveImageUrl(url, width = 400) {
  if (!url) {
    return BRAND_LOGO_FALLBACK;
  }
  if (url.startsWith('/uploads/')) return `${BACKEND_ORIGIN}${url}`;
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`);
  }
  return url;
}
