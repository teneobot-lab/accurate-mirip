
import React, { useState, useEffect } from 'react';
import { CalendarDays, Clock } from 'lucide-react';

export const ClockWidget: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center bg-slate-800 rounded-lg shadow-inner border border-slate-700 overflow-hidden mr-1">
      <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 border-r border-slate-700">
        <Clock size={12} className="text-emerald-400" />
        <span className="font-mono text-[12px] font-bold tracking-wider text-emerald-50">
          {time.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800">
        <CalendarDays size={12} className="text-blue-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
          {time.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
};
