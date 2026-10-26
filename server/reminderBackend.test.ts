import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { Messaging, MulticastMessage } from 'firebase-admin/messaging';
import { createReminderBackend } from './reminderBackend.js';
import { buildReminders, DEFAULT_SETTINGS, MAX_ATTEMPTS, tokenHash } from './reminderCore.js';
import type { Student } from '../types.js';

type Data = Record<string, unknown>;
const copy = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(copy);
  if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
  return value;
};

class MemoryDocument {
  constructor(readonly store: MemoryStore, readonly path: string) {}
  get id() { return this.path.split('/').at(-1)!; }
  get parent() { return new MemoryQuery(this.store, this.path.split('/').slice(0, -1).join('/')); }
  collection(name: string) { return new MemoryQuery(this.store, `${this.path}/${name}`); }
  async get() {
    const value = this.store.records.get(this.path);
    return { ref: this, id: this.id, exists: value !== undefined, data: () => value ? copy(value) as Data : undefined };
  }
  async set(data: Data, options?: {merge?:boolean}) {
    this.store.records.set(this.path, copy({ ...(options?.merge ? this.store.records.get(this.path) : {}), ...data }) as Data);
  }
  async update(data: Data) { await this.set(data, { merge: true }); }
}

class MemoryQuery {
  constructor(readonly store: MemoryStore, readonly path: string, readonly group = false,
    readonly cap = Infinity, readonly after = '', readonly filter?: [string, unknown]) {}
  get id() { return this.path.split('/').at(-1)!; }
  get parent(): MemoryDocument | undefined {
    const parts = this.path.split('/');
    return parts.length > 1 ? this.store.doc(parts.slice(0, -1).join('/')) : undefined;
  }
  limit(cap: number) { return new MemoryQuery(this.store, this.path, this.group, cap, this.after, this.filter); }
  orderBy(_field: unknown) { return this; }
  startAfter(document: MemoryDocument) { return new MemoryQuery(this.store, this.path, this.group, this.cap, document.path, this.filter); }
  where(field: string, _operator: string, value: unknown) { return new MemoryQuery(this.store, this.path, this.group, this.cap, this.after, [field, value]); }
  doc(name: string) { return this.store.doc(`${this.path}/${name}`); }
  async get() {
    this.store.reads.set(this.path, (this.store.reads.get(this.path) || 0) + 1);
    this.store.onRead?.(this.path);
    const paths = [...this.store.records.keys()].filter(path => {
      const parts = path.split('/');
      const belongs = this.group ? parts.at(-2) === this.path : parts.slice(0, -1).join('/') === this.path;
      return belongs && path > this.after && (!this.filter || this.store.records.get(path)?.[this.filter[0]] === this.filter[1]);
    }).sort().slice(0, this.cap);
    const docs = await Promise.all(paths.map(path => this.store.doc(path).get()));
    return { docs, size: docs.length, empty: !docs.length };
  }
}

class MemoryStore {
  records = new Map<string, Data>();
  reads = new Map<string, number>();
  onRead?: (path: string) => void;
  onTransactionRead?: (path: string) => void;
  doc(path: string) { return new MemoryDocument(this, path); }
  collection(path: string) { return new MemoryQuery(this, path); }
  collectionGroup(name: string) { return new MemoryQuery(this, name, true); }
  async runTransaction<T>(callback: (transaction: {
    get(ref: MemoryDocument): ReturnType<MemoryDocument['get']>;
    set(ref: MemoryDocument, data: Data, options?: {merge?:boolean}): void;
    update(ref: MemoryDocument, data: Data): void;
    delete(ref: MemoryDocument): void;
  }) => Promise<T>): Promise<T> {
    return callback({ get: ref => { this.onTransactionRead?.(ref.path); return ref.get(); }, set: (ref, data, options) => { void ref.set(data, options); }, update: (ref, data) => { void ref.update(data); }, delete: ref => { this.records.delete(ref.path); } });
  }
}

function fixtures(now: number, tokens = ['device-a']) {
  const store = new MemoryStore();
  for (const token of tokens) store.records.set(`tutors/owner/pushTokens/${token}`, { token, updatedAt: Timestamp.fromMillis(now) });
  store.records.set('tutors/owner/students/student', {
    name: 'Student', subject: 'Math', scheduleDays: ['Mon'], scheduleTime: '17:00',
    active: true, ratePerSession: 500, joinedDate: '2026-10-01',
  });
  store.records.set('tutors/owner/students/student/sessions/session', { date: '2026-10-20', status: 'completed', durationMinutes: 60 });
  return store;
}

