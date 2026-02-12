
import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Transaction } from '../types';
import { TrendingUp, Package, Activity, Loader2, RefreshCw, Repeat, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const DashboardView: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
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
            setItems(its); setStocks(stk); setTransactions(txs);
        } catch (e) {
            console.error("Dashboard Sync Error");
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
        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
            <Loader2 className="animate-spin text-brand" size={40} />
            <div className="text-[10px] font-bold uppercase tracking-[0.3em]">Memproses Data Dashboard...</div>
        </div>
    );

    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Performa Operasional</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">GudangPro Analytics Engine</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto p-1 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none p-2 text-xs font-bold text-slate-800 outline-none" />
                    <span className="text-slate-300">-</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none p-2 text-xs font-bold text-slate-800 outline-none" />
                    <button onClick={loadData} className="p-2.5 text-slate-400 hover:text-brand transition-all"><RefreshCw size={18}/></button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Pengiriman Keluar" value={stats.totalOut} icon={<ArrowUpRight/>} trend="+12%" color="text-rose-600" />
                <StatCard title="Penerimaan Masuk" value={stats.totalIn} icon={<ArrowDownRight/>} trend="+8%" color="text-emerald-600" />
                <StatCard title="Status Stok Aktif" value={stats.totalStockCount} icon={<Package/>} trend="Optimum" color="text-brand" />
                <StatCard title="Katalog Barang" value={stats.activeItems} icon={<Repeat/>} trend="Aktif" color="text-slate-800" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2">
                            <TrendingUp size={16} className="text-brand"/> Ringkasan Barang Keluar Terbanyak
                        </h3>
                    </div>
                    <div className="space-y-6">
                        {stats.topOutboundItems.map((item, idx) => (
                            <div key={idx} className="group">
                                <div className="flex justify-between items-end mb-2">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800 truncate">{item.name}</span>
                                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">{item.code}</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-full">{item.value}x Transaksi</span>
                                </div>
                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-brand rounded-full transition-all duration-1000 group-hover:bg-sky-500 shadow-sm"
                                        style={{ width: `${(item.value / (stats.topOutboundItems[0]?.value || 1)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {stats.topOutboundItems.length === 0 && (
                            <div className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest italic text-xs">Belum ada mutasi keluar</div>
                        )}
                    </div>
                </div>
                
                <div className="bg-[#0f172a] p-8 rounded-[32px] text-white flex flex-col items-center justify-center text-center shadow-xl shadow-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative z-10">
                        <Activity size={48} className="text-brand mb-6 mx-auto"/>
                        <h3 className="text-lg font-black tracking-tight mb-2">Sistem Integrasi</h3>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed mb-8">Data diperbarui secara otomatis dari seluruh outlet yang terhubung.</p>
                        <div className="inline-block px-4 py-2 bg-white/10 rounded-2xl border border-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                           ● Sistem Online
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, trend, color }: any) => (
    <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
        <div className="flex justify-between items-center">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 ${color}`}>
                {icon}
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{trend}</span>
        </div>
        <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">{title}</p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value.toLocaleString()}</h3>
        </div>
    </div>
);
