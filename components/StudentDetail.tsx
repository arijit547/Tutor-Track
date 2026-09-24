import React, { useState } from 'react';
import { Student } from '../types';
import { Button } from './Button';
import { ArrowLeft, Plus, CheckCircle2, XCircle, AlertCircle, WalletCards, Pencil, Trash2, CalendarDays, Clock3, Mail, CircleDollarSign } from 'lucide-react';

interface StudentDetailProps {
  student: Student;
  onBack: () => void;
  onLogSession: () => void;
  onLogPayment: () => void;
  onEditStudent: () => void;
  onDeleteStudent: () => void;
}

export const StudentDetail: React.FC<StudentDetailProps> = ({ student, onBack, onLogSession, onLogPayment, onEditStudent, onDeleteStudent }) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'payments'>('sessions');

  const billableSessions = student.sessions.filter(s => s.status === 'completed' || s.status === 'missed').length;
  const completedSessions = student.sessions.filter(s => s.status === 'completed').length;
  const totalDue = billableSessions * student.ratePerSession;
  const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, totalDue - totalPaid);
  const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>Dashboard</Button>

      <section className="tt-card rounded-[26px] overflow-hidden">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex items-start gap-4 min-w-0">
              <div className="h-14 w-14 rounded-[18px] bg-[#ece9f6] text-[#4d4982] grid place-items-center font-extrabold shrink-0">{initials}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-extrabold tracking-[-.04em] text-[#29283f]">{student.name}</h1>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[.08em] font-extrabold ${student.active ? 'bg-[#edf7f1] text-[#397d5c]' : 'bg-[#f0eef1] text-[#777481]'}`}>{student.active ? 'Active' : 'Inactive'}</span>
                </div>
                <p className="mt-1 text-sm text-[#807d8c]">{student.subject} · ৳{student.ratePerSession.toLocaleString()} per session</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#7d7a89]">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-[#69659b]" /> {student.scheduleDays.join(' · ')}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5 text-[#69659b]" /> {student.scheduleTime}</span>
                  {student.email && <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-[#69659b]" /> {student.email}</span>}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={onLogPayment} variant="secondary" icon={<WalletCards className="w-4 h-4" />}>Payment</Button>
              <Button onClick={onLogSession} icon={<Plus className="w-4 h-4" />}>Log session</Button>
              <Button onClick={onEditStudent} variant="ghost" icon={<Pencil className="w-4 h-4" />}>Edit</Button>
              <Button onClick={onDeleteStudent} variant="danger" icon={<Trash2 className="w-4 h-4" />}>Delete</Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-[#eeece6] bg-[#fbfaf7]">
          {[
            ['Completed', completedSessions.toString()],
            ['Total billed', `৳${totalDue.toLocaleString()}`],
            ['Collected', `৳${totalPaid.toLocaleString()}`],
            ['Outstanding', `৳${balance.toLocaleString()}`],
          ].map(([label, value], i) => (
            <div key={label} className={`p-4 sm:p-5 ${i % 2 === 0 ? 'border-r border-[#eeece6]' : ''} lg:border-r lg:last:border-r-0 border-b lg:border-b-0 border-[#eeece6]`}>
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#9b98a5]">{label}</p>
              <p className={`mt-1.5 text-lg font-extrabold tracking-[-.03em] ${label === 'Outstanding' && balance > 0 ? 'text-[#ad5348]' : 'text-[#343247]'}`}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="tt-card rounded-[24px] overflow-hidden">
        <div className="px-4 sm:px-6 pt-4 border-b border-[#ece9e3] flex gap-6">
          <button onClick={() => setActiveTab('sessions')} className={`pb-3.5 text-sm font-bold border-b-2 transition-colors ${activeTab === 'sessions' ? 'border-[#55518f] text-[#3f3b72]' : 'border-transparent text-[#8d8998] hover:text-[#555261]'}`}>Sessions <span className="ml-1 text-xs opacity-60">{student.sessions.length}</span></button>
          <button onClick={() => setActiveTab('payments')} className={`pb-3.5 text-sm font-bold border-b-2 transition-colors ${activeTab === 'payments' ? 'border-[#55518f] text-[#3f3b72]' : 'border-transparent text-[#8d8998] hover:text-[#555261]'}`}>Payments <span className="ml-1 text-xs opacity-60">{student.payments.length}</span></button>
        </div>

        {activeTab === 'sessions' ? (
          <div className="divide-y divide-[#efede7]">
            {student.sessions.length === 0 ? (
              <EmptyHistory icon={<CalendarDays className="w-5 h-5" />} title="No sessions yet" copy="Log the first class when you finish teaching." action="Log session" onAction={onLogSession} />
            ) : [...student.sessions].sort((a,b) => +new Date(b.date) - +new Date(a.date)).map(session => (
              <div key={session.id} className="p-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4 hover:bg-[#fbfaf7] transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${session.status === 'completed' ? 'bg-[#edf7f1] text-[#438164]' : session.status === 'missed' ? 'bg-[#fff1ee] text-[#b2584d]' : 'bg-[#f0eef1] text-[#7c7885]'}`}>
                    {session.status === 'completed' ? <CheckCircle2 className="w-4 h-4"/> : session.status === 'missed' ? <AlertCircle className="w-4 h-4"/> : <XCircle className="w-4 h-4"/>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#37354a]">{new Date(session.date).toLocaleDateString(undefined, { weekday:'short', year:'numeric', month:'short', day:'numeric' })}</p>
                    <p className="mt-0.5 text-xs text-[#8e8a98] truncate">{session.notes || `${session.status.charAt(0).toUpperCase() + session.status.slice(1)} session`}</p>
                  </div>
                </div>
                <div className="text-right shrink-0"><p className="text-sm font-bold text-[#454255]">{session.durationMinutes} min</p><p className="mt-0.5 text-[10px] uppercase tracking-[.09em] font-bold text-[#aaa7b0]">{session.status}</p></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-[#efede7]">
            {student.payments.length === 0 ? (
              <EmptyHistory icon={<CircleDollarSign className="w-5 h-5" />} title="No payments yet" copy="Record a payment when this student pays you." action="Record payment" onAction={onLogPayment} />
            ) : [...student.payments].sort((a,b) => +new Date(b.date) - +new Date(a.date)).map(payment => (
              <div key={payment.id} className="p-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4 hover:bg-[#fbfaf7] transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-[#edf7f1] text-[#438164] grid place-items-center shrink-0"><WalletCards className="w-4 h-4"/></div>
                  <div className="min-w-0"><p className="text-sm font-bold text-[#37354a]">{new Date(payment.date).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })}</p><p className="mt-0.5 text-xs text-[#8e8a98] truncate">{payment.notes || 'Payment received'}</p></div>
                </div>
                <p className="text-sm font-extrabold text-[#347a59] shrink-0">+৳{payment.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const EmptyHistory: React.FC<{icon: React.ReactNode; title:string; copy:string; action:string; onAction:()=>void}> = ({ icon, title, copy, action, onAction }) => (
  <div className="px-6 py-12 text-center">
    <div className="h-12 w-12 rounded-2xl bg-[#f1efe8] text-[#777386] grid place-items-center mx-auto">{icon}</div>
    <p className="mt-3 font-extrabold text-[#3b394e]">{title}</p>
    <p className="mt-1 text-sm text-[#918e9a]">{copy}</p>
    <Button size="sm" variant="secondary" className="mt-4" onClick={onAction}>{action}</Button>
  </div>
);
