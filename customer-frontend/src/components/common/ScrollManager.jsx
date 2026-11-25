import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORAGE_KEY = 'orgion_scroll_positions';

function readScrollMap() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeScrollMap(map) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Handles smooth scroll-to-top on PUSH/REPLACE (e.g. footer links),
 * smooth scroll to #hash anchors (e.g. /#why-us, /our-story#ingredients),
 * and smooth scroll restoration on browser Back/Forward (POP).
 */
export default function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const prevKeyRef = useRef(location.key);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Continuously track current scroll position for the active history key
  useEffect(() => {
    const key = location.key || location.pathname + location.search;
    prevKeyRef.current = key;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const map = readScrollMap();
        map[key] = window.scrollY;
        // Keep map bounded
        const keys = Object.keys(map);
        if (keys.length > 40) {
          delete map[keys[0]];
        }
        writeScrollMap(map);
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.key, location.pathname, location.search]);

  useEffect(() => {
    const key = location.key || location.pathname + location.search;

    if (location.hash) {
      const targetId = location.hash.replace('#', '');
      let attempts = 0;
      const tryScrollToHash = () => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (attempts < 10) {
          attempts += 1;
          setTimeout(tryScrollToHash, 80);
        }
      };
      requestAnimationFrame(tryScrollToHash);
      return;
    }

    if (navigationType === 'POP') {
      const map = readScrollMap();
      const savedY = map[key];
      if (typeof savedY === 'number') {
        requestAnimationFrame(() => {
          window.scrollTo({ top: savedY, left: 0, behavior: 'smooth' });
        });
        return;
      }
    }

    // Standard route change (PUSH / REPLACE) -> smooth scroll to top
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    });
  }, [location.pathname, location.search, location.hash, location.key, navigationType]);

  return null;
}
