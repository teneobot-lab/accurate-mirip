
import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { Calendar, Filter, TrendingUp, Package, Activity, Loader2, AlertCircle, RefreshCw, Repeat } from 'lucide-react';

export const DashboardView: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fixed: Local Date for 1st of month
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
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
            setItems(its); setStocks(stk); setTransactions(txs);
        } catch (e: any) {
            setError(e.message || "Gagal sinkronisasi Database");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const stats = useMemo(() => {
        const totalStockCount = stocks.reduce((acc, s) => acc + Number(s.qty || 0), 0);
        const filteredTx = transactions.filter(tx => tx.date >= startDate && tx.date <= endDate);
        
        let totalIn = 0; let totalOut = 0;
        const outItemFrequencyMap = new Map<string, number>();

        filteredTx.forEach(tx => {
            tx.items.forEach(line => { 
                const qty = Number((line.qty || 0) * (line.ratio || 1));
                if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') totalIn += qty;
                if (tx.type === 'OUT') totalOut += qty;
            });

            if (tx.type === 'OUT') {
                new Set<string>(tx.items.map(i => i.itemId)).forEach((itemId: string) => {
                    outItemFrequencyMap.set(itemId, (outItemFrequencyMap.get(itemId) || 0) + 1);
                });
            }
        });

        const topOutboundItems = Array.from(outItemFrequencyMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, val]) => ({
                name: items.find(i => i.id === id)?.name || 'Unknown Item',
                code: items.find(i => i.id === id)?.code || '???',
                value: val
            }));

        return { totalStockCount, activeItems: items.length, totalIn, totalOut, topOutboundItems };
    }, [items, stocks, transactions, startDate, endDate]);

    if (isLoading) return (
        <div className="h-full flex flex-col items-center justify-center text-cutty gap-4">
            <Loader2 className="animate-spin text-spectra" size={40} />
            <div className="text-[10px] font-black uppercase tracking-widest animate-pulse">Memuat Data Dashboard...</div>
        </div>
    );

    return (
        <div className="p-4 lg:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-white">Dashboard Performa</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Ringkasan Operasional Gudang</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 sm:flex-none bg-gable border border-spectra p-2 rounded-xl text-xs text-white outline-none" />
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 sm:flex-none bg-gable border border-spectra p-2 rounded-xl text-xs text-white outline-none" />
                    <button onClick={loadData} className="p-2 bg-spectra text-white rounded-xl hover:bg-white hover:text-spectra transition-all"><RefreshCw size={18}/></button>
                </div>
            </div>

            {/* STAT CARDS - RESPONSIVE GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Keluar" value={stats.totalOut} icon={<TrendingUp/>} color="bg-red-950/20 border-red-900/30 text-red-400" />
                <StatCard title="Total Masuk" value={stats.totalIn} icon={<Activity/>} color="bg-emerald-950/20 border-emerald-900/30 text-emerald-400" />
                <StatCard title="Stok Aktif" value={stats.totalStockCount} icon={<Package/>} color="bg-gable border-spectra text-white" />
                <StatCard title="Item Unik" value={stats.activeItems} icon={<Repeat/>} color="bg-daintree border-spectra text-cutty" />
            </div>

            {/* CHART SECTION - STACKS ON MOBILE */}
            <div className="bg-gable/30 p-6 rounded-[32px] border border-spectra/30 overflow-hidden text-slate-200">
                <div className="flex flex-col lg:flex-row items-center gap-8">
                    <div className="w-full lg:w-1/3 flex justify-center">
                        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-daintree border-4 border-spectra shadow-2xl flex flex-col items-center justify-center text-center p-4">
                             <h3 className="text-2xl font-black text-white tracking-widest">TOP 5</h3>
                             <p className="text-[10px] font-black text-spectra uppercase mt-1">Sering Keluar</p>
                        </div>
                    </div>
                    <div className="w-full lg:w-2/3 space-y-3">
                        {stats.topOutboundItems.map((item, idx) => (
                            <div key={idx} className="relative group">
                                <div className="flex justify-between items-center mb-1 px-2">
                                    <span className="text-xs font-bold text-slate-300 truncate pr-4">{item.name}</span>
                                    <span className="text-[10px] font-black text-spectra">{item.value}x</span>
                                </div>
                                <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-spectra to-emerald-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${(item.value / (stats.topOutboundItems[0]?.value || 1)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, color }: any) => (
    <div className={`${color} border p-5 rounded-2xl shadow-lg flex justify-between items-center group hover:scale-[1.02] transition-all`}>
        <div>
            <p className="text-[10px] font-black uppercase opacity-70 mb-1 tracking-widest">{title}</p>
            <h3 className="text-2xl font-black">{value.toLocaleString()}</h3>
        </div>
        <div className="opacity-20 transform scale-[2] group-hover:rotate-12 transition-transform">{icon}</div>
    </div>
);