function sender(outcome: (token: string) => boolean | 'invalid' = () => true) {
  const calls: MulticastMessage[] = [];
  const messaging = { sendEachForMulticast: async (message: MulticastMessage) => {
    calls.push(message);
    const responses = message.tokens.map(token => {
      const status = outcome(token);
      return status === true ? { success: true, messageId: 'message' } : { success: false, error: { code: status === 'invalid' ? 'messaging/registration-token-not-registered' : 'messaging/server-unavailable' } };
    });
    return { responses, successCount: responses.filter(item => item.success).length, failureCount: responses.filter(item => !item.success).length };
  } } as unknown as Pick<Messaging, 'sendEachForMulticast'>;
  return { calls, messaging };
}

test('financial history is evaluated once per successful Dhaka day despite repeated scheduler ticks', async () => {
  let now = Date.parse('2026-10-26T03:05:00Z');
  const store = fixtures(now);
  const delivery = sender();
  const backend = createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now });
  assert.equal((await backend.runSweep()).failed, 0);
  now += 5 * 60_000;
  assert.equal((await backend.runSweep()).failed, 0);
  assert.equal(store.reads.get('tutors/owner/students/student/sessions'), 1);
  assert.equal(store.reads.get('tutors/owner/students/student/payments'), 1);
  assert.equal(store.records.get('tutors/owner/notificationMeta/financialSweep')?.checkedDate, '2026-10-26');
  assert.equal(delivery.calls.length, 1);
  assert.equal(delivery.calls[0].data?.uid, 'owner');
  assert.equal(delivery.calls[0].notification, undefined);
});

test('partial financial delivery retries only the failed device and does not mark the day complete early', async () => {
  let now = Date.parse('2026-10-26T03:05:00Z');
  const store = fixtures(now, ['success', 'retry']);
  let recovered = false;
  const delivery = sender(token => token !== 'retry' || recovered);
  const backend = createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now });
  assert.equal((await backend.runSweep()).failed, 1);
  assert.equal(store.records.has('tutors/owner/notificationMeta/financialSweep'), false);
  recovered = true;
  now += 5 * 60_000;
  assert.equal((await backend.runSweep()).failed, 0);
  assert.deepEqual(delivery.calls[1].tokens, ['retry']);
  assert.equal(store.records.get('tutors/owner/notificationMeta/financialSweep')?.checkedDate, '2026-10-26');
});

test('class ledger suppresses successful-device duplicates while retrying a transient device', async () => {
  let now = Date.parse('2026-10-26T10:30:00Z');
  const store = fixtures(now, ['success', 'retry']);
  store.records.set('tutors/owner/notificationMeta/financialSweep', { checkedDate: '2026-10-26' });
  let recovered = false;
  const delivery = sender(token => token !== 'retry' || recovered);
  const backend = createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now });
  await backend.runSweep();
  recovered = true;
  now += 5 * 60_000;
  await backend.runSweep();
  now += 5 * 60_000;
  await backend.runSweep();
  assert.equal(delivery.calls.length, 2);
  assert.deepEqual(delivery.calls[1].tokens, ['retry']);
  assert.equal(delivery.calls[0].data?.reminderId, delivery.calls[1].data?.reminderId);
});

test('invalid-token cleanup preserves a token rotated while FCM request was in flight', async () => {
  const now = Date.parse('2026-10-26T10:30:00Z');
  const store = fixtures(now, ['old-token']);
  store.records.set('tutors/owner/notificationMeta/financialSweep', { checkedDate: '2026-10-26' });
  const delivery = sender(() => {
    store.records.set('tutors/owner/pushTokens/old-token', { token: 'rotated-token', updatedAt: Timestamp.fromMillis(now) });
    return 'invalid';
  });
  await createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now }).runSweep();
  assert.equal(store.records.get('tutors/owner/pushTokens/old-token')?.token, 'rotated-token');
});

test('expired budget stops before database access and exposes deadline health', async () => {
  const store = new MemoryStore();
  const delivery = sender();
  const summary = await createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example' }).runSweep(0);
  assert.equal(summary.deadlineReached, true);
  assert.equal(summary.processed, 0);
  assert.equal(store.records.size, 0);
});

test('global lease prevents overlapping scheduler requests from sending or scanning tokens', async () => {
  const now = Date.parse('2026-10-26T10:30:00Z');
  const store = fixtures(now);
  store.records.set('notificationScheduler/reminders', { leaseUntil: now + 60_000, leaseId: 'another-run' });
  const delivery = sender();
  const summary = await createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now }).runSweep();
  assert.equal(summary.busy, true);
  assert.equal(summary.tokenPages, 0);
  assert.equal(delivery.calls.length, 0);
});

