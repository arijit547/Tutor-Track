import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Payment } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (paymentData: Omit<Payment, 'id'>) => void;
  studentName: string;
  suggestedAmount: number;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSubmit, studentName, suggestedAmount }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(suggestedAmount > 0 ? suggestedAmount : 0);
  const [notes, setNotes] = useState('');

  // Reset form when modal reopens with new suggested amount
  React.useEffect(() => {
    if (isOpen) {
      setAmount(suggestedAmount > 0 ? suggestedAmount : 0);
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [isOpen, suggestedAmount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      date: new Date(date).toISOString(),
      amount,
      notes
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Record Payment: ${studentName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date Received</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount (BDT)</label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          {suggestedAmount > 0 && (
            <p className="text-xs text-slate-500 mt-1">Outstanding Balance: BDT {suggestedAmount}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder="Payment method, period covered, etc."
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="mr-2">Cancel</Button>
          <Button type="submit">Record Payment</Button>
        </div>
      </form>
    </Modal>
  );
};