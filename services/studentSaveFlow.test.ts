import assert from 'node:assert/strict';
import test from 'node:test';
import { firebaseHarness, payment, student } from './testSupport/firebaseHarness';

function app() {
  const f = firebaseHarness();
  const sync = f.load('syncService').syncService;
  const state = { students: [] as any[], error: null as string | null };
  const background: Promise<unknown>[] = [];
  const bindings: Record<string, unknown> = {
    currentUser: { uid: 'alice' }, loadedUid: 'alice', syncService: sync,
    setStudents: (students: any[]) => { state.students = students; },
    setPendingCount() {}, setError: (error: string) => { state.error = error; },
    refreshStudents: (uid: string) => { background.push(sync.processPendingOperations(uid)); },
  };
  const persistEdit = f.appHandler('persistEdit', bindings);
  const handler = (name: string, extra = {}) => f.appHandler(name, { ...bindings, persistEdit, ...extra });
  return { ...f, sync, state, handler, flush: async () => { await Promise.all(background); } };
}

test('App creates a student and records payment before reload with consistent cloud IDs', async () => {
  const f = app();
  const { id, sessions, payments, joinedDate, ...fields } = student();
  assert.equal(f.handler('handleStudentSubmit', { editingStudentId: null })(fields), true);
  const localStudentId = f.state.students[0].id;
  assert.equal(f.handler('handlePaymentSubmit', { modalStudentId: localStudentId })(payment()), true);
  const localPaymentId = f.state.students[0].payments[0].id;
  await f.flush();
  const loaded = await f.sync.refreshStudents('alice');
  assert.equal(loaded[0].id, localStudentId);
  assert.equal(loaded[0].payments.length, 1);
  assert.equal(loaded[0].payments[0].id, localPaymentId);
  assert.equal(f.sync.getPendingCount('alice'), 0);
});

test('App keeps a failed payment write in the durable queue and visible after reload', async () => {
  const f = app();
  f.documents.set('tutors/alice/students/student-1', student());
  f.storage.setItem('tutortrack_data_v1_alice', JSON.stringify([student()]));
  f.controls.failWrites = true;
  assert.equal(f.handler('handlePaymentSubmit', { modalStudentId: 'student-1' })(payment()), true);
  await f.flush();
  assert.equal(f.sync.getPendingCount('alice'), 1);
  const loaded = await f.sync.refreshStudents('alice');
  assert.equal(loaded[0].payments.length, 1);
  assert.equal(f.documents.size, 1);
});

test('App rejects storage failures before changing the displayed student list', async () => {
  const f = app();
  f.controls.storageFails = true;
  assert.equal(f.handler('handleStudentSubmit', { editingStudentId: null })(student()), false);
  assert.equal(f.state.students.length, 0);
  assert.match(f.state.error!, /quota|storage/i);
  await f.flush();
  assert.equal(f.documents.size, 0);
});
