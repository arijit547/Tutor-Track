import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Session } from '../types';
import { CalendarDays, Clock3, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (sessionData: Omit<Session, 'id'>) => void;
  studentName: string;
}

export const SessionModal: React.FC<SessionModalProps> = ({ isOpen, onClose, onSubmit, studentName }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState(60);
  const [status, setStatus] = useState<Session['status']>('completed');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      setDuration(60);
      setStatus('completed');
      setNotes('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ date: new Date(date).toISOString(), durationMinutes: duration, status, notes: notes.trim() || undefined });
    onClose();
  };

  const field = 'w-full rounded-xl border border-[#dcd8d0] bg-[#fbfaf7] px-3.5 py-2.5 text-sm outline-none';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Log session · ${studentName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-bold text-[#666374] mb-2">Date</label><div className="relative"><CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aaa6b2]"/><input type="date" required value={date} onChange={e => setDate(e.target.value)} className={`${field} pl-10`} /></div></div>
          <div><label className="block text-xs font-bold text-[#666374] mb-2">Duration</label><div className="relative"><Clock3 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aaa6b2]"/><input type="number" required min="15" step="15" value={duration} onChange={e => setDuration(Number(e.target.value))} className={`${field} pl-10`} /></div></div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#666374] mb-2">Session status</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              ['completed', 'Completed', CheckCircle2],
              ['missed', 'Missed', AlertCircle],
              ['cancelled', 'Cancelled', XCircle],
            ] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" onClick={() => setStatus(value)} className={`rounded-xl border px-2 py-3 text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-colors ${status === value ? 'border-[#8d88bd] bg-[#f0eef8] text-[#4d497e]' : 'border-[#e1ddd6] bg-white text-[#807d89] hover:bg-[#f8f6f1]'}`}><Icon className="w-4 h-4" /> {label}</button>
            ))}
          </div>
          {status === 'missed' && <p className="mt-2 text-[11px] text-[#9a6b32] bg-[#fff6e6] rounded-xl px-3 py-2">Missed sessions are counted as chargeable in the current billing logic.</p>}
        </div>

        <div><label className="block text-xs font-bold text-[#666374] mb-2">Notes <span className="font-medium text-[#a5a1ab]">(optional)</span></label><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className={`${field} resize-none`} placeholder="Topics covered, homework, progress…" /></div>

        <div className="pt-3 border-t border-[#eeece6] flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">Save session</Button></div>
      </form>
    </Modal>
  );
};
