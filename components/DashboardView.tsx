
import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { Calendar, Filter, TrendingUp, Package, Activity, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

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

             {/* Placeholder for Chart/Details - Empty State styled to match */}
            <div className="bg-gable rounded-2xl border border-spectra p-8 flex flex-col items-center justify-center text-center opacity-50 min-h-[200px]">
                <Activity size={48} className="text-spectra mb-4" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Analitik Lanjutan Segera Hadir</h3>
                <p className="text-xs text-slate-600 mt-2">Modul grafik dan prediksi stok sedang dalam pengembangan.</p>
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
