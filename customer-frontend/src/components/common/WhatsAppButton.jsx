import React from 'react';
import { useSiteConfig } from '../../hooks/useSiteConfig';
import { OfficialWhatsAppIcon } from './BrandIcons';

export default function WhatsAppButton({ productName }) {
  const siteConfig = useSiteConfig();

  const text = productName
    ? `Hello ORGION! I have a question about ${productName} (${window.location.href})`
    : siteConfig.whatsappDefaultMessage;

  const href = `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(text)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us"
      className="group fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_6px_22px_rgba(37,211,102,0.38)] ring-1 ring-black/5 transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-whatsapp/30"
    >
      <OfficialWhatsAppIcon size={46} />
      <span className="pointer-events-none absolute right-16 hidden whitespace-nowrap rounded-lg bg-text px-2.5 py-1 text-xs font-medium text-white shadow group-hover:block">
        Chat with us
      </span>
    </a>
  );
}
