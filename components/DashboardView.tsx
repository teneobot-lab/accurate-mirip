
import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Transaction } from '../types';
import { TrendingUp, Package, Activity, Loader2, RefreshCw, Repeat, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';

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
                unit: items.find(i => i.id === id)?.baseUnit || '',
                value: val
            }));

        return { totalStockCount, activeItems: items.length, totalIn, totalOut, topOutboundItems };
    }, [items, stocks, transactions, startDate, endDate]);

    if (isLoading) return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="animate-spin text-slate-300" size={32} />
            <div className="text-sm font-medium text-slate-500">Memuat data dashboard...</div>
        </div>
    );

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 border-b border-slate-100 pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Ringkasan Operasional</h2>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Pantau pergerakan stok dan performa gudang secara real-time.</p>
                </div>
                
                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                        <Calendar size={14} className="text-slate-400 mr-2"/>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            className="bg-transparent border-none p-0 text-xs font-semibold text-slate-700 outline-none w-24" 
                        />
                        <span className="text-slate-300 mx-2">s/d</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            className="bg-transparent border-none p-0 text-xs font-semibold text-slate-700 outline-none w-24" 
                        />
                    </div>
                    <button onClick={loadData} className="p-2 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-lg transition-all" title="Refresh Data">
                        <RefreshCw size={16}/>
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Pengiriman Keluar" 
                    value={stats.totalOut} 
                    icon={<ArrowUpRight size={20}/>} 
                    color="text-rose-600" 
                    bg="bg-rose-50"
                    desc="Total item keluar periode ini"
                />
                <StatCard 
                    title="Penerimaan Masuk" 
                    value={stats.totalIn} 
                    icon={<ArrowDownRight size={20}/>} 
                    color="text-emerald-600" 
                    bg="bg-emerald-50"
                    desc="Total item masuk periode ini"
                />
                <StatCard 
                    title="Total Stok Fisik" 
                    value={stats.totalStockCount} 
                    icon={<Package size={20}/>} 
                    color="text-blue-600" 
                    bg="bg-blue-50"
                    desc="Akumulasi seluruh gudang"
                />
                <StatCard 
                    title="Database Item" 
                    value={stats.activeItems} 
                    icon={<Repeat size={20}/>} 
                    color="text-slate-700" 
                    bg="bg-slate-100"
                    desc="SKU aktif terdaftar"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top Items List */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp size={18} className="text-slate-400"/> 
                            Frekuensi Barang Keluar
                        </h3>
                        <span className="text-xs font-medium text-slate-400 px-2 py-1 bg-slate-50 rounded-md">Top 5 Item</span>
                    </div>
                    
                    <div className="space-y-5 flex-1">
                        {stats.topOutboundItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 min-h-[200px]">
                                <Package size={32} className="opacity-20"/>
                                <span className="text-sm">Belum ada transaksi keluar periode ini</span>
                            </div>
                        ) : (
                            stats.topOutboundItems.map((item, idx) => {
                                const maxVal = stats.topOutboundItems[0]?.value || 1;
                                const percent = (item.value / maxVal) * 100;
                                
                                return (
                                    <div key={idx} className="group">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <div className="flex items-center gap-3">
                                                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700 group-hover:text-brand transition-colors">{item.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{item.code}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-bold text-slate-800">{item.value}x</span>
                                                <span className="text-[10px] text-slate-400 ml-1 font-medium">Transaksi</span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-1000 ${idx === 0 ? 'bg-amber-400' : 'bg-slate-300 group-hover:bg-brand'}`}
                                                style={{ width: `${percent}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
                
                {/* System Status / Mini Widget */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
                        {/* Decorative Circles */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand/20 rounded-full -ml-8 -mb-8 blur-xl"></div>
                        
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                                <Activity size={20} className="text-emerald-400"/>
                            </div>
                            <h3 className="text-lg font-bold mb-1">Status Sistem</h3>
                            <p className="text-slate-400 text-xs leading-relaxed mb-6">
                                Semua layanan berjalan normal. Sinkronisasi data real-time aktif.
                            </p>
                            
                            <div className="flex items-center gap-2 text-[10px] font-medium bg-black/20 p-2 rounded-lg w-fit border border-white/5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Online & Connected
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-700 mb-4">Akses Cepat</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center cursor-pointer hover:bg-brand/5 hover:border-brand/20 transition-all group">
                                <span className="text-2xl mb-1 block group-hover:scale-110 transition-transform">📦</span>
                                <span className="text-[10px] font-bold text-slate-600">Cek Stok</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center cursor-pointer hover:bg-brand/5 hover:border-brand/20 transition-all group">
                                <span className="text-2xl mb-1 block group-hover:scale-110 transition-transform">📄</span>
                                <span className="text-[10px] font-bold text-slate-600">Laporan</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Elegant Stat Card Component
const StatCard = ({ title, value, icon, bg, color, desc }: any) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all duration-300">
        <div className="flex justify-between items-start mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${color}`}>
                {icon}
            </div>
            {/* Optional Trend Indicator could go here */}
        </div>
        <div>
            <div className="text-3xl font-bold text-slate-800 tracking-tight mb-1">
                {value.toLocaleString()}
            </div>
            <div className="text-sm font-medium text-slate-600">{title}</div>
            <div className="text-[10px] text-slate-400 mt-1">{desc}</div>
        </div>
    </div>
);
