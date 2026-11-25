import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MotionConfig } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import { useCartStore } from './stores/cartStore';
import { subscribeForegroundMessages, syncPushIfGranted } from './lib/firebase';
import ErrorBoundary from './components/common/ErrorBoundary';
import ScrollManager from './components/common/ScrollManager';
import { MotionPage } from './components/common/MotionPrimitives';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/common/ProtectedRoute';

import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ReviewsPage from './pages/ReviewsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrderFailedPage from './pages/OrderFailedPage';
import AccountPage from './pages/AccountPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import { LoginPage, RegisterPage, ForgotPasswordPage } from './pages/AuthPages';
import {
  OurStoryPage,
  TermsPage,
  PrivacyPage,
  ShippingReturnsPage,
  ContactPage,
} from './pages/StaticPages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <span className="label-micro">404</span>
      <h1 className="mt-2 font-serif text-4xl font-semibold text-primary-dark">Page Not Found</h1>
      <p className="mt-3 text-sm text-text-muted">
        The botanical path you followed doesn’t exist.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Return Home
      </Link>
    </div>
  );
}

function AppBootstrap({ children }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const loadCart = useCartStore((s) => s.loadCart);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated) {
      loadCart(Boolean(user));
    }
  }, [isHydrated, user?._id, loadCart]);

  useEffect(() => {
    if (!isHydrated || !user?._id) return;
    syncPushIfGranted().then((ok) => {
      if (ok && !user.hasPushEnabled) {
        useAuthStore.setState((s) => ({
          user: s.user ? { ...s.user, hasPushEnabled: true } : s.user,
        }));
      }
    });
  }, [isHydrated, user?._id, user?.hasPushEnabled]);

  useEffect(() => {
    let unsub = () => {};
    subscribeForegroundMessages((payload) => {
      const title = payload?.notification?.title || 'ORGION Update';
      const body = payload?.notification?.body || '';
      toast.success(`${title}${body ? `: ${body}` : ''}`);
    }).then((fn) => {
      unsub = fn;
    });
    return () => unsub();
  }, []);

  return children;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <MotionPage key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/category/:slug" element={<ShopPage />} />
        <Route path="/product/:slug" element={<ProductDetailPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/cart" element={<CartPage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route path="/our-story" element={<OurStoryPage />} />
        <Route path="/terms-and-conditions" element={<TermsPage />} />
        <Route path="/privacy-policy" element={<PrivacyPage />} />
        <Route path="/shipping-returns" element={<ShippingReturnsPage />} />
        <Route path="/contact" element={<ContactPage />} />

        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-success/:orderRef"
          element={
            <ProtectedRoute>
              <OrderSuccessPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-failed"
          element={
            <ProtectedRoute>
              <OrderFailedPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/orders/:id"
          element={
            <ProtectedRoute>
              <OrderDetailPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MotionPage>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MotionConfig reducedMotion="user">
            <BrowserRouter>
              <ScrollManager />
              <AppBootstrap>
                <Layout>
                  <AnimatedRoutes />
                </Layout>
              </AppBootstrap>
              <Toaster
                position="top-center"
                toastOptions={{
                  style: {
                    background: '#FFFFFF',
                    color: '#1C1C1C',
                    border: '1px solid #ECE8E1',
                    borderRadius: '12px',
                    fontSize: '13px',
                  },
                }}
              />
            </BrowserRouter>
          </MotionConfig>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
