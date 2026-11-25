import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';

const loginSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/account';
  const setSession = useAuthStore((s) => s.setSession);
  const syncGuestToUser = useCartStore((s) => s.syncGuestToUser);
  const [unlockInputs, setUnlockInputs] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { mobile: '', password: '' },
  });

  const onSubmit = async (values) => {
    try {
      const res = await api.post('/v1/auth/login', values);
      const { user, accessToken } = res.data.data;
      setSession(user, accessToken);
      await syncGuestToUser();
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(redirect, { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <Helmet>
        <title>Sign In — ORGION</title>
      </Helmet>
      <div className="mx-auto max-w-md px-6 pt-8 pb-16">
        <div className="luxury-card p-8">
          <span className="label-micro">Welcome Back</span>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-primary-dark">Sign In</h1>
          <p className="mt-2 text-sm text-text-muted">
            Access your saved addresses, orders, and botanical rituals.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="mt-7 space-y-4">
            <div>
              <label className="label-micro block mb-1.5">Mobile Number</label>
              <input
                type="tel"
                maxLength={10}
                autoComplete="off"
                readOnly={!unlockInputs}
                onFocus={() => setUnlockInputs(true)}
                placeholder="Enter 10-digit mobile number"
                {...register('mobile')}
                className="input-field"
              />
              {errors.mobile && (
                <p className="mt-1 text-xs text-status-danger">{errors.mobile.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label-micro">Password</label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                autoComplete="new-password"
                readOnly={!unlockInputs}
                onFocus={() => setUnlockInputs(true)}
                placeholder="Enter password"
                {...register('password')}
                className="input-field"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-status-danger">{errors.password.message}</p>
              )}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full mt-2">
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-muted">
            New to ORGION?{' '}
            <Link
              to={`/register${redirect !== '/account' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
              className="font-medium text-primary hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/account';
  const setSession = useAuthStore((s) => s.setSession);
  const syncGuestToUser = useCartStore((s) => s.syncGuestToUser);
  const [unlockInputs, setUnlockInputs] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', mobile: '', email: '', password: '' },
  });

  const onSubmit = async (values) => {
    try {
      const res = await api.post('/v1/auth/register', values);
      const { user, accessToken } = res.data.data;
      setSession(user, accessToken);
      await syncGuestToUser();
      toast.success('Account created! Welcome to ORGION.');
      navigate(redirect, { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <Helmet>
        <title>Create Account — ORGION</title>
      </Helmet>
      <div className="mx-auto max-w-md px-6 pt-8 pb-16">
        <div className="luxury-card p-8">
          <span className="label-micro">Join ORGION</span>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-primary-dark">Create Account</h1>
          <p className="mt-2 text-sm text-text-muted">
            Required for order updates, ST Courier tracking, and invoices.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="mt-7 space-y-4">
            <div>
              <label className="label-micro block mb-1.5">Full Name</label>
              <input
                {...register('name')}
                autoComplete="off"
                readOnly={!unlockInputs}
                onFocus={() => setUnlockInputs(true)}
                placeholder="Enter your full name"
                className="input-field"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-status-danger">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="label-micro block mb-1.5">Mobile Number (10 digits)</label>
              <input
                type="tel"
                maxLength={10}
                autoComplete="off"
                readOnly={!unlockInputs}
                onFocus={() => setUnlockInputs(true)}
                {...register('mobile')}
                placeholder="Enter 10-digit mobile number"
                className="input-field"
              />
              {errors.mobile && (
                <p className="mt-1 text-xs text-status-danger">{errors.mobile.message}</p>
              )}
            </div>

            <div>
              <label className="label-micro block mb-1.5">Email Address</label>
              <input
                type="email"
                autoComplete="off"
                readOnly={!unlockInputs}
                onFocus={() => setUnlockInputs(true)}
                {...register('email')}
                placeholder="Enter your email address"
                className="input-field"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-status-danger">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="label-micro block mb-1.5">Password (min 8 chars)</label>
              <input
                type="password"
                autoComplete="new-password"
                readOnly={!unlockInputs}
                onFocus={() => setUnlockInputs(true)}
                placeholder="Create a password"
                {...register('password')}
                className="input-field"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-status-danger">{errors.password.message}</p>
              )}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full mt-2">
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/v1/auth/forgot-password', { mobile });
      toast.success('If your mobile is registered, an OTP has been dispatched.');
      setStep(2);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/v1/auth/reset-password', { mobile, otp, newPassword });
      toast.success('Password updated! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Reset Password — ORGION</title>
      </Helmet>
      <div className="mx-auto max-w-md px-6 pt-8 pb-16">
        <div className="luxury-card p-8">
          <h1 className="font-serif text-3xl font-semibold text-primary-dark">Reset Password</h1>
          {step === 1 ? (
            <form onSubmit={handleRequestOtp} className="mt-6 space-y-4">
              <p className="text-sm text-text-muted">
                Enter your registered 10-digit mobile number to receive a verification OTP.
              </p>
              <div>
                <label className="label-micro block mb-1.5">Mobile Number</label>
                <input
                  required
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="input-field"
                  placeholder="Enter 10-digit mobile number"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="mt-6 space-y-4">
              <p className="text-xs text-text-muted">
                Enter the 6-digit OTP (in development, check the backend console log).
              </p>
              <div>
                <label className="label-micro block mb-1.5">6-Digit OTP</label>
                <input
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-micro block mb-1.5">New Password</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Resetting...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
