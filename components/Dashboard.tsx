import React from 'react';
import { Student, DayOfWeek } from '../types';
import { StatsCard } from './StatsCard';
import { StudentCard } from './StudentCard';
import { Users, WalletCards, CalendarCheck2, ReceiptText, Plus, ArrowRight, Clock3, Sparkles, BookOpenCheck } from 'lucide-react';
import { Button } from './Button';

interface DashboardProps {
  students: Student[];
  tutorName?: string;
  onViewStudent: (id: string) => void;
  onLogSession: (id: string) => void;
  onAddStudent: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ students, tutorName, onViewStudent, onLogSession, onAddStudent }) => {
  const activeStudents = students.filter(s => s.active).length;
  const totalSessions = students.reduce((acc, s) => acc + s.sessions.filter(sess => sess.status === 'completed').length, 0);
  const totalEarnings = students.reduce((acc, s) => acc + s.sessions.filter(sess => sess.status === 'completed' || sess.status === 'missed').length * s.ratePerSession, 0);
  const totalCollected = students.reduce((acc, s) => acc + s.payments.reduce((pAcc, p) => pAcc + p.amount, 0), 0);
  const outstanding = Math.max(0, totalEarnings - totalCollected);

  const dayNames: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = dayNames[new Date().getDay()];
  const todaysClasses = students
    .filter(s => s.active && s.scheduleDays.includes(today))
    .sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime));

  const nextClass = todaysClasses.find(s => {
    const [h, m] = s.scheduleTime.split(':').map(Number);
    const now = new Date();
    const classTime = new Date();
    classTime.setHours(h, m, 0, 0);
    return classTime > now;
  }) || todaysClasses[0];

  const firstName = tutorName?.trim().split(' ')[0] || 'Tutor';
  const dateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date());

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[28px] bg-[#29285d] text-white px-5 py-6 sm:px-8 sm:py-7 shadow-[0_18px_48px_rgba(41,40,93,.18)]">
        <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full border-[34px] border-white/[.035]" />
        <div className="absolute right-10 bottom-[-70px] h-44 w-44 rounded-full bg-[#f4bd68]/10 blur-2xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[#f4cc85] text-xs font-bold uppercase tracking-[.16em]"><Sparkles className="w-3.5 h-3.5" /> {dateLabel}</div>
            <h1 className="mt-3 text-2xl sm:text-[2rem] font-extrabold tracking-[-.045em] leading-tight">Good to see you, {firstName}.</h1>
            <p className="mt-2 text-sm sm:text-[15px] text-white/68 leading-relaxed">Your students, sessions and payments are all in one calm workspace. Keep today moving without losing track.</p>
          </div>
          <Button onClick={onAddStudent} icon={<Plus className="w-4 h-4" />} className="!bg-[#f4bd68] !text-[#29285d] hover:!bg-[#f7c97f] shadow-none self-start lg:self-auto">
            Add student
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard title="Estimated income" value={`৳${totalEarnings.toLocaleString()}`} icon={<WalletCards className="w-5 h-5" />} trend="Lifetime" trendUp />
        <StatsCard title="Outstanding" value={`৳${outstanding.toLocaleString()}`} icon={<ReceiptText className="w-5 h-5" />} trend={outstanding > 0 ? 'Needs attention' : 'All settled'} trendUp={outstanding === 0} />
        <StatsCard title="Sessions done" value={totalSessions} icon={<CalendarCheck2 className="w-5 h-5" />} />
        <StatsCard title="Active students" value={activeStudents} icon={<Users className="w-5 h-5" />} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.35fr_.65fr] gap-4">
        <div className="tt-card rounded-[24px] overflow-hidden">
          <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center justify-between gap-4 border-b border-[#efede7]">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-[#9a97a6]"><BookOpenCheck className="w-3.5 h-3.5" /> Today · {today}</div>
              <h2 className="mt-1.5 text-lg font-extrabold tracking-[-.025em] text-[#2b2a42]">Today’s schedule</h2>
            </div>
            <span className="rounded-full bg-[#f2eff8] px-3 py-1.5 text-xs font-bold text-[#5a568e]">{todaysClasses.length} class{todaysClasses.length === 1 ? '' : 'es'}</span>
          </div>

          {todaysClasses.length > 0 ? (
            <div className="divide-y divide-[#efede7]">
              {todaysClasses.map((student, index) => (
                <div key={student.id} className="px-5 sm:px-6 py-4 flex items-center gap-4 hover:bg-[#faf9f6] transition-colors">
                  <div className="w-[58px] shrink-0">
                    <p className="text-sm font-extrabold text-[#32304f]">{student.scheduleTime}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#aaa7b2]">{index === 0 ? 'First' : 'Class'}</p>
                  </div>
                  <div className="h-10 w-[3px] rounded-full bg-[#ddd9e8]" />
                  <button onClick={() => onViewStudent(student.id)} className="min-w-0 flex-1 text-left group">
                    <p className="font-bold text-[#333148] truncate group-hover:text-[#56518f] transition-colors">{student.name}</p>
                    <p className="mt-0.5 text-xs text-[#8c8998] truncate">{student.subject} · ৳{student.ratePerSession.toLocaleString()}/session</p>
                  </button>
                  <Button size="sm" variant="secondary" onClick={() => onLogSession(student.id)}>Log</Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-10 text-center">
              <div className="h-12 w-12 rounded-2xl bg-[#f3f0e9] text-[#7e7a88] grid place-items-center mx-auto"><CalendarCheck2 className="w-5 h-5" /></div>
              <p className="mt-3 font-bold text-[#3b394f]">No classes today</p>
              <p className="mt-1 text-sm text-[#8d8998]">A clear day to prepare, review, or take a break.</p>
            </div>
          )}
        </div>

        <div className="tt-card rounded-[24px] p-5 sm:p-6 flex flex-col">
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#9a97a6]">Quick focus</p>
          <h2 className="mt-1.5 text-lg font-extrabold tracking-[-.025em] text-[#2b2a42]">Next up</h2>
          {nextClass ? (
            <div className="mt-5 flex-1 flex flex-col justify-between">
              <div className="rounded-[20px] bg-[#f5f2e9] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-10 w-10 rounded-[13px] bg-white grid place-items-center text-[#55518f] shadow-sm"><Clock3 className="w-[18px] h-[18px]" /></div>
                  <span className="text-xs font-bold text-[#5a568e] bg-white rounded-full px-2.5 py-1">{nextClass.scheduleTime}</span>
                </div>
                <p className="mt-4 font-extrabold text-[#343247]">{nextClass.name}</p>
                <p className="mt-1 text-sm text-[#817e8d]">{nextClass.subject}</p>
              </div>
              <button onClick={() => onViewStudent(nextClass.id)} className="mt-4 inline-flex items-center justify-between rounded-xl text-sm font-bold text-[#4e4a82] hover:text-[#2f2d65] group">
                Open student profile <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex-1 rounded-[20px] bg-[#f7f5ef] grid place-items-center min-h-36 text-center p-4">
              <div><p className="font-bold text-[#444153]">You’re clear for today</p><p className="mt-1 text-xs text-[#9692a0]">No upcoming class in the schedule.</p></div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#9996a4]">Student directory</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#29283f]">Your students</h2>
            <p className="mt-1 text-sm text-[#888593]">{students.length} total · {activeStudents} currently active</p>
          </div>
          <Button variant="secondary" onClick={onAddStudent} icon={<Plus className="w-4 h-4" />}>Add student</Button>
        </div>

        {students.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {students.map(student => <StudentCard key={student.id} student={student} onView={onViewStudent} onLogSession={onLogSession} />)}
          </div>
        ) : (
          <div className="tt-card rounded-[24px] px-6 py-14 text-center">
            <div className="h-14 w-14 rounded-2xl bg-[#efedf6] text-[#57538f] grid place-items-center mx-auto"><Users className="w-6 h-6" /></div>
            <h3 className="mt-4 text-lg font-extrabold text-[#302f47]">Your student list is empty</h3>
            <p className="mt-2 text-sm text-[#8a8796] max-w-md mx-auto">Add your first student to start tracking tuition schedules, sessions and payments.</p>
            <Button className="mt-5" onClick={onAddStudent} icon={<Plus className="w-4 h-4" />}>Add first student</Button>
          </div>
        )}
      </section>
    </div>
  );
};
