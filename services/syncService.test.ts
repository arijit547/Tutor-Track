import assert from 'node:assert/strict';
import test from 'node:test';
import { firebaseHarness, payment, student } from './testSupport/firebaseHarness';

const setup = () => { const f = firebaseHarness(); return { ...f, sync: f.load('syncService').syncService }; };
const createStudent = (uid = 'alice') => ({ uid, type: 'createStudent', data: student() });

test('pending writes are isolated per tutor and cannot replay after switching accounts', async () => {
  const f = setup();
  f.sync.queueOperation(createStudent());
  f.auth.currentUser = { uid: 'bob' };
  await f.sync.processPendingOperations('bob');
  await f.sync.processPendingOperations('alice');
  assert.equal(f.documents.size, 0);
  assert.equal(f.sync.getPendingCount('bob'), 0);
  assert.equal(f.sync.getPendingCount('alice'), 1);
});

test('failed writes remain durable and retry with the original IDs', async () => {
  const f = setup();
  f.sync.queueOperation(createStudent());
  f.controls.failWrites = true;
  await f.sync.processPendingOperations('alice');
  assert.equal(f.sync.getPendingCount('alice'), 1);
  f.controls.failWrites = false;
  await f.sync.processPendingOperations('alice');
  assert.ok(f.documents.has('tutors/alice/students/student-1'));
  assert.equal(f.sync.getPendingCount('alice'), 0);
});

test('overlapping replays execute a queued write once', async () => {
  const f = setup();
  f.sync.queueOperation(createStudent());
  await Promise.all([f.sync.processPendingOperations('alice'), f.sync.processPendingOperations('alice')]);
  assert.equal(f.controls.writeCount, 1);
  assert.equal(f.documents.size, 1);
});

test('a failed parent write blocks dependent children until a later retry', async () => {
  const f = setup();
  f.sync.queueOperation(createStudent());
  f.sync.queueOperation({ uid: 'alice', type: 'createPayment', studentId: 'student-1', data: payment() });
  f.controls.failWrites = true;
  await f.sync.processPendingOperations('alice');
  const operations = f.sync.getPendingOperations('alice');
  assert.equal(operations[0].retries, 1);
  assert.equal(operations[1].retries, 0);
});

test('unowned legacy writes are preserved without assigning them to the current user', async () => {
  const f = setup();
  const legacy = JSON.stringify([{ id: 'legacy', type: 'createStudent', data: student(), retries: 0 }]);
  f.storage.setItem('tutortrack_sync_queue_v1', legacy);
  await f.sync.processPendingOperations('alice');
  assert.equal(f.documents.size, 0);
  assert.equal(f.storage.getItem('tutortrack_sync_queue_v1'), legacy);
});

test('startup sync reconciles cached payments and keeps a failed write visible', async () => {
  const f = setup();
  f.documents.set('tutors/alice/students/student-1', student());
  f.storage.setItem('tutortrack_data_v1_alice', JSON.stringify([student()]));
  f.sync.queueOperation({ uid: 'alice', type: 'createPayment', studentId: 'student-1', data: payment() });
  f.controls.failWrites = true;
  const loaded = await f.sync.refreshStudents('alice');
  assert.equal(loaded[0].payments[0].id, 'payment-1');
  f.controls.failWrites = false;
  const replayed = await f.sync.refreshStudents('alice');
  assert.equal(replayed[0].payments.length, 1);
  assert.equal(replayed[0].payments[0].id, 'payment-1');
  assert.equal(f.sync.getPendingCount('alice'), 0);
});

test('partial fetch failures preserve the last complete student cache', async () => {
  const f = setup();
  const saved = [{ ...student(), payments: [payment()] }];
  const key = 'tutortrack_data_v1_alice';
  f.storage.setItem(key, JSON.stringify(saved));
  f.documents.set('tutors/alice/students/student-1', student());
  f.controls.failPaymentReads = true;
  await assert.rejects(() => f.sync.refreshStudents('alice'));
  assert.equal(f.storage.getItem(key), JSON.stringify(saved));
  assert.equal(f.sync.getCachedStudents('alice')[0].payments.length, 1);
  assert.equal(f.storage.getItem('tutortrack_data_v2_alice'), null);
});

test('an empty successful cloud snapshot clears stale cache without resurrecting students', async () => {
  const f = setup();
  f.storage.setItem('tutortrack_data_v1_alice', JSON.stringify([student()]));
  assert.equal((await f.sync.refreshStudents('alice')).length, 0);
});

test('storage failure prevents claiming that a queued edit was saved', () => {
  const f = setup();
  f.controls.storageFails = true;
  assert.throws(() => f.sync.queueOperation(createStudent()), /quota|storage/i);
  assert.equal(f.documents.size, 0);
});

