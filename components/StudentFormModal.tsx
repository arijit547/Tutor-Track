import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Student, DayOfWeek } from '../types';

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
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && student) {
      setName(student.name);
      setSubject(student.subject);
      setRatePerSession(student.ratePerSession.toString());
      setScheduleTime(student.scheduleTime);
      setScheduleDays(student.scheduleDays);
      setEmail(student.email || '');
      setActive(student.active);
      setErrors({});
    } else if (isOpen) {
      setName('');
      setSubject('');
      setRatePerSession('');
      setScheduleTime('10:00');
      setScheduleDays(['Mon']);
      setEmail('');
      setActive(true);
      setErrors({});
    }
  }, [isOpen, student]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Student name is required';
    if (!subject.trim()) newErrors.subject = 'Subject is required';
    if (!ratePerSession || Number(ratePerSession) <= 0) newErrors.ratePerSession = 'Rate must be greater than 0';
    if (scheduleDays.length === 0) newErrors.scheduleDays = 'Select at least one day';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    onSubmit({
      name: name.trim(),
      subject: subject.trim(),
      ratePerSession: Number(ratePerSession),
      scheduleTime,
      scheduleDays,
      email: email.trim() || undefined,
      active
    });

    onClose();
  };

  const toggleDay = (day: DayOfWeek) => {
    setScheduleDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const title = student ? `Edit Student: ${student.name}` : 'Add New Student';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Student Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-lg border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${errors.name ? 'border-red-500' : 'border-slate-300'}`}
            placeholder="John Doe"
          />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={`w-full rounded-lg border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${errors.subject ? 'border-red-500' : 'border-slate-300'}`}
            placeholder="Mathematics"
          />
          {errors.subject && <p className="text-xs text-red-600 mt-1">{errors.subject}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Rate per Session (BDT)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={ratePerSession}
            onChange={(e) => setRatePerSession(e.target.value)}
            className={`w-full rounded-lg border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${errors.ratePerSession ? 'border-red-500' : 'border-slate-300'}`}
            placeholder="50"
          />
          {errors.ratePerSession && <p className="text-xs text-red-600 mt-1">{errors.ratePerSession}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Time</label>
          <input
            type="time"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Schedule Days</label>
          <div className="grid grid-cols-4 gap-2">
            {DAYS.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${scheduleDays.includes(day)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {day}
              </button>
            ))}
          </div>
          {errors.scheduleDays && <p className="text-xs text-red-600 mt-1">{errors.scheduleDays}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email (Optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder="student@example.com"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-slate-300"
          />
          <label htmlFor="active" className="text-sm font-medium text-slate-700">
            Active Student
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {student ? 'Update Student' : 'Add Student'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
