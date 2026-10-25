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

// These lightweight SVG visualizations deliberately require no charting dependency.
// They use the same transaction records as the rest of the Finance page.
type TrendPoint = { key: string; label: string; income: number; expenses: number };
const shortMoney = (amount: number) => `৳${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(amount)}`;
const monthKeysEndingAt = (endMonth: string, count: number) => {
  const [year, monthNumber] = endMonth.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(year, monthNumber - count + i, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
};

const CashFlowChart: React.FC<{ data: TrendPoint[] }> = ({ data }) => {
  const [selected, setSelected] = useState(data.length - 1);
  const chartId = React.useId().replace(/:/g, '');
  const lastIndex = data.length - 1;
  const activeIndex = Math.max(0, Math.min(selected, lastIndex));
  const active = data[activeIndex];
  const hasActivity = data.some(point => point.income > 0 || point.expenses > 0);
  const maxValue = Math.max(1, ...data.flatMap(point => [point.income, point.expenses]));
  const left = 55, right = 705, top = 20, bottom = 212;
  const x = (index: number) => left + (right - left) * (index / Math.max(1, lastIndex));
  const y = (value: number) => bottom - (value / (maxValue * 1.13)) * (bottom - top);
  const makeLine = (points: Array<{ x: number; y: number }>) => points.map((point, i) => {
    if (!i) return `M ${point.x} ${point.y}`;
    const prev = points[i - 1];
    const mid = (prev.x + point.x) / 2;
    return `C ${mid} ${prev.y} ${mid} ${point.y} ${point.x} ${point.y}`;
  }).join(' ');
  const incomePoints = data.map((point, i) => ({ x: x(i), y: y(point.income) }));
  const expensePoints = data.map((point, i) => ({ x: x(i), y: y(point.expenses) }));
  const incomeLine = makeLine(incomePoints);
  const expenseLine = makeLine(expensePoints);
  const toArea = (line: string) => `${line} L ${right} ${bottom} L ${left} ${bottom} Z`;

  if (!hasActivity) {
    return <div className="h-[210px] grid place-items-center rounded-2xl border border-dashed border-[#e4e0ec] bg-[#faf9fc] text-center px-4">
      <div><p className="text-sm font-bold text-[#514e6c]">Your financial story starts here</p><p className="text-xs text-[#9893a5] mt-1">Record income or an expense to see your trend.</p></div>
    </div>;
  }
  return <div className="min-w-0">
    <svg viewBox="0 0 740 246" className="w-full h-auto" role="img" aria-label="Monthly income and expenses trend chart">
      <defs>
        <linearGradient id={`finance-income-${chartId}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4a9d87" stopOpacity=".24"/><stop offset="100%" stopColor="#4a9d87" stopOpacity="0"/></linearGradient>
        <linearGradient id={`finance-expense-${chartId}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e1a07c" stopOpacity=".14"/><stop offset="100%" stopColor="#e1a07c" stopOpacity="0"/></linearGradient>
      </defs>
      {[0, .25, .5, .75, 1].map(frac => <g key={frac}>
        <line x1={left} x2={right} y1={y(maxValue * 1.13 * frac)} y2={y(maxValue * 1.13 * frac)} stroke="#eeeaf1" strokeDasharray={frac === 0 ? undefined : '4 7'} />
        <text x={left - 10} y={y(maxValue * 1.13 * frac) + 4} textAnchor="end" fontSize="11" fill="#a39eac">{shortMoney(maxValue * 1.13 * frac)}</text>
      </g>)}
      <path d={toArea(incomeLine)} fill={`url(#finance-income-${chartId})`}/>
      <path d={toArea(expenseLine)} fill={`url(#finance-expense-${chartId})`}/>
      <path d={incomeLine} fill="none" stroke="#469b80" strokeWidth="3.5" strokeLinecap="round"/>
      <path d={expenseLine} fill="none" stroke="#df9876" strokeWidth="3" strokeLinecap="round"/>
      {active && <g>
        <line x1={x(activeIndex)} x2={x(activeIndex)} y1={top} y2={bottom} stroke="#c8c0d5" strokeDasharray="5 5" strokeWidth="1.5"/>
        <circle cx={x(activeIndex)} cy={y(active.income)} r="6" fill="#469b80" stroke="white" strokeWidth="3" />
        <circle cx={x(activeIndex)} cy={y(active.expenses)} r="6" fill="#df9876" stroke="white" strokeWidth="3" />
      </g>}
      {data.map((point, index) => <g key={point.key}>
        <text x={x(index)} y="238" textAnchor="middle" fontSize="11" fill="#8e899c">{data.length > 6 && index % 2 === 1 && index !== lastIndex ? '' : point.label}</text>
        <rect x={x(index) - (right - left) / data.length / 2} y={top} width={(right - left) / data.length} height={bottom - top} fill="transparent"
          role="button" tabIndex={0} aria-label={`${point.key}: income ${money(point.income)}, expenses ${money(point.expenses)}`}
          onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)} onClick={() => setSelected(index)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(index); } }} />
      </g>)}
    </svg>
    {active && <div aria-live="polite" className="rounded-2xl bg-[#f7f6f9] px-4 py-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
      <span className="font-extrabold text-sm text-[#494562]">{new Date(`${active.key}-01T12:00:00`).toLocaleDateString('en-BD', { month: 'long', year: 'numeric' })}</span>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold">
        <span className="text-[#38846c]"><span aria-hidden="true">● </span>Income {money(active.income)}</span>
        <span className="text-[#bd775a]"><span aria-hidden="true">● </span>Expenses {money(active.expenses)}</span>
      </div>
    </div>}
  </div>;
};

