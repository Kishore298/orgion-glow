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
  if (!dateInput) return '';
  return new Date(dateInput).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(
  /\/api\/?$/,
  ''
);

export function isFallbackLogo(url) {
  return !url || url === BRAND_LOGO_FALLBACK;
}

export function resolveImageUrl(url, width = 800) {
  if (!url) {
    return BRAND_LOGO_FALLBACK;
  }
  if (url.startsWith('/uploads/')) {
    return `${BACKEND_ORIGIN}${url}`;
  }
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`);
  }
  return url;
}

export function handleImageError(e) {
  if (e.currentTarget.dataset.fallbackApplied) return;
  e.currentTarget.dataset.fallbackApplied = '1';
  e.currentTarget.src = BRAND_LOGO_FALLBACK;
  e.currentTarget.classList.remove('object-cover');
  e.currentTarget.classList.add('object-contain', 'p-5');
}
