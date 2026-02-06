
import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { Calendar, Filter, TrendingUp, Package, Activity, Loader2, AlertCircle, RefreshCw, BarChart3, Repeat } from 'lucide-react';

export const DashboardView: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [its, stk, txs] = await Promise.all([
                StorageService.fetchItems().catch(() => []),
                StorageService.fetchStocks().catch(() => []),
                StorageService.fetchTransactions().catch(() => [])
            ]);
            
            setItems(Array.isArray(its) ? its : []);
            setStocks(Array.isArray(stk) ? stk : []);
            setTransactions(Array.isArray(txs) ? txs : []);
        } catch (e: any) {
            console.error("DB Error", e);
            setError(e.message || "Gagal sinkronisasi dengan Database MySQL");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const stats = useMemo(() => {
        const safeStocks = Array.isArray(stocks) ? stocks : [];
        const safeTransactions = Array.isArray(transactions) ? transactions : [];
        const safeItems = Array.isArray(items) ? items : [];

        const totalStockCount = safeStocks.reduce((acc, s) => acc + Number(s.qty || 0), 0);
        const filteredTx = safeTransactions.filter(tx => tx && tx.date >= startDate && tx.date <= endDate);
        
        let totalIn = 0;
        let totalOut = 0;
        
        // Map untuk menghitung FREKUENSI/RUTINITAS transaksi
        // Key: ItemId, Value: Jumlah Transaksi yang mengandung item tersebut
        const outItemFrequencyMap = new Map<string, number>();

        filteredTx.forEach(tx => {
            if (!tx.items) return;
            
            // 1. Hitung Total Qty Global (IN/OUT)
            tx.items.forEach(line => { 
                const qty = Number((line.qty || 0) * (line.ratio || 1));
                
                if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
                    totalIn += qty;
                }
                
                if (tx.type === 'OUT') {
                    totalOut += qty;
                }
            });

            // 2. Hitung Rutinitas Item (Khusus OUT)
            if (tx.type === 'OUT') {
                // Gunakan Set untuk memastikan 1 Item dihitung 1x per Invoice (Rutinitas)
                // Meskipun item diinput 2 baris di invoice yang sama, tetap dihitung 1 kejadian.
                const uniqueItemsInTx = new Set(tx.items.map(i => i.itemId));
                
                uniqueItemsInTx.forEach(itemId => {
                    const currentCount = outItemFrequencyMap.get(itemId) || 0;
                    outItemFrequencyMap.set(itemId, currentCount + 1);
                });
            }
        });

        // Calculate Top 5 Outbound Items based on FREQUENCY
        const topOutboundItems = Array.from(outItemFrequencyMap.entries())
            .sort((a, b) => b[1] - a[1]) // Sort Descending by Count
            .slice(0, 5) // Take Top 5
            .map(([id, val]) => {
                const itemMaster = safeItems.find(i => i.id === id);
                return {
                    name: itemMaster?.name || 'Unknown Item',
                    code: itemMaster?.code || '???',
                    unit: 'Trx', // Unit diganti menjadi Trx (Transaksi)
                    value: val
                };
            });

        return { 
            totalStockCount, 
            activeItems: safeItems.length,
            totalIn,
            totalOut,
            txCount: filteredTx.length,
            topOutboundItems
        };
    }, [items, stocks, transactions, startDate, endDate]);

    if (isLoading) return (
        <div className="h-full flex flex-col items-center justify-center text-cutty gap-4 bg-daintree">
            <Loader2 className="animate-spin text-spectra" size={40} />
            <div className="text-xs font-bold uppercase tracking-[0.2em] animate-pulse">Sinkronisasi MySQL Central...</div>
        </div>
    );

    if (error) return (
        <div className="h-full flex flex-col items-center justify-center text-red-400 p-8 text-center bg-daintree">
            <AlertCircle size={48} className="mb-4 opacity-20" />
            <h3 className="font-bold text-lg mb-2">Koneksi Database Terputus</h3>
            <p className="text-sm opacity-70 mb-6 max-w-xs">{error}</p>
            <button onClick={loadData} className="px-6 py-2 bg-red-900/50 hover:bg-red-900 text-white rounded-full font-bold text-xs shadow-lg active:scale-95 transition-all border border-red-800">COBA LAGI</button>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto bg-daintree p-8 transition-colors font-sans h-full">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">Executive Dashboard</h2>
                    <p className="text-xs text-slate-400 font-medium">Ringkasan performa gudang & inventaris</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                     <div className="bg-emerald-900/20 border border-emerald-900 px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> 
                        MySQL Instance: Active
                    </div>
                    <div className="flex gap-2">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gable border border-spectra p-2 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-spectra shadow-sm" />
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gable border border-spectra p-2 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-spectra shadow-sm" />
                        <button onClick={loadData} className="p-2 bg-spectra text-white rounded-lg shadow-md hover:bg-cutty transition-colors"><RefreshCw size={16}/></button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Total Stok Keluar" value={stats.totalOut} icon={<TrendingUp/>} color="bg-gradient-to-br from-red-950 to-red-900 border-red-900/50 text-red-100" iconColor="text-red-500" />
                <StatCard title="Total Stok Masuk" value={stats.totalIn} icon={<Activity/>} color="bg-gradient-to-br from-emerald-950 to-emerald-900 border-emerald-900/50 text-emerald-100" iconColor="text-emerald-500" />
                <StatCard title="Total Stok Aktif" value={stats.totalStockCount} icon={<Package/>} color="bg-gable border-spectra text-white" iconColor="text-spectra" />
                <StatCard title="Total Item Unik" value={stats.activeItems} icon={<Package/>} color="bg-daintree border-spectra text-cutty" iconColor="text-cutty" />
            </div>

            {/* --- CUSTOM CHART INFOGRAPHIC (TOP 5 OUTBOUND FREQUENCY) --- */}
            <div className="mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8 items-center bg-gable/30 p-6 rounded-[32px] border border-spectra/30 relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute -left-20 -top-20 w-64 h-64 bg-spectra/10 rounded-full blur-3xl pointer-events-none"></div>

                    {/* Left Circle (Title) */}
                    <div className="lg:col-span-4 flex justify-center lg:justify-end pr-0 lg:pr-8 mb-8 lg:mb-0 relative z-10">
                        <div className="w-56 h-56 rounded-full bg-daintree border-[6px] border-l-spectra border-t-gable border-r-daintree border-b-cutty shadow-2xl flex flex-col items-center justify-center text-center relative group hover:scale-105 transition-transform duration-500">
                            <div className="absolute inset-0 rounded-full border border-white/5 animate-spin-slow"></div>
                            <h3 className="text-3xl font-black text-white tracking-widest drop-shadow-lg">TOP 5</h3>
                            <p className="text-xs font-bold text-spectra uppercase tracking-[0.2em] mt-1 mb-2">High Routine</p>
                            <div className="h-px w-16 bg-white/20 mb-2"></div>
                            <p className="text-[9px] text-slate-400 max-w-[120px] leading-tight">
                                Barang dengan frekuensi transaksi keluar tertinggi
                            </p>
                            <Repeat size={24} className="text-emerald-500 mt-4 opacity-50 group-hover:opacity-100 transition-opacity"/>
                        </div>
                    </div>

                    {/* Right Bars (Chart) */}
                    <div className="lg:col-span-8 flex flex-col gap-3 relative z-10 pl-4 lg:pl-0">
                        {stats.topOutboundItems.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 text-sm font-bold italic border-l-2 border-spectra/30 pl-4">
                                Belum ada data transaksi keluar pada periode ini.
                            </div>
                        ) : (
                            stats.topOutboundItems.map((item, idx) => (
                                <div key={idx} className="relative h-14 w-full flex items-center group">
                                    {/* The Gradient Bar */}
                                    <div 
                                        className={`absolute left-0 top-0 bottom-0 rounded-r-full shadow-[4px_4px_10px_rgba(0,0,0,0.3)] transition-all duration-700 ease-out flex items-center px-6 gap-6 border-t border-b border-r border-white/5 hover:brightness-110 hover:translate-x-2
                                            ${idx === 0 ? 'bg-[#0a181a] w-[100%] z-50' : ''} 
                                            ${idx === 1 ? 'bg-[#13282b] w-[95%] z-40' : ''} 
                                            ${idx === 2 ? 'bg-[#1c383d] w-[90%] z-30' : ''} 
                                            ${idx === 3 ? 'bg-[#26494f] w-[85%] z-20' : ''} 
                                            ${idx === 4 ? 'bg-[#2f5a61] w-[80%] z-10' : ''} 
                                        `}
                                    >
                                        {/* Index Number */}
                                        <span className="text-3xl font-black text-white/10 font-mono tracking-tighter group-hover:text-white/30 transition-colors">0{idx + 1}</span>
                                        
                                        {/* Label */}
                                        <div className="flex flex-col leading-none min-w-0 flex-1">
                                            <span className="text-sm font-bold text-slate-100 truncate pr-4 drop-shadow-md">{item.name}</span>
                                            <span className="text-[10px] text-emerald-500/70 font-mono mt-1 font-bold tracking-wider">{item.code}</span>
                                        </div>
                                        
                                        {/* Value Badge */}
                                        <div className="bg-black/40 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2 shadow-inner min-w-[100px] justify-center">
                                            <span className="text-sm font-mono font-black text-white">{item.value.toLocaleString()}x</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">Trx</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

             {/* Placeholder for Chart/Details - Empty State styled to match */}
            <div className="bg-gable rounded-2xl border border-spectra p-8 flex flex-col items-center justify-center text-center opacity-50 min-h-[150px]">
                <Activity size={32} className="text-spectra mb-3" />
                <h3 className="text-slate-400 font-bold text-xs uppercase tracking-widest">Analitik Lanjutan</h3>
                <p className="text-[10px] text-slate-600 mt-1">Prediksi stok & tren musiman segera hadir.</p>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, color, iconColor }: any) => (
    <div className={`${color} border rounded-2xl p-6 shadow-xl flex justify-between items-center overflow-hidden relative group hover:scale-[1.02] transition-transform`}>
        <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase opacity-70 mb-1 tracking-wider">{title}</p>
            <h3 className="text-3xl font-black tracking-tight">{value.toLocaleString()}</h3>
        </div>
        <div className={`opacity-30 transform scale-[2.5] group-hover:rotate-12 transition-transform duration-500 ${iconColor}`}>{icon}</div>
    </div>
);
