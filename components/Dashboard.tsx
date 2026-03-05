import React from 'react';
import { Student, DayOfWeek } from '../types';
import { StatsCard } from './StatsCard';
import { StudentCard } from './StudentCard';
import { Users, Coins, Calendar, Clock, Bell, Plus } from 'lucide-react';
import { Button } from './Button';

interface DashboardProps {
  students: Student[];
  onViewStudent: (id: string) => void;
  onLogSession: (id: string) => void;
  onAddStudent: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ students, onViewStudent, onLogSession, onAddStudent }) => {
  // Calculate Stats
  const activeStudents = students.filter(s => s.active).length;

  const totalSessions = students.reduce((acc, s) =>
    acc + s.sessions.filter(sess => sess.status === 'completed').length, 0
  );

  const totalEarnings = students.reduce((acc, s) => {
    const sessionValue = s.sessions
      .filter(sess => sess.status === 'completed' || sess.status === 'missed')
      .length * s.ratePerSession;
    return acc + sessionValue;
  }, 0);

  const totalCollected = students.reduce((acc, s) =>
    acc + s.payments.reduce((pAcc, p) => pAcc + p.amount, 0), 0
  );

  const outstanding = totalEarnings - totalCollected;

  // Calculate Today's Schedule
  const dayNames: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = dayNames[new Date().getDay()];

  const todaysClasses = students
    .filter(s => s.active && s.scheduleDays.includes(today))
    .sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime));

  return (
    <div className="space-y-8">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Income (Est.)"
          value={`BDT ${totalEarnings.toLocaleString()}`}
          icon={<Coins className="w-6 h-6" />}
          trend="Lifetime"
          trendUp={true}
        />
        <StatsCard
          title="Outstanding Fees"
          value={`BDT ${outstanding.toLocaleString()}`}
          icon={<Clock className="w-6 h-6" />}
          trend={outstanding > 0 ? "Action needed" : "All clear"}
          trendUp={outstanding === 0}
        />
        <StatsCard
          title="Total Sessions"
          value={totalSessions}
          icon={<Calendar className="w-6 h-6" />}
        />
        <StatsCard
          title="Active Students"
          value={activeStudents}
          icon={<Users className="w-6 h-6" />}
        />
      </div>

      {/* Today's Schedule Panel */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-6 h-6 animate-pulse" />
          <h2 className="text-xl font-bold">Today's Schedule ({today})</h2>
        </div>

        {todaysClasses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todaysClasses.map(student => (
              <div key={student.id} className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-lg flex justify-between items-center hover:bg-white/20 transition-colors cursor-pointer" onClick={() => onViewStudent(student.id)}>
                <div>
                  <p className="font-bold text-lg">{student.scheduleTime}</p>
                  <p className="font-medium">{student.name}</p>
                  <p className="text-xs text-indigo-100">{student.subject}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onLogSession(student.id); }}
                  className="bg-white text-indigo-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-indigo-50"
                >
                  Log Now
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-indigo-100 italic">No tuitions scheduled for today. Enjoy your free time!</p>
        )}
      </div>

      {/* Students Grid */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">Your Students</h2>
          <Button onClick={onAddStudent} icon={<Plus className="w-4 h-4" />}>
            Add Student
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map(student => (
            <StudentCard
              key={student.id}
              student={student}
              onView={onViewStudent}
              onLogSession={onLogSession}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
