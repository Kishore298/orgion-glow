import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, User, Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { LUXURY_EASE } from '../common/MotionPrimitives';

const NAV_LINKS = [
  { to: '/shop', label: 'Shop' },
  { to: '/offers', label: 'Offers' },
  { to: '/category/skin-care', label: 'Skincare' },
  { to: '/category/lip-care', label: 'Lip Care' },
  { to: '/#why-us', label: 'Why Us', isHash: true, hashId: 'why-us' },
  { to: '/#our-story', label: 'Our Story', isHash: true, hashId: 'our-story' },
  { to: '/#reviews', label: 'Customer Reviews', isHash: true, hashId: 'reviews' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const items = useCartStore((s) => s.items);
  const openMiniCart = useCartStore((s) => s.openMiniCart);
  const user = useAuthStore((s) => s.user);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const itemCount = items.reduce((sum, i) => sum + Number(i.qty || 1), 0);

  // Lock background page scrolling while mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.hash]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchTerm.trim();
    setSearchOpen(false);
    setMobileOpen(false);
    navigate(q ? `/shop?search=${encodeURIComponent(q)}` : '/shop');
  };

  const handleHashClick = (e, hashId) => {
    setMobileOpen(false);
    if (location.pathname === '/') {
      e.preventDefault();
      document.getElementById(hashId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `/#${hashId}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Mobile menu button */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-text hover:text-primary"
          >
            <Menu size={22} />
          </button>
        </div>

        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 py-1" aria-label="ORGION Home">
          <img
            src="/orgion-logo.png"
            alt="ORGION — The Secret Glow"
            className="h-14 sm:h-[68px] w-auto object-contain"
          />
        </Link>

        {/* Center Nav Links (Tablet + Desktop) */}
        <nav
          className="hidden md:flex items-center gap-3.5 lg:gap-6 whitespace-nowrap"
          aria-label="Main navigation"
        >
          {NAV_LINKS.map((link) =>
            link.isHash ? (
              <Link
                key={link.to}
                to={link.to}
                onClick={(e) => handleHashClick(e, link.hashId)}
                className={`relative py-1 text-[13px] lg:text-sm font-medium transition-colors ${
                  location.pathname === '/' && location.hash === `#${link.hashId}`
                    ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1.5px] after:bg-primary'
                    : 'text-text hover:text-primary'
                }`}
              >
                {link.label}
              </Link>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `relative py-1 text-[13px] lg:text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1.5px] after:bg-primary'
                      : 'text-text hover:text-primary'
                  }`
                }
              >
                {link.label}
              </NavLink>
            )
          )}
        </nav>

        {/* Right Icons */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            aria-label="Search products"
            onClick={() => setSearchOpen((o) => !o)}
            className="p-2 text-text transition-colors hover:text-primary"
          >
            <Search size={20} strokeWidth={1.7} />
          </button>

          <button
            type="button"
            aria-label={`Shopping bag with ${itemCount} items`}
            onClick={openMiniCart}
            className="relative p-2 text-text transition-colors hover:text-primary"
          >
            <ShoppingBag size={20} strokeWidth={1.7} />
            {itemCount > 0 && (
              <motion.span
                key={itemCount}
                initial={{ scale: 0.7 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
                className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-white"
              >
                {itemCount}
              </motion.span>
            )}
          </button>

          <Link
            to={user ? '/account' : '/login'}
            aria-label={user ? 'My account' : 'Sign in'}
            className="flex items-center gap-1.5 p-2 text-text transition-colors hover:text-primary"
          >
            <User size={20} strokeWidth={1.7} />
            {user && (
              <span className="hidden lg:inline text-xs font-medium text-text-muted max-w-[90px] truncate">
                {user.name?.split(' ')[0]}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Expandable Search Bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: LUXURY_EASE }}
            className="overflow-hidden border-t border-border bg-surface"
          >
            <form
              onSubmit={handleSearchSubmit}
              className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3"
            >
              <input
                type="search"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search soaps, night cream, lip balms..."
                className="input-field"
              />
              <button type="submit" className="btn-primary shrink-0">
                Search
              </button>
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
                className="p-2 text-text-muted hover:text-text"
              >
                <X size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portal Mobile Drawer so backdrop-filter on header never traps fixed positioning */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {mobileOpen && (
              <div className="fixed inset-0 z-[100] flex md:hidden" role="dialog" aria-modal="true">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
                  onClick={() => setMobileOpen(false)}
                />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ duration: 0.26, ease: LUXURY_EASE }}
                  className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col bg-background shadow-2xl border-r border-border"
                >
                  {/* Drawer header */}
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <img
                      src="/orgion-logo.png"
                      alt="ORGION"
                      className="h-11 w-auto object-contain"
                    />
                    <button
                      type="button"
                      aria-label="Close menu"
                      onClick={() => setMobileOpen(false)}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted hover:text-text"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Drawer links with >=44px tap targets */}
                  <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
                    {NAV_LINKS.map((link) =>
                      link.isHash ? (
                        <Link
                          key={link.to}
                          to={link.to}
                          onClick={(e) => handleHashClick(e, link.hashId)}
                          className="flex min-h-[44px] items-center rounded-xl px-3.5 text-[15px] font-medium text-text hover:bg-surface-muted hover:text-primary"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            `flex min-h-[44px] items-center rounded-xl px-3.5 text-[15px] font-medium transition-colors ${
                              isActive
                                ? 'bg-primary-soft text-primary-dark'
                                : 'text-text hover:bg-surface-muted hover:text-primary'
                            }`
                          }
                        >
                          {link.label}
                        </NavLink>
                      )
                    )}
                  </nav>

                  {/* Bottom CTA */}
                  <div className="border-t border-border p-5 bg-surface-muted/60">
                    <Link
                      to={user ? '/account' : '/login'}
                      onClick={() => setMobileOpen(false)}
                      className="btn-primary w-full min-h-[44px] text-sm"
                    >
                      {user ? 'My Account' : 'Sign In / Register'}
                    </Link>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </header>
  );
}
