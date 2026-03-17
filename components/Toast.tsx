import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  createdAt: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

const ToastItem: React.FC<{
  toast: Toast;
  onRemove: (id: string) => void;
}> = ({ toast, onRemove }) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progress, setProgress] = useState(100);
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 280);
  }, [onRemove, toast.id]);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => setProgress(0));
    timerRef.current = setTimeout(dismiss, toast.duration);
    return () => {
      cancelAnimationFrame(rafId);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, toast.duration]);

  const CONFIG: Record<ToastType, {
    icon: React.ReactNode;
    bar: string;
    border: string;
    bg: string;
    label: string;
  }> = {
    success: {
      icon: <CheckCircle size={16} className="shrink-0" />,
      bar: 'bg-emerald-500',
      border: 'border-emerald-500',
      bg: 'bg-emerald-50 text-emerald-800',
      label: 'Berhasil',
    },
    error: {
      icon: <AlertCircle size={16} className="shrink-0" />,
      bar: 'bg-red-500',
      border: 'border-red-500',
      bg: 'bg-red-50 text-red-800',
      label: 'Error',
    },
    warning: {
      icon: <AlertTriangle size={16} className="shrink-0" />,
      bar: 'bg-amber-500',
      border: 'border-amber-500',
      bg: 'bg-amber-50 text-amber-800',
      label: 'Perhatian',
    },
    info: {
      icon: <Info size={16} className="shrink-0" />,
      bar: 'bg-blue-500',
      border: 'border-blue-500',
      bg: 'bg-blue-50 text-blue-800',
      label: 'Info',
    },
  };

  const c = CONFIG[toast.type];

  return (
    <div
      className={`
        pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg shadow-lg border-l-4
        ${c.border} ${c.bg}
        transition-all duration-300 ease-out
        ${exiting ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100'}
      `}
    >
      <div className="flex items-start gap-3 px-4 pt-3 pb-2.5">
        <span className="mt-0.5">{c.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide opacity-60 mb-0.5">{c.label}</p>
          <p className="text-[13px] font-medium leading-snug break-words">{toast.message}</p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 mt-0.5 p-0.5 rounded opacity-40 hover:opacity-80 transition-opacity"
          aria-label="Tutup"
        >
          <X size={14} />
        </button>
      </div>
      <div className="h-[3px] w-full bg-black/10">
        <div
          className={`h-full ${c.bar} transition-all ease-linear`}
          style={{
            width: `${progress}%`,
            transitionDuration: `${toast.duration}ms`,
          }}
        />
      </div>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((
    message: string,
    type: ToastType = 'info',
    duration = 3500
  ) => {
    setToasts(prev => {
      if (prev.some(t => t.message === message && t.type === type)) return prev;
      const next = [...prev, {
        id: crypto.randomUUID(),
        message,
        type,
        duration,
        createdAt: Date.now(),
      }];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        role="region"
        aria-label="Notifikasi"
        aria-live="polite"
        className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 w-80 pointer-events-none"
      >
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
