import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#293c30]/45 backdrop-blur-sm p-0 sm:p-4" onMouseDown={(e) => e.currentTarget === e.target && onClose()}>
      <div
        ref={modalRef}
        className="bg-[#fdfefb] w-full sm:max-w-lg max-h-[92vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/80 shadow-[0_16px_50px_rgba(19,39,26,.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-[18px] border-b border-[#ebe8e1] bg-white/80">
          <div>
            <p className="text-[10px] normal-case tracking-normal font-bold text-[#7a8f7c]">TutorTrack</p>
            <h2 id="modal-title" className="mt-1 text-lg font-bold tracking-[-.02em] text-[#293e30]">{title}</h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-xl text-[#7a8f7c] hover:bg-[#eef3eb] hover:text-[#293c30] transition-colors" aria-label="Close modal">
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[calc(92vh-76px)] tt-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};
