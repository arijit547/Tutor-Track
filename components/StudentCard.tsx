import React from 'react';
import { Student } from '../types';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import { Button } from './Button';
import { getStudentBilling, monthlyRateLabel } from '../services/studentBilling';

interface StudentCardProps {
  student: Student;
  onView: (id: string) => void;
  onLogSession: (id: string) => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({ student, onView, onLogSession }) => {
  const billing = getStudentBilling(student);
  const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <article className="tt-card rounded-2xl p-5 sm:p-6 flex flex-col min-w-0">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-[#ecf0e8] text-[#355e47] grid place-items-center text-sm font-medium shrink-0">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-[#293b30] truncate">{student.name}</h3>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${student.active ? 'bg-[#438264]' : 'bg-[#b2bbb3]'}`} title={student.active ? 'Active' : 'Inactive'} />
          </div>
          <p className="mt-1 text-xs text-[#839086] truncate">{student.subject}</p>
        </div>
        <button onClick={() => onView(student.id)} className="h-8 w-8 rounded-lg grid place-items-center text-[#65796c] hover:text-[#2c654e] hover:bg-[#f0f4ee] transition-colors" aria-label={`View ${student.name}`}><ArrowUpRight size={17} strokeWidth={1.6} /></button>
      </div>

      <dl className="mt-5 divide-y divide-[#ebeee8] border-y border-[#ebeee8]">
        <div className="flex justify-between items-baseline gap-3 py-3">
          <dt className="text-xs text-[#687769]">Schedule</dt>
          <dd className="text-xs text-right text-[#405246] font-medium truncate">{student.scheduleDays.join(' · ')} · {student.scheduleTime}</dd>
        </div>
        <div className="flex justify-between items-baseline gap-3 py-3">
          <dt className="text-xs text-[#687769]">Balance due</dt>
          <dd className={`text-sm tabular-nums font-medium ${billing.outstanding > 0 ? 'text-[#a25b48]' : 'text-[#3b7355]'}`}>৳{billing.outstanding.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between items-baseline gap-3 py-3">
          <dt className="text-xs text-[#687769]">Tuition rate</dt>
          <dd className="text-xs text-right text-[#405246] font-medium">{monthlyRateLabel(student)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-[#687769]"><Clock3 size={14} strokeWidth={1.6} />{billing.completedSessions} completed sessions</div>
      <div className="mt-auto pt-5 flex gap-2.5">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => onView(student.id)}>Details</Button>
        <Button size="sm" className="flex-1" onClick={() => onLogSession(student.id)}>Log session</Button>
      </div>
    </article>
  );
};
