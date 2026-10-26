import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import app, { auth, db } from './firebase';
import { hasMessagingConfiguration } from './firebaseConfig';
import { requestPushTest, type PushTestResult } from './pushTestRequest';

export interface PushMessage {
  title: string;
  body: string;
  studentId?: string;
}

const preferenceKey = (uid: string) => `tutortrack_push_${uid}`;
const deviceKey = (uid: string) => `tt_push_device_${uid}`;
const registrationKey = (uid: string) => `tutortrack_push_registered_${uid}`;
const OWNER_KEY = 'tutortrack_push_owner';
let operation: Promise<unknown> = Promise.resolve();
let workerRegistration: Promise<ServiceWorkerRegistration> | undefined;
const loggingOut = new Set<string>();

if (auth) {
  onAuthStateChanged(auth, user => {
    if (!user) loggingOut.clear();
    else for (const uid of loggingOut) if (uid !== user.uid) loggingOut.delete(uid);
  });
}

// Token writes and logout cleanup must finish in order, including an enable
// operation that was still obtaining its token when Sign out was pressed.
const serialized = <T>(work: () => Promise<T>): Promise<T> => {
  const next = operation.catch(() => undefined).then(work);
  operation = next;
  return next;
};

const assertUser = (uid: string) => {
  if (!app || !db || auth?.currentUser?.uid !== uid) {
    throw new Error('Sign in again before changing notification settings.');
  }
};

export const isPushConfigured = () => Boolean(app && db && hasMessagingConfiguration() && import.meta.env.VITE_FIREBASE_VAPID_KEY);

export const isPushEnabled = (uid: string) => {
  try { return localStorage.getItem(preferenceKey(uid)) === 'on'; } catch { return false; }
};

export const getPushDeviceId = (uid: string): string => {
  let deviceId = localStorage.getItem(deviceKey(uid));
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(deviceKey(uid), deviceId);
  }
  return deviceId;
};

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    throw new Error('Notifications require HTTPS and a browser with service worker support.');
  }
  if (!workerRegistration) {
    workerRegistration = (async () => {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        type: 'module', scope: '/', updateViaCache: 'none',
      });
      if (!registration.active) {
        await new Promise<void>((resolve, reject) => {
          const worker = registration.installing || registration.waiting;
          if (!worker) return reject(new Error('Notification worker did not install. Reload and try again.'));
          const timeout = window.setTimeout(() => {
            worker.removeEventListener('statechange', changed);
            reject(new Error('Notification worker timed out. Reload and try again.'));
          }, 20000);
          function changed() {
            if (worker!.state === 'activated') {
              window.clearTimeout(timeout);
              worker!.removeEventListener('statechange', changed);
              resolve();
            } else if (worker!.state === 'redundant') {
              window.clearTimeout(timeout);
              worker!.removeEventListener('statechange', changed);
              reject(new Error('Notification worker could not start. Reload and try again.'));
            }
          }
          worker.addEventListener('statechange', changed);
          changed();
        });
      }
      return registration;
    })().catch(error => { workerRegistration = undefined; throw error; });
  }
  return workerRegistration;
}

async function bindWorker(uid: string | null, previousUid?: string) {
  const registration = await registerPushServiceWorker();
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error('Notification settings could not be saved on this device. Reload and try again.'));
    }, 10000);
    channel.port1.onmessage = event => {
      window.clearTimeout(timeout);
      channel.port1.close();
      if (event.data?.ok) resolve();
      else reject(new Error('Allow browser storage to save notification settings.'));
    };
    registration.active!.postMessage({ type: 'TUTORTRACK_PUSH_OWNER', uid, previousUid }, [channel.port2]);
  });
}

async function registerToken(uid: string): Promise<string> {
  assertUser(uid);
  if (loggingOut.has(uid)) throw new Error('Sign out is in progress.');
  if (!isPushConfigured()) throw new Error('Push setup is incomplete. Add the Firebase Web App configuration and public VAPID key, then redeploy.');
  if (!(await isSupported())) throw new Error('Push is not supported here. On iPhone, install TutorTrack on your Home Screen and open it there.');
  const registration = await registerPushServiceWorker();
  const messaging = getMessaging(app);
  const formerOwner = localStorage.getItem(OWNER_KEY);
  if (formerOwner && formerOwner !== uid) {
    // A browser token is shared by the origin. Invalidate a former account's
    // subscription before associating this installation with another account.
    await bindWorker(null, formerOwner);
    await deleteToken(messaging);
  }
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  assertUser(uid);
  if (loggingOut.has(uid)) throw new Error('Sign out is in progress.');
  if (!token) throw new Error('A push token was not issued. Check browser notification permission and the Firebase VAPID key.');
  // Keep evidence even if the write succeeds but binding the worker fails.
  // A device ID alone is not enrollment: it survives after push is disabled.
  localStorage.setItem(registrationKey(uid), 'on');
  await setDoc(doc(db, 'tutors', uid, 'pushTokens', getPushDeviceId(uid)), {
    token, updatedAt: serverTimestamp(),
  });
  assertUser(uid);
  await bindWorker(uid);
  localStorage.setItem(OWNER_KEY, uid);
  return token;
}

