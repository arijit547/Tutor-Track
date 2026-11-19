import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Check, ChevronDown, LoaderCircle, Plus, StickyNote } from 'lucide-react';
import { FinanceTransaction, FinanceTransactionType } from '../types';
import { buildFinanceEntry, expenseCategories, incomeCategories, quickCategories, yesterdayLocal } from '../services/financeEntry';
import { localDate } from '../services/localDate';
import { Button } from './Button';
import { Modal } from './Modal';

interface FinanceEntryFormProps {
  initialType: FinanceTransactionType;
  entries: FinanceTransaction[];
  editing?: FinanceTransaction | null;
  focusRequest?: number;
  autoFocus?: boolean;
  onSave: (entry: FinanceTransaction) => Promise<void>;
  onDone?: () => void;
  onBusyChange?: (busy: boolean) => void;
}

export const FinanceEntryForm: React.FC<FinanceEntryFormProps> = ({
  initialType, entries, editing, focusRequest = 0, autoFocus = false, onSave, onDone, onBusyChange,
}) => {
  const id = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const categoryMemory = useRef({ income: quickCategories(entries, 'income')[0], expense: quickCategories(entries, 'expense')[0] });
  const [type, setType] = useState(editing?.type ?? initialType);
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [category, setCategory] = useState(editing?.category ?? categoryMemory.current[initialType]);
  const [date, setDate] = useState(editing?.date ?? localDate());
  const [note, setNote] = useState(editing?.note ?? '');
  const [detailsOpen, setDetailsOpen] = useState(Boolean(editing?.note));
  const [moreCategories, setMoreCategories] = useState(false);
  const [customDate, setCustomDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!focusRequest || busy.current) return;
    setType(initialType);
    setCategory(categoryMemory.current[initialType]);
    setError('');
    amountRef.current?.focus({ preventScroll: true });
  }, [focusRequest, initialType]);

  const selectType = (next: FinanceTransactionType) => {
    setType(next);
    setCategory(categoryMemory.current[next]);
    setMoreCategories(false);
    setError('');
  };
  const selectCategory = (next: string) => {
    setCategory(next);
    categoryMemory.current[type] = next;
  };
  const categories = type === 'income' ? incomeCategories : expenseCategories;
  const chips = quickCategories(entries, type);
  if (!chips.includes(category)) chips[3] = category;
  const today = localDate();
  const yesterday = yesterdayLocal();
  const field = 'w-full rounded-xl border border-[#ded9e5] bg-white px-3.5 py-3 text-base text-[#343047] outline-none';
  const chip = 'min-h-11 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#655fa6]';
  const activeChip = 'border-[#bcb4d5] bg-[#f0edf7] text-[#514781]';

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    let entry: FinanceTransaction;
    try { entry = buildFinanceEntry({ type, amount, category, date, note }, editing); }
    catch (error) { setError(error instanceof Error ? error.message : 'Check the amount and date.'); return; }
    const another = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'another';
    busy.current = true;
    setSaving(true);
    onBusyChange?.(true);
    setError('');
    try {
      await onSave(entry);
      if (!editing) { setAmount(''); setNote(''); setDetailsOpen(false); }
      if (another) amountRef.current?.focus();
      else onDone?.();
    } catch {
      setError('Unable to save. Your entry is still here; check browser storage and try again.');
    } finally {
      busy.current = false;
      setSaving(false);
      onBusyChange?.(false);
      // The disabled field becomes focusable again after React commits this update.
      if (another) requestAnimationFrame(() => amountRef.current?.focus());
    }
  };

  return <form onSubmit={submit} aria-label={editing ? 'Edit finance entry' : 'Quick finance entry'}>
    <fieldset disabled={saving} className="min-w-0 space-y-5">
      <div className="flex items-center rounded-2xl bg-[#f0edf3] p-1.5 max-w-sm" role="group" aria-label="Entry type">
        {(['expense', 'income'] as const).map(value => {
          const Icon = value === 'income' ? ArrowDownLeft : ArrowUpRight;
          return <button key={value} type="button" aria-pressed={type === value} onClick={() => selectType(value)}
            className={`min-h-11 flex-1 rounded-xl px-4 py-2.5 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${type === value ? value === 'income' ? 'bg-white text-[#34765a] shadow-sm' : 'bg-white text-[#a65540] shadow-sm' : 'text-[#8b8395] hover:text-[#4c455d]'}`}>
            <Icon className="w-4 h-4" />{value === 'income' ? 'Income' : 'Expense'}
          </button>;
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] lg:gap-7">
        <div>
          <label htmlFor={`${id}-amount`} className="text-xs font-bold text-[#7d758a]">Amount in taka</label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[#dfd9e8] bg-[#fbf9fd] px-4 py-3 focus-within:border-[#9990b8]">
            <span aria-hidden="true" className="text-2xl font-semibold text-[#a19aae]">৳</span>
            <input id={`${id}-amount`} ref={amountRef} autoFocus={autoFocus} type="text" inputMode="decimal" autoComplete="off" required
              value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" aria-describedby={error ? `${id}-error` : undefined}
              className="tt-finance-amount min-w-0 w-full border-0 bg-transparent p-0 text-4xl font-extrabold tracking-tight tabular-nums text-[#343047] outline-none placeholder:text-[#c1bacb]" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Entry date">
            <button type="button" aria-pressed={date === today && !customDate} onClick={() => { setDate(today); setCustomDate(false); }} className={`${chip} ${date === today && !customDate ? activeChip : 'border-[#e6e1e9] bg-white text-[#81788e]'}`}>Today</button>
            <button type="button" aria-pressed={date === yesterday && !customDate} onClick={() => { setDate(yesterday); setCustomDate(false); }} className={`${chip} ${date === yesterday && !customDate ? activeChip : 'border-[#e6e1e9] bg-white text-[#81788e]'}`}>Yesterday</button>
            <button type="button" aria-expanded={customDate} aria-controls={`${id}-date-wrap`} onClick={() => setCustomDate(!customDate)} className={`${chip} inline-flex items-center gap-1.5 ${customDate || (date !== today && date !== yesterday) ? activeChip : 'border-[#e6e1e9] bg-white text-[#81788e]'}`}><CalendarDays className="w-3.5 h-3.5" />{date !== today && date !== yesterday ? date : 'Choose date'}</button>
          </div>
          {customDate && <label id={`${id}-date-wrap`} className="mt-3 block text-xs font-bold text-[#7d758a]">Entry date<input aria-label="Entry date" type="date" value={date} required onChange={event => setDate(event.target.value)} className={`${field} mt-1.5`} /></label>}
        </div>

        <div>
          <p id={`${id}-category-label`} className="text-xs font-bold text-[#7d758a]">Category</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-category-label`}>
            {chips.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => selectCategory(item)}
              className={`${chip} inline-flex items-center gap-1.5 ${category === item ? activeChip : 'border-[#e6e1e9] bg-white text-[#81788e] hover:border-[#c7bddb]'}`}>{category === item && <Check className="w-3.5 h-3.5" />}{item}</button>)}
            <button type="button" aria-expanded={moreCategories} aria-controls={`${id}-categories`} onClick={() => setMoreCategories(!moreCategories)} className={`${chip} inline-flex items-center gap-1.5 border-dashed border-[#d7d0e1] text-[#81788e]`}>More<ChevronDown className="w-3.5 h-3.5" /></button>
          </div>
          {moreCategories && <label className="mt-3 block text-xs font-bold text-[#7d758a]">All categories<select id={`${id}-categories`} value={category} onChange={event => selectCategory(event.target.value)} className={`${field} mt-1.5`}>
            {!categories.includes(category) && <option value={category}>{category}</option>}{categories.map(item => <option key={item}>{item}</option>)}
          </select></label>}
          <button type="button" aria-expanded={detailsOpen} aria-controls={`${id}-note`} onClick={() => setDetailsOpen(!detailsOpen)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-xs font-semibold text-[#8b819b] hover:text-[#514781]"><StickyNote className="w-3.5 h-3.5" />{detailsOpen ? 'Hide details' : 'Add a note (optional)'}</button>
          {detailsOpen && <textarea id={`${id}-note`} aria-label="Note" rows={2} maxLength={280} value={note} onChange={event => setNote(event.target.value)} className={`${field} resize-none`} placeholder="What was this for?" />}
        </div>
      </div>
      {type === 'income' && <p className="text-[11px] leading-5 text-[#93899f]">Student tuition payments are already included automatically. Add your other income here.</p>}
      {error && <p id={`${id}-error`} role="alert" className="rounded-xl bg-[#fff0eb] px-3 py-2.5 text-xs font-semibold text-[#af4f41]">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#eee9f1] pt-4">
        <Button type="submit" value="save" disabled={saving} className="!min-h-11 flex-1 sm:flex-none !bg-[#514781] hover:!bg-[#403667] !shadow-none" icon={saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}>{saving ? 'Saving…' : editing ? 'Save changes' : `Save ${type}`}</Button>
        {!editing && <Button type="submit" value="another" disabled={saving} variant="ghost" className="!min-h-11 flex-1 sm:flex-none !text-[#756889] !text-xs" icon={<Plus className="w-3.5 h-3.5" />}>Save & add another</Button>}
      </div>
    </fieldset>
  </form>;
};

export const FinanceEntryModal: React.FC<FinanceEntryFormProps & { isOpen: boolean; onClose: () => void }> = props => {
  const busy = useRef(false);
  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')].filter(element => element.getClientRects().length);
    const first = elements[0];
    const last = elements.at(-1);
    if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  };
  return <div onKeyDown={trapFocus}>
    <Modal isOpen={props.isOpen} onClose={() => { if (!busy.current) props.onClose(); }} title={props.editing ? 'Edit transaction' : 'Quick add'}>
      <FinanceEntryForm {...props} autoFocus onDone={props.onClose} onBusyChange={value => { busy.current = value; }} />
    </Modal>
  </div>;
};
