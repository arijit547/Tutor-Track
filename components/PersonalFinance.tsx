import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, CloudOff,
  Download, Edit3, Landmark, PiggyBank, Plus, ReceiptText,
  RefreshCw, Search, ShieldCheck, Trash2, WalletCards,
} from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { FinanceBudget, FinanceTransaction, FinanceTransactionType, Student } from '../types';
import { mergeFinanceEntries, personalFinanceService, readFinanceCache } from '../services/personalFinanceService';
import { isFirebaseConfigured } from '../services/firebase';

const incomeCategories = ['Salary', 'Freelance', 'Business', 'Gift', 'Investment', 'Other income'];
const expenseCategories = ['Food', 'Transport', 'Housing', 'Utilities', 'Education', 'Shopping', 'Health', 'Entertainment', 'Family', 'Savings', 'Other expense'];
const money = (n: number) => `৳${n.toLocaleString('en-BD', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
const todayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const monthTitle = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString('en-BD', { month: 'long', year: 'numeric' });

type DisplayEntry = Pick<FinanceTransaction, 'id' | 'date' | 'type' | 'category' | 'amount' | 'note'> & { source: 'personal' | 'tuition' };

const FinanceEntryModal: React.FC<{
  isOpen: boolean;
  editing: FinanceTransaction | null;
  initialType: FinanceTransactionType;
  onClose: () => void;
  onSave: (item: FinanceTransaction) => Promise<void>;
}> = ({ isOpen, editing, initialType, onClose, onSave }) => {
  const [type, setType] = useState<FinanceTransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const nextType = editing?.type ?? initialType;
    setType(nextType);
    setAmount(editing ? String(editing.amount) : '');
    setCategory(editing?.category ?? (nextType === 'income' ? 'Salary' : 'Food'));
    setDate(editing?.date ?? todayLocal());
    setNote(editing?.note ?? '');
    setFormError('');
    setSaving(false);
  }, [isOpen, editing, initialType]);

  const categories = type === 'income' ? incomeCategories : expenseCategories;
  const inputClass = 'mt-1.5 w-full min-h-11 rounded-xl border border-[#e1ddd5] bg-[#fbfaf7] px-3.5 py-2.5 outline-none text-sm text-[#333149]';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > 999999999999) {
      setFormError('Enter a valid amount greater than zero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00`).getTime()) || new Date(`${date}T12:00:00`).toISOString().slice(0, 10) !== date) {
      setFormError('Choose a valid date.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await onSave({
        id: editing?.id ?? crypto.randomUUID(),
        type,
        amount: Math.round(value * 100) / 100,
        category: category.trim() || categories[0],
        date,
        note: note.trim(),
        updatedAt: Math.max(Date.now(), (editing?.updatedAt || 0) + 1),
      });
      onClose();
    } catch {
      setFormError('Unable to save. Make sure your browser allows local storage.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title={editing ? 'Edit personal transaction' : 'New personal transaction'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-[#f3f1eb] p-1">
          {(['income', 'expense'] as const).map(value => (
            <button key={value} type="button" onClick={() => {
              setType(value);
              setCategory(value === 'income' ? 'Salary' : 'Food');
            }} className={`rounded-xl px-3 py-2.5 text-sm font-bold capitalize transition-colors ${type === value ? 'bg-white shadow-sm text-[#34326f]' : 'text-[#8b8795]'}`}>{value}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-bold text-[#656174]">Amount (BDT)
            <input autoFocus type="number" required min="0.01" max="999999999999" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inputClass} />
          </label>
          <label className="text-xs font-bold text-[#656174]">Date
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="block text-xs font-bold text-[#656174]">Category
          <select className={inputClass} value={category} onChange={e => setCategory(e.target.value)}>
            {!categories.includes(category) && <option value={category}>{category}</option>}
            {categories.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-[#656174]">Note <span className="font-normal text-[#a19daa]">(optional)</span>
          <textarea className={`${inputClass} resize-none`} rows={3} maxLength={280} value={note} onChange={e => setNote(e.target.value)} placeholder="What was this for?" />
        </label>
        {type === 'income' && <p className="text-xs text-[#827d8d]">Tuition payments logged through student profiles are included automatically. Don't enter those again.</p>}
        {formError && <p role="alert" className="text-xs font-semibold text-[#b34a43]">{formError}</p>}
        <div className="pt-3 border-t border-[#efede6] flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add transaction'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export const PersonalFinance: React.FC<{ uid: string; students: Student[] }> = ({ uid, students }) => {
  const [store, setStore] = useState(() => readFinanceCache(uid));
  const [synced, setSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [allTime, setAllTime] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | FinanceTransactionType>('all');
  const [search, setSearch] = useState('');
  const [entryModal, setEntryModal] = useState(false);
  const [initialType, setInitialType] = useState<FinanceTransactionType>('expense');
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setStore(readFinanceCache(uid));
    let active = true;
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      setSyncing(true);
      try {
        const result = await personalFinanceService.sync(uid);
        if (active) {
          setStore(old => ({
            entries: mergeFinanceEntries(old.entries, result.data.entries),
            budget: old.budget.updatedAt >= result.data.budget.updatedAt ? old.budget : result.data.budget,
          }));
          setSynced(result.synced);
        }
      } finally {
        running = false;
        if (active) setSyncing(false);
      }
    };
    void refresh();
    window.addEventListener('online', refresh);
    return () => {
      active = false;
      window.removeEventListener('online', refresh);
    };
  }, [uid]);

  const tuitionEntries = useMemo<DisplayEntry[]>(() => students.flatMap(student =>
    student.payments.filter(p => Number.isFinite(p.amount) && p.amount > 0 && !Number.isNaN(new Date(p.date).getTime())).map(payment => ({
      id: `tuition:${student.id}:${payment.id}`,
      type: 'income' as const,
      amount: payment.amount,
      category: 'Tuition payment',
      date: payment.date.slice(0, 10),
      note: `${student.name}${payment.notes ? ` · ${payment.notes}` : ''}`,
      source: 'tuition' as const,
    }))
  ), [students]);

  const entries = useMemo<DisplayEntry[]>(() => [
    ...store.entries.filter(item => !item.deleted).map(item => ({ ...item, source: 'personal' as const })),
    ...tuitionEntries,
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [store.entries, tuitionEntries]);

  const periodEntries = useMemo(() => allTime ? entries : entries.filter(item => item.date.slice(0, 7) === month), [entries, month, allTime]);
  const filteredEntries = useMemo(() => periodEntries.filter(item =>
    (typeFilter === 'all' || item.type === typeFilter) &&
    `${item.category} ${item.note} ${item.amount}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [periodEntries, search, typeFilter]);

  const income = periodEntries.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expenses = periodEntries.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const net = income - expenses;
  const allTimeNet = entries.reduce((sum, item) => sum + (item.type === 'income' ? item.amount : -item.amount), 0);
  const tuitionIncome = periodEntries.filter(item => item.source === 'tuition').reduce((sum, item) => sum + item.amount, 0);
  const budgetLimit = store.budget.monthlyLimit;
  const monthExpenses = entries.filter(item => item.type === 'expense' && item.date.slice(0, 7) === month).reduce((sum, item) => sum + item.amount, 0);
  const progress = budgetLimit > 0 ? (monthExpenses / budgetLimit) * 100 : 0;
  const expensesByCategory = Object.entries(periodEntries.filter(item => item.type === 'expense').reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  const handleSave = async (entry: FinanceTransaction) => {
    const ok = await personalFinanceService.saveEntry(uid, entry);
    setStore(readFinanceCache(uid));
    setSynced(ok);
    setNotice(ok ? 'Transaction saved and synced.' : 'Transaction saved on this device. Cloud sync pending.');
  };

  const handleDelete = async (id: string) => {
    const original = store.entries.find(item => item.id === id);
    if (!original || !window.confirm('Delete this personal transaction?')) return;
    try {
      const ok = await personalFinanceService.saveEntry(uid, { ...original, deleted: true, updatedAt: Math.max(Date.now(), original.updatedAt + 1) });
      setStore(readFinanceCache(uid));
      setSynced(ok);
      setNotice(ok ? 'Transaction deleted.' : 'Deletion saved locally. Cloud sync pending.');
    } catch {
      setNotice('Unable to delete the transaction. Check device storage permissions.');
    }
  };

  const handleSaveBudget = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(budgetDraft);
    if (!Number.isFinite(amount) || amount < 0 || amount > 999999999999) {
      setNotice('Enter a valid monthly limit (zero means no limit).');
      return;
    }
    const budget: FinanceBudget = { monthlyLimit: Math.round(amount * 100) / 100, updatedAt: Math.max(Date.now(), store.budget.updatedAt + 1) };
    try {
      const ok = await personalFinanceService.saveBudget(uid, budget);
      setStore(readFinanceCache(uid));
      setSynced(ok);
      setEditingBudget(false);
      setNotice(ok ? 'Monthly spending limit saved.' : 'Spending limit saved locally. Cloud sync pending.');
    } catch {
      setNotice('Unable to save the spending limit on this device.');
    }
  };

  const startNewEntry = (type: FinanceTransactionType) => {
    setEditing(null);
    setInitialType(type);
    setEntryModal(true);
  };

  const exportCSV = () => {
    // Prevent spreadsheet formula injection in text fields.
    const csvField = (value: string | number) => {
      let str = String(value);
      if (/^[\s]*[=+@\-\t\r]/.test(str)) str = `'${str}`;
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = [
      ['Date', 'Type', 'Category', 'Amount BDT', 'Note', 'Source'],
      ...filteredEntries.map(item => [item.date, item.type, item.category, item.amount, item.note, item.source]),
    ];
    const content = '\ufeff' + rows.map(row => row.map(csvField).join(',')).join('\r\n');
    const file = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tutortrack-finance-${allTime ? 'all-time' : month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const cardClass = 'tt-card rounded-[22px] p-4 sm:p-5';
  const monthCaption = allTime ? 'All-time activity' : monthTitle(month);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[28px] bg-[#29285d] px-5 py-6 sm:px-8 sm:py-8 text-white shadow-[0_18px_48px_rgba(41,40,93,.18)]">
        <div className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-[#58569d]/30 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-[#efc282]"><ShieldCheck className="w-4 h-4" /> Teacher workspace · private</p>
            <h1 className="mt-3 text-2xl sm:text-[2rem] font-extrabold tracking-[-.04em]">Personal finance</h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">Your money, organized. Track personal income and expenses alongside your recorded tuition payments.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button className="!bg-[#f4bd68] !text-[#29285d] hover:!bg-[#f7c97f] !shadow-none" icon={<Plus className="w-4 h-4" />} onClick={() => startNewEntry('expense')}>Add expense</Button>
            <Button className="!bg-white/12 !border !border-white/25 !text-white !shadow-none hover:!bg-white/20" onClick={() => startNewEntry('income')} icon={<Plus className="w-4 h-4" />}>Add income</Button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-2 rounded-xl border border-[#ddd9d2] bg-white px-3 py-2 text-xs font-bold text-[#5d5970]">
            <CalendarDays className="w-4 h-4" />
            <input aria-label="Finance month" type="month" value={month} onChange={e => { if (e.target.value) { setMonth(e.target.value); setAllTime(false); } }} className="border-0 bg-transparent outline-none text-xs min-w-0 max-w-[145px]" />
          </label>
          <button onClick={() => setAllTime(!allTime)} className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold ${allTime ? 'border-[#34326f] bg-[#34326f] text-white' : 'border-[#ddd9d2] bg-white text-[#716d7b]'}`}>{allTime ? 'All time ✓' : 'All time'}</button>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${synced ? 'text-[#438367]' : 'text-[#9a793e]'}`}>
          {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : synced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
          {syncing ? 'Syncing finances…' : synced ? 'Cloud synced' : isFirebaseConfigured() ? 'Saved locally · sync when online' : 'Saved on this device'}
        </span>
      </div>

      {notice && <div role="status" className="rounded-2xl bg-[#f0eee6] text-[#5b5670] px-4 py-3 flex items-center justify-between gap-3 text-xs font-semibold"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss message" className="shrink-0 text-[#898493] hover:text-[#34326f]">✕</button></div>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className={cardClass}>
          <div className="flex justify-between items-center"><p className="text-xs font-bold text-[#898594]">Income</p><span className="h-9 w-9 rounded-xl bg-[#eaf6ef] text-[#438566] grid place-items-center"><ArrowDownLeft className="w-4 h-4" /></span></div>
          <p className="mt-3 text-xl sm:text-2xl font-extrabold tracking-tight text-[#303047] break-all">{money(income)}</p>
          <p className="mt-1 text-[11px] text-[#938f9b]">{monthCaption}</p>
        </div>
        <div className={cardClass}>
          <div className="flex justify-between items-center"><p className="text-xs font-bold text-[#898594]">Expenses</p><span className="h-9 w-9 rounded-xl bg-[#fff0ea] text-[#cb705b] grid place-items-center"><ArrowUpRight className="w-4 h-4" /></span></div>
          <p className="mt-3 text-xl sm:text-2xl font-extrabold tracking-tight text-[#303047] break-all">{money(expenses)}</p>
          <p className="mt-1 text-[11px] text-[#938f9b]">{monthCaption}</p>
        </div>
        <div className={cardClass}>
          <div className="flex justify-between items-center"><p className="text-xs font-bold text-[#898594]">Net cash flow</p><span className="h-9 w-9 rounded-xl bg-[#edeaf7] text-[#615ca0] grid place-items-center"><WalletCards className="w-4 h-4" /></span></div>
          <p className={`mt-3 text-xl sm:text-2xl font-extrabold tracking-tight break-all ${net < 0 ? 'text-[#bd554c]' : 'text-[#303047]'}`}>{net < 0 ? '-' : ''}{money(Math.abs(net))}</p>
          <p className="mt-1 text-[11px] text-[#938f9b]">{monthCaption}</p>
        </div>
        <div className={cardClass}>
          <div className="flex justify-between items-center"><p className="text-xs font-bold text-[#898594]">Lifetime net</p><span className="h-9 w-9 rounded-xl bg-[#f8f1df] text-[#9a7734] grid place-items-center"><Landmark className="w-4 h-4" /></span></div>
          <p className={`mt-3 text-xl sm:text-2xl font-extrabold tracking-tight break-all ${allTimeNet < 0 ? 'text-[#bd554c]' : 'text-[#303047]'}`}>{allTimeNet < 0 ? '-' : ''}{money(Math.abs(allTimeNet))}</p>
          <p className="mt-1 text-[11px] text-[#938f9b]">Based on recorded transactions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_.9fr] gap-4">
        <section className={`${cardClass} space-y-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#9692a0]">Plan your spending</p><h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#302f46]">Monthly expense limit</h2></div>
            <button onClick={() => { setBudgetDraft(String(budgetLimit || '')); setEditingBudget(!editingBudget); }} className="text-xs font-bold text-[#5b568f] hover:underline">{budgetLimit > 0 ? 'Edit limit' : 'Set limit'}</button>
          </div>
          {editingBudget && <form onSubmit={handleSaveBudget} className="flex flex-wrap gap-2 items-end">
            <label className="flex-1 min-w-[140px] text-xs font-semibold text-[#777284]">Limit (BDT, 0 to clear)
              <input autoFocus type="number" min="0" max="999999999999" step="0.01" value={budgetDraft} onChange={e => setBudgetDraft(e.target.value)} className="mt-1 block w-full rounded-xl border border-[#ddd9d2] px-3 py-2.5 text-sm" placeholder="e.g. 15000" />
            </label>
            <Button type="submit" size="sm">Save</Button><Button type="button" variant="ghost" size="sm" onClick={() => setEditingBudget(false)}>Cancel</Button>
          </form>}
          {budgetLimit > 0 ? <>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-2xl font-extrabold text-[#313048]">{money(monthExpenses)} <span className="text-sm font-semibold text-[#a19dab]">/ {money(budgetLimit)}</span></p><p className={`text-xs font-bold ${progress > 100 ? 'text-[#bb554c]' : 'text-[#797486]'}`}>{Math.round(progress)}% used</p></div>
            <div role="progressbar" aria-valuenow={Math.min(Math.round(progress), 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly spending limit used" className="h-3 rounded-full overflow-hidden bg-[#f0eee9]"><div className={`h-full rounded-full transition-all ${progress > 100 ? 'bg-[#c96c60]' : 'bg-[#5b57a6]'}`} style={{ width: `${Math.min(progress, 100)}%` }} /></div>
            <p className={`text-xs ${progress > 100 ? 'text-[#ba554d] font-bold' : 'text-[#898493]'}`}>{progress > 100 ? `${money(monthExpenses - budgetLimit)} over your limit.` : `${money(Math.max(0, budgetLimit - monthExpenses))} remaining for ${monthTitle(month)}.`}</p>
          </> : <div className="rounded-2xl bg-[#f7f5ef] px-4 py-4 flex items-center gap-3"><PiggyBank className="w-7 h-7 shrink-0 text-[#9b8d65]" /><p className="text-xs leading-relaxed text-[#837e89]">Set a monthly spending limit to see how much you have left. The limit applies to each month.</p></div>}
          {allTime && <p className="text-[11px] text-[#a19dab]">Budget progress is for {monthTitle(month)}, even when all-time totals are shown above.</p>}
        </section>
        <section className={`${cardClass} space-y-4`}>
          <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#9692a0]">Income breakdown</p><h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#302f46]">Where your money came from</h2></div>
          <div className="space-y-3">
            <div className="flex justify-between gap-2 text-sm"><span className="text-[#7b7687]">Tuition payments <span className="text-[10px] text-[#a49fae]">(automatic)</span></span><strong className="text-[#38364e]">{money(tuitionIncome)}</strong></div>
            <div className="h-2.5 rounded-full bg-[#eeeaf1] overflow-hidden"><div className="h-full rounded-full bg-[#5d57a0]" style={{ width: `${income ? (tuitionIncome / income) * 100 : 0}%` }} /></div>
            <div className="flex justify-between gap-2 text-sm"><span className="text-[#7b7687]">Other personal income</span><strong className="text-[#38364e]">{money(income - tuitionIncome)}</strong></div>
            <div className="h-2.5 rounded-full bg-[#eeeaf1] overflow-hidden"><div className="h-full rounded-full bg-[#e6b86e]" style={{ width: `${income ? ((income - tuitionIncome) / income) * 100 : 0}%` }} /></div>
          </div>
          <p className="text-xs leading-relaxed text-[#9691a0]">Tuition amounts come from payments logged on student profiles. They can't be edited here, so you won't accidentally change a student's payment history.</p>
        </section>
      </div>

      {expensesByCategory.length > 0 && <section className={`${cardClass} space-y-4`}>
        <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#9692a0]">Spending insights</p><h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#302f46]">Expenses by category</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {expensesByCategory.map(([category, amount]) => <div key={category}>
            <div className="flex items-center justify-between gap-3 mb-2 text-xs"><span className="font-semibold text-[#615d72]">{category}</span><strong className="text-[#34324d]">{money(amount)} · {Math.round(amount / expenses * 100)}%</strong></div>
            <div className="h-2 rounded-full bg-[#f0eee9]"><div className="h-2 rounded-full bg-[#8c84ba]" style={{ width: `${amount / expenses * 100}%` }} /></div>
          </div>)}
        </div>
      </section>}

      <section className="tt-card rounded-[24px] overflow-hidden">
        <div className="px-5 sm:px-6 py-5 border-b border-[#efede8] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#9994a3]">Your money journal</p><h2 className="mt-1 text-lg sm:text-xl font-extrabold tracking-tight text-[#2e2d46]">Transactions <span className="ml-1 text-sm font-semibold text-[#a19dac]">({filteredEntries.length})</span></h2></div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="min-w-0 flex-1 sm:flex-none flex items-center gap-2 rounded-xl border border-[#e2ded7] bg-[#fbfaf8] px-3 py-2.5 text-xs"><Search className="w-4 h-4 shrink-0 text-[#a19ca9]" /><input className="w-full sm:w-40 bg-transparent border-0 outline-none min-w-0" placeholder="Search transactions" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search transactions" /></label>
            <select aria-label="Transaction type" value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)} className="rounded-xl border border-[#e2ded7] bg-white px-3 py-2.5 text-xs font-semibold text-[#666173]"><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select>
            <Button onClick={exportCSV} size="sm" variant="secondary" icon={<Download className="w-4 h-4" />}>CSV</Button>
          </div>
        </div>
        {filteredEntries.length ? <div className="divide-y divide-[#f0ede9]">
          {filteredEntries.map(entry => <div key={entry.id} className="flex items-center gap-3 px-4 sm:px-6 py-4 hover:bg-[#fcfbf9] transition-colors">
            <div className={`h-10 w-10 shrink-0 grid place-items-center rounded-[13px] ${entry.type === 'income' ? 'bg-[#eaf6ef] text-[#45886a]' : 'bg-[#fff1eb] text-[#c17460]'}`}>{entry.type === 'income' ? <ArrowDownLeft className="w-[18px] h-[18px]" /> : <ArrowUpRight className="w-[18px] h-[18px]" />}</div>
            <div className="flex-1 min-w-0"><div className="flex items-center flex-wrap gap-1.5"><p className="text-sm font-bold text-[#3a374f] truncate">{entry.category}</p>{entry.source === 'tuition' && <span className="text-[9px] font-bold rounded-full bg-[#f1eff8] text-[#68619d] px-2 py-0.5">Auto · tuition</span>}</div><p className="mt-1 text-[11px] text-[#92909a] truncate">{entry.date} {entry.note ? `· ${entry.note}` : ''}</p></div>
            <div className="text-right shrink-0"><p className={`text-sm font-extrabold ${entry.type === 'income' ? 'text-[#408063]' : 'text-[#b45b4d]'}`}>{entry.type === 'income' ? '+' : '−'}{money(entry.amount)}</p></div>
            {entry.source === 'personal' && <div className="flex items-center shrink-0 ml-1 gap-1"><button aria-label={`Edit ${entry.category} ${entry.date}`} className="h-8 w-8 grid place-items-center rounded-lg text-[#8c8798] hover:text-[#524d86] hover:bg-[#efedf7]" onClick={() => { setEditing(store.entries.find(item => item.id === entry.id) || null); setInitialType(entry.type); setEntryModal(true); }}><Edit3 className="w-3.5 h-3.5" /></button><button aria-label={`Delete ${entry.category} ${entry.date}`} className="h-8 w-8 grid place-items-center rounded-lg text-[#a29baa] hover:text-[#b85346] hover:bg-[#fff0ed]" onClick={() => void handleDelete(entry.id)}><Trash2 className="w-3.5 h-3.5" /></button></div>}
          </div>)}
        </div> : <div className="py-12 text-center px-6"><ReceiptText className="w-9 h-9 mx-auto text-[#c5becc]" /><p className="mt-3 text-sm font-extrabold text-[#3b394f]">No transactions found</p><p className="mt-1 text-xs text-[#948f9b]">Try another month or filter, or record your first transaction.</p><Button onClick={() => startNewEntry('expense')} size="sm" className="mt-4">Add a transaction</Button></div>}
      </section>

      <FinanceEntryModal isOpen={entryModal} editing={editing} initialType={initialType} onClose={() => setEntryModal(false)} onSave={handleSave} />
    </div>
  );
};
