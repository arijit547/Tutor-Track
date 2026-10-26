import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  disablePush, enablePush, refreshPush, sendTestNotification,
  subscribeToForegroundMessages,
} from '../services/pushService';

export interface ReminderPreferences {
  classReminders: boolean;
  paymentReminders: boolean;
  monthlySalaryReminders: boolean;
}

const defaults: ReminderPreferences = {
  classReminders: true, paymentReminders: true, monthlySalaryReminders: true,
};
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Notifications could not be updated. Please try again.';

export function usePushNotifications(uid: string | undefined) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preferences, setPreferences] = useState<ReminderPreferences>(defaults);
  const [settingsReady, setSettingsReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeUid = useRef(uid);
  activeUid.current = uid;

  useEffect(() => {
    setEnabled(false);
    setBusy(false);
    setMessage(null);
    setError(null);
    setPreferences(defaults);
    setSettingsReady(false);
    if (!uid || !db) return;
    return onSnapshot(doc(db, 'tutors', uid, 'notificationSettings', 'general'), snapshot => {
      const data = snapshot.data();
      setPreferences({
        classReminders: data?.classReminders !== false,
        paymentReminders: data?.paymentReminders !== false,
        monthlySalaryReminders: data?.monthlySalaryReminders !== false,
      });
      setSettingsReady(true);
    }, () => {
      setError('Reminder preferences could not be loaded. Check your connection and published Firestore rules.');
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    let stopped = false;
    let refreshing = false;
    let unsubscribe = () => {};
    const refresh = async () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      try {
        const registered = await refreshPush(uid);
        if (!stopped && activeUid.current === uid) setEnabled(registered);
      } catch (err) {
        if (!stopped) { setEnabled(false); setError(messageOf(err)); }
      } finally { refreshing = false; }
    };
    void refresh();
    void subscribeToForegroundMessages(payload => {
      if (!stopped && activeUid.current === uid) setMessage(`${payload.title}: ${payload.body}`);
    }).then(cleanup => {
      if (stopped) cleanup(); else unsubscribe = cleanup;
    }).catch(err => { if (!stopped) setError(messageOf(err)); });
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    const interval = window.setInterval(refresh, 60 * 60 * 1000);
    return () => {
      stopped = true;
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [uid]);

  const enable = useCallback(async () => {
    if (!uid) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      // Called directly by a button: permission must retain the user's gesture.
      await enablePush(uid);
      if (activeUid.current === uid) {
        setEnabled(true);
        setMessage('Push notifications enabled on this device. You can now send a test notification from Profile.');
      }
    } catch (err) { if (activeUid.current === uid) setError(messageOf(err)); }
    finally { if (activeUid.current === uid) setBusy(false); }
  }, [uid]);

  const disable = useCallback(async () => {
    if (!uid) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await disablePush(uid);
      if (activeUid.current === uid) { setEnabled(false); setMessage('Push notifications disabled on this device.'); }
    } catch (err) { if (activeUid.current === uid) setError(messageOf(err)); }
    finally { if (activeUid.current === uid) setBusy(false); }
  }, [uid]);

  const test = useCallback(async (delay = false) => {
    if (!uid) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await sendTestNotification(uid, delay);
      if (activeUid.current === uid) setMessage(result.queued
        ? 'Test queued. Close TutorTrack now. The scheduler normally checks every five minutes, but GitHub may delay a run.'
        : `Test accepted by the push service for ${result.sent} device. Check this device for delivery.`);
    } catch (err) { if (activeUid.current === uid) setError(messageOf(err)); }
    finally { if (activeUid.current === uid) setBusy(false); }
  }, [uid]);

  const updatePreference = useCallback(async (key: keyof ReminderPreferences, value: boolean) => {
    if (!uid || !db || !settingsReady) return;
    setBusy(true); setError(null);
    try {
      await setDoc(doc(db, 'tutors', uid, 'notificationSettings', 'general'), {
        ...preferences, [key]: value, updatedAt: serverTimestamp(),
      });
      if (activeUid.current === uid) setMessage('Reminder preference saved for all your devices.');
    } catch (err) { if (activeUid.current === uid) setError(messageOf(err)); }
    finally { if (activeUid.current === uid) setBusy(false); }
  }, [uid, preferences, settingsReady]);

  return { enabled, busy, preferences, settingsReady, message, error, enable, disable, test, updatePreference,
    dismissMessage: () => { setMessage(null); setError(null); } };
}
