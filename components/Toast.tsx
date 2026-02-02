
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

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
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    // Anti-spam: Limit to 3 visible toasts, remove oldest
    setToasts((prev) => {
        const newToasts = [...prev, { id, message, type }];
        if (newToasts.length > 3) return newToasts.slice(newToasts.length - 3);
        return newToasts;
    });

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <CheckCircle size={18} className="text-emerald-500" />;
      case 'error': return <AlertCircle size={18} className="text-red-500" />;
      case 'warning': return <AlertTriangle size={18} className="text-amber-500" />;
      case 'info': return <Info size={18} className="text-blue-500" />;
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success': return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
      case 'error': return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'warning': return 'border-amber-500 bg-amber-50 dark:bg-amber-900/20';
      case 'info': return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 min-w-[300px] max-w-sm p-4 rounded-lg shadow-lg border-l-4 transform transition-all duration-300 animate-in slide-in-from-right fade-in ${getStyles(toast.type)} bg-white dark:bg-slate-900`}
          >
            <div className="flex-shrink-0">{getIcon(toast.type)}</div>
            <p className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
