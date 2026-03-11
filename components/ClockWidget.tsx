
import React, { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';

export const ClockWidget: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
      <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-700 pr-4">
        <Clock size={16} className="text-blue-500" />
        <span className="font-mono text-sm font-bold">
          {time.toLocaleTimeString([], { hour12: false })}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Calendar size={16} className="text-emerald-500" />
        <span className="text-xs font-bold uppercase tracking-tight">
          {time.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
};
