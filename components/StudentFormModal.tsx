import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Student, DayOfWeek, BillingMode } from '../types';
import { getStudentPlans, monthFromDate, nextMonth } from '../services/studentBilling';
import { prepareStudentBillingUpdate } from '../services/studentBillingUpdate';
import { MapPin, Map, Mail, UserRound, BookOpen, Banknote, Clock3 } from 'lucide-react';
import { getCurrentLocation } from '../services/locationService.browser';
import { MapPicker } from './MapPicker';

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (studentData: Omit<Student, 'id' | 'sessions' | 'payments' | 'joinedDate'>) => void;
  student?: Student;
}

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const StudentFormModal: React.FC<StudentFormModalProps> = ({ isOpen, onClose, onSubmit, student }) => {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [billingMode, setBillingMode] = useState<BillingMode>('session-target');
  const [sessionsPerMonth, setSessionsPerMonth] = useState('12');
  const [billingStartDate, setBillingStartDate] = useState(() => new Date().toLocaleDateString('en-CA'));

  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [scheduleDays, setScheduleDays] = useState<DayOfWeek[]>(['Mon']);
  const [email, setEmail] = useState('');
  const [active, setActive] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string } | undefined>();
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (student) {
      const plans = getStudentPlans(student);
      const current = plans[plans.length - 1];
      setName(student.name); setSubject(student.subject);
      setMonthlySalary(current?.monthlySalary?.toString() || '');
      setBillingMode(current?.billingMode || 'session-target');
      setSessionsPerMonth(current?.sessionsPerMonth?.toString() || '12');
      setBillingStartDate(student.billingStartDate || (student.joinedDate?.slice(0, 10)) || new Date().toLocaleDateString('en-CA'));
      setScheduleTime(student.scheduleTime); setScheduleDays(student.scheduleDays); setEmail(student.email || '');
      setActive(student.active); setLocation(student.location);
    } else {
      setName(''); setSubject(''); setMonthlySalary(''); setBillingMode('session-target');
      setSessionsPerMonth('12'); setBillingStartDate(new Date().toLocaleDateString('en-CA'));
      setScheduleTime('10:00'); setScheduleDays(['Mon']);
      setEmail(''); setActive(true); setLocation(undefined);
    }
    setErrors({});
  }, [isOpen, student]);

  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Student name is required';
    if (!subject.trim()) next.subject = 'Subject is required';
    if (!monthlySalary || !Number.isFinite(Number(monthlySalary)) || Number(monthlySalary) <= 0) next.salary = 'Enter a valid monthly salary';
    if (billingMode === 'session-target' && (!sessionsPerMonth || !Number.isInteger(Number(sessionsPerMonth)) || Number(sessionsPerMonth) < 1)) next.sessions = 'Set the required number of sessions (at least 1)';
    if (sessionsPerMonth && (!Number.isInteger(Number(sessionsPerMonth)) || Number(sessionsPerMonth) < 1)) next.sessions = 'Use a positive whole number';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(billingStartDate) || Number.isNaN(Date.parse(billingStartDate))) next.start = 'Choose a valid billing start date';
    if (!scheduleDays.length) next.days = 'Choose at least one day';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const monthly = Number(monthlySalary);
    const count = sessionsPerMonth ? Number(sessionsPerMonth) : undefined;
    const monthNow = monthFromDate(new Date());
    const billingUpdate = prepareStudentBillingUpdate(student, {
      monthlySalary: monthly, billingMode, sessionsPerMonth: count, billingStartDate,
    });

    let pausedMonths = [...(student?.billingPausedMonths || [])];
    let pausedFromMonth = student?.billingPausedFromMonth || (!student && !active ? monthFromDate(billingStartDate) : '');
    if (student?.active && !active) {
      pausedFromMonth = nextMonth(monthNow); // The current calendar month remains billable.
    } else if (student && !student.active && active && pausedFromMonth) {
      for (let month = pausedFromMonth, i = 0; month < monthNow && i < 1200; month = nextMonth(month), i++) {
        if (!pausedMonths.includes(month)) pausedMonths.push(month);
      }
      pausedFromMonth = '';
    }

    onSubmit({
      name: name.trim(), subject: subject.trim(), scheduleTime, scheduleDays,
      email: email.trim() || undefined, active, location,
      ...billingUpdate, billingPausedMonths: pausedMonths, billingPausedFromMonth: pausedFromMonth,
    });
    onClose();
  };

  const toggleDay = (day: DayOfWeek) => setScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  const estimatedRate = Number(monthlySalary) > 0 && Number(sessionsPerMonth) > 0
    ? Number(monthlySalary) / Number(sessionsPerMonth) : 0;
  const historyExists = !!student && (student.sessions.length > 0 || student.payments.length > 0);
  const field = 'w-full rounded-xl border bg-[#fbfaf7] px-3.5 py-2.5 text-sm outline-none';
  const fieldBorder = (key: string) => errors[key] ? 'border-[#d98378]' : 'border-[#dcd8d0]';

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={student ? `Edit student · ${student.name}` : 'Add a new student'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Student name" error={errors.name} icon={<UserRound className="w-4 h-4" />}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Student name" className={`${field} ${fieldBorder('name')} pl-10`} />
            </Field>
            <Field label="Subject" error={errors.subject} icon={<BookOpen className="w-4 h-4" />}>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Mathematics" className={`${field} ${fieldBorder('subject')} pl-10`} />
            </Field>
          </div>

          <div className="rounded-[20px] border border-[#e5e1d9] bg-[#faf8f3] p-4 space-y-4">
            <div>
              <p className="text-sm font-extrabold text-[#39364d]">Monthly tuition agreement</p>
              <p className="mt-1 text-xs text-[#888394]">Set the monthly salary first. We calculate an equivalent per-session rate automatically.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Salary per month (BDT)" error={errors.salary} icon={<Banknote className="w-4 h-4" />}>
                <input type="number" min="1" step="0.01" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} placeholder="6000" className={`${field} ${fieldBorder('salary')} pl-10`} />
              </Field>
              <Field label="Billing starts" error={errors.start} icon={<Clock3 className="w-4 h-4" />}>
                <input type="date" value={billingStartDate} onChange={e => setBillingStartDate(e.target.value)} disabled={!!student} className={`${field} ${fieldBorder('start')} pl-10 disabled:opacity-60`} />
              </Field>
            </div>
            <div>
              <p className="text-xs font-bold text-[#666374] mb-2">When is a tuition month completed?</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => setBillingMode('session-target')} aria-pressed={billingMode === 'session-target'} className={`text-left rounded-2xl border p-3 transition-all ${billingMode === 'session-target' ? 'border-[#56518f] bg-[#eeedf7] text-[#34316f]' : 'border-[#dedbd4] bg-white text-[#676477]'}`}>
                  <span className="block text-xs font-extrabold">Fixed sessions per month</span>
                  <span className="block mt-1 text-[11px] leading-4">Pay is earned by completed sessions, up to one monthly salary.</span>
                </button>
                <button type="button" onClick={() => setBillingMode('calendar-month')} aria-pressed={billingMode === 'calendar-month'} className={`text-left rounded-2xl border p-3 transition-all ${billingMode === 'calendar-month' ? 'border-[#56518f] bg-[#eeedf7] text-[#34316f]' : 'border-[#dedbd4] bg-white text-[#676477]'}`}>
                  <span className="block text-xs font-extrabold">Calendar month</span>
                  <span className="block mt-1 text-[11px] leading-4">Full monthly salary is due when the calendar month ends, regardless of sessions.</span>
                </button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 items-end">
              <Field label={billingMode === 'session-target' ? 'Required sessions per month' : 'Planned sessions per month (optional)'} error={errors.sessions}>
                <input type="number" min="1" step="1" value={sessionsPerMonth} onChange={e => setSessionsPerMonth(e.target.value)} placeholder="12" className={`${field} ${fieldBorder('sessions')}`} />
              </Field>
              <div className="rounded-xl border border-[#ded9ed] bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#918ca0]">Calculated per-session equivalent</p>
                <p className="mt-1 text-lg font-extrabold text-[#34316f]">{estimatedRate ? `৳${estimatedRate.toLocaleString('en-BD', { maximumFractionDigits: 2 })}` : '—'}</p>
              </div>
            </div>
            <p className="text-[11px] leading-5 text-[#777287]">
              {billingMode === 'session-target'
                ? 'Only completed sessions count. Extra sessions beyond the monthly target do not add charges automatically. Each calendar month has its own target.'
                : 'The estimated per-session amount is informational only. Attendance does not change the fixed monthly fee; the fee becomes due after the month ends.'}
              {' '}The first calendar month is billed in full (no proration).
            </p>
            {student && historyExists && <p className="text-[11px] font-semibold text-[#6c5687]">If you change salary or billing method, the new contract starts next calendar month so past billing stays unchanged.</p>}
          </div>

          <Field label="Class time" icon={<Clock3 className="w-4 h-4" />}>
            <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className={`${field} border-[#dcd8d0] pl-10`} />
          </Field>

          <div>
            <label className="block text-xs font-bold text-[#666374] mb-2">Weekly schedule</label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map(day => <button key={day} type="button" onClick={() => toggleDay(day)} className={`h-9 rounded-xl text-[11px] font-extrabold transition-colors ${scheduleDays.includes(day) ? 'bg-[#34326f] text-white shadow-sm' : 'bg-[#f0eee8] text-[#777482] hover:bg-[#e8e5ed]'}`}>{day.slice(0,1)}</button>)}
            </div>
            <p className="mt-2 text-[11px] text-[#9995a0]">Selected: {scheduleDays.length ? scheduleDays.join(', ') : 'none'}</p>
            {errors.days && <p className="mt-1 text-[11px] font-semibold text-[#b3584d]">{errors.days}</p>}
          </div>

          <Field label="Student email (optional)" icon={<Mail className="w-4 h-4" />}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="student@example.com" className={`${field} border-[#dcd8d0] pl-10`} />
          </Field>

          <div className="rounded-[18px] border border-[#e5e1d9] bg-[#faf8f3] p-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-white text-[#5b578b] grid place-items-center shrink-0"><MapPin className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-[#4b485d]">Tuition location <span className="font-medium text-[#9995a1]">(optional)</span></p>
                <p className="mt-1 text-[11px] leading-5 text-[#8c8995]">Used only for the optional browser auto-session detector.</p>
                {location && <p className="mt-2 text-[11px] font-semibold text-[#5e5a70] truncate">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" icon={<Map className="w-4 h-4" />} onClick={() => setShowMapPicker(true)}>{location ? 'Change location' : 'Set location'}</Button>
              <Button type="button" variant="ghost" size="sm" icon={<MapPin className="w-4 h-4" />} disabled={loadingLocation} onClick={async () => {
                setLoadingLocation(true);
                try { setLocation(await getCurrentLocation()); } catch { alert('Could not access your location. Check browser permissions.'); }
                setLoadingLocation(false);
              }}>{loadingLocation ? 'Locating…' : 'Use current'}</Button>
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-[16px] border border-[#e5e1da] bg-white px-4 py-3 cursor-pointer">
            <div><p className="text-xs font-extrabold text-[#4c495d]">Active student</p><p className="mt-0.5 text-[11px] text-[#96929e]">Show this student in the active schedule.</p></div>
            <button type="button" onClick={() => setActive(v => !v)} className={`relative h-6 w-11 rounded-full transition-colors ${active ? 'bg-[#55518f]' : 'bg-[#d3cfd6]'}`} aria-pressed={active}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} /></button>
          </label>

          <div className="pt-3 border-t border-[#eeece6] flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">{student ? 'Save changes' : 'Add student'}</Button></div>
        </form>
      </Modal>

      {showMapPicker && <MapPicker initialLocation={location} onLocationSelect={loc => { setLocation(loc); setShowMapPicker(false); }} onClose={() => setShowMapPicker(false)} />}
    </>
  );
};

const Field: React.FC<{ label: string; error?: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ label, error, icon, children }) => (
  <div>
    <label className="block text-xs font-bold text-[#666374] mb-2">{label}</label>
    <div className="relative">{icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#aaa6b2] pointer-events-none">{icon}</span>}{children}</div>
    {error && <p className="mt-1 text-[11px] font-semibold text-[#b3584d]">{error}</p>}
  </div>
);
