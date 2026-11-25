import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import { useAdminAuthStore } from './stores/adminAuthStore';
import { subscribeAdminForegroundMessages, syncAdminPushIfGranted } from './lib/firebase';
import ScrollManager from './components/common/ScrollManager';
import AdminLayout from './components/layout/AdminLayout';
import AdminLoginPage from './pages/AdminLoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminOrdersPage from './pages/AdminOrdersPage';
import AdminOrderDetailPage from './pages/AdminOrderDetailPage';
import ProductsPage from './pages/ProductsPage';
import ProductEditorPage from './pages/ProductEditorPage';
import CategoriesPage from './pages/CategoriesPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import AdminReviewsPage from './pages/AdminReviewsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30 * 1000, retry: 1, refetchOnWindowFocus: false },
  },
});

function AdminProtectedRoute({ children }) {
  const user = useAdminAuthStore((s) => s.user);
  const isHydrated = useAdminAuthStore((s) => s.isHydrated);

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-sm text-text-muted">
        Loading ORGION Admin...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <AdminLayout>{children}</AdminLayout>;
}

export default function App() {
  const hydrate = useAdminAuthStore((s) => s.hydrate);
  const user = useAdminAuthStore((s) => s.user);
  const isHydrated = useAdminAuthStore((s) => s.isHydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated || !user?._id) return;
    syncAdminPushIfGranted().then((ok) => {
      if (ok && !user.hasPushEnabled) {
        useAdminAuthStore.setState((s) => ({
          user: s.user ? { ...s.user, hasPushEnabled: true } : s.user,
        }));
      }
    });
  }, [isHydrated, user?._id, user?.hasPushEnabled]);

  useEffect(() => {
    let unsub = () => {};
    subscribeAdminForegroundMessages((payload) => {
      const title = payload?.notification?.title || 'New ORGION Order';
      const body = payload?.notification?.body || '';
      toast.success(`${title}${body ? ` — ${body}` : ''}`, { duration: 6000 });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    }).then((fn) => {
      unsub = fn;
    });
    return () => unsub();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <ScrollManager />
          <Routes>
          <Route path="/login" element={<AdminLoginPage />} />
          <Route
            path="/"
            element={
              <AdminProtectedRoute>
                <DashboardPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <AdminProtectedRoute>
                <AdminOrdersPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <AdminProtectedRoute>
                <AdminOrderDetailPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <AdminProtectedRoute>
                <ProductsPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/products/:id"
            element={
              <AdminProtectedRoute>
                <ProductEditorPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <AdminProtectedRoute>
                <CategoriesPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <AdminProtectedRoute>
                <CustomersPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <AdminProtectedRoute>
                <CustomerDetailPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/reviews"
            element={
              <AdminProtectedRoute>
                <AdminReviewsPage />
              </AdminProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </MotionConfig>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
