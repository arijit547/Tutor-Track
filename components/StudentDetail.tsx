import React, { useState } from 'react';
import { Student, Session, Payment } from '../types';
import { Button } from './Button';
import { ArrowLeft, Plus, CheckCircle, XCircle, AlertCircle, Coins, Edit2, Trash2 } from 'lucide-react';

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

  const totalSessions = student.sessions.filter(s => s.status === 'completed' || s.status === 'missed').length;
  const totalDue = totalSessions * student.ratePerSession;
  const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalDue - totalPaid;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-2">
        <Button variant="ghost" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{student.name}</h1>
            <p className="text-slate-500">{student.subject} • BDT {student.ratePerSession}/session</p>
            <div className="flex gap-2 mt-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                {student.scheduleDays.join(', ')}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${balance > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                {balance > 0 ? `BDT ${balance} Owed` : 'Fully Paid'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onLogPayment} variant="secondary" icon={<Coins className="w-4 h-4" />}>
              Record Payment
            </Button>
            <Button onClick={onLogSession} icon={<Plus className="w-4 h-4" />}>
              Log Session
            </Button>
            <Button onClick={onEditStudent} variant="outline" icon={<Edit2 className="w-4 h-4" />}>
              Edit
            </Button>
            <Button onClick={onDeleteStudent} variant="danger" icon={<Trash2 className="w-4 h-4" />}>
              Delete
            </Button>
          </div>
        </div>

      </div>

      {/* History Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'sessions' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Session History
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'payments' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Payment History
          </button>
        </div>

        <div className="p-0">
          {activeTab === 'sessions' ? (
            <div className="divide-y divide-slate-100">
              {student.sessions.length === 0 && (
                <div className="p-8 text-center text-slate-500">No sessions logged yet.</div>
              )}
              {/* Sort sessions by date descending */}
              {[...student.sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(session => (
                <div key={session.id} className="p-4 hover:bg-slate-50 flex justify-between items-center">
                  <div className="flex items-start gap-3">
                    {session.status === 'completed' ? <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" /> :
                      session.status === 'missed' ? <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" /> :
                        <XCircle className="w-5 h-5 text-slate-400 mt-0.5" />}
                    <div>
                      <p className="font-medium text-slate-900">
                        {new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                      {session.notes && <p className="text-sm text-slate-500">{session.notes}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">{session.durationMinutes} min</p>
                    <p className="text-xs text-slate-500 capitalize">{session.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {student.payments.length === 0 && (
                <div className="p-8 text-center text-slate-500">No payments recorded yet.</div>
              )}
              {/* Sort payments by date descending */}
              {[...student.payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(payment => (
                <div key={payment.id} className="p-4 hover:bg-slate-50 flex justify-between items-center">
                  <div className="flex items-start gap-3">
                    <div className="bg-green-100 p-1 rounded-full">
                      <Coins className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {new Date(payment.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                      {payment.notes && <p className="text-sm text-slate-500">{payment.notes}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">+BDT {payment.amount.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};