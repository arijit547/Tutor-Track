import React from 'react';
import { Student, DayOfWeek } from '../types';
import { StatsCard } from './StatsCard';
import { StudentCard } from './StudentCard';
import { Plus, ArrowUpRight, Clock3, CalendarDays } from 'lucide-react';
import { Button } from './Button';
import { getStudentBilling, monthlyRateLabel } from '../services/studentBilling';

interface DashboardProps {
  students: Student[];
  tutorName?: string;
  onViewStudent: (id: string) => void;
  onLogSession: (id: string) => void;
  onAddStudent: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ students, onViewStudent, onLogSession, onAddStudent }) => {
  const activeStudents = students.filter(s => s.active).length;
  const totalSessions = students.reduce((acc, s) => acc + s.sessions.filter(sess => sess.status === 'completed').length, 0);
  const totalEarnings = students.reduce((acc, s) => acc + getStudentBilling(s).earned, 0);
  const totalCollected = students.reduce((acc, s) => acc + s.payments.reduce((sum, p) => sum + p.amount, 0), 0);
  const outstanding = Math.max(0, totalEarnings - totalCollected);

  const dayNames: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = dayNames[new Date().getDay()];
  const todaysClasses = students
    .filter(s => s.active && s.scheduleDays.includes(today))
    .sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime));

  const now = new Date();
  const nextClass = todaysClasses.find(s => {
    const [hours, minutes] = s.scheduleTime.split(':').map(Number);
    const classTime = new Date();
    classTime.setHours(hours, minutes, 0, 0);
    return classTime > now;
  });

  const weeklyCounts = dayNames.map(day => students.filter(s => s.active && s.scheduleDays.includes(day)).length);
  const maxWeekCount = Math.max(1, ...weeklyCounts);
  const weeklyTotal = weeklyCounts.reduce((count, dayCount) => count + dayCount, 0);
  const dateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(now);

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="tt-card tt-overview overflow-hidden rounded-2xl grid lg:grid-cols-[1.25fr_.75fr]">
        <div className="px-6 py-7 sm:px-8 sm:py-9 flex flex-col items-start justify-between gap-7">
          <div>
            <p className="tt-kicker flex items-center gap-2"><span className="tt-dot" /> {dateLabel}</p>
            <h1 className="tt-display mt-4 text-[2.3rem] sm:text-[3rem] leading-[1.1] tracking-[-.035em] text-[#25362e]">Your teaching, at a glance</h1>
            <p className="mt-3 max-w-[460px] text-sm sm:text-[15px] leading-6 text-[#65746b]">Students, class schedules, and payments in one place, ready for the next lesson.</p>
          </div>
          <Button onClick={onAddStudent} icon={<Plus className="h-4 w-4" />}>Add student</Button>
        </div>

        <div className="tt-weekly-panel border-t lg:border-t-0 lg:border-l border-[#e5e9e2] px-6 py-6 sm:px-7 sm:py-8 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="tt-kicker">Weekly schedule</p>
              <p className="mt-1 text-[26px] font-medium tracking-[-.035em] tabular-nums text-[#28372f]">{weeklyTotal} <span className="text-sm font-normal tracking-normal text-[#77857b]">classes planned</span></p>
            </div>
            <CalendarDays className="h-[18px] w-[18px] text-[#73877c]" strokeWidth={1.6} />
          </div>
          <div className="mt-6 flex gap-2 items-end justify-between" aria-label="Classes scheduled by day of week">
            {dayNames.map((day, index) => (
              <div key={day} className="flex flex-1 min-w-0 flex-col items-center gap-2">
                <span className="text-[11px] tabular-nums text-[#65796c]">{weeklyCounts[index]}</span>
                <div className="w-full max-w-9 h-[68px] rounded-md bg-[#e5eae3] flex items-end overflow-hidden">
                  <div
                    className={`w-full rounded-[5px] ${today === day ? 'bg-[#295b49]' : 'bg-[#abbdb0]'}`}
                    style={{ height: `${Math.max(weeklyCounts[index] ? 12 : 3, (weeklyCounts[index] / maxWeekCount) * 100)}%` }}
                  />
                </div>
                <span className={`text-[11px] ${today === day ? 'font-semibold text-[#255a46]' : 'text-[#667869]'}`}>{day}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-[#65796c]">Based on active students’ recurring schedules</p>
        </div>
      </section>

      <section aria-label="Tuition overview" className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard title="Total earned" value={`৳${totalEarnings.toLocaleString()}`} meta="From recorded sessions" />
        <StatsCard title="Outstanding" value={`৳${outstanding.toLocaleString()}`} meta={outstanding ? 'To be collected' : 'All settled'} emphasis={outstanding > 0} />
        <StatsCard title="Sessions completed" value={totalSessions} meta="All time" />
        <StatsCard title="Active students" value={activeStudents} meta={`${students.length} students on record`} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.45fr_.8fr] gap-4">
        <div className="tt-card rounded-2xl overflow-hidden">
          <div className="px-5 sm:px-6 py-5 flex items-center justify-between gap-4 border-b border-[#e9ebe6]">
            <div>
              <p className="tt-kicker">Today · {today}</p>
              <h2 className="tt-section-title mt-1">Class schedule</h2>
            </div>
            <span className="tt-count">{todaysClasses.length} {todaysClasses.length === 1 ? 'class' : 'classes'}</span>
          </div>

          {todaysClasses.length > 0 ? (
            <div className="divide-y divide-[#edf0ea]">
              {todaysClasses.map(student => (
                <div key={student.id} className="flex items-center gap-4 px-5 sm:px-6 py-4 hover:bg-[#fafbf8] transition-colors duration-150">
                  <div className="w-[64px] shrink-0">
                    <p className="text-[13px] font-semibold tabular-nums text-[#273e31]">{student.scheduleTime}</p>
                  </div>
                  <div className="w-px h-10 bg-[#dae2d9] relative"><span className="absolute h-[5px] w-[5px] -left-[2px] top-[17px] rounded-full bg-[#71917d]" /></div>
                  <button onClick={() => onViewStudent(student.id)} className="text-left min-w-0 flex-1 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#295b49] rounded">
                    <p className="text-sm font-medium text-[#25362e] truncate group-hover:text-[#265c47]">{student.name}</p>
                    <p className="mt-1 text-xs text-[#65796c] truncate">{student.subject} · {monthlyRateLabel(student)}</p>
                  </button>
                  <Button size="sm" variant="secondary" onClick={() => onLogSession(student.id)}>Log session</Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 flex items-start gap-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-[#f0f3ed] text-[#5d7965] grid place-items-center"><CalendarDays size={18} strokeWidth={1.6} /></div>
              <div><p className="font-medium text-[#334338]">No classes scheduled today</p><p className="mt-1 text-sm text-[#65796c]">Your next lesson will appear here when it’s scheduled</p></div>
            </div>
          )}
        </div>

        <div className="tt-card rounded-2xl p-5 sm:p-6 flex flex-col min-h-60">
          <p className="tt-kicker">Up next</p>
          <h2 className="tt-section-title mt-1">Next lesson</h2>
          {nextClass ? (
            <div className="mt-6 flex-1 flex flex-col justify-between">
              <div className="border-l-2 border-[#386d55] pl-4 py-1">
                <div className="inline-flex items-center gap-2 text-xs font-medium text-[#3b7159]"><Clock3 className="w-4 h-4" /> {nextClass.scheduleTime}</div>
                <p className="mt-2 text-lg font-medium text-[#283b2d]">{nextClass.name}</p>
                <p className="mt-1 text-sm text-[#65796c]">{nextClass.subject}</p>
              </div>
              <button onClick={() => onViewStudent(nextClass.id)} className="mt-6 inline-flex items-center justify-between gap-3 text-sm font-medium text-[#2a5c47] hover:text-[#143c2d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#295b49]">
                View student record <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex-1 flex flex-col justify-center border-t border-[#edf0ea] pt-4">
              <p className="font-medium text-[#35483a]">No more classes today</p>
              <p className="mt-2 text-sm leading-6 text-[#65796c]">Your remaining time is clear. Check the week ahead when you're ready.</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="tt-kicker">Student records</p>
            <h2 className="tt-section-title mt-1">Your students</h2>
            <p className="mt-1 text-sm text-[#69796d]">{students.length} total · {activeStudents} active</p>
          </div>
          <Button variant="secondary" onClick={onAddStudent} icon={<Plus className="w-4 h-4" />}>Add student</Button>
        </div>

        {students.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {students.map(student => <StudentCard key={student.id} student={student} onView={onViewStudent} onLogSession={onLogSession} />)}
          </div>
        ) : (
          <div className="tt-card rounded-2xl px-6 py-12 sm:px-9 sm:py-14 flex flex-col items-start">
            <div className="h-11 w-11 rounded-xl bg-[#edf1e9] text-[#53735a] grid place-items-center"><Plus size={20} strokeWidth={1.6} /></div>
            <h3 className="tt-display mt-4 text-[27px] text-[#294234]">Start your student record</h3>
            <p className="mt-2 text-sm text-[#65796c] max-w-md">Add a student to keep their lessons, tuition schedule and payments together.</p>
            <Button className="mt-6" onClick={onAddStudent} icon={<Plus className="w-4 h-4" />}>Add your first student</Button>
          </div>
        )}
      </section>
    </div>
  );
};
