import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFinanceEntry, quickCategories, yesterdayLocal } from './financeEntry';

const draft = { type: 'expense' as const, amount: '250', category: 'Transport', date: '2026-11-18', note: '  Bus fare  ' };

test('quick entry preserves category and date while producing separate records for repeated saves', () => {
  const first = buildFinanceEntry(draft);
  const second = buildFinanceEntry({ ...draft, amount: '80', note: '' });
  assert.notEqual(first.id, second.id);
  assert.equal(first.amount, 250);
  assert.equal(first.note, 'Bus fare');
  assert.equal(second.amount, 80);
  assert.equal(second.category, 'Transport');
  assert.equal(second.date, draft.date);
});

test('amount entry accepts decimal keypad values and rejects zero, negatives, excess decimals and exponent notation', () => {
  assert.equal(buildFinanceEntry({ ...draft, amount: '.50' }).amount, .5);
  assert.equal(buildFinanceEntry({ ...draft, amount: '250.' }).amount, 250);
  for (const amount of ['', '0', '-10', '1e3', 'Infinity', '0.001', '12.345', '1000000000000']) {
    assert.throws(() => buildFinanceEntry({ ...draft, amount }), /amount/i);
  }
});

test('invalid calendar dates are rejected while real leap days are accepted', () => {
  assert.equal(buildFinanceEntry({ ...draft, date: '2028-02-29' }).date, '2028-02-29');
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-2', '']) {
    assert.throws(() => buildFinanceEntry({ ...draft, date }), /date/i);
  }
});

test('editing keeps the existing ID and advances its timestamp', () => {
  const original = { ...buildFinanceEntry(draft), updatedAt: Date.now() + 50000 };
  const edited = buildFinanceEntry({ ...draft, type: 'income', amount: '900', category: 'Freelance' }, original);
  assert.equal(edited.id, original.id);
  assert.ok(edited.updatedAt > original.updatedAt);
  assert.equal(edited.type, 'income');
});

test('quick categories prioritize recent manual records of the selected type and exclude deleted entries', () => {
  const entries = [
    { ...buildFinanceEntry(draft), category: 'Health', updatedAt: 50 },
    { ...buildFinanceEntry(draft), category: 'Shopping', updatedAt: 100 },
    { ...buildFinanceEntry(draft), type: 'income' as const, category: 'Freelance', updatedAt: 200 },
    { ...buildFinanceEntry(draft), category: 'Housing', deleted: true, updatedAt: 300 },
  ];
  const categories = quickCategories(entries, 'expense');
  assert.deepEqual(categories.slice(0, 2), ['Shopping', 'Health']);
  assert.ok(!categories.includes('Freelance'));
  assert.ok(!categories.includes('Housing'));
  assert.equal(new Set(categories).size, categories.length);
  assert.equal(categories.length, 4);
});

test('yesterday shortcut crosses month and year boundaries using the local calendar', () => {
  assert.equal(yesterdayLocal(new Date(2026, 11, 1, 0, 15)), '2026-11-30');
  assert.equal(yesterdayLocal(new Date(2026, 0, 1, 0, 15)), '2025-12-31');
});
