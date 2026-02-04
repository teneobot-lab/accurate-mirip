
import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Transaction } from '../types';
import { TrendingUp, Package, Activity, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

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
        } catch (e: any) { setError(e.message || "Database Error"); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const stats = useMemo(() => {
        const totalStockCount = stocks.reduce((acc, s) => acc + Number(s.qty || 0), 0);
        const filteredTx = transactions.filter(tx => tx && tx.date >= startDate && tx.date <= endDate);
        let totalIn = 0; let totalOut = 0;
        filteredTx.forEach(tx => {
            let qty = 0; tx.items?.forEach(line => { qty += Number((line.qty || 0) * (line.ratio || 1)); });
            if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') totalIn += qty;
            if (tx.type === 'OUT') totalOut += qty;
        });
        return { totalStockCount, activeItems: items.length, totalIn, totalOut };
    }, [items, stocks, transactions, startDate, endDate]);

    if (isLoading) return <div className="h-full flex items-center justify-center text-cutty"><Loader2 className="animate-spin text-spectra mr-3" size={32} /><span className="text-xs font-bold uppercase tracking-widest">Loading...</span></div>;

    return (
        <div className="flex-1 overflow-y-auto bg-daintree p-4 lg:p-8">
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 className="text-lg lg:text-xl font-bold text-white mb-1">Executive Dashboard</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Real-time Stock Monitoring</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 sm:w-32 bg-gable border border-spectra p-2 rounded-lg text-xs text-white outline-none" />
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 sm:w-32 bg-gable border border-spectra p-2 rounded-lg text-xs text-white outline-none" />
                    <button onClick={loadData} className="p-2 bg-spectra text-white rounded-lg hover:bg-white hover:text-spectra transition-colors shadow-lg"><RefreshCw size={16}/></button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
                <StatCard title="Stok Keluar" value={stats.totalOut} icon={<TrendingUp/>} color="bg-red-950/20 border-red-900/50 text-red-100" iconColor="text-red-500" />
                <StatCard title="Stok Masuk" value={stats.totalIn} icon={<Activity/>} color="bg-emerald-950/20 border-emerald-900/50 text-emerald-100" iconColor="text-emerald-500" />
                <StatCard title="Total Stok" value={stats.totalStockCount} icon={<Package/>} color="bg-gable border-spectra text-white" iconColor="text-spectra" />
                <StatCard title="Unique SKU" value={stats.activeItems} icon={<Package/>} color="bg-gable border-spectra text-white" iconColor="text-cutty" />
            </div>

            <div className="bg-gable rounded-2xl border border-spectra p-8 lg:p-12 flex flex-col items-center justify-center text-center opacity-40 min-h-[300px] shadow-inner">
                <Activity size={48} className="text-spectra mb-4" />
                <h3 className="text-slate-200 font-bold text-sm uppercase tracking-widest">Warehouse Analytics Module</h3>
                <p className="text-[10px] text-slate-500 mt-2 uppercase font-black">Ready for expanded visualization</p>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, color, iconColor }: any) => (
    <div className={`${color} border rounded-2xl p-5 shadow-xl flex justify-between items-center group relative overflow-hidden`}>
        <div className="relative z-10">
            <p className="text-[10px] font-black uppercase opacity-60 mb-1 tracking-widest">{title}</p>
            <h3 className="text-2xl font-black tracking-tighter">{value.toLocaleString()}</h3>
        </div>
        <div className={`opacity-20 transform scale-[2] group-hover:scale-[2.5] transition-transform duration-500 ${iconColor}`}>{icon}</div>
    </div>
);
