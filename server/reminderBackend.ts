import { randomUUID } from 'node:crypto';
import { FieldPath, FieldValue, Timestamp, type Firestore, type DocumentReference, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import type { Payment, Session, Student } from '../types';
import { DEFAULT_SETTINGS, LEASE_MS, MAX_ATTEMPTS, STALE_TOKEN_MS, appLink, buildReminders, canClaim, dhakaParts, financialHandledToday, invalidToken, pendingDevices, tokenHash, type Reminder, type ReminderSettings } from './reminderCore';
import { PushError, safeErrorCode } from './errors';

export interface TestRequest { deviceId: string; delay: boolean }
export function parseTestRequest(input: unknown): TestRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PushError(400, 'invalid_argument', 'Provide a deviceId and optional boolean delay.');
  const data = input as Record<string, unknown>;
  const { deviceId, delay = false } = data;
  if (Object.keys(data).some(key => !['deviceId', 'delay'].includes(key)) || typeof deviceId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(deviceId) || typeof delay !== 'boolean') {
    throw new PushError(400, 'invalid_argument', 'Provide a valid deviceId and optional boolean delay.');
  }
  return { deviceId, delay };
}

export interface BackendDependencies {
  db: Firestore;
  messaging: Pick<Messaging, 'sendEachForMulticast'>;
  appUrl: string;
  clock?: () => number;
}
export interface SweepSummary {
  tutors: number; processed: number; failed: number; deadlineReached: boolean;
  busy?: boolean; pageCapReached: boolean; tokenPages: number;
  partialTutors?: number; terminalFailures?: number;
}

export const SWEEP_BUDGET_MS = 45_000;
export const TOKEN_PAGE_SIZE = 100;
export const MAX_TOKEN_PAGES = 10;
export const STUDENT_PAGE_SIZE = 25;
export const MAX_STUDENT_PAGES_PER_TUTOR = 2;
export const TUTOR_BUDGET_MS = 10_000;