test('automatic retries stop at three failures and explicit retry can recover', async () => {
  const f = setup();
  f.sync.queueOperation(createStudent());
  f.controls.failWrites = true;
  for (let attempt = 0; attempt < 5; attempt++) await f.sync.processPendingOperations('alice');
  assert.equal(f.sync.getPendingOperations('alice')[0].retries, 3);
  f.controls.failWrites = false;
  await f.sync.processPendingOperations('alice');
  assert.equal(f.documents.size, 0);
  await f.sync.processPendingOperations('alice', true);
  assert.equal(f.sync.getPendingCount('alice'), 0);
  assert.equal(f.documents.size, 1);
});

test('switching accounts during a write leaves later operations with their owner', async () => {
  const f = setup();
  f.sync.queueOperation(createStudent());
  f.sync.queueOperation({ uid: 'alice', type: 'createPayment', studentId: 'student-1', data: payment() });
  f.controls.beforeWrite = async () => { f.auth.currentUser = { uid: 'bob' }; };
  await f.sync.processPendingOperations('alice');
  assert.equal(f.documents.size, 1);
  assert.ok([...f.documents.keys()].every(key => key.startsWith('tutors/alice/')));
  assert.equal(f.sync.getPendingCount('alice'), 1);
  assert.equal(f.sync.getPendingCount('bob'), 0);
});

test('new edits queued during replay are drained without losing a child record', async () => {
  const f = setup();
  f.sync.queueOperation(createStudent());
  f.controls.beforeWrite = async () => {
    f.controls.beforeWrite = undefined;
    f.sync.queueOperation({ uid: 'alice', type: 'createPayment', studentId: 'student-1', data: payment() });
  };
  await f.sync.processPendingOperations('alice');
  assert.equal(f.sync.getPendingCount('alice'), 0);
  assert.ok(f.documents.has('tutors/alice/students/student-1/payments/payment-1'));
});

test('an edit during a remote read cannot be replaced by the stale snapshot', async () => {
  const f = setup();
  f.documents.set('tutors/alice/students/student-1', student());
  f.storage.setItem('tutortrack_data_v1_alice', JSON.stringify([student()]));
  f.controls.beforeRead = async () => {
    f.controls.beforeRead = undefined;
    f.sync.queueOperation({ uid: 'alice', type: 'createPayment', studentId: 'student-1', data: payment() });
  };
  const loaded = await f.sync.refreshStudents('alice');
  assert.equal(loaded[0].payments.length, 1);
  assert.equal(f.sync.getPendingCount('alice'), 1);
});

test('offline edits and deletion remain visible through a reload', async () => {
  const f = setup();
  f.controls.online = false;
  f.sync.queueOperation(createStudent());
  f.sync.queueOperation({ uid: 'alice', type: 'updateStudent', studentId: 'student-1', data: { name: 'Edited offline' } });
  f.sync.queueOperation({ uid: 'alice', type: 'createSession', studentId: 'student-1', data: { id: 's1', date: payment().date, durationMinutes: 60, status: 'completed' } });
  const loaded = await f.sync.refreshStudents('alice');
  assert.equal(loaded[0].name, 'Edited offline');
  assert.equal(loaded[0].sessions.length, 1);
  f.sync.queueOperation({ uid: 'alice', type: 'deleteStudent', studentId: 'student-1' });
  assert.equal((await f.sync.refreshStudents('alice')).length, 0);
  assert.equal(f.documents.size, 0);
});

test('a second tab saving during a fetch cannot have its acknowledged edit overwritten', async () => {
  const f = setup();
  const peer = f.load('syncService').syncService;
  f.documents.set('tutors/alice/students/student-1', student());
  f.storage.setItem('tutortrack_data_v1_alice', JSON.stringify([student()]));
  let reads = 0;
  f.controls.beforeRead = async () => {
    if (++reads !== 2) return;
    f.controls.beforeRead = undefined;
    peer.queueOperation({ uid: 'alice', type: 'updateStudent', studentId: 'student-1', data: { name: 'Saved from second tab' } });
    await peer.processPendingOperations('alice');
  };
  const loaded = await f.sync.refreshStudents('alice');
  assert.equal(loaded[0].name, 'Saved from second tab');
});

test('the previous release cache remains intact for historical record recovery', async () => {
  const f = setup();
  const original = JSON.stringify([{ ...student('old-ui-id'), payments: [payment()] }]);
  f.storage.setItem('tutortrack_data_v1_alice', original);
  await f.sync.refreshStudents('alice');
  assert.equal(f.storage.getItem('tutortrack_data_v1_alice'), original);
  assert.equal(f.sync.getCachedStudents('alice').length, 0);
});
