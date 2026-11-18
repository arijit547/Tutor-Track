import { auth, isFirebaseConfigured } from './firebase';
import { firebaseService } from './firebaseService';
import type { Payment, Session, Student } from '../types';

type StudentFields = Omit<Student, 'id' | 'sessions' | 'payments'>;
export type SyncIntent =
  | { type: 'createStudent'; data: Omit<Student, 'sessions' | 'payments'> }
  | { type: 'updateStudent'; studentId: string; data: Partial<StudentFields> }
  | { type: 'deleteStudent'; studentId: string }
  | { type: 'createSession'; studentId: string; data: Session }
  | { type: 'deleteSession'; studentId: string; data: { sessionId: string } }
  | { type: 'createPayment'; studentId: string; data: Payment }
  | { type: 'deletePayment'; studentId: string; data: { paymentId: string } };
export type SyncOperation = SyncIntent & { uid: string; id: string; timestamp: number; retries: number };

const LEGACY_QUEUE_KEY = 'tutortrack_sync_queue_v1';
const queuePrefix = (uid: string) => `tutortrack_sync_queue_v2:${encodeURIComponent(uid)}:`;
const cacheKey = (uid: string) => `tutortrack_data_v2_${uid}`;
const legacyCacheKey = (uid: string) => `tutortrack_data_v1_${uid}`;
const operationKey = (operation: SyncOperation) => `${queuePrefix(operation.uid)}${operation.id}`;
const revisionKey = (uid: string) => `tutortrack_student_revision_v2:${encodeURIComponent(uid)}`;
const revision = (uid: string) => localStorage.getItem(revisionKey(uid));
const markChanged = (uid: string) => localStorage.setItem(revisionKey(uid), crypto.randomUUID());
const running = new Map<string, Promise<void>>();

/** Overlay durable edits on any snapshot; stable IDs make repeat application safe. */
export function applyPendingOperations(students: Student[], operations: SyncOperation[]): Student[] {
  let result = students;
  for (const operation of operations) {
    if (operation.type === 'createStudent') {
      const existing = result.find(student => student.id === operation.data.id);
      const created = { sessions: [], payments: [], ...existing, ...operation.data } as Student;
      result = [...result.filter(student => student.id !== created.id), created];
    } else if (operation.type === 'deleteStudent') {
      result = result.filter(student => student.id !== operation.studentId);
    } else {
      result = result.map(student => {
        if (student.id !== operation.studentId) return student;
        switch (operation.type) {
          case 'updateStudent': return { ...student, ...operation.data };
          case 'createSession': return { ...student, sessions: [...student.sessions.filter(item => item.id !== operation.data.id), operation.data] };
          case 'deleteSession': return { ...student, sessions: student.sessions.filter(item => item.id !== operation.data.sessionId) };
          case 'createPayment': return { ...student, payments: [...student.payments.filter(item => item.id !== operation.data.id), operation.data] };
          case 'deletePayment': return { ...student, payments: student.payments.filter(item => item.id !== operation.data.paymentId) };
        }
      });
    }
  }
  return result;
}

async function execute(operation: SyncOperation): Promise<boolean> {
  const uid = operation.uid;
  switch (operation.type) {
    case 'createStudent': return await firebaseService.createStudent(operation.data, uid) !== null;
    case 'updateStudent': return firebaseService.updateStudent(operation.studentId, operation.data, uid);
    case 'deleteStudent': return firebaseService.deleteStudent(operation.studentId, uid);
    case 'createSession': return await firebaseService.createSession(operation.studentId, operation.data, uid) !== null;
    case 'deleteSession': return firebaseService.deleteSession(operation.studentId, operation.data.sessionId, uid);
    case 'createPayment': return await firebaseService.createPayment(operation.studentId, operation.data, uid) !== null;
    case 'deletePayment': return firebaseService.deletePayment(operation.studentId, operation.data.paymentId, uid);
  }
}

