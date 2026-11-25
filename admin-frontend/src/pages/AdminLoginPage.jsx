import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { useAdminAuthStore } from '../stores/adminAuthStore';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const user = useAdminAuthStore((s) => s.user);
  const isHydrated = useAdminAuthStore((s) => s.isHydrated);
  const setSession = useAdminAuthStore((s) => s.setSession);

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [unlockInputs, setUnlockInputs] = useState(false);

  useEffect(() => {
    if (isHydrated && user && ['admin', 'staff'].includes(user.role)) {
      navigate('/', { replace: true });
    }
  }, [isHydrated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/v1/auth/login', { mobile, password });
      const { user: loggedInUser, accessToken } = res.data.data;
      if (!['admin', 'staff'].includes(loggedInUser.role)) {
        toast.error('Access restricted to ORGION admin and staff accounts');
        setLoading(false);
        return;
      }
      setSession(loggedInUser, accessToken);
      toast.success(`Signed in as ${loggedInUser.name}`);
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md admin-card p-8">
        <div className="text-center">
          <img
            src="/orgion-logo.png"
            alt="ORGION — The Secret Glow"
            className="mx-auto h-16 w-auto object-contain"
          />
          <p className="mt-2 label-micro">Store Operations Console</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold text-primary-dark">Admin Sign In</h1>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="mt-7 space-y-4">
          <div>
            <label className="label-micro block mb-1.5">Mobile Number</label>
            <input
              required
              type="tel"
              name="admin_mobile_input"
              maxLength={10}
              autoComplete="off"
              readOnly={!unlockInputs}
              onFocus={() => setUnlockInputs(true)}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="Enter 10-digit mobile number"
              className="input-field"
            />
          </div>

          <div>
            <label className="label-micro block mb-1.5">Password</label>
            <input
              required
              type="password"
              name="admin_password_input"
              autoComplete="new-password"
              readOnly={!unlockInputs}
              onFocus={() => setUnlockInputs(true)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="input-field"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
