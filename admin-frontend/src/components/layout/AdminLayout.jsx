import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FolderTree,
  Users,
  MessageSquareHeart,
  LogOut,
  Menu,
  X,
  Bell,
  BellOff,
  Megaphone,
  Ticket,
  Sliders,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdminAuthStore } from '../../stores/adminAuthStore';
import {
  disableAdminPushNotifications,
  enableAdminPushNotifications,
  isAdminPushActiveForUser,
} from '../../lib/firebase';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/categories', label: 'Categories', icon: FolderTree },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/reviews', label: 'Reviews', icon: MessageSquareHeart },
  { to: '/coupons', label: 'Coupons', icon: Ticket },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/settings', label: 'Settings', icon: Sliders },
];

export default function AdminLayout({ children }) {
  const user = useAdminAuthStore((s) => s.user);
  const hydrate = useAdminAuthStore((s) => s.hydrate);
  const logout = useAdminAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [togglingPush, setTogglingPush] = useState(false);
  const pushEnabled = isAdminPushActiveForUser(user);

  const handleToggleAlerts = async () => {
    setTogglingPush(true);
    try {
      if (pushEnabled) {
        await disableAdminPushNotifications();
        useAdminAuthStore.setState((s) => ({
          user: s.user ? { ...s.user, hasPushEnabled: false } : s.user,
        }));
        toast.success('Order push alerts disabled on this device');
      } else {
        const res = await enableAdminPushNotifications();
        if (res.ok) {
          useAdminAuthStore.setState((s) => ({
            user: s.user ? { ...s.user, hasPushEnabled: true } : s.user,
          }));
          toast.success('New order push alerts enabled on this device');
        } else {
          toast.error(res.reason);
        }
      }
      await hydrate();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to update push alert preference'
      );
    } finally {
      setTogglingPush(false);
    }
  };

  const handleLogout = async () => {
    setSidebarOpen(false);
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const SidebarContent = (
    <div className="flex h-full flex-col bg-surface border-r border-border">
      <div className="px-6 py-5 border-b border-border">
        <img
          src="/orgion-logo.png"
          alt="ORGION — The Secret Glow"
          className="h-12 w-auto object-contain"
        />
        <p className="mt-1.5 text-[11px] uppercase tracking-wider text-text-muted">
          Store Operations
        </p>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:bg-surface-muted hover:text-text'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-4 text-xs text-text-muted space-y-3">
        <div>
          <p className="font-medium text-text truncate">{user?.name}</p>
          <p className="uppercase tracking-wider text-[10px]">{user?.role}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="btn-ghost lg:hidden w-full justify-start min-h-[38px] px-3 text-xs text-status-danger border-red-200 hover:bg-red-50"
        >
          <LogOut size={14} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-text">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/35"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 h-full">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-4 p-1.5 text-text-muted"
            >
              <X size={18} />
            </button>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border bg-surface/95 px-3 sm:px-6 lg:px-8 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Toggle sidebar"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-text-muted hover:bg-surface-muted"
            >
              <Menu size={20} />
            </button>
            <span className="text-xs font-medium uppercase tracking-wider text-text-muted hidden sm:inline">
              ORGION Admin Console
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              disabled={togglingPush}
              onClick={handleToggleAlerts}
              title={
                pushEnabled
                  ? 'Order push alerts enabled — click to disable'
                  : 'Enable push alerts for new orders'
              }
              className={`inline-flex items-center gap-1.5 rounded-[10px] border px-3 min-h-[36px] text-xs font-medium transition ${
                pushEnabled
                  ? 'border-primary/30 bg-primary-soft text-primary-dark'
                  : 'border-border bg-surface-muted text-text-muted hover:text-text'
              }`}
            >
              {pushEnabled ? <Bell size={14} /> : <BellOff size={14} />}
              <span className="hidden sm:inline">
                {togglingPush
                  ? '...'
                  : pushEnabled
                  ? 'Order Alerts On'
                  : 'Enable Order Alerts'}
              </span>
            </button>

            <div className="text-right">
              <p className="text-sm font-medium text-text">{user?.name}</p>
              <p className="text-[11px] uppercase tracking-wider text-primary">{user?.role}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-ghost min-h-[36px] px-3 text-xs"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 lg:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
