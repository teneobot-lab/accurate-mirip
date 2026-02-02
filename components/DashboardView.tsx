
import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { Calendar, Filter, TrendingUp, Package, Activity, Loader2 } from 'lucide-react';

export const DashboardView: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [its, stk, txs] = await Promise.all([
                StorageService.fetchItems(),
                StorageService.fetchStocks(),
                StorageService.fetchTransactions()
            ]);
            setItems(its);
            setStocks(stk);
            setTransactions(txs);
        } catch (e) {
            console.error("DB Error", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const stats = useMemo(() => {
        const totalStockCount = stocks.reduce((acc, s) => acc + Number(s.qty), 0);
        const filteredTx = transactions.filter(tx => tx.date >= startDate && tx.date <= endDate);
        let totalIn = 0;
        let totalOut = 0;

        filteredTx.forEach(tx => {
            let qty = 0;
            tx.items.forEach(line => { qty += Number(line.qty * line.ratio); });
            if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') totalIn += qty;
            if (tx.type === 'OUT') totalOut += qty;
        });

        return { 
            totalStockCount, 
            activeItems: items.length,
            totalIn,
            totalOut,
            txCount: filteredTx.length
        };
    }, [items, stocks, transactions, startDate, endDate]);

    if (isLoading) return <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest"><Loader2 className="animate-spin mr-2"/> Sync MySQL...</div>;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-8 transition-colors font-sans">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Executive Dashboard (DB Sync)</h2>
                    <div className="flex gap-3">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-2 rounded text-xs dark:bg-slate-900" />
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-2 rounded text-xs dark:bg-slate-900" />
                        <button onClick={loadData} className="p-2 bg-blue-600 text-white rounded"><Filter size={16}/></button>
                    </div>
                </div>
                <div className="text-right text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Connected to MySQL
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Total Stok Keluar" value={stats.totalOut} icon={<TrendingUp/>} color="bg-red-500" />
                <StatCard title="Total Stok Masuk" value={stats.totalIn} icon={<Activity/>} color="bg-emerald-500" />
                <StatCard title="Total Stok Aktif" value={stats.totalStockCount} icon={<Package/>} color="bg-blue-500" />
                <StatCard title="Total Item Unik" value={stats.activeItems} icon={<Package/>} color="bg-purple-500" />
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, color }: any) => (
    <div className={`${color} rounded-2xl p-6 text-white shadow-lg flex justify-between items-center overflow-hidden relative`}>
        <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase opacity-80 mb-1">{title}</p>
            <h3 className="text-2xl font-bold">{value.toLocaleString()}</h3>
        </div>
        <div className="opacity-20 transform scale-150">{icon}</div>
    </div>
);