const BudgetGauge: React.FC<{ amount: number; limit: number }> = ({ amount, limit }) => {
  const ratio = limit > 0 ? amount / limit : 0;
  const percent = ratio * 100;
  const over = ratio > 1;
  const path = 'M 25 120 A 95 95 0 0 1 215 120';
  return <div className="relative mx-auto w-full max-w-[260px]">
    <svg viewBox="0 0 240 148" className="w-full" role="progressbar" aria-label="Monthly spending budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(percent))} aria-valuetext={`${Math.round(percent)} percent of budget used`}>
      <path d={path} fill="none" stroke="#ece9f1" strokeWidth="19" strokeLinecap="round" />
      <path d={path} fill="none" stroke={over ? '#c86e61' : '#6760aa'} strokeWidth="19" strokeLinecap="round" pathLength={100} strokeDasharray={`${Math.min(100, Math.max(0, percent))} 100`} className="transition-all duration-500" />
      <text x="120" y="99" textAnchor="middle" fontSize="35" fontWeight="800" fill={over ? '#b75c50' : '#33314c'}>{Math.round(percent)}%</text>
      <text x="120" y="121" textAnchor="middle" fontSize="11" fontWeight="700" fill="#928c9c">{over ? 'Over budget' : 'Budget used'}</text>
    </svg>
  </div>;
};

