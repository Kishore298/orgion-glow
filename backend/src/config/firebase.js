const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const env = require('./env');

let firebaseApp = null;

function getFirebaseMessaging() {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return null;
  }

  if (!firebaseApp) {
    const apps = getApps();
    firebaseApp = apps.length
      ? apps[0]
      : initializeApp({
          credential: cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_PRIVATE_KEY,
          }),
        });
  }

  return getMessaging(firebaseApp);
}

module.exports = { getFirebaseMessaging };
