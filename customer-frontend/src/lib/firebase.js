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
const FCM_TOKEN_KEY = 'orgion_fcm_token';
const PUSH_OPT_OUT_KEY = 'orgion_push_opted_out';

export function isPushConfigured() {
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

async function acquireAndRegisterPushToken() {
  const supported = await isSupported();
  if (!supported) {
    return { ok: false, reason: 'Firebase Messaging is not supported on this browser.' };
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
    return { ok: false, reason: 'Could not retrieve push registration token.' };
  }

  localStorage.setItem(FCM_TOKEN_KEY, token);
  localStorage.removeItem(PUSH_OPT_OUT_KEY);
  await api.post('/v1/notifications/push-token', { token, device: 'web' });
  return { ok: true, token };
}

export async function enablePushNotifications() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { ok: false, reason: 'Notifications are not supported in this browser.' };
    }
    if (!('serviceWorker' in navigator)) {
      return { ok: false, reason: 'Service Workers are not supported in this browser.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'Notification permission was declined.' };
    }

    if (!isPushConfigured()) {
      return {
        ok: false,
        reason: 'Push notifications are not configured. Please restart the dev server if .env was updated.',
      };
    }

    return await acquireAndRegisterPushToken();
  } catch (err) {
    return {
      ok: false,
      reason: err?.response?.data?.message || err?.message || 'Failed to enable push notifications.',
    };
  }
}

export async function syncPushIfGranted() {
  try {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      Notification.permission !== 'granted' ||
      !isPushConfigured() ||
      localStorage.getItem(PUSH_OPT_OUT_KEY) === '1'
    ) {
      return false;
    }
    const res = await acquireAndRegisterPushToken();
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export async function disablePushNotifications() {
  const token = localStorage.getItem(FCM_TOKEN_KEY);
  localStorage.setItem(PUSH_OPT_OUT_KEY, '1');
  await api.delete('/v1/notifications/push-token', { data: { token } });
  localStorage.removeItem(FCM_TOKEN_KEY);
}

export function isPushActiveForUser(user) {
  if (typeof window !== 'undefined' && localStorage.getItem(PUSH_OPT_OUT_KEY) === '1') {
    return false;
  }
  if (user?.hasPushEnabled) return true;
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted' &&
    isPushConfigured()
  );
}

export async function subscribeForegroundMessages(callback) {
  if (!isPushConfigured()) return () => {};
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
