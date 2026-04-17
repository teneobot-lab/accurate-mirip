import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  hardDeleteText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  onHardDelete?: () => void | Promise<void>;
  isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText    = 'Hapus',
  cancelText     = 'Batal',
  hardDeleteText,
  onConfirm,
  onCancel,
  onHardDelete,
  isDestructive  = true,
}) => {
  const [isConfirming, setIsConfirming]     = useState(false);
  const [isHardDeleting, setIsHardDeleting] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-focus confirm button saat dialog buka
  useEffect(() => {
    if (isOpen) {
      // Slight delay agar animasi tidak konflik dengan focus
      const t = setTimeout(() => confirmBtnRef.current?.focus(), 80);
      return () => clearTimeout(t);
    } else {
      // Reset loading state saat ditutup
      setIsConfirming(false);
      setIsHardDeleting(false);
    }
  }, [isOpen]);

  // Keyboard handler: Escape = cancel, Enter = confirm
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      // Enter hanya jika tidak sedang loading
      if (e.key === 'Enter' && !isConfirming && !isHardDeleting) {
        e.preventDefault();
        handleConfirm();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, isConfirming, isHardDeleting]);

  const handleConfirm = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const handleHardDelete = async () => {
    if (!onHardDelete || isHardDeleting) return;
    setIsHardDeleting(true);
    try {
      await onHardDelete();
    } finally {
      setIsHardDeleting(false);
    }
  };

  if (!isOpen) return null;

  const isLoading = isConfirming || isHardDeleting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4"
      // Klik backdrop = cancel (hanya jika tidak sedang loading)
      onMouseDown={e => { if (e.target === e.currentTarget && !isLoading) onCancel(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            {isDestructive && (
              <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={15} className="text-rose-600" />
              </div>
            )}
            <h3
              id="confirm-dialog-title"
              className="font-bold text-[13px] text-slate-800"
            >
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Tutup dialog"
            className="text-slate-400 hover:text-rose-500 rounded-lg p-1 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p
            id="confirm-dialog-message"
            className="text-[13px] text-slate-600 leading-relaxed"
          >
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-2 flex-wrap">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-1.5 text-[12px] font-semibold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>

          {onHardDelete && hardDeleteText && (
            <button
              onClick={handleHardDelete}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 text-white bg-orange-600 hover:bg-orange-700 rounded-lg text-[12px] font-bold shadow-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isHardDeleting && <Loader2 size={12} className="animate-spin" />}
              {hardDeleteText}
            </button>
          )}

          <button
            ref={confirmBtnRef}
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-5 py-1.5 text-white rounded-lg text-[12px] font-bold shadow-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-brand hover:bg-brand/90'
            }`}
          >
            {isConfirming && <Loader2 size={12} className="animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
