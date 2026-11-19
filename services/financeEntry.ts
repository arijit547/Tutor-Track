import type { FinanceTransaction, FinanceTransactionType } from '../types';
import { localDate } from './localDate';

export const incomeCategories = ['Salary', 'Freelance', 'Business', 'Gift', 'Investment', 'Other income'];
export const expenseCategories = ['Food', 'Transport', 'Housing', 'Utilities', 'Education', 'Shopping', 'Health', 'Entertainment', 'Family', 'Savings', 'Other expense'];

export const yesterdayLocal = (now = new Date()): string => {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return localDate(yesterday);
};

export function quickCategories(entries: FinanceTransaction[], type: FinanceTransactionType): string[] {
  const options = type === 'income' ? incomeCategories : expenseCategories;
  const defaults = type === 'income' ? ['Salary', 'Freelance', 'Business', 'Other income'] : ['Food', 'Transport', 'Shopping', 'Other expense'];
  const recent = entries.filter(entry => !entry.deleted && entry.type === type && options.includes(entry.category))
    .sort((a, b) => b.updatedAt - a.updatedAt).map(entry => entry.category);
  return [...new Set([...recent, ...defaults])].slice(0, 4);
}

export interface FinanceDraft {
  type: FinanceTransactionType;
  amount: string;
  category: string;
  date: string;
  note: string;
}

export function buildFinanceEntry(draft: FinanceDraft, editing?: FinanceTransaction | null): FinanceTransaction {
  const amount = Number(draft.amount);
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(draft.amount.trim())
    || !Number.isFinite(amount) || amount <= 0 || amount > 999999999999) {
    throw new Error('Enter an amount greater than zero, with up to two decimal places.');
  }
  const date = new Date(`${draft.date}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(date.getTime()) || localDate(date) !== draft.date) {
    throw new Error('Choose a valid date.');
  }
  const categories = draft.type === 'income' ? incomeCategories : expenseCategories;
  if (!categories.includes(draft.category) && draft.category !== editing?.category) throw new Error('Choose a category.');
  return {
    id: editing?.id ?? crypto.randomUUID(), type: draft.type, amount: Math.round(amount * 100) / 100,
    category: draft.category, date: draft.date, note: draft.note.trim().slice(0, 280),
    updatedAt: Math.max(Date.now(), (editing?.updatedAt ?? 0) + 1),
  };
}
