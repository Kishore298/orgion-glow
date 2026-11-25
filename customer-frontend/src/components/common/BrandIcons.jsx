import React from 'react';

export function OfficialWhatsAppIcon({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#25D366"
        d="M24 4C12.95 4 4 12.95 4 24c0 3.53.92 6.97 2.66 10.01L4 44l10.26-2.61A19.9 19.9 0 0024 44c11.05 0 20-8.95 20-20S35.05 4 24 4z"
      />
      <path
        fill="#FFFFFF"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M34.86 28.43c-.58-.29-3.44-1.7-3.97-1.89-.53-.19-.92-.29-1.31.29-.39.58-1.5 1.89-1.84 2.28-.34.39-.68.44-1.26.15-.58-.29-2.46-.91-4.68-2.89-1.73-1.54-2.9-3.45-3.24-4.03-.34-.58-.04-.89.25-1.18.26-.26.58-.68.87-1.02.29-.34.39-.58.58-.97.19-.39.1-.73-.05-1.02-.15-.29-1.31-3.15-1.79-4.32-.47-1.13-.95-.98-1.31-1-.34-.02-.73-.02-1.12-.02-.39 0-1.02.15-1.55.73-.53.58-2.04 1.99-2.04 4.85s2.09 5.63 2.38 6.02c.29.39 4.11 6.27 9.96 8.8 1.39.6 2.48.96 3.33 1.23 1.4.44 2.67.38 3.68.23 1.12-.17 3.44-1.41 3.93-2.77.48-1.36.48-2.52.34-2.77-.15-.24-.53-.39-1.12-.68z"
      />
    </svg>
  );
}

export function OfficialInstagramIcon({ size = 26, className = '' }) {
  const gradId = 'orgion-ig-gradient';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#FDF497" />
          <stop offset="5%" stopColor="#FDF497" />
          <stop offset="45%" stopColor="#FD5949" />
          <stop offset="60%" stopColor="#D6249F" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="11" fill={`url(#${gradId})`} />
      <rect
        x="11"
        y="11"
        width="26"
        height="26"
        rx="7.5"
        stroke="#FFFFFF"
        strokeWidth="2.8"
      />
      <circle cx="24" cy="24" r="6.2" stroke="#FFFFFF" strokeWidth="2.8" />
      <circle cx="32.2" cy="15.8" r="1.8" fill="#FFFFFF" />
    </svg>
  );
}