export function createReminderBackend({ db, messaging, appUrl, clock = Date.now }: BackendDependencies) {
  try { appLink(appUrl); }
  catch { throw new PushError(503, 'configuration_unavailable', 'Notification server configuration is unavailable.'); }
  const logger = { warn: console.warn, error: console.error };
  let activeDeadline = Infinity;
  let terminalFailures = 0;
  const hasBudget = () => clock() < activeDeadline - 5_000;
  interface Device {
    id: string;
    token: string;
    ref: DocumentReference;
  }

  interface DeliveryResult { sent: number; finished: boolean; handledToday: boolean; terminal?: boolean }

  async function deleteTokenIfUnchanged(device: Device) {
    await db.runTransaction(async transaction => {
      const latest = await transaction.get(device.ref);
      if (latest.data()?.token === device.token) transaction.delete(device.ref);
    });
  }

  async function deliver(uid: string, reminder: Reminder, devices: Device[], now: Date): Promise<DeliveryResult> {
    const claimAt = clock();
    if (!devices.length || reminder.expiresAt <= claimAt) return { sent: 0, finished: true, handledToday: false };
    const ref = db.doc(`tutors/${uid}/reminders/${reminder.id}`);
    const leaseId = randomUUID();
    const claim = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      let data = snapshot.data();
      if (data?.status === 'sent' || data?.status === 'expired') return { claimed: false, data };
      const attempted: string[] | undefined = data?.attemptedTokenHashes;
      const hasNewToken = Array.isArray(attempted) && devices.some(device => !attempted.includes(tokenHash(device.token)));
      const exhausted = data?.status === 'dead' || (data?.attempts || 0) >= MAX_ATTEMPTS;
      if (exhausted && hasNewToken) data = { ...data, status: 'retry', attempts: 0, leaseUntil: 0 };
      if (exhausted && !hasNewToken) {
        transaction.set(ref, { status: 'dead', leaseUntil: 0, terminalAt: FieldValue.serverTimestamp() }, { merge: true });
        return { claimed: false, data: { ...data, status: 'dead' } };
      }
      if (!canClaim(data, claimAt)) return { claimed: false, data };
      transaction.set(ref, {
        type: reminder.type,
        studentId: reminder.studentId || null,
        status: 'sending', leaseId, leaseUntil: claimAt + LEASE_MS,
        lastAttemptAt: Timestamp.fromMillis(claimAt),
        attemptedTokenHashes: [...new Set([...(attempted || []), ...devices.map(device => tokenHash(device.token))])],
        attempts: (data?.attempts || 0) + 1,
        updatedAt: FieldValue.serverTimestamp(),
        ...(snapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        expireAt: Timestamp.fromMillis(now.getTime() + 90 * 86_400_000),
      }, { merge: true });
      return { claimed: true, data };
    });
    if (!claim.claimed) {
      return {
        sent: 0, finished: ['sent', 'dead', 'expired'].includes(claim.data?.status),
        terminal: claim.data?.status === 'dead',
        handledToday: financialHandledToday(
          [claim.data?.sentAt, claim.data?.lastSuccessfulAt, claim.data?.lastAttemptAt]
            .map(value => value instanceof Timestamp ? value.toMillis() : undefined), now,
        ),
      };
    }

    let sent = 0;
    const completed: string[] = claim.data?.completedTokenHashes || [];
    const pending = pendingDevices(devices, completed);
    let transientFailures = 0;
    let expired = false;
    const url = appLink(appUrl, reminder.studentId);
    for (let offset = 0; offset < pending.length; offset += 100) {
      if (!hasBudget()) { transientFailures++; break; }
      const sendAt = clock();
      if (reminder.expiresAt <= sendAt) { expired = true; break; }
      const batch = pending.slice(offset, offset + 100);
      const response = await messaging.sendEachForMulticast({
        tokens: batch.map(device => device.token),
        // Data-only permits the worker to suppress messages after sign-out/account
        // switching. A notification payload would bypass that ownership check.
        data: {
          uid, title: reminder.title, body: reminder.body,
          reminderId: reminder.id, type: reminder.type,
          url, ...(reminder.studentId ? { studentId: reminder.studentId } : {}),
        },
        webpush: { headers: {
          TTL: String(Math.max(1, Math.floor((reminder.expiresAt - sendAt) / 1000))),
          Urgency: reminder.type === 'class' ? 'high' : 'normal',
        } },
      });
      const failures: Record<string, number> = {};
      for (let index = 0; index < response.responses.length; index++) {
        const result = response.responses[index];
        const device = batch[index];
        if (result.success) {
          sent++;
          completed.push(tokenHash(device.token));
        } else if (invalidToken(result.error?.code)) {
          completed.push(tokenHash(device.token));
          await deleteTokenIfUnchanged(device);
        } else {
          transientFailures++;
          const code = result.error?.code || 'unknown';
          failures[code] = (failures[code] || 0) + 1;
        }
      }
      // Persist successes before another batch, so transient failures retry only
      // the remaining devices. FCM and Firestore cannot commit atomically.
      await db.runTransaction(async transaction => {
        const current = await transaction.get(ref);
        if (current.data()?.leaseId !== leaseId) throw new Error('Reminder delivery lease lost');
        transaction.update(ref, {
          completedTokenHashes: completed, updatedAt: FieldValue.serverTimestamp(),
          ...(response.successCount ? { lastSuccessfulAt: FieldValue.serverTimestamp() } : {}),
        });
      });
      if (Object.keys(failures).length) logger.warn('Push delivery failures', { reminderId: reminder.id, failures });
    }
    const terminal = !expired && transientFailures > 0 && (claim.data?.attempts || 0) + 1 >= MAX_ATTEMPTS;
    const finished = expired || transientFailures === 0 || terminal;
    await db.runTransaction(async transaction => {
      const current = await transaction.get(ref);
      if (current.data()?.leaseId !== leaseId) return;
      transaction.update(ref, {
        status: terminal ? 'dead' : expired ? (reminder.type === 'class' ? 'expired' : 'retry') : finished ? 'sent' : 'retry', leaseUntil: 0,
        ...(finished && !terminal && !expired ? { sentAt: FieldValue.serverTimestamp() } : {}),
        ...(terminal ? { terminalAt: FieldValue.serverTimestamp() } : {}),
        updatedAt: FieldValue.serverTimestamp(),
        successCount: FieldValue.increment(sent),
      });
    });
    // Suppress the parallel weekly category even if this attempt partially
    // failed: its successful devices must not get two financial notices today.
    return { sent, finished, handledToday: true, terminal };
  }

  async function readStudent(snapshot: QueryDocumentSnapshot): Promise<Student> {
    const [sessions, payments] = await Promise.all([
      snapshot.ref.collection('sessions').get(), snapshot.ref.collection('payments').get(),
    ]);
    return {
      ...snapshot.data(), id: snapshot.id,
      sessions: sessions.docs.map(item => ({ ...item.data(), id: item.id } as Session)),
      payments: payments.docs.map(item => ({ ...item.data(), id: item.id } as Payment)),
    } as Student;
  }

  async function settingsFor(uid: string): Promise<ReminderSettings> {
    const data = (await db.doc(`tutors/${uid}/notificationSettings/general`).get()).data();
    return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) =>
      [key, typeof data?.[key] === 'boolean' ? data[key] : fallback])) as unknown as ReminderSettings;
  }

  async function processTutor(uid: string, devices: Device[], now: Date) {
    const tutorRef = db.doc(`tutors/${uid}`);
    const tutorDeadline = Math.min(activeDeadline - 5_000, clock() + TUTOR_BUDGET_MS);
    const tutorHasBudget = () => hasBudget() && clock() < tutorDeadline;
    let failed = false;
    const tests = await tutorRef.collection('pushTests').where('status', '==', 'pending').limit(25).get();
    for (const test of tests.docs) {
      if (!tutorHasBudget()) return { complete: false, failed };
      const data = test.data();
      if (!(data.dueAt instanceof Timestamp) || !(data.expireAt instanceof Timestamp)) continue;
      if (data.expireAt.toMillis() <= clock()) { await test.ref.update({ status: 'expired' }); continue; }
      if (data.dueAt.toMillis() > clock()) continue;
      const targets = devices.filter(device => device.id === data.deviceId);
      if (!targets.length) { await test.ref.update({ status: 'cancelled' }); continue; }
      try {
        const result = await deliver(uid, {
          id: `test-${test.id}`, type: 'test', title: 'TutorTrack test notification',
          body: 'Server push works. This notification can arrive while TutorTrack is closed.',
          expiresAt: data.expireAt.toMillis(),
        }, targets, now);
        if (result.terminal) terminalFailures++;
        if (result.finished) await test.ref.update({ status: result.terminal ? 'dead' : 'sent', sentAt: FieldValue.serverTimestamp() });
        else failed = true;
      } catch (error) {
        failed = true;
        logger.error('Queued test delivery failed', { testId: test.id, error: safeErrorCode(error) });
      }
    }

    const settings = await settingsFor(uid);
    if (!Object.values(settings).some(Boolean)) return { complete: true, failed };
    const parts = dhakaParts(now);
    const financialStateRef = tutorRef.collection('notificationMeta').doc('financialSweep');
    const progressRef = tutorRef.collection('notificationMeta').doc('sweepProgress');
    const financialEligible = parts.hour >= 9 && parts.hour < 21 && (settings.paymentReminders || settings.monthlySalaryReminders);
    const checkedDate = financialEligible ? (await financialStateRef.get()).data()?.checkedDate : undefined;
    const financialWindow = financialEligible && checkedDate !== parts.date;
    const progress = (await progressRef.get()).data();
    const financialDate = financialWindow ? parts.date : null;
    // Starting a new day's financial pass must include the earlier students,
    // even if a class-only pass was previously paused halfway through.
    const reset = (progress?.financialDate || null) !== financialDate;
    let studentCursor: string | undefined = !reset && typeof progress?.studentCursor === 'string' ? progress.studentCursor : undefined;
    let financialFailed = !reset && progress?.financialFailed === true;
    const effectiveSettings = financialWindow ? settings : { ...settings, paymentReminders: false, monthlySalaryReminders: false };
    const savePartial = async () => {
      await progressRef.set({ studentCursor: studentCursor || null, financialDate, financialFailed, updatedAt: FieldValue.serverTimestamp() });
      return { complete: false, failed: failed || financialFailed };
    };

    for (let pageNumber = 0; pageNumber < MAX_STUDENT_PAGES_PER_TUTOR; pageNumber++) {
      if (!tutorHasBudget()) return savePartial();
      let query = tutorRef.collection('students').orderBy(FieldPath.documentId()).limit(STUDENT_PAGE_SIZE);
      if (studentCursor) query = query.startAfter(tutorRef.collection('students').doc(studentCursor));
      const page = await query.get();
      for (const snapshot of page.docs) {
        if (!tutorHasBudget()) return savePartial();
        try {
          const data = snapshot.data();
          if (data.active) {
            // A single student's history read can exceed the soft tutor budget;
            // finish that student, save its cursor, then rotate to other tutors.
            const student = financialWindow ? await readStudent(snapshot) : {
              ...data, id: snapshot.id, sessions: [], payments: [],
            } as unknown as Student;
            const reminders = buildReminders(student, now, effectiveSettings);
            let salaryHandledToday = false;
            for (const reminder of reminders) {
              if (reminder.type === 'payment' && salaryHandledToday) continue;
              const result = await deliver(uid, reminder, devices, now);
              if (result.terminal) terminalFailures++;
              if (reminder.type === 'salary') salaryHandledToday = result.handledToday;
              if (!result.finished) {
                failed = true;
                if (reminder.type !== 'class') financialFailed = true;
              }
            }
          }
        } catch (error) {
          failed = true;
          if (financialWindow) financialFailed = true;
          logger.error('Student reminder failed', { studentId: snapshot.id, error: safeErrorCode(error) });
        }
        studentCursor = snapshot.id;
      }
      if (page.size < STUDENT_PAGE_SIZE) {
        if (financialWindow && !financialFailed && hasBudget()) {
          await financialStateRef.set({ checkedDate: parts.date, checkedAt: FieldValue.serverTimestamp() });
        }
        // A completed class pass starts again at the first student next tick.
        // An unsuccessful financial pass similarly retries from its start,
        // while the delivery ledger skips already successful devices.
        await progressRef.set({ studentCursor: null, financialDate: null, financialFailed: false, updatedAt: FieldValue.serverTimestamp() });
        return { complete: true, failed: failed || financialFailed };
      }
    }
    return savePartial();
  }

  async function runSweep(budgetMs = SWEEP_BUDGET_MS): Promise<SweepSummary> {
    const started = clock();
    activeDeadline = started + Math.max(0, Math.min(budgetMs, SWEEP_BUDGET_MS));
    terminalFailures = 0;
    const summary: SweepSummary = { tutors: 0, processed: 0, failed: 0, deadlineReached: false, pageCapReached: false, tokenPages: 0, partialTutors: 0, terminalFailures: 0 };
    if (!hasBudget()) { activeDeadline = Infinity; return { ...summary, deadlineReached: true }; }
    const now = new Date(started);
    const leaseId = randomUUID();
    // No matching client rule grants access to this global scheduler state.
    const stateRef = db.doc('notificationScheduler/reminders');
    const claimed = await db.runTransaction(async transaction => {
      const state = (await transaction.get(stateRef)).data();
      if ((state?.leaseUntil || 0) > started) return { busy: true, cursor: undefined };
      transaction.set(stateRef, { leaseId, leaseUntil: started + 120_000, lastStartedAt: Timestamp.fromDate(now) }, { merge: true });
      return { busy: false, cursor: typeof state?.cursor === 'string' ? state.cursor : undefined };
    });
    if (claimed.busy) { activeDeadline = Infinity; return { ...summary, busy: true }; }
    let cursor = claimed.cursor;
    const seen = new Set<string>();
    try {
      for (let pageNumber = 0; pageNumber < MAX_TOKEN_PAGES && hasBudget(); pageNumber++) {
        let query = db.collectionGroup('pushTokens').orderBy(FieldPath.documentId()).limit(TOKEN_PAGE_SIZE);
        if (cursor) query = query.startAfter(db.doc(cursor));
        const page = await query.get();
        summary.tokenPages++;
        if (page.empty) { cursor = undefined; break; }
        const groups = new Map<string, QueryDocumentSnapshot[]>();
        for (const item of page.docs) {
          const parent = item.ref.parent.parent;
          if (!parent || parent.parent.path !== 'tutors') continue;
          groups.set(parent.id, [...(groups.get(parent.id) || []), item]);
        }
        for (const [uid, tokenSnapshots] of groups) {
          if (!hasBudget()) { summary.deadlineReached = true; break; }
          if (seen.has(uid)) { cursor = tokenSnapshots.at(-1)!.ref.path; continue; }
          summary.tutors++;
          seen.add(uid);
          try {
            // Load all of this tutor's devices together even when the collection
            // group page ends halfway through that tutor's device registrations.
            const allTokens = await db.collection(`tutors/${uid}/pushTokens`).limit(101).get();
            if (allTokens.size > 100) throw new PushError(503, 'capacity_exceeded', 'Too many registered devices.');
            const devices: Device[] = [];
            for (const snapshot of allTokens.docs) {
              const data = snapshot.data();
              if (typeof data.token !== 'string' || !data.token) continue;
              const device = { id: snapshot.id, token: data.token, ref: snapshot.ref };
              if (!(data.updatedAt instanceof Timestamp) || data.updatedAt.toMillis() < started - STALE_TOKEN_MS) {
                await deleteTokenIfUnchanged(device);
              } else devices.push(device);
            }
            const result = devices.length ? await processTutor(uid, devices, now) : { complete: true, failed: false };
            if (result.complete) summary.processed++;
            else summary.partialTutors = (summary.partialTutors || 0) + 1;
            if (result.failed) summary.failed++;
          } catch (error) {
            summary.failed++;
            logger.error('Tutor reminder failed', { error: safeErrorCode(error) });
          }
          cursor = tokenSnapshots.at(-1)!.ref.path;
        }
        if (summary.deadlineReached) break;
        if (page.size < TOKEN_PAGE_SIZE) { cursor = undefined; break; }
        // Malformed paths cannot pin the cursor forever.
        cursor = page.docs.at(-1)!.ref.path;
        if (pageNumber === MAX_TOKEN_PAGES - 1) summary.pageCapReached = true;
      }
      summary.deadlineReached ||= !hasBudget();
      summary.terminalFailures = terminalFailures;
      return summary;
    } finally {
      await db.runTransaction(async transaction => {
        const state = (await transaction.get(stateRef)).data();
        if (state?.leaseId !== leaseId) return;
        transaction.update(stateRef, {
          leaseUntil: 0, cursor: cursor || null,
          lastFinishedAt: FieldValue.serverTimestamp(),
          lastSummary: summary,
        });
      });
      activeDeadline = Infinity;
    }
  }

  async function sendTest(uid: string, input: TestRequest) {
    const { deviceId, delay } = parseTestRequest(input);
    const deviceRef = db.doc(`tutors/${uid}/pushTokens/${deviceId}`);
    const snapshot = await deviceRef.get();
    const token = snapshot.data()?.token;
    if (typeof token !== 'string' || !token) throw new PushError(403, 'device_unregistered', 'Enable push notifications on this device first.');
    const now = new Date(clock());
    const rateRef = db.doc(`tutors/${uid}/notificationMeta/testRateLimit`);
    await db.runTransaction(async transaction => {
      const last = (await transaction.get(rateRef)).data()?.lastRequestedAt as Timestamp | undefined;
      if (last && now.getTime() - last.toMillis() < 30_000) throw new PushError(429, 'rate_limited', 'Wait 30 seconds before another test.');
      transaction.set(rateRef, { lastRequestedAt: Timestamp.fromDate(now) });
    });

    const id = randomUUID();
    if (delay) {
      await db.doc(`tutors/${uid}/pushTests/${id}`).set({
        deviceId, status: 'pending', createdAt: Timestamp.fromDate(now),
        dueAt: Timestamp.fromMillis(now.getTime() + 30_000),
        expireAt: Timestamp.fromMillis(now.getTime() + 15 * 60_000),
      });
      return { sent: 0, queued: true };
    }
    const result = await deliver(uid, {
      id: `test-${id}`, type: 'test', title: 'TutorTrack test notification',
      body: 'Server push works. TutorTrack reminders use this same delivery path.',
      expiresAt: now.getTime() + 15 * 60_000,
    }, [{ id: deviceId, token, ref: deviceRef }], now);
    if (!result.sent) throw new PushError(503, 'unavailable', 'The push service could not deliver to this device. Re-enable notifications and try again.');
    return { sent: result.sent, queued: false };
  }

  return { sendTest, runSweep };
}