export async function enablePush(uid: string): Promise<string> {
  assertUser(uid);
  if (loggingOut.has(uid)) throw new Error('Sign out is in progress.');
  if (!isPushConfigured()) throw new Error('Push setup is incomplete. Add the Firebase Web App configuration and public VAPID key, then redeploy.');
  if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push is unavailable in this browser. Use HTTPS; on iPhone, install TutorTrack on your Home Screen first.');
  }
  // Keep this call before any await so Safari retains the button's user gesture.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in this site’s browser settings, then try again.');
  return serialized(async () => {
    const token = await registerToken(uid);
    localStorage.setItem(preferenceKey(uid), 'on');
    return token;
  });
}

export async function refreshPush(uid: string): Promise<boolean> {
  if (loggingOut.has(uid)) return false;
  if (!isPushEnabled(uid) || !isPushConfigured() || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') {
    await disablePush(uid);
    return false;
  }
  return serialized(async () => {
    if (!isPushEnabled(uid) || loggingOut.has(uid)) return false;
    await registerToken(uid);
    return true;
  });
}

async function removeRegistration(uid: string): Promise<void> {
  assertUser(uid);
  const deviceId = localStorage.getItem(deviceKey(uid));
  if (localStorage.getItem(registrationKey(uid)) !== 'on' && localStorage.getItem(OWNER_KEY) !== uid) return;
  // Clear the durable worker binding first, suppressing queued messages even
  // when the network prevents deleting the Firestore registration.
  if ('serviceWorker' in navigator && window.isSecureContext) await bindWorker(null, uid);
  if (!navigator.onLine) throw new Error('Connect to the internet to remove this device’s push registration, then try again.');
  if (deviceId) await deleteDoc(doc(db, 'tutors', uid, 'pushTokens', deviceId));
  localStorage.removeItem(registrationKey(uid));
  if (localStorage.getItem(OWNER_KEY) === uid) localStorage.removeItem(OWNER_KEY);
  if (app && 'Notification' in window && await isSupported()) {
    try { await deleteToken(getMessaging(app)); }
    catch { console.warn('Push subscription cleanup will be retried when notifications are enabled again.'); }
  }
}

export async function disablePush(uid: string): Promise<void> {
  // Synchronous preference update prevents refresh events from re-enrolling.
  localStorage.setItem(preferenceKey(uid), 'off');
  await serialized(async () => {
    localStorage.setItem(preferenceKey(uid), 'off');
    await removeRegistration(uid);
  });
}

export async function cleanupPushOnLogout(uid: string): Promise<void> {
  // Preserve the choice for the next sign-in; the device is unregistered now.
  loggingOut.add(uid);
  try { await serialized(() => removeRegistration(uid)); }
  catch (error) { loggingOut.delete(uid); throw error; }
}

export async function sendTestNotification(uid: string, delay = false): Promise<PushTestResult> {
  assertUser(uid);
  if (loggingOut.has(uid)) throw new Error('Sign out is in progress.');
  if (!isPushEnabled(uid)) throw new Error('Enable push notifications on this device first.');
  let idToken: string;
  try {
    idToken = await auth.currentUser.getIdToken();
  } catch {
    throw new Error('Your sign-in could not be verified. Check your connection or sign in again, then retry.');
  }
  // Account changes during ID-token refresh must not send a test for the old UI.
  assertUser(uid);
  if (loggingOut.has(uid)) throw new Error('Sign out is in progress.');
  return requestPushTest({ idToken, deviceId: getPushDeviceId(uid), delay });
}

export async function subscribeToForegroundMessages(callback: (message: PushMessage) => void): Promise<() => void> {
  if (!app || !('Notification' in window) || !(await isSupported())) return () => undefined;
  return onMessage(getMessaging(app), payload => {
    const data = payload.data || {};
    const uid = auth?.currentUser?.uid;
    if (!uid || data.uid !== uid || !isPushEnabled(uid)) return;
    callback({
      title: data.title || payload.notification?.title || 'TutorTrack',
      body: data.body || payload.notification?.body || '',
      studentId: data.studentId || undefined,
    });
  });
}
