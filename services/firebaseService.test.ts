import assert from 'node:assert/strict';
import test from 'node:test';
import { firebaseHarness, payment, student } from './testSupport/firebaseHarness';

test('student, session and payment writes preserve client IDs across reload and retries', async () => {
  const f = firebaseHarness();
  const local = student();
  const created = await f.firebaseService.createStudent(local, 'alice');
  assert.equal(created?.id, local.id);
  assert.equal(created?.joinedDate, local.joinedDate);
  const session = { id: 'session-1', date: payment().date, durationMinutes: 60, status: 'completed' };
  await f.firebaseService.createSession(local.id, session, 'alice');
  await f.firebaseService.createPayment(local.id, payment(), 'alice');
  await f.firebaseService.createPayment(local.id, payment(), 'alice');
  const reloaded = await f.firebaseService.getAllStudents('alice');
  assert.equal(reloaded[0].id, local.id);
  assert.equal(reloaded[0].sessions[0].id, session.id);
  assert.equal(reloaded[0].payments[0].id, payment().id);
  assert.equal(reloaded[0].payments.length, 1);
});

test('writes carrying another owner never target the current account', async () => {
  const f = firebaseHarness();
  f.auth.currentUser = { uid: 'bob' };
  assert.equal(await f.firebaseService.createStudent(student(), 'alice'), null);
  assert.equal(await f.firebaseService.createPayment(student().id, payment(), 'alice'), null);
  assert.equal(f.documents.size, 0);
});

test('partial history failures reject the load instead of reporting zero payments', async () => {
  const f = firebaseHarness();
  f.documents.set('tutors/alice/students/student-1', student());
  f.controls.failPaymentReads = true;
  await assert.rejects(() => f.firebaseService.getAllStudents('alice'));
});

test('a failed student query is distinct from a successful empty collection', async () => {
  const f = firebaseHarness();
  assert.equal((await f.firebaseService.getAllStudents('alice')).length, 0);
  f.controls.failReads = true;
  await assert.rejects(() => f.firebaseService.getAllStudents('alice'));
});

test('a cache-only SDK snapshot is not treated as a complete cloud response', async () => {
  const f = firebaseHarness();
  f.controls.cachedReads = true;
  await assert.rejects(() => f.firebaseService.getAllStudents('alice'));
});
