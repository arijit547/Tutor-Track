import { createHash } from 'node:crypto';
import { getStudentBilling, getStudentPlans } from '../services/studentBilling';
import type { Student } from '../types';

export const TIME_ZONE = 'Asia/Dhaka';
export const LEASE_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 6;
export const STALE_TOKEN_MS = 90 * 24 * 60 * 60_000;

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
});

export function dhakaParts(value: Date) {
  const parts = Object.fromEntries(formatter.formatToParts(value).map(p => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    month: `${parts.year}-${parts.month}`,
    weekday: parts.weekday,
    hour: Number(parts.hour), minute: Number(parts.minute),
  };
}

function dhakaDate(value: string): string {
  if (/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid billing date');
  return dhakaParts(date).date;
}

export function billingInDhaka(student: Student, now: Date) {
  // Existing billing uses local Date getters. Normalize dated records to Dhaka
  // calendar dates, then use a mid-month anchor independent of server timezone.
  const month = dhakaParts(now).month;
  const normalized: Student = {
    ...student,
    joinedDate: dhakaDate(student.joinedDate),
    billingStartDate: student.billingStartDate ? dhakaDate(student.billingStartDate) : undefined,
    sessions: student.sessions.map(s => ({ ...s, date: dhakaDate(s.date) })),
  };
  const summary = getStudentBilling(normalized, new Date(`${month}-15T12:00:00Z`));
  const currentUnmatured = summary.currentMode === 'session-target' && !summary.currentMonthComplete
    ? summary.currentMonthEarned : 0;
  return {
    ...summary,
    monthly: getStudentPlans(normalized).some(plan => plan.effectiveMonth <= month),
    salaryDue: Math.max(0, Math.round((summary.earned - currentUnmatured - summary.paid) * 100) / 100),
  };
}

export interface ReminderSettings {
  classReminders: boolean;
  paymentReminders: boolean;
  monthlySalaryReminders: boolean;
}

export const DEFAULT_SETTINGS: ReminderSettings = {
  classReminders: true, paymentReminders: true, monthlySalaryReminders: true,
};

export interface Reminder {
  id: string;
  type: 'class' | 'payment' | 'salary' | 'test';
  title: string;
  body: string;
  studentId?: string;
  expiresAt: number;
}

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const idPart = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);

export function buildReminders(student: Student, now: Date, settings: ReminderSettings): Reminder[] {
  if (!student.active) return [];
  const output: Reminder[] = [];
  const parts = dhakaParts(now);
  if (settings.classReminders && /^([01]\d|2[0-3]):[0-5]\d$/.test(student.scheduleTime)) {
    // Include tomorrow, since 00:15 classes are reminded at 23:45 today.
    for (const dayOffset of [0, 1]) {
      const day = dhakaParts(new Date(now.getTime() + dayOffset * 86_400_000));
      if (!student.scheduleDays.includes(day.weekday as Student['scheduleDays'][number])) continue;
      const classAt = new Date(`${day.date}T${student.scheduleTime}:00+06:00`).getTime();
      const remaining = classAt - now.getTime();
      if (remaining > 0 && remaining <= 30 * 60_000) {
        output.push({
          id: `class-${idPart(student.id)}-${day.date}-${student.scheduleTime.replace(':', '')}`,
          type: 'class', studentId: student.id,
          title: `Upcoming tuition: ${student.name}`,
          body: `${student.subject} starts at ${student.scheduleTime} (${Math.ceil(remaining / 60_000)} minutes).`,
          expiresAt: classAt,
        });
      }
    }
  }
  // The backend evaluates finance once per tutor/day, with a catch-up window
  // for delayed external scheduler runs. It avoids repeating history reads.
  if (parts.hour < 9 || parts.hour >= 21 || (!settings.paymentReminders && !settings.monthlySalaryReminders)) return output;
  const bill = billingInDhaka(student, now);
  const expiresAt = new Date(`${parts.date}T21:00:00+06:00`).getTime();
  // The monthly target must be complete, or the earned amount must be from
  // a prior month. Mere passage of a calendar date never completes a target.
  if (settings.monthlySalaryReminders && bill.monthly && bill.salaryDue > 0) {
    output.push({
      id: `salary-${idPart(student.id)}-${parts.month}`, type: 'salary', studentId: student.id,
      title: `Monthly salary pending: ${student.name}`,
      body: `৳${bill.salaryDue.toLocaleString('en-BD')} earned salary remains unpaid. Recorded payments have been deducted.`,
      expiresAt,
    });
  }
  if (settings.paymentReminders && parts.weekday === 'Mon' && bill.outstanding > 0) {
    output.push({
      id: `payment-${idPart(student.id)}-${parts.date}`, type: 'payment', studentId: student.id,
      title: `Payment balance: ${student.name}`,
      body: `৳${bill.outstanding.toLocaleString('en-BD')} of earned tuition is unpaid.`, expiresAt,
    });
  }
  return output;
}

export function appLink(origin: string, studentId?: string): string {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('APP_URL must be the public HTTPS application origin');
  }
  if (studentId) url.searchParams.set('student', studentId);
  return url.href;
}

export interface ClaimState {
  status?: string;
  leaseUntil?: number;
  attempts?: number;
}

export function canClaim(state: ClaimState | undefined, now: number): boolean {
  return !['sent', 'dead', 'expired'].includes(state?.status || '') && (state?.attempts || 0) < MAX_ATTEMPTS && (state?.leaseUntil || 0) <= now;
}

export function financialHandledToday(timestamps: (number | undefined)[], now: Date): boolean {
  const today = dhakaParts(now).date;
  return timestamps.some(value => value !== undefined && dhakaParts(new Date(value)).date === today);
}

export function pendingDevices<T extends {token: string}>(devices: T[], completed: string[]): T[] {
  const seen = new Set(completed);
  return devices.filter(device => {
    const hash = tokenHash(device.token);
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
}

export const invalidToken = (code?: string) => code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
