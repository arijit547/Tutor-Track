import type { BillingMode, MonthlyBillingPlan, Student } from '../types.js';

export const monthFromDate = (date: Date | string): string => {
  if (typeof date === 'string' && /^\d{4}-\d{2}(?:-\d{2})?$/.test(date)) return date.slice(0, 7);
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return monthFromDate(new Date());
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
};

export const nextMonth = (month: string): string => {
  const [year, mon] = month.split('-').map(Number);
  return monthFromDate(new Date(year, mon, 1));
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const validMoney = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const validCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

export const getStudentPlans = (student: Student): MonthlyBillingPlan[] => {
  if (student.billingPlans?.length) return [...student.billingPlans].sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
  // Backward compatibility if the monthly fields exist without plan history.
  if (validMoney(student.monthlySalary) && student.billingMode) {
    return [{
      effectiveMonth: monthFromDate(student.billingStartDate || student.joinedDate),
      monthlySalary: student.monthlySalary,
      billingMode: student.billingMode,
      sessionsPerMonth: student.sessionsPerMonth,
    }];
  }
  return [];
};

export const planForMonth = (student: Student, month: string): MonthlyBillingPlan | undefined =>
  getStudentPlans(student).filter(plan => plan.effectiveMonth <= month).at(-1);

export const monthlyRateLabel = (student: Student, month = monthFromDate(new Date())) => {
  const plan = planForMonth(student, month);
  const upcoming = getStudentPlans(student)[0];
  if (plan) return `৳${plan.monthlySalary.toLocaleString('en-BD')}/month`;
  const legacy = student.legacyRatePerSession ?? student.ratePerSession;
  return `৳${legacy.toLocaleString('en-BD')}/session${upcoming ? ` (monthly from ${upcoming.effectiveMonth})` : ''}`;
};

const isPaused = (student: Student, month: string) =>
  (student.billingPausedMonths || []).includes(month) ||
  (Boolean(student.billingPausedFromMonth) && month >= (student.billingPausedFromMonth || '9999-99'));

export interface StudentBillingSummary {
  earned: number;
  paid: number;
  outstanding: number;
  completedSessions: number;
  currentMonthSessions: number;
  currentMonthEarned: number;
  currentMonthTarget?: number;
  currentMonthComplete: boolean;
  currentMode: BillingMode | 'legacy';
}

/**
 * Session-target billing: completed sessions earn monthlySalary / target, capped
 * at one full monthly salary per calendar month. Missed/cancelled do not count.
 * Calendar-month billing: a full month's salary is earned after the month ends;
 * logged sessions are for attendance only. No automatic prorating.
 * Legacy students retain their old per-session calculations until a monthly
 * billing plan takes effect (including previously billable missed sessions).
 */
export const getStudentBilling = (student: Student, asOf = new Date()): StudentBillingSummary => {
  const plans = getStudentPlans(student);
  const thisMonth = monthFromDate(asOf);
  const completedSessions = student.sessions.filter(s => s.status === 'completed').length;
  const totalPaid = roundMoney(student.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0));
  const monthSessionCount = (month: string) => student.sessions.filter(s => s.status === 'completed' && monthFromDate(s.date) === month).length;
  const currentMonthSessions = monthSessionCount(thisMonth);

  if (!plans.length) {
    const billable = student.sessions.filter(s => s.status === 'completed' || s.status === 'missed');
    const earned = roundMoney(billable.length * (student.ratePerSession || 0));
    return { earned, paid: totalPaid, outstanding: Math.max(0, roundMoney(earned - totalPaid)), completedSessions,
      currentMonthSessions, currentMonthEarned: roundMoney(billable.filter(s => monthFromDate(s.date) === thisMonth).length * (student.ratePerSession || 0)),
      currentMonthComplete: false, currentMode: 'legacy' };
  }

  const initialMonth = plans[0].effectiveMonth;
  const historicalLegacy = student.sessions.filter(s =>
    monthFromDate(s.date) < initialMonth && (s.status === 'completed' || s.status === 'missed')
  );
  let earned = roundMoney(historicalLegacy.length * (student.legacyRatePerSession ?? student.ratePerSession ?? 0));
  let currentMonthEarned = 0;
  let currentMonthTarget: number | undefined;
  let currentMonthComplete = false;
  let currentMode: BillingMode | 'legacy' = 'legacy';

  // Guard against accidentally iterating over an unreasonably large time range.
  for (let month = initialMonth, count = 0; month <= thisMonth && count < 1200; month = nextMonth(month), count++) {
    const plan = planForMonth(student, month);
    if (!plan || !validMoney(plan.monthlySalary) || isPaused(student, month)) continue;
    let bill = 0;
    const countDone = monthSessionCount(month);
    if (plan.billingMode === 'session-target') {
      const target = validCount(plan.sessionsPerMonth) ? plan.sessionsPerMonth : 1;
      bill = roundMoney(plan.monthlySalary * Math.min(countDone, target) / target);
      if (month === thisMonth) { currentMonthTarget = target; currentMonthComplete = countDone >= target; }
    } else {
      bill = month < thisMonth ? plan.monthlySalary : 0;
      if (month === thisMonth) currentMonthComplete = false;
    }
    earned += bill;
    if (month === thisMonth) {
      currentMonthEarned = bill;
      currentMode = plan.billingMode;
    }
  }
  earned = roundMoney(earned);
  return { earned, paid: totalPaid, outstanding: Math.max(0, roundMoney(earned - totalPaid)),
    completedSessions, currentMonthSessions, currentMonthEarned, currentMonthTarget,
    currentMonthComplete, currentMode };
};
