import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const scrollMap = new Map();

export default function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const key = location.key || location.pathname;
    const onScroll = () => scrollMap.set(key, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.key, location.pathname]);

  useEffect(() => {
    const key = location.key || location.pathname;
    if (navigationType === 'POP' && scrollMap.has(key)) {
      window.scrollTo({ top: scrollMap.get(key), left: 0, behavior: 'smooth' });
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [location.pathname, location.key, navigationType]);

  return null;
}
