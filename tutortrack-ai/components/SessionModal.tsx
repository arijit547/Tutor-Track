import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Session } from '../types';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      date: new Date(date).toISOString(),
      durationMinutes: duration,
      status,
      notes
    });
    onClose();
    // Reset defaults for next time
    setNotes('');
    setStatus('completed');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Log Session: ${studentName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
          <input 
            type="date" 
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Duration (min)</label>
            <input 
              type="number" 
              required
              min="15"
              step="15"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value as Session['status'])}
              className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="completed">Completed</option>
              <option value="missed">Missed (Chargeable)</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
          <textarea 
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder="Topic covered, homework assigned, etc."
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="mr-2">Cancel</Button>
          <Button type="submit">Save Session</Button>
        </div>
      </form>
    </Modal>
  );
};