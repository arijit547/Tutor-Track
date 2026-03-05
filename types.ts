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
}

export type ViewState = 'dashboard' | 'students' | 'student-detail' | 'settings' | 'login' | 'register' | 'password-reset';

export interface AppState {
  students: Student[];
  currentView: ViewState;
  selectedStudentId: string | null;
}
