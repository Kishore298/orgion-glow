import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Portal-based image lightbox so position:fixed is never trapped inside transformed ancestors.
 */
export default function ImageLightbox({ src, alt = 'Review image preview', onClose }) {
  useEffect(() => {
    if (!src) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [src, onClose]);

  if (!src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="absolute right-5 top-5 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
      >
        <X size={22} />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
      />
    </div>,
    document.body
  );
}
