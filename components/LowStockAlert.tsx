
import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { StorageService } from '../services/storage';
import { Item, Stock } from '../types';

export const LowStockAlert: React.FC = () => {
    const [alerts, setAlerts] = useState<{ item: Item; currentQty: number }[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const checkStockLevels = async () => {
        setIsLoading(true);
        try {
            const [items, stocks] = await Promise.all([
                StorageService.fetchItems(),
                StorageService.fetchStocks()
            ]);

            const lowStockItems = items
                .filter(item => item.isActive && item.minStock > 0)
                .map(item => {
                    const currentQty = stocks
                        .filter(s => s.itemId === item.id)
                        .reduce((acc, s) => acc + Number(s.qty), 0);
                    return { item, currentQty };
                })
                .filter(data => data.currentQty <= data.item.minStock)
                .sort((a, b) => a.currentQty - b.currentQty);

            setAlerts(lowStockItems);
        } catch (error) {
            console.error("Failed to check stock levels", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkStockLevels();
        const interval = setInterval(checkStockLevels, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`relative p-1.5 rounded-lg transition-all border ${
                    isOpen 
                    ? 'bg-slate-200 text-slate-800 border-slate-300' 
                    : 'text-slate-400 border-transparent hover:bg-slate-100 hover:text-slate-600'
                }`}
            >
                <Bell size={18} className={alerts.length > 0 && !isOpen ? 'animate-bounce-subtle' : ''} />
                {alerts.length > 0 && (
                    <span className="absolute top-1 right-1 flex h-2 w-2">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 border border-white"></span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-1 duration-200 origin-top-right">
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-slate-600 font-bold text-[10px] uppercase tracking-widest">
                            <AlertTriangle size={12} className="text-amber-500"/> Notifikasi Stok
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={checkStockLevels} className="p-1 text-slate-400 hover:text-slate-600">
                                <RefreshCw size={10} className={isLoading ? 'animate-spin' : ''}/>
                            </button>
                            <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-rose-500">
                                <X size={12}/>
                            </button>
                        </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {alerts.length === 0 ? (
                            <div className="p-6 text-center text-slate-400">
                                <p className="text-[10px] font-bold uppercase">Stok Aman</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {alerts.map((alert) => (
                                    <div key={alert.item.id} className="p-2.5 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <span className="font-semibold text-slate-700 text-[11px] truncate w-40">{alert.item.name}</span>
                                            <span className="text-[9px] font-mono text-slate-400">{alert.item.code}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="text-[10px]">
                                                <span className={`font-bold ${alert.currentQty <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                                                    {alert.currentQty.toLocaleString()}
                                                </span>
                                                <span className="text-slate-400 ml-1 uppercase">{alert.item.baseUnit}</span>
                                            </div>
                                            <div className="text-[9px] text-slate-400">Min: {alert.item.minStock}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
            <style>{`
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-2px); }
                }
                .animate-bounce-subtle { animation: bounce-subtle 2s ease-in-out infinite; }
            `}</style>
        </div>
    );
};
