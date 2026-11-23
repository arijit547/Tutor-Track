import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Payment } from '../types';
import { localDate } from '../services/localDate';
import { CalendarDays, WalletCards } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (paymentData: Omit<Payment, 'id'>) => boolean;
  studentName: string;
  suggestedAmount: number;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSubmit, studentName, suggestedAmount }) => {
  const [date, setDate] = useState(localDate());
  const [error, setError] = useState('');
  const [amount, setAmount] = useState(suggestedAmount > 0 ? suggestedAmount : 0);
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setAmount(suggestedAmount > 0 ? suggestedAmount : 0);
      setDate(localDate());
      setError('');
      setNotes('');
    }
  }, [isOpen, suggestedAmount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit({ date: new Date(date).toISOString(), amount, notes: notes.trim() || undefined })) {
      setError('Unable to save. Check browser storage and try again.');
      return;
    }
    onClose();
  };

  const field = 'w-full rounded-xl border border-[#dce3da] bg-[#fafbf8] px-3.5 py-2.5 text-sm outline-none';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Record payment · ${studentName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        {suggestedAmount > 0 && (
          <div className="rounded-[18px] bg-[#f4f1e9] p-4 flex items-center justify-between gap-4">
            <div><p className="text-[10px] font-bold normal-case tracking-normal text-[#9b96a0]">Current outstanding</p><p className="mt-1 text-lg font-semibold text-[#303f33]">৳{suggestedAmount.toLocaleString()}</p></div>
            <div className="h-10 w-10 rounded-xl bg-white text-[#8b672d] grid place-items-center"><WalletCards className="w-4 h-4" /></div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="block text-xs font-bold text-[#66766b] mb-2">Date received</label><div className="relative"><CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ba69a]"/><input type="date" required value={date} onChange={e => setDate(e.target.value)} className={`${field} pl-10`} /></div></div>
          <div><label className="block text-xs font-bold text-[#66766b] mb-2">Amount (BDT)</label><input type="number" required min="0.01" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} className={field} /></div>
        </div>

        <div><label className="block text-xs font-bold text-[#66766b] mb-2">Notes <span className="font-medium text-[#9ea99e]">(optional)</span></label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={`${field} resize-none`} placeholder="Payment method or period covered…" /></div>

        <div className="pt-3 border-t border-[#e9eee7] flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">Record payment</Button></div>
      </form>
    </Modal>
  );
};
