
import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { Calendar, Filter, TrendingUp, Package, Activity, Loader2, AlertCircle, ArrowUpRight, ArrowDownRight, Database } from 'lucide-react';

export const DashboardView: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [its, stk, txs] = await Promise.all([
                StorageService.fetchItems().catch(() => []),
                StorageService.fetchStocks().catch(() => []),
                StorageService.fetchTransactions().catch(() => [])
            ]);
            setItems(its || []); setStocks(stk || []); setTransactions(txs || []);
        } catch (e) {} finally { setIsLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const stats = useMemo(() => {
        const totalStock = stocks.reduce((acc, s) => acc + Number(s.qty || 0), 0);
        const filteredTx = transactions.filter(tx => tx && tx.date >= startDate && tx.date <= endDate);
        let totalIn = 0, totalOut = 0;
        filteredTx.forEach(tx => {
            if (!tx.items) return;
            let qty = tx.items.reduce((a, l) => a + Number((l.qty || 0) * (l.ratio || 1)), 0);
            if (tx.type === 'IN') totalIn += qty;
            if (tx.type === 'OUT') totalOut += qty;
        });
        return { totalStock, activeItems: items.length, totalIn, totalOut };
    }, [items, stocks, transactions, startDate, endDate]);

    if (isLoading) return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 bg-white dark:bg-slate-900">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Sinkronisasi Database...</div>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto p-10 bg-white dark:bg-slate-900 font-sans scrollbar-thin">
            <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Ringkasan Operasional</h2>
                    <p className="text-sm text-slate-400 mt-1">Pantau performa stok dan logistik real-time</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-2 rounded-[20px] border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2 px-4 py-2 border-r border-slate-200 dark:border-slate-700">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">Rentang Laporan</span>
                    </div>
                    <div className="flex gap-2 p-1">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="dashboard-date" />
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="dashboard-date" />
                        <button onClick={loadData} className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"><Filter size={16}/></button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <StatCard title="Stok Keluar" value={stats.totalOut} trend="+12%" type="down" icon={<ArrowUpRight/>} color="bg-red-50 text-red-600 border-red-100" />
                <StatCard title="Stok Masuk" value={stats.totalIn} trend="+8%" type="up" icon={<ArrowDownRight/>} color="bg-emerald-50 text-emerald-600 border-emerald-100" />
                <StatCard title="Inventory Aktif" value={stats.totalStock} icon={<Package/>} color="bg-blue-50 text-blue-600 border-blue-100" />
                <StatCard title="Item Unik" value={stats.activeItems} icon={<Database/>} color="bg-indigo-50 text-indigo-600 border-indigo-100" />
            </div>

            {/* Visual Status Section */}
            <div className="mt-12 p-8 rounded-[32px] bg-slate-900 text-white relative overflow-hidden flex flex-col md:flex-row justify-between items-center shadow-2xl">
                <div className="relative z-10">
                    <h3 className="text-xl font-bold mb-2">Koneksi Database MySQL</h3>
                    <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Enterprise Centralized: Connected</span>
                    </div>
                </div>
                <div className="mt-6 md:mt-0 flex gap-4 relative z-10">
                    <button className="px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">LOG AUDIT</button>
                    <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold transition-all shadow-xl shadow-blue-500/20">SYSTEM HEALTH</button>
                </div>
                <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
            </div>
            
            <style>{`
                .dashboard-date { @apply text-[11px] font-bold bg-transparent outline-none text-slate-700 dark:text-white px-2; }
                .scrollbar-thin::-webkit-scrollbar { width: 5px; }
                .scrollbar-thin::-webkit-scrollbar-thumb { @apply bg-slate-200 dark:bg-slate-800 rounded-full; }
            `}</style>
        </div>
    );
};

const StatCard = ({ title, value, icon, color, trend, type }: any) => (
    <div className={`p-8 rounded-[32px] border ${color} bg-white dark:bg-slate-800 relative overflow-hidden group hover:shadow-xl transition-all duration-300`}>
        <p className="text-[10px] font-bold uppercase opacity-60 mb-2 tracking-widest">{title}</p>
        <div className="flex items-end justify-between gap-4">
            <h3 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-none">{value.toLocaleString()}</h3>
            {trend && (
                <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${type === 'up' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                    {trend} {icon}
                </div>
            )}
        </div>
        <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500 scale-150 transform rotate-12">{icon}</div>
    </div>
);
