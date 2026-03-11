
import React, { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';

export const ClockWidget: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 text-slate-600 bg-mist-50/50 border border-mist-300 px-3 py-1.5 rounded-lg">
      <div className="flex items-center gap-1.5 border-r border-mist-300 pr-3">
        <Clock size={14} className="text-brand" />
        <span className="font-mono text-[11px] font-bold text-slate-700">
          {time.toLocaleTimeString([], { hour12: false })}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Calendar size={14} className="text-emerald-600" />
        <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500">
          {time.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
};