export const syncService = {
  getPendingOperations(uid?: string): SyncOperation[] {
    if (!uid) return [];
    const prefix = queuePrefix(uid);
    const operations: SyncOperation[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const operation = JSON.parse(localStorage.getItem(key)!);
      if (!operation || operation.uid !== uid || typeof operation.id !== 'string'
        || operationKey(operation) !== key || !Number.isFinite(operation.timestamp)
        || !Number.isInteger(operation.retries) || operation.retries < 0) {
        throw new Error('Saved changes could not be read. Keep this browser data for recovery.');
      }
      operations.push(operation);
    }
    return operations.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  },

  queueOperation(intent: SyncIntent & { uid: string }): SyncOperation {
    if (!intent.uid || auth?.currentUser?.uid !== intent.uid) throw new Error('Account changed. Sign in again before saving.');
    const pending = syncService.getPendingOperations(intent.uid);
    const operation = {
      ...intent, id: crypto.randomUUID(), retries: 0,
      timestamp: Math.max(Date.now(), (pending.at(-1)?.timestamp ?? 0) + 1),
    } as SyncOperation;
    // One key per operation avoids overwriting another tab's newly queued edit.
    markChanged(intent.uid);
    localStorage.setItem(operationKey(operation), JSON.stringify(operation));
    return operation;
  },

  getCachedStudents(uid: string): Student[] {
    // Read the previous release's snapshot on first use, but never overwrite it:
    // mismatched historical IDs may need recovery from that original copy.
    const parsed = JSON.parse(localStorage.getItem(cacheKey(uid)) ?? localStorage.getItem(legacyCacheKey(uid)) ?? '[]');
    if (!Array.isArray(parsed)) throw new Error('Saved student data could not be read.');
    return applyPendingOperations(parsed, syncService.getPendingOperations(uid));
  },

  hasLegacyOperations(): boolean {
    const raw = localStorage.getItem(LEGACY_QUEUE_KEY);
    return Boolean(raw && raw !== '[]');
  },

  processPendingOperations(uid: string, retryFailed = false): Promise<void> {
    const existing = running.get(uid);
    if (existing) return existing;
    const process = async () => {
      if (!isFirebaseConfigured() || !navigator.onLine || auth?.currentUser?.uid !== uid) return;
      while (true) {
        if (auth?.currentUser?.uid !== uid || !navigator.onLine) break;
        const operation = syncService.getPendingOperations(uid)[0];
        if (!operation) break;
        if (!localStorage.getItem(operationKey(operation))) continue;
        if (operation.retries >= 3 && !retryFailed) break;
        let success = false;
        try { success = await execute(operation); } catch { /* Keep failed edits durable. */ }
        if (success) {
          // Keep the last local copy before removing its durable operation.
          markChanged(uid);
          localStorage.setItem(cacheKey(uid), JSON.stringify(syncService.getCachedStudents(uid)));
          localStorage.removeItem(operationKey(operation));
        } else {
          localStorage.setItem(operationKey(operation), JSON.stringify({ ...operation, retries: retryFailed ? 1 : operation.retries + 1 }));
          break; // A child must never pass its failed parent.
        }
      }
    };
    const task = (async () => {
      if (navigator.locks) await navigator.locks.request(`tutortrack-sync:${uid}`, process);
      else await process();
    })().finally(() => { running.delete(uid); });
    running.set(uid, task);
    return task;
  },

  async refreshStudents(uid: string, retryFailed = false): Promise<Student[]> {
    await syncService.processPendingOperations(uid, retryFailed);
    if (auth?.currentUser?.uid !== uid) throw new Error('Account changed while syncing.');
    if (!isFirebaseConfigured() || !navigator.onLine) return syncService.getCachedStudents(uid);
    const beforeRead = revision(uid);
    const pendingAtStart = syncService.getPendingOperations(uid);
    // A failed/partial read must never replace the last complete local snapshot.
    const cloud = await firebaseService.getAllStudents(uid);
    if (auth?.currentUser?.uid !== uid) throw new Error('Account changed while syncing.');
    if (revision(uid) !== beforeRead) return syncService.getCachedStudents(uid);
    const merged = applyPendingOperations(cloud, [...pendingAtStart, ...syncService.getPendingOperations(uid)]);
    localStorage.setItem(cacheKey(uid), JSON.stringify(merged));
    return merged;
  },

  getPendingCount(uid?: string): number {
    return syncService.getPendingOperations(uid).length;
  },
};
