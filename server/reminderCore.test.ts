import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Student, Session, MonthlyBillingPlan } from '../types.js';
import { appLink, billingInDhaka, buildReminders, canClaim, dhakaParts, DEFAULT_SETTINGS, financialHandledToday, invalidToken, pendingDevices, tokenHash } from './reminderCore.js';

function student(overrides: Partial<Student> = {}): Student {
  return {
    id: 'student-1', name: 'Rahim', subject: 'Math', scheduleDays: ['Mon'],
    scheduleTime: '17:00', active: true, ratePerSession: 500,
    joinedDate: '2026-10-01', sessions: [], payments: [],
    ...overrides,
  };
}
function completed(date: string, id = date): Session {
  return { id, date, status: 'completed', durationMinutes: 60 };
}

test('class reminder at 30 minutes and catch-up before class, never after class', () => {
  const item = student();
  assert.equal(buildReminders(item, new Date('2026-10-26T10:29:59Z'), DEFAULT_SETTINGS).length, 0);
  const first = buildReminders(item, new Date('2026-10-26T10:30:00Z'), DEFAULT_SETTINGS)[0];
  const catchup = buildReminders(item, new Date('2026-10-26T10:35:00Z'), DEFAULT_SETTINGS)[0];
  assert.equal(first.type, 'class');
  assert.equal(first.id, catchup.id);
  assert.equal(buildReminders(item, new Date('2026-10-26T11:00:00Z'), DEFAULT_SETTINGS).length, 0);
});

test('tomorrow 00:15 tuition is reminded at previous-day 23:45 in Dhaka', () => {
  const item = student({ scheduleDays: ['Tue'], scheduleTime: '00:15' });
  const reminder = buildReminders(item, new Date('2026-10-26T17:45:00Z'), DEFAULT_SETTINGS)[0];
  assert.equal(reminder.type, 'class');
  assert.match(reminder.id, /2026-10-27-0015$/);
  assert.equal(dhakaParts(new Date('2026-10-26T18:00:00Z')).date, '2026-10-27');
});

test('current session-target partial earnings are weekly payment balance, salary only on target completion', () => {
  const plan: MonthlyBillingPlan = { effectiveMonth: '2026-10', billingMode: 'session-target', monthlySalary: 2000, sessionsPerMonth: 4 };
  const partial = student({ billingPlans: [plan], sessions: [completed('2026-10-20')] });
  const now = new Date('2026-10-26T03:00:00Z'); // Monday 09:00 Dhaka
  assert.deepEqual(buildReminders(partial, now, DEFAULT_SETTINGS).map(item => item.type), ['payment']);
  assert.equal(billingInDhaka(partial, now).outstanding, 500);
  assert.equal(billingInDhaka(partial, now).salaryDue, 0);
  const full = { ...partial, sessions: [1, 2, 3, 4].map(day => completed(`2026-10-0${day}`)) };
  assert.deepEqual(buildReminders(full, now, DEFAULT_SETTINGS).map(item => item.type), ['salary', 'payment']);
  assert.equal(billingInDhaka(full, now).salaryDue, 2000);
});

test('calendar salary becomes earned only after Dhaka month-end; server TZ cannot change it', () => {
  const item = student({ billingPlans: [{ effectiveMonth: '2026-10', billingMode: 'calendar-month', monthlySalary: 4000 }] });
  const original = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Pacific/Honolulu', 'Asia/Dhaka']) {
      process.env.TZ = zone;
      assert.equal(billingInDhaka(item, new Date('2026-10-31T17:59:59Z')).salaryDue, 0, zone);
      assert.equal(billingInDhaka(item, new Date('2026-10-31T18:00:00Z')).salaryDue, 4000, zone);
    }
  } finally {
    if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
  }
});

test('sessions around UTC month-end belong to Dhaka month and recorded payments reduce balance', () => {
  const item = student({
    billingPlans: [{ effectiveMonth: '2026-10', billingMode: 'session-target', monthlySalary: 4000, sessionsPerMonth: 4 }],
    sessions: [completed('2026-10-31T17:59:59Z'), completed('2026-10-31T18:00:00Z')],
    payments: [{ id: 'payment', date: '2026-11-01', amount: 500 }],
  });
  const bill = billingInDhaka(item, new Date('2026-11-01T03:00:00Z'));
  assert.equal(bill.currentMonthSessions, 1);
  assert.equal(bill.earned, 2000);
  assert.equal(bill.outstanding, 1500);
  assert.equal(bill.salaryDue, 500); // only October has matured
});

