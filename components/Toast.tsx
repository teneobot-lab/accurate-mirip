
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Bell } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => {
        const next = [...prev, { id, message, type }];
        return next.length > 4 ? next.slice(next.length - 4) : next;
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <CheckCircle size={20} className="text-emerald-500" />;
      case 'error': return <AlertCircle size={20} className="text-red-500" />;
      case 'warning': return <AlertTriangle size={20} className="text-amber-500" />;
      case 'info': return <Bell size={20} className="text-blue-500" />;
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success': return 'border-emerald-100 bg-emerald-50/90 text-emerald-900';
      case 'error': return 'border-red-100 bg-red-50/90 text-red-900';
      case 'warning': return 'border-amber-100 bg-amber-50/90 text-amber-900';
      case 'info': return 'border-blue-100 bg-blue-50/90 text-blue-900';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-8 right-8 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-4 min-w-[320px] max-w-md px-6 py-4 rounded-[20px] shadow-2xl backdrop-blur-xl border border-white transform transition-all duration-500 animate-in slide-in-from-right fade-in ${getStyles(toast.type)}`}
          >
            <div className="flex-shrink-0 p-2 bg-white/50 rounded-xl shadow-sm">{getIcon(toast.type)}</div>
            <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-0.5">{toast.type}</p>
                <p className="text-[13px] font-bold leading-snug">{toast.message}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-white rounded-lg">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
