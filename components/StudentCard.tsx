import React from 'react';
import { Student } from '../types';
import { Calendar, Coins, Clock } from 'lucide-react';
import { Button } from './Button';

interface StudentCardProps {
  student: Student;
  onView: (id: string) => void;
  onLogSession: (id: string) => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({ student, onView, onLogSession }) => {
  const totalSessions = student.sessions.filter(s => s.status === 'completed').length;
  const totalDue = totalSessions * student.ratePerSession;
  const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalDue - totalPaid;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{student.name}</h3>
          <p className="text-sm text-slate-500">{student.subject}</p>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-semibold ${student.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
          {student.active ? 'Active' : 'Inactive'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex items-center text-sm text-slate-600">
          <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
          <span>{student.scheduleDays.join(', ')}</span>
        </div>
        <div className="flex items-center text-sm text-slate-600">
          <Coins className="w-4 h-4 mr-2 text-green-500" />
          <span className={balance > 0 ? "text-red-600 font-medium" : "text-slate-600"}>
            BDT {balance} Due
          </span>
        </div>
        <div className="flex items-center text-sm text-slate-600">
          <Clock className="w-4 h-4 mr-2 text-blue-500" />
          <span>{totalSessions} Sessions</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => onView(student.id)}>
          View Details
        </Button>
        <Button variant="primary" size="sm" className="flex-1" onClick={() => onLogSession(student.id)}>
          Log Session
        </Button>
      </div>
    </div>
  );
};