test('paid, paused, inactive and future-only plans do not create false salary reminders', () => {
  const now = new Date('2026-11-02T03:00:00Z');
  const plan: MonthlyBillingPlan = { effectiveMonth: '2026-10', billingMode: 'calendar-month', monthlySalary: 4000 };
  const item = student({ billingPlans: [plan] });
  assert.equal(buildReminders({ ...item, active: false }, now, DEFAULT_SETTINGS).length, 0);
  assert.equal(buildReminders({ ...item, billingPausedMonths: ['2026-10'] }, now, DEFAULT_SETTINGS).length, 0);
  assert.equal(buildReminders({ ...item, payments: [{ id: 'p', date: '2026-11-01', amount: 4000 }] }, now, DEFAULT_SETTINGS).length, 0);
  const future = { ...item, billingPlans: [{ ...plan, effectiveMonth: '2026-12' }], sessions: [completed('2026-10-20')] };
  assert.equal(billingInDhaka(future, now).monthly, false);
});

test('settings disable categories; financial catch-up starts at 09:00 and stops at 21:00 Dhaka', () => {
  const item = student({ sessions: [completed('2026-10-20')] });
  assert.equal(buildReminders(item, new Date('2026-10-26T03:00:00Z'), { classReminders: false, paymentReminders: false, monthlySalaryReminders: false }).length, 0);
  assert.equal(buildReminders(item, new Date('2026-10-26T02:59:59Z'), DEFAULT_SETTINGS).length, 0);
  assert.equal(buildReminders(item, new Date('2026-10-26T03:30:00Z'), DEFAULT_SETTINGS)[0].type, 'payment');
  assert.equal(buildReminders(item, new Date('2026-10-26T14:59:59Z'), DEFAULT_SETTINGS)[0].type, 'payment');
  assert.equal(buildReminders(item, new Date('2026-10-26T15:00:00Z'), DEFAULT_SETTINGS).length, 0);
});

test('lease excludes overlapping executions, completed reminders and exhausted retries', () => {
  assert.equal(canClaim(undefined, 1000), true);
  assert.equal(canClaim({ status: 'sent' }, 1000), false);
  assert.equal(canClaim({ status: 'dead', attempts: 1 }, 1000), false);
  assert.equal(canClaim({ status: 'expired', attempts: 1 }, 1000), false);
  assert.equal(canClaim({ status: 'sending', leaseUntil: 1001 }, 1000), false);
  assert.equal(canClaim({ status: 'sending', leaseUntil: 999, attempts: 1 }, 1000), true);
  assert.equal(canClaim({ status: 'retry', attempts: 6 }, 1000), false);
});

test('partial delivery retries only failed tokens and deduplicates duplicate device registrations', () => {
  const devices = [{ token: 'success' }, { token: 'transient' }, { token: 'transient' }, { token: 'invalid' }];
  assert.deepEqual(pendingDevices(devices, [tokenHash('success'), tokenHash('invalid')]), [{ token: 'transient' }]);
  assert.equal(invalidToken('messaging/registration-token-not-registered'), true);
  assert.equal(invalidToken('messaging/invalid-registration-token'), true);
  assert.equal(invalidToken('messaging/server-unavailable'), false);
  assert.equal(invalidToken('messaging/invalid-argument'), false); // malformed payload is not proof of bad token
});

test('partial or in-flight salary attempts suppress weekly category only on the same Dhaka day', () => {
  const now = new Date('2026-11-02T03:05:00Z');
  const thisMorning = Date.parse('2026-11-02T03:00:00Z');
  const yesterday = Date.parse('2026-11-01T03:00:00Z');
  assert.equal(financialHandledToday([undefined, thisMorning], now), true); // partial success or active lease
  assert.equal(financialHandledToday([yesterday, thisMorning], now), true); // retry of older partial delivery
  assert.equal(financialHandledToday([yesterday, undefined], now), false); // salary sent on an earlier day
  assert.equal(financialHandledToday([], now), false);
  assert.equal(financialHandledToday([Date.parse('2026-11-01T18:00:00Z')], now), true); // Dhaka midnight
});

test('notification deep links accept HTTPS origin only and encode student IDs', () => {
  assert.equal(appLink('https://tutortrack.example', 'a&b'), 'https://tutortrack.example/?student=a%26b');
  for (const value of ['http://tutortrack.example', 'https://user:secret@tutortrack.example', 'https://tutortrack.example/path', 'https://tutortrack.example/?next=evil']) {
    assert.throws(() => appLink(value));
  }
});
