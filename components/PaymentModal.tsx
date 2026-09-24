import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Payment } from '../types';
import { CalendarDays, WalletCards } from 'lucide-react';

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

  React.useEffect(() => {
    if (isOpen) {
      setAmount(suggestedAmount > 0 ? suggestedAmount : 0);
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [isOpen, suggestedAmount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ date: new Date(date).toISOString(), amount, notes: notes.trim() || undefined });
    onClose();
  };

  const field = 'w-full rounded-xl border border-[#dcd8d0] bg-[#fbfaf7] px-3.5 py-2.5 text-sm outline-none';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Record payment · ${studentName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {suggestedAmount > 0 && (
          <div className="rounded-[18px] bg-[#f4f1e9] p-4 flex items-center justify-between gap-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#9b96a0]">Current outstanding</p><p className="mt-1 text-lg font-extrabold text-[#343247]">৳{suggestedAmount.toLocaleString()}</p></div>
            <div className="h-10 w-10 rounded-xl bg-white text-[#8b672d] grid place-items-center"><WalletCards className="w-4 h-4" /></div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="block text-xs font-bold text-[#666374] mb-2">Date received</label><div className="relative"><CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aaa6b2]"/><input type="date" required value={date} onChange={e => setDate(e.target.value)} className={`${field} pl-10`} /></div></div>
          <div><label className="block text-xs font-bold text-[#666374] mb-2">Amount (BDT)</label><input type="number" required min="0.01" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} className={field} /></div>
        </div>

        <div><label className="block text-xs font-bold text-[#666374] mb-2">Notes <span className="font-medium text-[#a5a1ab]">(optional)</span></label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={`${field} resize-none`} placeholder="Payment method or period covered…" /></div>

        <div className="pt-3 border-t border-[#eeece6] flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">Record payment</Button></div>
      </form>
    </Modal>
  );
};
