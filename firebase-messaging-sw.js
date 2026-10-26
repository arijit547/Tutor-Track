// Vite bundles this entry with the same installed Firebase SDK and environment
// as the frontend. Its production URL is /firebase-messaging-sw.js.
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { firebaseConfig, hasMessagingConfiguration } from './services/firebaseConfig';

const OWNER_DATABASE = 'tutortrack-push';
const STORE = 'state';

async function withState(mode, operation) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(OWNER_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
      let result;
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

const getOwner = () => withState('readonly', store => store.get('owner'));
const setOwner = uid => withState('readwrite', store => store.put(uid, 'owner'));

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('message', event => {
  if (event.data?.type !== 'TUTORTRACK_PUSH_OWNER') return;
  event.waitUntil((async () => {
    try {
      const owner = await getOwner();
      if (!event.data.previousUid || owner === event.data.previousUid) {
        await setOwner(typeof event.data.uid === 'string' ? event.data.uid : null);
      }
      if (!event.data.uid) {
        const notifications = await self.registration.getNotifications();
        notifications.filter(notification => !event.data.previousUid || notification.data?.uid === event.data.previousUid)
          .forEach(notification => notification.close());
      }
      event.ports[0]?.postMessage({ ok: true });
    } catch {
      event.ports[0]?.postMessage({ ok: false });
    }
  })());
});

const safeUrl = value => {
  const url = new URL(typeof value === 'string' ? value : '/', self.location.origin);
  return url.origin === self.location.origin ? url.href : self.location.origin + '/';
};

// Register before getMessaging attaches Firebase's default click handler.
self.addEventListener('notificationclick', event => {
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil((async () => {
    const data = event.notification.data;
    if (!data?.uid || await getOwner() !== data.uid) return;
    const url = safeUrl(data.url);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(url);
      await existing.focus();
    } else {
      await self.clients.openWindow(url);
    }
  })());
});

// Do not cache authenticated pages, Firestore responses or personal data.
if (hasMessagingConfiguration()) {
  try {
    // Attach the push listener while the worker evaluates. Deferring this until
    // an asynchronous capability check can lose the event that woke the worker.
    const messaging = getMessaging(initializeApp(firebaseConfig));
    onBackgroundMessage(messaging, async payload => {
      // The server sends data-only messages. Notification payloads are displayed
      // by Firebase itself, so never display a second notification for those.
      if (payload.notification) return;
      const data = payload.data || {};
      if (!data.uid || !data.title || await getOwner() !== data.uid) return;
      await self.registration.showNotification(data.title, {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.reminderId || payload.messageId,
        data: { uid: data.uid, url: safeUrl(data.url), studentId: data.studentId },
      });
    });
  } catch {
    // Installation still works when this browser does not support messaging.
  }
}
