import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Student } from '../types.js';
import { getStudentBilling, planForMonth } from './studentBilling.js';
import { prepareStudentBillingUpdate } from './studentBillingUpdate.js';

const now = new Date('2026-10-26T12:00:00');
const fixture = (overrides: Partial<Student> = {}): Student => ({
  id: 'student', name: 'Student', subject: 'Math', scheduleDays: ['Mon'], scheduleTime: '17:00',
  ratePerSession: 1000, joinedDate: '2026-10-01', active: true, sessions: [], payments: [],
  ...overrides,
});
const futureStudent = () => fixture({
  monthlySalary: 6000, billingMode: 'calendar-month', billingStartDate: '2027-01-15',
  billingPlans: [{ effectiveMonth: '2027-01', monthlySalary: 6000, billingMode: 'calendar-month' }],
});

test('editing a future-start salary preserves its start and replaces the old salary permanently', () => {
  const student = futureStudent();
  const original = structuredClone(student);
  const update = prepareStudentBillingUpdate(student, {
    monthlySalary: 8000, billingMode: 'calendar-month', billingStartDate: '2027-01-15',
  }, now);
  const saved = { ...student, ...update };
  assert.equal(saved.billingStartDate, '2027-01-15');
  assert.deepEqual(saved.billingPlans, [{ effectiveMonth: '2027-01', monthlySalary: 8000, billingMode: 'calendar-month' }]);
  assert.equal(getStudentBilling(saved, new Date('2026-12-31T12:00:00')).earned, 0);
  assert.equal(getStudentBilling(saved, new Date('2027-01-31T12:00:00')).earned, 0);
  assert.equal(getStudentBilling(saved, new Date('2027-02-01T12:00:00')).earned, 8000);
  assert.equal(getStudentBilling(saved, new Date('2027-03-01T12:00:00')).earned, 16000);
  assert.equal(planForMonth(saved, '2027-03')?.monthlySalary, 8000);
  assert.deepEqual(student, original, 'Preparing a form save must not mutate existing data');
});

test('future-start session targets do not become active early when salary or target changes', () => {
  const student = futureStudent();
  const update = prepareStudentBillingUpdate(student, {
    monthlySalary: 8000, billingMode: 'session-target', sessionsPerMonth: 8, billingStartDate: '2027-01-15',
  }, now);
  const saved = { ...student, ...update };
  assert.equal(planForMonth(saved, '2026-12'), undefined);
  assert.equal(saved.billingPlans.length, 1);
  assert.equal(saved.billingPlans[0].effectiveMonth, '2027-01');
  assert.equal(planForMonth(saved, '2027-02')?.monthlySalary, 8000);
  assert.equal(planForMonth(saved, '2027-02')?.sessionsPerMonth, 8);
});

test('older monthly fields without plan history retain their future start even with a recorded payment', () => {
  const student = fixture({
    monthlySalary: 6000, billingMode: 'calendar-month', billingStartDate: '2027-01-15',
    payments: [{ id: 'advance', date: '2026-10-20', amount: 500 }],
  });
  const saved = { ...student, ...prepareStudentBillingUpdate(student, {
    monthlySalary: 8000, billingMode: 'calendar-month', billingStartDate: '2027-01-15',
  }, now) };
  assert.deepEqual(saved.billingPlans, [{ effectiveMonth: '2027-01', monthlySalary: 8000, billingMode: 'calendar-month' }]);
  assert.equal(getStudentBilling(saved, new Date('2026-12-31T12:00:00')).earned, 0);
  assert.equal(getStudentBilling(saved, new Date('2027-02-01T12:00:00')).outstanding, 7500);
});

test('new students use the chosen start and unchanged future terms create no extra plan', () => {
  const terms = { monthlySalary: 6000, billingMode: 'calendar-month' as const, billingStartDate: '2027-01-15' };
  assert.deepEqual(prepareStudentBillingUpdate(undefined, terms, now).billingPlans, futureStudent().billingPlans);
  const student = futureStudent();
  assert.deepEqual(prepareStudentBillingUpdate(student, terms, now).billingPlans, student.billingPlans);
});

test('current-month changes without recorded history preserve earlier calendar contracts', () => {
  const student = fixture({
    billingStartDate: '2026-09-01',
    billingPlans: [{ effectiveMonth: '2026-09', monthlySalary: 6000, billingMode: 'calendar-month' }],
  });
  const saved = { ...student, ...prepareStudentBillingUpdate(student, {
    monthlySalary: 8000, billingMode: 'calendar-month', billingStartDate: '2026-09-01',
  }, now) };
  assert.deepEqual(saved.billingPlans.map(plan => plan.effectiveMonth), ['2026-09', '2026-10']);
  assert.equal(planForMonth(saved, '2026-09')?.monthlySalary, 6000);
  assert.equal(planForMonth(saved, '2026-10')?.monthlySalary, 8000);
  assert.equal(getStudentBilling(saved, now).earned, 6000);
});

test('legacy conversion with history starts next month and preserves missed-session totals and received payments', () => {
  const student = fixture({
    sessions: [
      { id: 'done', date: '2026-10-01', durationMinutes: 60, status: 'completed' },
      { id: 'missed', date: '2026-10-02', durationMinutes: 60, status: 'missed' },
      { id: 'cancelled', date: '2026-10-03', durationMinutes: 60, status: 'cancelled' },
    ],
    payments: [{ id: 'paid', date: '2026-10-03', amount: 500 }],
  });
  const before = getStudentBilling(student, now);
  const saved = { ...student, ...prepareStudentBillingUpdate(student, {
    monthlySalary: 6000, billingMode: 'session-target', sessionsPerMonth: 12, billingStartDate: '2026-10-01',
  }, now) };
  assert.equal(saved.billingPlans[0].effectiveMonth, '2026-11');
  assert.equal(saved.legacyRatePerSession, 1000);
  assert.equal(saved.ratePerSession, 500);
  const after = getStudentBilling(saved, now);
  assert.deepEqual([before.earned, before.paid, before.outstanding], [2000, 500, 1500]);
  assert.deepEqual([after.earned, after.paid, after.outstanding], [2000, 500, 1500]);
  saved.sessions = [...saved.sessions, { id: 'november', date: '2026-11-01', durationMinutes: 60, status: 'completed' }];
  assert.equal(getStudentBilling(saved, new Date('2026-11-02T12:00:00')).outstanding, 2000);
});

test('existing monthly contracts with history change next month without changing earlier rates', () => {
  const student = fixture({
    ratePerSession: 500, legacyRatePerSession: 1000, billingStartDate: '2026-09-01',
    billingPlans: [{ effectiveMonth: '2026-09', monthlySalary: 6000, billingMode: 'session-target', sessionsPerMonth: 12 }],
    sessions: [{ id: 'done', date: '2026-10-01', durationMinutes: 60, status: 'completed' }],
  });
  const saved = { ...student, ...prepareStudentBillingUpdate(student, {
    monthlySalary: 8000, billingMode: 'session-target', sessionsPerMonth: 8, billingStartDate: '2026-09-01',
  }, now) };
  assert.equal(saved.legacyRatePerSession, 1000);
  assert.equal(planForMonth(saved, '2026-10')?.monthlySalary, 6000);
  assert.equal(planForMonth(saved, '2026-11')?.monthlySalary, 8000);
  assert.equal(getStudentBilling(saved, now).earned, getStudentBilling(student, now).earned);
});
