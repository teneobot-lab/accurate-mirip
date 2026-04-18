import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Clock } from 'lucide-react';

// Format hari dalam bahasa Indonesia
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const ClockWidget: React.FC = () => {
  const [time, setTime] = useState(new Date());

  const tick = useCallback(() => {
    if (!document.hidden) setTime(new Date());
  }, []);

  useEffect(() => {
    // Tick langsung saat mount — tidak ada jeda 1 detik di awal
    tick();

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [tick]);

  const timeStr = time.toLocaleTimeString('id-ID', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateStr = time.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const hariStr = HARI[time.getDay()];

  // Warna jam berubah berdasarkan waktu
  const hour = time.getHours();
  const timeColor =
    hour >= 5  && hour < 12 ? 'text-amber-300'   // Pagi
    : hour >= 12 && hour < 17 ? 'text-emerald-400' // Siang
    : hour >= 17 && hour < 20 ? 'text-orange-400'  // Sore
    : 'text-blue-400';                              // Malam

  return (
    <div
      aria-label={`Sekarang ${hariStr}, ${dateStr} pukul ${timeStr}`}
      title={`${hariStr}, ${dateStr}`}
      className="flex items-center bg-slate-800 rounded-lg shadow-inner border border-slate-700 overflow-hidden select-none"
    >
      {/* JAM */}
      <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 border-r border-slate-700">
        <Clock size={11} className={`${timeColor} shrink-0`} />
        <span className={`font-mono text-[12px] font-bold tracking-wider ${timeColor}`}>
          {timeStr}
        </span>
      </div>

      {/* TANGGAL + HARI */}
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <CalendarDays size={11} className="text-slate-400 shrink-0" />
        <div className="flex flex-col leading-none">
          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">
            {hariStr}
          </span>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide mt-0.5">
            {dateStr}
          </span>
        </div>
      </div>
    </div>
  );
};
