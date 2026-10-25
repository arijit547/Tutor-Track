import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { FinanceBudget, FinanceStore, FinanceTransaction } from '../types';

/** Kept strictly separate per signed-in tutor; never shared with students. */
const CACHE_PREFIX = 'tutortrack_personal_finance_v1';
const emptyStore = (): FinanceStore => ({ entries: [], budget: { monthlyLimit: 0, updatedAt: 0 } });
const cacheKey = (uid: string) => `${CACHE_PREFIX}:${uid}`;
const isCloudAvailable = (uid: string) =>
  isFirebaseConfigured() && Boolean(db && auth?.currentUser?.uid === uid);

const validEntry = (value: any): value is FinanceTransaction =>
  value && typeof value.id === 'string' &&
  (value.type === 'income' || value.type === 'expense') &&
  typeof value.category === 'string' && typeof value.note === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
  typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount > 0 &&
  typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt);

const normalBudget = (value: any): FinanceBudget =>
  value && typeof value.monthlyLimit === 'number' && Number.isFinite(value.monthlyLimit) &&
  value.monthlyLimit >= 0 && typeof value.updatedAt === 'number'
    ? { monthlyLimit: value.monthlyLimit, updatedAt: value.updatedAt }
    : { monthlyLimit: 0, updatedAt: 0 };

export const readFinanceCache = (uid: string): FinanceStore => {
  if (!uid) return emptyStore();
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries.filter(validEntry) : [],
      budget: normalBudget(parsed.budget),
    };
  } catch (error) {
    console.warn('Could not read locally saved finances:', error);
    return emptyStore();
  }
};

const writeFinanceCache = (uid: string, data: FinanceStore) => {
  localStorage.setItem(cacheKey(uid), JSON.stringify(data));
};

/** Last-modified-wins merge retains deletion tombstones across offline devices. */
export const mergeFinanceEntries = (a: FinanceTransaction[], b: FinanceTransaction[]): FinanceTransaction[] => {
  const map = new Map<string, FinanceTransaction>();
  for (const entry of [...b, ...a]) {
    const current = map.get(entry.id);
    if (!current || entry.updatedAt >= current.updatedAt) map.set(entry.id, entry);
  }
  return [...map.values()];
};

export const personalFinanceService = {
  /** Optimistic local save; false means data is safe locally but still needs cloud sync. */
  async saveEntry(uid: string, entry: FinanceTransaction): Promise<boolean> {
    const previous = readFinanceCache(uid);
    writeFinanceCache(uid, { ...previous, entries: mergeFinanceEntries([entry], previous.entries) });
    if (!isCloudAvailable(uid) || !navigator.onLine) return false;
    try {
      await setDoc(doc(db, 'tutors', uid, 'financeEntries', entry.id), entry);
      return true;
    } catch (error) {
      console.warn('Finance entry stored locally; remote sync pending:', error);
      return false;
    }
  },

  async saveBudget(uid: string, budget: FinanceBudget): Promise<boolean> {
    const previous = readFinanceCache(uid);
    writeFinanceCache(uid, { ...previous, budget });
    if (!isCloudAvailable(uid) || !navigator.onLine) return false;
    try {
      await setDoc(doc(db, 'tutors', uid, 'financeSettings', 'general'), budget);
      return true;
    } catch (error) {
      console.warn('Finance budget stored locally; remote sync pending:', error);
      return false;
    }
  },

  async sync(uid: string): Promise<{ data: FinanceStore; synced: boolean }> {
    if (!isCloudAvailable(uid) || !navigator.onLine) {
      return { data: readFinanceCache(uid), synced: false };
    }
    try {
      const [entriesSnapshot, budgetSnapshot] = await Promise.all([
        getDocs(collection(db, 'tutors', uid, 'financeEntries')),
        getDoc(doc(db, 'tutors', uid, 'financeSettings', 'general')),
      ]);
      const remoteEntries = entriesSnapshot.docs.map(item => item.data()).filter(validEntry);
      const remoteBudget = budgetSnapshot.exists() ? normalBudget(budgetSnapshot.data()) : emptyStore().budget;
      // Read the local cache AFTER the fetch, so edits made during the fetch aren't lost.
      const local = readFinanceCache(uid);
      const mergedEntries = mergeFinanceEntries(local.entries, remoteEntries);
      const budget = local.budget.updatedAt >= remoteBudget.updatedAt ? local.budget : remoteBudget;
      const data = { entries: mergedEntries, budget };
      writeFinanceCache(uid, data);

      const remoteById = new Map(remoteEntries.map(entry => [entry.id, entry]));
      const missingFromRemote = mergedEntries.filter(entry =>
        !remoteById.has(entry.id) || entry.updatedAt > remoteById.get(entry.id)!.updatedAt
      );
      await Promise.all([
        ...missingFromRemote.map(entry =>
          setDoc(doc(db, 'tutors', uid, 'financeEntries', entry.id), entry)
        ),
        ...(budget.updatedAt > remoteBudget.updatedAt
          ? [setDoc(doc(db, 'tutors', uid, 'financeSettings', 'general'), budget)]
          : []),
      ]);
      return { data: readFinanceCache(uid), synced: true };
    } catch (error) {
      console.warn('Finance cloud sync unavailable; local data retained:', error);
      return { data: readFinanceCache(uid), synced: false };
    }
  },
};