const EXPENSE_COLORS = ['#655fa6', '#e9ac70', '#55a48b', '#df8f7b', '#87a6c1', '#c0a4c7'];
const SpendingDonut: React.FC<{ categories: Array<[string, number]>; total: number }> = ({ categories, total }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const shown = categories.length <= 6 ? categories : [
    ...categories.slice(0, 5),
    ['Other categories', categories.slice(5).reduce((sum, [, amount]) => sum + amount, 0)] as [string, number],
  ];
  const chosen = shown[Math.min(activeIndex, Math.max(0, shown.length - 1))];
  const circumference = 2 * Math.PI * 72;
  let used = 0;
  const segments = shown.map(([category, amount], index) => {
    const fraction = total > 0 ? amount / total : 0;
    const segment = { category, amount, index, start: used, fraction };
    used += fraction;
    return segment;
  });
  return <div className="grid grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)] items-center gap-4 sm:gap-7">
    <div className="w-full max-w-[240px] mx-auto">
      <svg viewBox="0 0 240 240" className="w-full" role="img" aria-label="Expense share by category donut chart">
        <circle cx="120" cy="120" r="72" stroke="#3684e4" strokeWidth="24" fill="none"/>
        {segments.map(segment => <circle key={segment.category} cx="120" cy="120" r="72" fill="none" stroke={EXPENSE_COLORS[segment.index % EXPENSE_COLORS.length]}
          strokeWidth={activeIndex === segment.index ? 29 : 24} strokeDasharray={`${Math.max(0, segment.fraction * circumference - 3)} ${circumference}`} strokeDashoffset={-segment.start * circumference} transform="rotate(-90 120 120)"
          className="cursor-pointer transition-all duration-300" role="button" tabIndex={0} aria-label={`${segment.category}, ${money(segment.amount)}`}
          onMouseEnter={() => setActiveIndex(segment.index)} onFocus={() => setActiveIndex(segment.index)} onClick={() => setActiveIndex(segment.index)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveIndex(segment.index); } }}>
          <title>{`${segment.category}: ${money(segment.amount)}`}</title>
        </circle>)}
        <text x="120" y="110" textAnchor="middle" fontSize="12" fontWeight="700" fill="#8d8698">{chosen?.[0] ?? 'Expenses'}</text>
        <text x="120" y="139" textAnchor="middle" fontSize="20" fontWeight="800" fill="#34324e">{money(chosen?.[1] ?? 0)}</text>
        <text x="120" y="158" textAnchor="middle" fontSize="12" fontWeight="700" fill="#827d96">{total > 0 ? Math.round(((chosen?.[1] ?? 0) / total) * 100) : 0}% of total</text>
      </svg>
    </div>
    <div className="grid grid-cols-1 gap-1.5 min-w-0">
      {segments.map(segment => <button key={segment.category} type="button" onFocus={() => setActiveIndex(segment.index)} onMouseEnter={() => setActiveIndex(segment.index)} onClick={() => setActiveIndex(segment.index)}
        className={`rounded-xl flex gap-3 items-center justify-between text-left px-3 py-2.5 transition-colors ${activeIndex === segment.index ? 'bg-[#f4f2fa]' : 'hover:bg-[#faf9fc]'}`}>
        <span className="min-w-0 flex items-center gap-2 text-xs font-bold text-[#666076]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: EXPENSE_COLORS[segment.index % EXPENSE_COLORS.length] }} /><span className="truncate">{segment.category}</span></span>
        <span className="shrink-0 font-extrabold text-xs text-[#45415c]">{money(segment.amount)}</span>
      </button>)}
    </div>
  </div>;
};

