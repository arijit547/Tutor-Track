import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, setLogLevel, Timestamp, updateDoc } from 'firebase/firestore';

// Fail closed: this test suite must never connect to an actual Firebase project.
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/);
setLogLevel('silent');
let environment;
let owner;
let other;
let anonymous;
const tokenData = () => ({ token: 'example-fcm-token', updatedAt: serverTimestamp() });
const settingsData = () => ({ classReminders: true, paymentReminders: false, monthlySalaryReminders: true, updatedAt: serverTimestamp() });

before(async () => {
  const [host, rawPort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  environment = await initializeTestEnvironment({
    projectId: 'demo-tutortrack',
    firestore: { host, port: Number(rawPort), rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
  owner = environment.authenticatedContext('tutor-a').firestore();
  other = environment.authenticatedContext('tutor-b').firestore();
  anonymous = environment.unauthenticatedContext().firestore();
});
beforeEach(async () => { await environment.clearFirestore(); });
after(async () => { await environment?.cleanup(); });

test('owner can create, list, read, renew and delete own push token', async () => {
  const ref = doc(owner, 'tutors/tutor-a/pushTokens/device-a');
  await assertSucceeds(setDoc(ref, tokenData()));
  await assertSucceeds(getDoc(ref));
  const listed = await assertSucceeds(getDocs(collection(owner, 'tutors/tutor-a/pushTokens')));
  assert.equal(listed.size, 1);
  await assertSucceeds(updateDoc(ref, { token: 'rotated-token', updatedAt: serverTimestamp() }));
  assert.equal((await getDoc(ref)).data().token, 'rotated-token');
  await assertSucceeds(deleteDoc(ref));
});

test('other tutors and unauthenticated users cannot read or write another tutor token', async () => {
  await setDoc(doc(owner, 'tutors/tutor-a/pushTokens/device-a'), tokenData());
  for (const client of [other, anonymous]) {
    const ref = doc(client, 'tutors/tutor-a/pushTokens/device-a');
    await assertFails(getDoc(ref));
    await assertFails(getDocs(collection(client, 'tutors/tutor-a/pushTokens')));
    await assertFails(setDoc(ref, tokenData()));
    await assertFails(deleteDoc(ref));
  }
});

test('token payload rejects empty, oversized, missing, stale timestamp and extra fields', async () => {
  const ref = doc(owner, 'tutors/tutor-a/pushTokens/device-a');
  for (const payload of [
    { token: '', updatedAt: serverTimestamp() },
    { token: 'x'.repeat(4097), updatedAt: serverTimestamp() },
    { token: 42, updatedAt: serverTimestamp() },
    { token: 'token' },
    { updatedAt: serverTimestamp() },
    { token: 'token', updatedAt: Timestamp.fromMillis(0) },
    { ...tokenData(), uid: 'tutor-b' },
  ]) await assertFails(setDoc(ref, payload));
});

test('owner can save notification settings and change individual switches with server timestamp', async () => {
  const ref = doc(owner, 'tutors/tutor-a/notificationSettings/general');
  await assertSucceeds(setDoc(ref, settingsData()));
  await assertSucceeds(updateDoc(ref, { paymentReminders: true, updatedAt: serverTimestamp() }));
  assert.equal((await assertSucceeds(getDoc(ref))).data().paymentReminders, true);
  await assertSucceeds(deleteDoc(ref));
});

test('notification settings reject foreign access, invalid types, extra fields and unexpected documents', async () => {
  const path = 'tutors/tutor-a/notificationSettings/general';
  await setDoc(doc(owner, path), settingsData());
  for (const client of [other, anonymous]) {
    await assertFails(getDoc(doc(client, path)));
    await assertFails(setDoc(doc(client, path), settingsData()));
    await assertFails(deleteDoc(doc(client, path)));
  }
  await assertFails(setDoc(doc(owner, path), { ...settingsData(), classReminders: 'yes' }));
  await assertFails(setDoc(doc(owner, path), { ...settingsData(), admin: true }));
  await assertFails(setDoc(doc(owner, path), { classReminders: true, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(owner, 'tutors/tutor-a/notificationSettings/other'), settingsData()));
});

test('all clients, including owner, cannot read or change server reminder state, queue or rate limits', async () => {
  const paths = ['reminders/reminder-a', 'pushTests/test-a', 'notificationMeta/testRateLimit'];
  await environment.withSecurityRulesDisabled(async context => {
    for (const path of paths) await setDoc(doc(context.firestore(), `tutors/tutor-a/${path}`), { status: 'sending' });
  });
  for (const client of [owner, other, anonymous]) {
    for (const path of paths) {
      const ref = doc(client, `tutors/tutor-a/${path}`);
      await assertFails(getDoc(ref));
      await assertFails(setDoc(ref, { status: 'sent' }));
      await assertFails(deleteDoc(ref));
    }
  }
});

test('client collection-group token scan is forbidden', async () => {
  await setDoc(doc(owner, 'tutors/tutor-a/pushTokens/device-a'), tokenData());
  await setDoc(doc(other, 'tutors/tutor-b/pushTokens/device-b'), tokenData());
  await assertFails(getDocs(collectionGroup(owner, 'pushTokens')));
});

test('existing tutor, profile, student, session, payment and finance paths retain owner access', async () => {
  const paths = [
    'tutors/tutor-a',
    'tutors/tutor-a/profile/general',
    'tutors/tutor-a/students/student-a',
    'tutors/tutor-a/students/student-a/sessions/session-a',
    'tutors/tutor-a/students/student-a/payments/payment-a',
    'tutors/tutor-a/financeEntries/entry-a',
    'tutors/tutor-a/financeSettings/general',
  ];
  for (const path of paths) {
    const ref = doc(owner, path);
    await assertSucceeds(setDoc(ref, { example: true }));
    await assertSucceeds(getDoc(ref));
    for (const client of [other, anonymous]) {
      await assertFails(getDoc(doc(client, path)));
      await assertFails(setDoc(doc(client, path), { example: false }));
      await assertFails(deleteDoc(doc(client, path)));
    }
    await assertSucceeds(deleteDoc(ref));
  }
});
