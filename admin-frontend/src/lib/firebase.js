import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import api from './api';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
const ADMIN_FCM_KEY = 'orgion_admin_fcm_token';
const ADMIN_PUSH_OPT_OUT_KEY = 'orgion_admin_push_opted_out';

export function isAdminPushConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && vapidKey);
}

function getFirebaseApp() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return null;
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

async function waitForActiveServiceWorker(registration) {
  if (registration.active) return registration;

  const worker = registration.installing || registration.waiting;
  if (worker) {
    await new Promise((resolve, reject) => {
      if (worker.state === 'activated') {
        resolve();
        return;
      }
      const timer = setTimeout(() => reject(new Error('Service worker activation timed out')), 10000);
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') {
          clearTimeout(timer);
          resolve();
        } else if (worker.state === 'redundant') {
          clearTimeout(timer);
          reject(new Error('Service worker became redundant'));
        }
      });
    });
  }

  await navigator.serviceWorker.ready;
  return registration;
}

async function acquireAndRegisterAdminPushToken() {
  const supported = await isSupported();
  if (!supported) {
    return { ok: false, reason: 'Firebase Messaging is unsupported in this browser.' };
  }

  const app = getFirebaseApp();
  const messaging = getMessaging(app);
  const swQuery = new URLSearchParams(firebaseConfig).toString();
  const swRegistration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${swQuery}`,
    { scope: '/' }
  );
  await waitForActiveServiceWorker(swRegistration);

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swRegistration,
  });

  if (!token) {
    return { ok: false, reason: 'Could not obtain push token.' };
  }

  localStorage.setItem(ADMIN_FCM_KEY, token);
  localStorage.removeItem(ADMIN_PUSH_OPT_OUT_KEY);
  await api.post('/v1/notifications/push-token', { token, device: 'admin-web' });
  return { ok: true, token };
}

export async function enableAdminPushNotifications() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { ok: false, reason: 'Browser notifications are not supported.' };
    }
    if (!('serviceWorker' in navigator)) {
      return { ok: false, reason: 'Service Workers are not supported in this browser.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'Notification permission was declined.' };
    }

    if (!isAdminPushConfigured()) {
      return {
        ok: false,
        reason: 'Firebase push keys are not loaded. Restart the admin dev server.',
      };
    }

    return await acquireAndRegisterAdminPushToken();
  } catch (err) {
    return {
      ok: false,
      reason:
        err?.response?.data?.message || err?.message || 'Failed to enable admin push notifications.',
    };
  }
}

export async function syncAdminPushIfGranted() {
  try {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      Notification.permission !== 'granted' ||
      !isAdminPushConfigured() ||
      localStorage.getItem(ADMIN_PUSH_OPT_OUT_KEY) === '1'
    ) {
      return false;
    }
    const res = await acquireAndRegisterAdminPushToken();
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export async function disableAdminPushNotifications() {
  const token = localStorage.getItem(ADMIN_FCM_KEY);
  localStorage.setItem(ADMIN_PUSH_OPT_OUT_KEY, '1');
  await api.delete('/v1/notifications/push-token', { data: { token } });
  localStorage.removeItem(ADMIN_FCM_KEY);
}

export function isAdminPushActiveForUser(user) {
  if (typeof window !== 'undefined' && localStorage.getItem(ADMIN_PUSH_OPT_OUT_KEY) === '1') {
    return false;
  }
  if (user?.hasPushEnabled) return true;
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted' &&
    isAdminPushConfigured()
  );
}

export async function subscribeAdminForegroundMessages(callback) {
  if (!isAdminPushConfigured()) return () => {};
  try {
    const supported = await isSupported();
    if (!supported) return () => {};
    const app = getFirebaseApp();
    if (!app) return () => {};
    const messaging = getMessaging(app);
    return onMessage(messaging, callback);
  } catch {
    return () => {};
  }
}
