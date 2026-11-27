import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Mail, Phone } from 'lucide-react';
import { useSiteConfig } from '../../hooks/useSiteConfig';
import { OfficialInstagramIcon, OfficialWhatsAppIcon } from '../common/BrandIcons';

export default function Footer() {
  const siteConfig = useSiteConfig();
  const location = useLocation();
  const year = new Date().getFullYear();
  const addr = siteConfig.businessAddress || {};

  const handleOurStoryClick = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      document.getElementById('our-story')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', '/#our-story');
    }
  };

  return (
    <footer className="bg-footer-bg text-text border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-7 sm:py-10">
        <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-4 space-y-3.5">
            <Link to="/" className="inline-block" aria-label="ORGION Home">
              <img
                src="/orgion-logo.png"
                alt="ORGION — The Secret Glow"
                className="h-14 sm:h-20 w-auto object-contain"
              />
            </Link>
            <p className="text-xs sm:text-sm leading-relaxed text-text-muted max-w-xs">
              Homemade, herbal lip care and skin care crafted in small batches with carefully selected ingredients.
            </p>
            <div className="flex items-center gap-3 pt-1">
              {siteConfig.socialLinks?.instagram && (
                <a
                  href={siteConfig.socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow ORGION on Instagram"
                  title="Instagram (@orgion.we)"
                  className="inline-flex items-center justify-center rounded-xl transition-transform hover:scale-105"
                >
                  <OfficialInstagramIcon size={28} />
                </a>
              )}
              <a
                href={`https://wa.me/${siteConfig.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat with ORGION on WhatsApp"
                title="WhatsApp"
                className="inline-flex items-center justify-center rounded-full transition-transform hover:scale-105"
              >
                <OfficialWhatsAppIcon size={30} />
              </a>
            </div>
          </div>

          {/* Explore */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="label-micro mb-3.5 inline-block border-b border-primary/50 pb-1 text-text">
              Explore
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-text-muted">
              <li><Link to="/shop" className="hover:text-primary">Shop</Link></li>
              <li><Link to="/offers" className="hover:text-primary">Offers</Link></li>
              <li>
                <Link to="/#our-story" onClick={handleOurStoryClick} className="hover:text-primary">
                  Our Story
                </Link>
              </li>
              <li><Link to="/reviews" className="hover:text-primary">Customer Reviews</Link></li>
            </ul>
          </div>

          {/* Helpful Links */}
          <div className="col-span-1 md:col-span-3">
            <h4 className="label-micro mb-3.5 inline-block border-b border-primary/50 pb-1 text-text">
              Helpful Links
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-text-muted">
              <li><Link to="/shipping-returns" className="hover:text-primary">Shipping & Returns</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-primary">Privacy Policy</Link></li>
              <li><Link to="/terms-and-conditions" className="hover:text-primary">Terms & Conditions</Link></li>
              <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
            </ul>
          </div>

          {/* Address */}
          <div className="col-span-2 md:col-span-3">
            <h4 className="label-micro mb-3.5 inline-block border-b border-primary/50 pb-1 text-text">
              Address
            </h4>
            <div className="space-y-2 text-xs sm:text-sm text-text-muted">
              <div className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-text">{addr.companyName || 'ORGION'}</p>
                  <p>{addr.line1 || 'Nagercoil'}</p>
                  <p>{addr.line2 || 'Tamil Nadu, India'}</p>
                </div>
              </div>
              <p className="flex items-center gap-2">
                <Mail size={14} className="shrink-0 text-primary" />
                <a href={`mailto:${siteConfig.supportEmail}`} className="hover:text-primary">
                  {siteConfig.supportEmail}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Phone size={14} className="shrink-0 text-primary" />
                <span>{siteConfig.supportPhone}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 sm:mt-12 border-t border-black/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted text-center sm:text-left">
          <p>&copy; {year} {siteConfig.storeName}. {siteConfig.tagline}.</p>
          <p>Handmade Skincare · Nagercoil, India</p>
        </div>
      </div>
    </footer>
  );
}
