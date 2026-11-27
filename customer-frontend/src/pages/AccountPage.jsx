import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Bell, LogOut, MapPin, Package, Plus, Trash2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import PincodeAddressForm from '../components/common/PincodeAddressForm';
import PasswordInput from '../components/common/PasswordInput';
import BackButton from '../components/common/BackButton';
import {
  disablePushNotifications,
  enablePushNotifications,
  isPushActiveForUser,
} from '../lib/firebase';

export default function AccountPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  const logout = useAuthStore((s) => s.logout);
  const clearCart = useCartStore((s) => s.clearCart);

  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [togglingPush, setTogglingPush] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch('/v1/auth/me', profile);
      await hydrate();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSavingPwd(true);
    try {
      await api.post('/v1/auth/change-password', passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      toast.success('Password updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingPwd(false);
    }
  };

  const handleSaveAddress = async (values) => {
    try {
      if (editingAddress) {
        await api.patch(`/v1/addresses/${editingAddress._id}`, values);
        toast.success('Address updated');
      } else {
        await api.post('/v1/addresses', values);
        toast.success('Address added');
      }
      setShowAddressForm(false);
      setEditingAddress(null);
      await hydrate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!window.confirm('Delete this saved address?')) return;
    try {
      await api.delete(`/v1/addresses/${id}`);
      await hydrate();
      toast.success('Address deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await api.patch(`/v1/addresses/${id}/default`);
      await hydrate();
      toast.success('Default address updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const pushEnabled = isPushActiveForUser(user);

  const handleTogglePush = async () => {
    setTogglingPush(true);
    try {
      if (pushEnabled) {
        await disablePushNotifications();
        useAuthStore.setState((s) => ({
          user: s.user ? { ...s.user, hasPushEnabled: false } : s.user,
        }));
        toast.success('Push notifications disabled');
      } else {
        const res = await enablePushNotifications();
        if (res.ok) {
          useAuthStore.setState((s) => ({
            user: s.user ? { ...s.user, hasPushEnabled: true } : s.user,
          }));
          toast.success('Push notifications enabled on this device');
        } else {
          toast.error(res.reason);
        }
      }
      await hydrate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingPush(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    clearCart();
    toast.success('Signed out');
    navigate('/');
  };

  return (
    <>
      <Helmet>
        <title>My Account — ORGION</title>
      </Helmet>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-3 sm:pt-4 pb-8 sm:pb-10 space-y-4 sm:space-y-5">
        <div>
          <BackButton fallbackTo="/" label="Back" className="mb-1.5 sm:mb-2" />
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5 sm:pb-4">
          <div>
            <span className="label-micro">Welcome</span>
            <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-semibold text-primary-dark">
              {user?.name}
            </h1>
            <p className="text-xs sm:text-sm text-text-muted">{user?.mobile} · {user?.email}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/account/orders" className="btn-primary text-xs sm:text-sm">
              <Package size={15} /> My Orders
            </Link>
            <button type="button" onClick={handleLogout} className="btn-ghost text-xs sm:text-sm">
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Profile details */}
          <form onSubmit={handleSaveProfile} className="luxury-card p-4 sm:p-5 space-y-3 sm:space-y-4">
            <h2 className="font-serif text-lg sm:text-xl font-semibold text-text">Personal Details</h2>
            <div>
              <label className="label-micro block mb-1.5">Full Name</label>
              <input
                required
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-micro block mb-1.5">Email Address</label>
              <input
                required
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="input-field"
              />
            </div>
            <button type="submit" disabled={savingProfile} className="btn-primary">
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          {/* Password & Push Notifications */}
          <div className="space-y-6">
            <form onSubmit={handleChangePassword} className="luxury-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Lock size={17} className="text-primary" />
                <h2 className="font-serif text-2xl font-semibold text-text">Change Password</h2>
              </div>
              <div>
                <label className="label-micro block mb-1.5">Current Password</label>
                <PasswordInput
                  required
                  value={passwords.currentPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, currentPassword: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label-micro block mb-1.5">New Password</label>
                <PasswordInput
                  required
                  minLength={8}
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                />
              </div>
              <button type="submit" disabled={savingPwd} className="btn-ghost">
                {savingPwd ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <div className="luxury-card p-6 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Bell size={19} className="text-primary mt-0.5" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-sm text-text">Shipping Push Notifications</p>
                    {pushEnabled && (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-dark">
                        Enabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">
                    Receive instant ST Courier tracking alerts on this device.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={togglingPush}
                onClick={handleTogglePush}
                className={pushEnabled ? 'btn-ghost text-xs' : 'btn-primary text-xs'}
              >
                {togglingPush ? '...' : pushEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>

        {/* Saved Addresses */}
        <div className="luxury-card p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-primary" />
              <h2 className="font-serif text-lg sm:text-2xl font-semibold text-text">Saved Addresses</h2>
            </div>
            {!showAddressForm && (
              <button
                type="button"
                onClick={() => {
                  setEditingAddress(null);
                  setShowAddressForm(true);
                }}
                className="btn-primary min-h-[38px] px-4 text-xs"
              >
                <Plus size={14} /> Add Address
              </button>
            )}
          </div>

          {showAddressForm ? (
            <PincodeAddressForm
              initialValues={editingAddress}
              onSubmit={handleSaveAddress}
              onCancel={() => {
                setShowAddressForm(false);
                setEditingAddress(null);
              }}
            />
          ) : (user?.addresses || []).length === 0 ? (
            <p className="text-sm text-text-muted">No saved addresses yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {user.addresses.map((addr) => (
                <div
                  key={addr._id}
                  className="rounded-2xl border border-border bg-surface-muted p-5 flex flex-col justify-between"
                >
                  <div className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text">{addr.fullName}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-surface px-2.5 py-0.5 text-[10px] font-medium uppercase text-text-muted border border-border">
                          {addr.type}
                        </span>
                        {addr.isDefault && (
                          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[10px] font-medium uppercase text-primary-dark">
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-text-muted">
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ''}
                    </p>
                    <p className="text-text-muted">
                      {addr.city}, {addr.state} - {addr.pincode}
                    </p>
                    <p className="mt-1 text-text-muted">Mobile: {addr.mobile}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center gap-4 text-xs">
                    {!addr.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(addr._id)}
                        className="font-medium text-primary hover:underline"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAddress(addr);
                        setShowAddressForm(true);
                      }}
                      className="text-text-muted hover:text-text"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr._id)}
                      className="ml-auto text-text-muted hover:text-status-danger inline-flex items-center gap-1"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
