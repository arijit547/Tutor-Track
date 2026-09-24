import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Student, DayOfWeek } from '../types';
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
  const [ratePerSession, setRatePerSession] = useState('');
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
      setName(student.name); setSubject(student.subject); setRatePerSession(student.ratePerSession.toString());
      setScheduleTime(student.scheduleTime); setScheduleDays(student.scheduleDays); setEmail(student.email || '');
      setActive(student.active); setLocation(student.location);
    } else {
      setName(''); setSubject(''); setRatePerSession(''); setScheduleTime('10:00'); setScheduleDays(['Mon']);
      setEmail(''); setActive(true); setLocation(undefined);
    }
    setErrors({});
  }, [isOpen, student]);

  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Student name is required';
    if (!subject.trim()) next.subject = 'Subject is required';
    if (!ratePerSession || Number(ratePerSession) <= 0) next.rate = 'Enter a valid session rate';
    if (!scheduleDays.length) next.days = 'Choose at least one day';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    onSubmit({ name: name.trim(), subject: subject.trim(), ratePerSession: Number(ratePerSession), scheduleTime, scheduleDays, email: email.trim() || undefined, active, location });
    onClose();
  };

  const toggleDay = (day: DayOfWeek) => setScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
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

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Rate per session (BDT)" error={errors.rate} icon={<Banknote className="w-4 h-4" />}>
              <input type="number" min="1" step="1" value={ratePerSession} onChange={e => setRatePerSession(e.target.value)} placeholder="1000" className={`${field} ${fieldBorder('rate')} pl-10`} />
            </Field>
            <Field label="Class time" icon={<Clock3 className="w-4 h-4" />}>
              <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className={`${field} border-[#dcd8d0] pl-10`} />
            </Field>
          </div>

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
