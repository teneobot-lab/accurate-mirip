import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    hardDeleteText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    onHardDelete?: () => void;
    isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Hapus',
    cancelText = 'Batal',
    hardDeleteText,
    onConfirm,
    onCancel,
    onHardDelete,
    isDestructive = true
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden animate-in zoom-in-95">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        {isDestructive && <AlertTriangle size={18} className="text-rose-500" />}
                        <h3 className="font-bold text-sm text-slate-800">{title}</h3>
                    </div>
                    <button onClick={onCancel} className="text-slate-400 hover:text-rose-500 rounded-full p-1 hover:bg-rose-50 transition-colors">
                        <X size={18} />
                    </button>
                </div>
                
                <div className="p-6">
                    <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
                </div>
                
                <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 flex-wrap">
                    <button 
                        onClick={onCancel} 
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        {cancelText}
                    </button>
                    {onHardDelete && hardDeleteText && (
                        <button 
                            onClick={onHardDelete} 
                            className="px-4 py-2 text-white bg-orange-600 hover:bg-orange-700 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
                        >
                            {hardDeleteText}
                        </button>
                    )}
                    <button 
                        onClick={() => {
                            onConfirm();
                        }} 
                        className={`px-6 py-2 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 ${
                            isDestructive 
                                ? 'bg-rose-600 hover:bg-rose-700' 
                                : 'bg-brand hover:bg-brand/90'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