const IncomeSources: React.FC<{ tuition: number; other: number }> = ({ tuition, other }) => {
  const total = tuition + other;
  const tuitionPct = total > 0 ? tuition / total * 100 : 0;
  const arc = 'M 30 145 A 90 90 0 0 1 210 145';
  return <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row gap-4 items-center">
    <div className="w-full max-w-[218px] shrink-0">
      <svg viewBox="0 0 240 168" className="w-full" role="img" aria-label={`Income sources: ${Math.round(tuitionPct)} percent tuition and ${Math.round(100 - tuitionPct)} percent other`}>
        <path d={arc} fill="none" stroke="#e6b86e" strokeWidth="23" strokeLinecap="round"/>
        {total > 0 && <path d={arc} fill="none" stroke="#655fa6" strokeWidth="23" strokeLinecap="butt" pathLength={100} strokeDasharray={`${tuitionPct} 100`} />}
        <text x="120" y="113" textAnchor="middle" fill="#37344f" fontWeight="800" fontSize="29">{total ? Math.round(tuitionPct) : 0}%</text>
        <text x="120" y="136" textAnchor="middle" fill="#9690a1" fontWeight="700" fontSize="11">from tuition</text>
      </svg>
    </div>
    <div className="grid gap-3 w-full min-w-0">
      <div className="flex items-center justify-between gap-2 border-b border-[#efecf1] pb-3">
        <span className="flex gap-2 items-center text-xs font-bold text-[#797387]"><span className="w-2.5 h-2.5 rounded-full bg-[#655fa6]"/>Tuition <span className="text-[10px] font-normal">(automatic)</span></span>
        <strong className="text-sm text-[#34324b]">{money(tuition)}</strong>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex gap-2 items-center text-xs font-bold text-[#797387]"><span className="w-2.5 h-2.5 rounded-full bg-[#e6b86e]"/>Other income</span>
        <strong className="text-sm text-[#34324b]">{money(other)}</strong>
      </div>
    </div>
  </div>;
};

const SpendingHeatmap: React.FC<{ month: string; daily: Record<number, number> }> = ({ month, daily }) => {
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
  const maximum = Math.max(0, ...Object.values(daily));
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const chosenDay = activeDay !== null && activeDay <= daysInMonth ? activeDay : null;
  const dayColor = (amount: number) => {
    if (!amount || !maximum) return '#f3f0f4';
    const intensity = amount / maximum;
    if (intensity < .25) return '#dedbf0';
    if (intensity < .5) return '#bdb6df';
    if (intensity < .75) return '#9288c7';
    return '#5f579d';
  };
  return <div className="max-w-[430px] mx-auto w-full">
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={index} className="text-center text-[11px] font-bold text-[#a49eac]">{day}</span>)}</div>
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {Array.from({ length: firstWeekday }, (_, index) => <span aria-hidden="true" key={`empty-${index}`} />)}
      {days.map(day => <button type="button" key={day} onFocus={() => setActiveDay(day)} onMouseEnter={() => setActiveDay(day)} onClick={() => setActiveDay(day)}
        aria-label={`${month}-${String(day).padStart(2, '0')}: spent ${money(daily[day] ?? 0)}`}
        className={`aspect-square rounded-lg grid place-items-center text-[10px] sm:text-xs font-bold transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#655fa6] ${chosenDay === day ? 'ring-2 ring-offset-1 ring-[#655fa6]' : ''}`}
        style={{ backgroundColor: dayColor(daily[day] || 0), color: (daily[day] || 0) / (maximum || 1) >= .75 ? '#fff' : '#5b5373' }}>
        {day}
      </button>)}
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[#8f8999]">
      <span>{chosenDay ? `${month}-${String(chosenDay).padStart(2, '0')}: ${money(daily[chosenDay] || 0)}` : 'Select any day to inspect spending'}</span>
      <span className="flex items-center gap-1.5">Less {['#f3f0f4', '#dedbf0', '#bdb6df', '#9288c7', '#5f579d'].map(color => <i key={color} className="w-2.5 h-2.5 rounded-sm" style={{ background: color }}/>) } More</span>
    </div>
  </div>;
};

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
  const [trendWindow, setTrendWindow] = useState<6 | 12>(6);

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

  // Use all recorded transactions for the historical trend, not just the selected month's summary.
  const trendEndingMonth = allTime ? todayLocal().slice(0, 7) : month;
  const trendData = useMemo<TrendPoint[]>(() => {
    const keys = monthKeysEndingAt(trendEndingMonth, trendWindow);
    const grouped = new Map(keys.map(key => [key, { income: 0, expenses: 0 }]));
    entries.forEach(entry => {
      const bucket = grouped.get(entry.date.slice(0, 7));
      if (!bucket) return;
      if (entry.type === 'income') bucket.income += entry.amount;
      else bucket.expenses += entry.amount;
    });
    return keys.map(key => ({
      key,
      label: new Date(`${key}-01T12:00:00`).toLocaleDateString('en-BD', { month: 'short' }),
      income: grouped.get(key)?.income || 0,
      expenses: grouped.get(key)?.expenses || 0,
    }));
  }, [entries, trendEndingMonth, trendWindow]);
  const dailyExpenseTotals = useMemo(() => entries.reduce<Record<number, number>>((totals, entry) => {
    if (entry.type === 'expense' && entry.date.slice(0, 7) === month) {
      const day = Number(entry.date.slice(8, 10));
      if (Number.isInteger(day) && day >= 1 && day <= 31) totals[day] = (totals[day] || 0) + entry.amount;
    }
    return totals;
  }, {}), [entries, month]);

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

      <section className={`${cardClass} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#9692a0]">Financial pulse</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#302f46]">Income & expense trends</h2>
            <p className="mt-1 text-xs text-[#958f9e]">Through {monthTitle(trendEndingMonth)} · Select a month on the chart for details</p>
          </div>
          <div className="flex items-center rounded-xl bg-[#f3f1f6] p-1" role="group" aria-label="Trend range">
            {([6, 12] as const).map(count => <button key={count} type="button" onClick={() => setTrendWindow(count)} aria-pressed={trendWindow === count}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition-all ${trendWindow === count ? 'bg-white shadow-sm text-[#37336e]' : 'text-[#928c9e] hover:text-[#5b568f]'}`}>{count}M</button>)}
          </div>
        </div>
        <CashFlowChart data={trendData} />
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-[#8d8796]">
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#469b80]"/>Income</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#df9876]"/>Expenses</span>
          <span className="ml-auto text-[#aaa4b0] font-medium">Based on your recorded transactions</span>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className={`${cardClass} space-y-4`}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#9692a0]">Plan your spending</p><h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#302f46]">Monthly budget</h2></div>
            <button onClick={() => { setBudgetDraft(String(budgetLimit || '')); setEditingBudget(!editingBudget); }} className="text-xs font-bold text-[#5b568f] hover:underline shrink-0">{budgetLimit > 0 ? 'Edit limit' : 'Set limit'}</button>
          </div>
          {editingBudget && <form onSubmit={handleSaveBudget} className="flex flex-wrap gap-2 items-end">
            <label className="flex-1 min-w-[140px] text-xs font-semibold text-[#777284]">Limit (BDT, 0 to clear)
              <input autoFocus type="number" min="0" max="999999999999" step="0.01" value={budgetDraft} onChange={e => setBudgetDraft(e.target.value)} className="mt-1 block w-full rounded-xl border border-[#ddd9d2] px-3 py-2.5 text-sm" placeholder="e.g. 15000" />
            </label>
            <Button type="submit" size="sm">Save</Button><Button type="button" variant="ghost" size="sm" onClick={() => setEditingBudget(false)}>Cancel</Button>
          </form>}
          {budgetLimit > 0 ? <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
            <BudgetGauge amount={monthExpenses} limit={budgetLimit} />
            <div className="space-y-3 text-center sm:text-left">
              <p className="text-xs font-bold text-[#968fa1]">Spent in {monthTitle(month)}</p>
              <p className="text-2xl font-extrabold tracking-tight text-[#34314c]">{money(monthExpenses)}</p>
              <p className="text-xs text-[#9a94a2]">of {money(budgetLimit)} monthly limit</p>
              <div className={`rounded-xl px-3 py-2.5 text-xs font-bold ${progress > 100 ? 'bg-[#fff0ec] text-[#ba554d]' : 'bg-[#f2f0f9] text-[#5f5998]'}`}>
                {progress > 100 ? `${money(monthExpenses - budgetLimit)} over budget` : `${money(Math.max(0, budgetLimit - monthExpenses))} remaining`}
              </div>
            </div>
          </div> : <div className="rounded-2xl bg-[#f7f5ef] px-4 py-6 flex items-center gap-3"><PiggyBank className="w-9 h-9 shrink-0 text-[#9b8d65]" /><p className="text-xs leading-relaxed text-[#837e89]">Set a monthly budget to unlock your spending gauge. The same limit applies to every month.</p></div>}
          {allTime && <p className="text-[11px] text-[#a19dab]">The budget gauge uses {monthTitle(month)}, even while the summary displays all-time figures.</p>}
        </section>
        <section className={`${cardClass} space-y-3`}>
          <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#9692a0]">Income composition</p><h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#302f46]">Where your money came from</h2></div>
          <IncomeSources tuition={tuitionIncome} other={Math.max(0, income - tuitionIncome)} />
          <p className="text-xs leading-relaxed text-[#9691a0]">Tuition payments are pulled from student profiles automatically and cannot be edited here.</p>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-4">
        <section className={`${cardClass} space-y-2`}>
          <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#9692a0]">Spending mix</p><h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#302f46]">Expenses by category</h2></div>
          {expensesByCategory.length ? <SpendingDonut categories={expensesByCategory} total={expenses} /> : <div className="min-h-[220px] grid place-items-center text-center px-4"><div><ReceiptText className="w-8 h-8 mx-auto text-[#c4bbd0]"/><p className="mt-2 text-sm font-bold text-[#555169]">No expenses for this period</p><p className="mt-1 text-xs text-[#9d97a7]">Add an expense to see its category distribution.</p></div></div>}
        </section>
        <section className={`${cardClass} space-y-4`}>
          <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#9692a0]">Daily rhythm</p><h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#302f46]">Spending calendar</h2><p className="mt-1 text-xs text-[#9a94a2]">{monthTitle(month)} · Darker dates had more expenses</p></div>
          <SpendingHeatmap month={month} daily={dailyExpenseTotals} />
          {allTime && <p className="text-[11px] text-[#a19dab]">Showing the selected month. Change the month above to inspect another calendar.</p>}
        </section>
      </div>

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
