
import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { Calendar, Filter, TrendingUp, Package, Activity, Loader2, AlertCircle } from 'lucide-react';

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

        filteredTx.forEach(tx => {
            if (!tx.items) return;
            let qty = 0;
            tx.items.forEach(line => { 
                qty += Number((line.qty || 0) * (line.ratio || 1)); 
            });
            if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') totalIn += qty;
            if (tx.type === 'OUT') totalOut += qty;
        });

        return { 
            totalStockCount, 
            activeItems: safeItems.length,
            totalIn,
            totalOut,
            txCount: filteredTx.length
        };
    }, [items, stocks, transactions, startDate, endDate]);

    if (isLoading) return (
        <div className="h-full flex flex-col items-center justify-center text-cutty gap-4">
            <Loader2 className="animate-spin text-spectra" size={40} />
            <div className="text-xs font-bold uppercase tracking-[0.2em] animate-pulse">Sinkronisasi MySQL Central...</div>
        </div>
    );

    if (error) return (
        <div className="h-full flex flex-col items-center justify-center text-red-500 p-8 text-center">
            <AlertCircle size={48} className="mb-4 opacity-20" />
            <h3 className="font-bold text-lg mb-2">Koneksi Database Terputus</h3>
            <p className="text-sm opacity-70 mb-6 max-w-xs">{error}</p>
            <button onClick={loadData} className="px-6 py-2 bg-red-600 text-white rounded-full font-bold text-xs shadow-lg active:scale-95 transition-all">COBA LAGI</button>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-8 transition-colors font-sans">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-xl font-bold text-daintree dark:text-slate-100 mb-4">Executive Dashboard</h2>
                    <div className="flex gap-3">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-cutty p-2 rounded text-xs dark:bg-slate-900 dark:border-spectra outline-none focus:ring-1 focus:ring-spectra" />
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-cutty p-2 rounded text-xs dark:bg-slate-900 dark:border-spectra outline-none focus:ring-1 focus:ring-spectra" />
                        <button onClick={loadData} className="p-2 bg-daintree text-white rounded-lg shadow-md hover:bg-gable transition-colors"><Filter size={16}/></button>
                    </div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> 
                    MySQL Instance: Active
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Replaced generic colors with theme palette */}
                <StatCard title="Total Stok Keluar" value={stats.totalOut} icon={<TrendingUp/>} color="from-red-800 to-red-600" />
                <StatCard title="Total Stok Masuk" value={stats.totalIn} icon={<Activity/>} color="from-emerald-800 to-emerald-600" />
                <StatCard title="Total Stok Aktif" value={stats.totalStockCount} icon={<Package/>} color="from-daintree to-spectra" />
                <StatCard title="Total Item Unik" value={stats.activeItems} icon={<Package/>} color="from-gable to-cutty" />
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, color }: any) => (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-6 text-white shadow-xl flex justify-between items-center overflow-hidden relative group hover:scale-[1.02] transition-transform`}>
        <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase opacity-70 mb-1 tracking-wider">{title}</p>
            <h3 className="text-3xl font-black">{value.toLocaleString()}</h3>
        </div>
        <div className="opacity-20 transform scale-[2.5] group-hover:rotate-12 transition-transform duration-500">{icon}</div>
    </div>
);
