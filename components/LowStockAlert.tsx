
import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, ArrowRight, RefreshCw, X } from 'lucide-react';
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
                .filter(item => item.isActive && item.minStock > 0) // Hanya item aktif & user set minStock
                .map(item => {
                    // Hitung total stok dari semua gudang
                    const currentQty = stocks
                        .filter(s => s.itemId === item.id)
                        .reduce((acc, s) => acc + Number(s.qty), 0);
                    
                    return { item, currentQty };
                })
                .filter(data => data.currentQty <= data.item.minStock) // Logic Low Stock
                .sort((a, b) => a.currentQty - b.currentQty); // Urutkan dari stok terkecil

            setAlerts(lowStockItems);
        } catch (error) {
            console.error("Failed to check stock levels", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Check on mount and every 60 seconds
    useEffect(() => {
        checkStockLevels();
        const interval = setInterval(checkStockLevels, 60000);
        return () => clearInterval(interval);
    }, []);

    // Click outside handler
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
                className={`relative p-2 rounded-xl transition-all border ${
                    isOpen 
                    ? 'bg-spectra text-white border-spectra' 
                    : 'text-slate-400 border-transparent hover:bg-spectra/20 hover:text-white'
                }`}
                title="Notifikasi Stok Menipis"
            >
                <Bell size={20} className={alerts.length > 0 && !isOpen ? 'animate-swing' : ''} />
                
                {/* Badge Count */}
                {alerts.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-gable rounded-2xl shadow-2xl border border-spectra overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 origin-top-right">
                    <div className="bg-daintree p-3 border-b border-spectra flex justify-between items-center">
                        <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wide">
                            <AlertTriangle size={14} className="text-red-400"/>
                            Low Stock Alert
                            <span className="bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded text-[10px] border border-red-900">
                                {alerts.length} Item
                            </span>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={checkStockLevels} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors">
                                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''}/>
                            </button>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors">
                                <X size={14}/>
                            </button>
                        </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto scrollbar-thin">
                        {alerts.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center gap-2 text-slate-500">
                                <span className="p-3 bg-daintree rounded-full border border-spectra/30">
                                    <Bell size={20} className="text-emerald-500/50"/>
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wider">Stok Aman</span>
                                <span className="text-[9px]">Tidak ada item di bawah batas minimum.</span>
                            </div>
                        ) : (
                            <ul className="divide-y divide-spectra/30">
                                {alerts.map((alert, idx) => (
                                    <li key={alert.item.id} className="p-3 hover:bg-daintree/50 transition-colors group">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-slate-200 text-xs truncate w-40" title={alert.item.name}>
                                                {alert.item.name}
                                            </span>
                                            <span className="text-[9px] font-mono font-bold text-spectra uppercase">
                                                {alert.item.code}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-slate-500 uppercase font-bold">Sisa Stok</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className={`text-sm font-black ${alert.currentQty <= 0 ? 'text-red-500' : 'text-amber-400'}`}>
                                                        {alert.currentQty.toLocaleString()}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 font-bold">{alert.item.baseUnit}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-[9px] text-slate-500 bg-black/20 px-2 py-1 rounded border border-white/5">
                                                <span>Min: <span className="text-slate-300 font-bold">{alert.item.minStock}</span></span>
                                            </div>
                                        </div>
                                        {/* Simple Progress Bar */}
                                        <div className="mt-2 h-1 w-full bg-black/40 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full ${alert.currentQty <= 0 ? 'bg-red-600' : 'bg-amber-500'}`} 
                                                style={{ width: `${Math.min((alert.currentQty / alert.item.minStock) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
            <style>{`
                @keyframes swing {
                    0%, 100% { transform: rotate(0deg); }
                    20% { transform: rotate(15deg); }
                    40% { transform: rotate(-10deg); }
                    60% { transform: rotate(5deg); }
                    80% { transform: rotate(-5deg); }
                }
                .animate-swing {
                    animation: swing 1s ease-in-out infinite;
                    transform-origin: top center;
                }
            `}</style>
        </div>
    );
};