test('test delivery selects only the authenticated tutor device and rate-limits repeat requests', async () => {
  const now = Date.parse('2026-10-26T10:30:00Z');
  const store = fixtures(now);
  const delivery = sender();
  const backend = createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now });
  await assert.rejects(backend.sendTest('other-tutor', { deviceId: 'device-a', delay: false }), error => (error as {code:string}).code === 'device_unregistered');
  assert.deepEqual(await backend.sendTest('owner', { deviceId: 'device-a', delay: true }), { sent: 0, queued: true });
  await assert.rejects(backend.sendTest('owner', { deviceId: 'device-a', delay: false }), error => (error as {code:string}).code === 'rate_limited');
  assert.equal(delivery.calls.length, 0);
});

test('slow tutor saves its next student and rotates to another tutor before the next tick', async () => {
  let now = Date.parse('2026-10-26T10:30:00Z');
  const source = fixtures(now);
  const store = new MemoryStore();
  const student = source.records.get('tutors/owner/students/student')!;
  store.records.set('tutors/a-slow/pushTokens/device', { token: 'slow', updatedAt: Timestamp.fromMillis(now) });
  store.records.set('tutors/b-fast/pushTokens/device', { token: 'fast', updatedAt: Timestamp.fromMillis(now) });
  store.records.set('tutors/a-slow/students/student-1', student);
  store.records.set('tutors/a-slow/students/student-2', student);
  store.records.set('tutors/b-fast/students/student-b', student);
  for (const uid of ['a-slow', 'b-fast']) store.records.set(`tutors/${uid}/notificationMeta/financialSweep`, { checkedDate: '2026-10-26' });
  let firstSlowSend = true;
  const delivery = sender(token => {
    if (token === 'slow' && firstSlowSend) { now += 11_000; firstSlowSend = false; }
    return true;
  });
  const backend = createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now });
  const first = await backend.runSweep();
  assert.equal(first.partialTutors, 1);
  assert.equal(first.processed, 1);
  assert.equal(store.records.get('tutors/a-slow/notificationMeta/sweepProgress')?.studentCursor, 'student-1');
  assert.deepEqual(delivery.calls.map(call => call.data?.studentId), ['student-1', 'student-b']);
  now += 5 * 60_000;
  await backend.runSweep();
  assert.deepEqual(delivery.calls.map(call => call.data?.studentId), ['student-1', 'student-b', 'student-2']);
  assert.equal(store.records.get('tutors/a-slow/notificationMeta/sweepProgress')?.studentCursor, null);
});

test('student page cap resumes after fifty students instead of rereading the same prefix', async () => {
  const now = Date.parse('2026-10-26T10:30:00Z');
  const store = fixtures(now);
  const template = store.records.get('tutors/owner/students/student')!;
  store.records.delete('tutors/owner/students/student');
  for (let i = 0; i < 51; i++) store.records.set(`tutors/owner/students/student-${String(i).padStart(3, '0')}`, { ...template, active: false });
  store.records.set('tutors/owner/notificationMeta/financialSweep', { checkedDate: '2026-10-26' });
  const delivery = sender();
  const backend = createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now });
  assert.equal((await backend.runSweep()).partialTutors, 1);
  assert.equal(store.reads.get('tutors/owner/students'), 2);
  assert.equal(store.records.get('tutors/owner/notificationMeta/sweepProgress')?.studentCursor, 'student-049');
  assert.equal((await backend.runSweep()).processed, 1);
  assert.equal(store.reads.get('tutors/owner/students'), 3);
});

test('exhausted financial delivery becomes terminal and does not repeat history reads every tick', async () => {
  let now = Date.parse('2026-10-26T03:05:00Z');
  const store = fixtures(now);
  const student = { ...store.records.get('tutors/owner/students/student'), id: 'student', sessions: [store.records.get('tutors/owner/students/student/sessions/session')], payments: [] } as unknown as Student;
  const reminder = buildReminders(student, new Date(now), DEFAULT_SETTINGS).find(item => item.type === 'payment')!;
  store.records.set(`tutors/owner/reminders/${reminder.id}`, { status: 'retry', attempts: MAX_ATTEMPTS, attemptedTokenHashes: [tokenHash('device-a')], completedTokenHashes: [], lastAttemptAt: Timestamp.fromMillis(now) });
  const delivery = sender();
  const backend = createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now });
  assert.equal((await backend.runSweep()).terminalFailures, 1);
  assert.equal(store.records.get(`tutors/owner/reminders/${reminder.id}`)?.status, 'dead');
  assert.equal(store.records.get('tutors/owner/notificationMeta/financialSweep')?.checkedDate, '2026-10-26');
  for (let i = 0; i < 3; i++) { now += 5 * 60_000; await backend.runSweep(); }
  assert.equal(store.reads.get('tutors/owner/students/student/sessions'), 1);
  assert.equal(store.reads.get('tutors/owner/students/student/payments'), 1);
  assert.equal(delivery.calls.length, 0);
});

