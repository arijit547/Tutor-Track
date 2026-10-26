import type { BillingMode, MonthlyBillingPlan, Student } from '../types.js';
import { getStudentPlans, monthFromDate, nextMonth } from './studentBilling.js';

interface BillingTerms {
  monthlySalary: number;
  billingMode: BillingMode;
  sessionsPerMonth?: number;
  billingStartDate: string;
}

/** Prepare a validated form's billing fields without changing prior contracts. */
export function prepareStudentBillingUpdate(student: Student | undefined, terms: BillingTerms, now = new Date()) {
  const { monthlySalary, billingMode, sessionsPerMonth, billingStartDate } = terms;
  const savedPlans = student ? getStudentPlans(student) : [];
  const latest = savedPlans.at(-1);
  const changed = !latest || latest.monthlySalary !== monthlySalary || latest.billingMode !== billingMode || latest.sessionsPerMonth !== sessionsPerMonth;
  const monthNow = monthFromDate(now);
  const hasRecordedHistory = !!student && (student.sessions.length > 0 || student.payments.length > 0);
  const futureStart = savedPlans[0]?.effectiveMonth;
  // A contract that has not started is edited at its original future start.
  // Replacing that version also prevents the old salary returning at that date.
  const effectiveMonth = !student ? monthFromDate(billingStartDate)
    : futureStart && futureStart > monthNow ? futureStart
    : hasRecordedHistory ? nextMonth(monthNow) : monthNow;
  const newPlan: MonthlyBillingPlan = {
    effectiveMonth, monthlySalary, billingMode,
    ...(sessionsPerMonth ? { sessionsPerMonth } : {}),
  };

  return {
    monthlySalary, billingMode, sessionsPerMonth,
    ratePerSession: sessionsPerMonth ? Math.round(monthlySalary / sessionsPerMonth * 100) / 100 : 0,
    ...(student && { legacyRatePerSession: student.legacyRatePerSession ?? student.ratePerSession }),
    billingStartDate: student?.billingStartDate || billingStartDate,
    billingPlans: changed ? [...savedPlans.filter(plan => plan.effectiveMonth !== effectiveMonth), newPlan]
      .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth)) : savedPlans,
  };
}
