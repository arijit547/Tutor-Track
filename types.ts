export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  bio?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  bio?: string;
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
}

export interface Session {
  id: string;
  date: string; // ISO String
  durationMinutes: number;
  notes?: string;
  status: 'completed' | 'cancelled' | 'missed';
  autoLogged?: boolean;
}

export interface Payment {
  id: string;
  date: string; // ISO String
  amount: number;
  notes?: string;
}

export interface Student {
  id: string;
  name: string;
  subject: string;
  scheduleDays: DayOfWeek[];
  scheduleTime: string; // Format "HH:MM" 24h
  ratePerSession: number;
  email?: string;
  sessions: Session[];
  payments: Payment[];
  active: boolean;
  joinedDate: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

export type FinanceTransactionType = 'income' | 'expense';

// Manual personal finance entries are independent from student tuition payments.
export interface FinanceTransaction {
  id: string;
  type: FinanceTransactionType;
  amount: number;
  category: string;
  date: string; // Local calendar date: YYYY-MM-DD
  note: string;
  updatedAt: number; // Epoch milliseconds, for offline/cloud reconciliation
  deleted?: boolean; // Tombstone keeps offline deletes from reappearing on sync
}

export interface FinanceBudget {
  monthlyLimit: number;
  updatedAt: number;
}

export interface FinanceStore {
  entries: FinanceTransaction[];
  budget: FinanceBudget;
}

export type ViewState = 'dashboard' | 'students' | 'student-detail' | 'finance' | 'settings' | 'login' | 'register' | 'password-reset';

export interface AppState {
  students: Student[];
  currentView: ViewState;
  selectedStudentId: string | null;
}