test('class expiring during its Firestore claim is released without sending a late push', async () => {
  let now = Date.parse('2026-10-26T10:59:50Z');
  const store = fixtures(now);
  store.records.set('tutors/owner/notificationMeta/financialSweep', { checkedDate: '2026-10-26' });
  store.onTransactionRead = path => {
    if (path.includes('/reminders/class-')) now = Date.parse('2026-10-26T11:00:10Z');
  };
  const delivery = sender();
  await createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now }).runSweep();
  assert.equal(delivery.calls.length, 0);
  const ledger = [...store.records].find(([path]) => path.includes('/reminders/class-'))?.[1];
  assert.equal(ledger?.status, 'expired');
  assert.equal(ledger?.leaseUntil, 0);
});

test('new financial day restarts an unfinished prior pass and clears prior failure state', async () => {
  const now = Date.parse('2026-10-26T03:05:00Z');
  for (const previousDate of [null, '2026-10-25']) {
    const store = fixtures(now);
    const template = store.records.get('tutors/owner/students/student')!;
    const session = store.records.get('tutors/owner/students/student/sessions/session')!;
    store.records.delete('tutors/owner/students/student');
    for (const id of ['student-1', 'student-2']) {
      store.records.set(`tutors/owner/students/${id}`, template);
      store.records.set(`tutors/owner/students/${id}/sessions/session`, session);
    }
    store.records.set('tutors/owner/notificationMeta/sweepProgress', { studentCursor: 'student-1', financialDate: previousDate, financialFailed: true });
    const delivery = sender();
    await createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now }).runSweep();
    assert.deepEqual(delivery.calls.map(call => call.data?.studentId), ['student-1', 'student-2']);
    assert.equal(store.records.get('tutors/owner/notificationMeta/financialSweep')?.checkedDate, '2026-10-26');
  }
});

test('a renewed token can reopen an exhausted event without resending completed old tokens', async () => {
  const now = Date.parse('2026-10-26T03:05:00Z');
  const store = fixtures(now, ['renewed-token', 'old-success']);
  const student = { ...store.records.get('tutors/owner/students/student'), id: 'student', sessions: [store.records.get('tutors/owner/students/student/sessions/session')], payments: [] } as unknown as Student;
  const reminder = buildReminders(student, new Date(now), DEFAULT_SETTINGS).find(item => item.type === 'payment')!;
  const ledgerPath = `tutors/owner/reminders/${reminder.id}`;
  store.records.set(ledgerPath, { status: 'dead', attempts: MAX_ATTEMPTS, attemptedTokenHashes: [tokenHash('old-token'), tokenHash('old-success')], completedTokenHashes: [tokenHash('old-success')] });
  const delivery = sender();
  const summary = await createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now }).runSweep();
  assert.equal(summary.terminalFailures, 0);
  assert.deepEqual(delivery.calls[0].tokens, ['renewed-token']);
  assert.equal(store.records.get(ledgerPath)?.status, 'sent');
  assert.equal(store.records.get(ledgerPath)?.attempts, 1);
});

test('successful sixth attempt remains sent on later sweeps, including after a new token registers', async () => {
  let now = Date.parse('2026-10-26T10:30:00Z');
  const store = fixtures(now);
  store.records.set('tutors/owner/notificationMeta/financialSweep', { checkedDate: '2026-10-26' });
  const student = { ...store.records.get('tutors/owner/students/student'), id: 'student', sessions: [], payments: [] } as unknown as Student;
  const reminder = buildReminders(student, new Date(now), DEFAULT_SETTINGS).find(item => item.type === 'class')!;
  const ledgerPath = `tutors/owner/reminders/${reminder.id}`;
  store.records.set(ledgerPath, { status: 'retry', attempts: MAX_ATTEMPTS - 1, attemptedTokenHashes: [tokenHash('device-a')], completedTokenHashes: [] });
  const delivery = sender();
  const backend = createReminderBackend({ db: store as unknown as Firestore, messaging: delivery.messaging, appUrl: 'https://tutortrack.example', clock: () => now });
  await backend.runSweep();
  assert.equal(store.records.get(ledgerPath)?.status, 'sent');
  assert.equal(store.records.get(ledgerPath)?.attempts, MAX_ATTEMPTS);
  now += 5 * 60_000;
  assert.equal((await backend.runSweep()).terminalFailures, 0);
  store.records.set('tutors/owner/pushTokens/new-device', { token: 'new-token', updatedAt: Timestamp.fromMillis(now) });
  now += 5 * 60_000;
  assert.equal((await backend.runSweep()).terminalFailures, 0);
  assert.equal(store.records.get(ledgerPath)?.status, 'sent');
  assert.equal(store.records.get(ledgerPath)?.attempts, MAX_ATTEMPTS);
  assert.equal(delivery.calls.length, 1);
});
