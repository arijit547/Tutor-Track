import { isFirebaseConfigured } from './firebase';
import { firebaseService } from './firebaseService';

const SYNC_QUEUE_KEY = 'tutortrack_sync_queue_v1';

export interface SyncOperation {
  id: string;
  type: 'createStudent' | 'updateStudent' | 'deleteStudent' | 'createSession' | 'deleteSession' | 'createPayment' | 'deletePayment';
  studentId?: string;
  data?: any;
  timestamp: number;
  retries: number;
}

export const syncService = {
  // Get pending sync operations
  getPendingOperations(): SyncOperation[] {
    try {
      const queued = localStorage.getItem(SYNC_QUEUE_KEY);
      return queued ? JSON.parse(queued) : [];
    } catch {
      return [];
    }
  },

  // Add operation to queue
  queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retries'>) {
    const operations = syncService.getPendingOperations();
    operations.push({
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
    });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(operations));
  },

  // Remove operation from queue
  removeOperation(operationId: string) {
    const operations = syncService.getPendingOperations();
    const filtered = operations.filter(op => op.id !== operationId);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
  },

  // Update operation retries
  incrementRetries(operationId: string) {
    const operations = syncService.getPendingOperations();
    const updated = operations.map(op =>
      op.id === operationId ? { ...op, retries: op.retries + 1 } : op
    );
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updated));
  },

  // Process queued operations
  async processPendingOperations(): Promise<void> {
    if (!isFirebaseConfigured()) return;

    const operations = syncService.getPendingOperations();
    const maxRetries = 3;

    for (const operation of operations) {
      if (operation.retries >= maxRetries) {
        console.warn(`Operation ${operation.id} exceeded max retries`);
        continue;
      }

      try {
        let success = false;

        switch (operation.type) {
          case 'createStudent':
            success = await firebaseService.createStudent(operation.data) !== null;
            break;
          case 'updateStudent':
            success = await firebaseService.updateStudent(operation.studentId!, operation.data);
            break;
          case 'deleteStudent':
            success = await firebaseService.deleteStudent(operation.studentId!);
            break;
          case 'createSession':
            success = await firebaseService.createSession(operation.studentId!, operation.data) !== null;
            break;
          case 'deleteSession':
            success = await firebaseService.deleteSession(operation.studentId!, operation.data.sessionId);
            break;
          case 'createPayment':
            success = await firebaseService.createPayment(operation.studentId!, operation.data) !== null;
            break;
          case 'deletePayment':
            success = await firebaseService.deletePayment(operation.studentId!, operation.data.paymentId);
            break;
        }

        if (success) {
          syncService.removeOperation(operation.id);
        } else {
          syncService.incrementRetries(operation.id);
        }
      } catch (error) {
        console.error(`Error processing operation ${operation.id}:`, error);
        syncService.incrementRetries(operation.id);
      }
    }
  },

  // Clear all queued operations
  clearQueue() {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]));
  },

  // Get pending operations count
  getPendingCount(): number {
    return syncService.getPendingOperations().length;
  },
};
