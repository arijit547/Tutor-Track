import React from 'react';
import { Student } from '../types';
import { CalendarDays, Clock3, WalletCards, ArrowUpRight } from 'lucide-react';
import { Button } from './Button';
import { getStudentBilling, monthlyRateLabel } from '../services/studentBilling';

interface StudentCardProps {
  student: Student;
  onView: (id: string) => void;
  onLogSession: (id: string) => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({ student, onView, onLogSession }) => {
  const billing = getStudentBilling(student);
  const completedSessions = billing.completedSessions;
  const balance = billing.outstanding;
  const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <article className="tt-card tt-card-hover rounded-[22px] p-5 group">
      <div className="flex items-start gap-3.5">
        <div className="h-11 w-11 rounded-[14px] bg-[#ece9f6] text-[#4e4a82] grid place-items-center font-extrabold text-sm shrink-0">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[#27263e] tracking-[-.02em] truncate">{student.name}</h3>
            <span className={`h-2 w-2 rounded-full ${student.active ? 'bg-[#4a9a70]' : 'bg-[#bbb8c2]'}`} title={student.active ? 'Active' : 'Inactive'} />
          </div>
          <p className="mt-0.5 text-sm text-[#858293] truncate">{student.subject}</p>
        </div>
        <button onClick={() => onView(student.id)} className="h-9 w-9 rounded-xl grid place-items-center text-[#8d8a99] hover:bg-[#f1eff5] hover:text-[#4b487f] transition-colors" aria-label={`View ${student.name}`}>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-[#f8f6f1] p-3">
          <div className="flex items-center gap-2 text-[#9693a2] text-[11px] font-semibold uppercase tracking-[.08em]"><CalendarDays className="w-3.5 h-3.5" /> Schedule</div>
          <p className="mt-2 text-sm font-bold text-[#39374d] truncate">{student.scheduleDays.join(' · ')}</p>
          <p className="text-xs text-[#888596] mt-0.5">{student.scheduleTime}</p>
        </div>
        <div className="rounded-2xl bg-[#f8f6f1] p-3">
          <div className="flex items-center gap-2 text-[#9693a2] text-[11px] font-semibold uppercase tracking-[.08em]"><WalletCards className="w-3.5 h-3.5" /> Balance</div>
          <p className={`mt-2 text-sm font-extrabold ${balance > 0 ? 'text-[#b35549]' : 'text-[#2d805b]'}`}>৳{balance.toLocaleString()}</p>
          <p className="text-xs text-[#888596] mt-0.5">{balance > 0 ? 'outstanding' : 'settled'}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-[#7f7c8e]">
        <span className="inline-flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" /> {completedSessions} completed</span>
        <span>{monthlyRateLabel(student)}</span>
      </div>

      <div className="mt-5 flex gap-2.5">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => onView(student.id)}>Details</Button>
        <Button size="sm" className="flex-1" onClick={() => onLogSession(student.id)}>Log session</Button>
      </div>
    </article>
  );
};
