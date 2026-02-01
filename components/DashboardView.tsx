
import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { 
    Calendar, Filter, ChevronRight, TrendingUp, Package, Activity, ArrowUpRight
} from 'lucide-react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
} from 'recharts';

export const DashboardView: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // Date Filter State
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        setItems(StorageService.getItems());
        setStocks(StorageService.getStocks());
        setWarehouses(StorageService.getWarehouses());
        setTransactions(StorageService.getTransactions());
    }, []);

    // --- Derived Data Calculations ---

    const stats = useMemo(() => {
        let totalStockCount = 0;
        let activeItems = 0;

        items.forEach(item => {
            const itemStocks = stocks.filter(s => s.itemId === item.id);
            const currentTotal = itemStocks.reduce((acc, s) => acc + s.qty, 0);
            totalStockCount += currentTotal;
            if (currentTotal > 0) activeItems++;
        });

        // Filter transactions by date range
        const filteredTx = transactions.filter(tx => tx.date >= startDate && tx.date <= endDate);
        
        let totalIn = 0;
        let totalOut = 0;

        filteredTx.forEach(tx => {
            let qty = 0;
            tx.items.forEach(line => { qty += (line.qty * line.ratio); });
            if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') totalIn += qty;
            if (tx.type === 'OUT') totalOut += qty;
        });

        return { 
            totalStockCount, 
            activeItems,
            totalIn,
            totalOut,
            txCount: filteredTx.length
        };
    }, [items, stocks, transactions, startDate, endDate]);

    const chartData = useMemo(() => {
        // Group by Date for Chart
        const dailyData: Record<string, { date: string, value: number }> = {};
        
        // Initialize range with 0
        const start = new Date(startDate);
        const end = new Date(endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const displayDate = d.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});
            dailyData[dateStr] = { date: displayDate, value: 0 }; 
        }

        transactions.forEach(tx => {
            if (tx.date >= startDate && tx.date <= endDate && tx.type === 'OUT') {
                const dateKey = tx.date;
                let qty = 0;
                tx.items.forEach(line => { qty += (line.qty * line.ratio); });
                if (dailyData[dateKey]) { 
                    dailyData[dateKey].value += qty;
                }
            }
        });

        return Object.values(dailyData);
    }, [transactions, startDate, endDate]);

    const topItems = useMemo(() => {
        const itemMap = new Map<string, number>();
        transactions.forEach(tx => {
             if (tx.date >= startDate && tx.date <= endDate && tx.type === 'OUT') {
                 tx.items.forEach(line => {
                     const baseQty = line.qty * line.ratio;
                     const current = itemMap.get(line.itemId) || 0;
                     itemMap.set(line.itemId, current + baseQty);
                 });
             }
        });

        return Array.from(itemMap.entries())
            .map(([itemId, qty]) => {
                const item = items.find(i => i.id === itemId);
                return {
                    name: item ? item.name : 'Unknown',
                    code: item ? item.code : '?',
                    qty: qty,
                    category: item ? item.category : ''
                };
            })
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);
    }, [transactions, items, startDate, endDate]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-8 transition-colors font-sans">
            
            {/* Filter Section */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Filter Dashboard</h2>
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mulai Dari</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                            <input 
                                type="date" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hingga</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                            <input 
                                type="date" 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                            />
                        </div>
                    </div>
                    <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 h-[42px]">
                        <Filter size={16} /> Terapkan Filter
                    </button>
                </div>
            </div>

            {/* Blue Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Sales (Mapped to Outbound) */}
                <div className="bg-blue-500 dark:bg-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
                    <div className="relative z-10 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">Total Barang Keluar</p>
                        <h3 className="text-3xl font-bold mb-4">{stats.totalOut.toLocaleString()} <span className="text-sm font-normal opacity-70">Unit</span></h3>
                        <button className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 opacity-60 hover:opacity-100 transition-opacity mx-auto">
                            Rincian <ChevronRight size={10} />
                        </button>
                    </div>
                    <div className="absolute -bottom-4 -right-4 opacity-10 transform rotate-12 group-hover:scale-110 transition-transform duration-500">
                        <TrendingUp size={100} />
                    </div>
                </div>

                {/* Total Profit (Mapped to Inbound/Restock) */}
                <div className="bg-blue-500 dark:bg-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
                    <div className="relative z-10 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">Total Barang Masuk</p>
                        <h3 className="text-3xl font-bold mb-4">{stats.totalIn.toLocaleString()} <span className="text-sm font-normal opacity-70">Unit</span></h3>
                        <button className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 opacity-60 hover:opacity-100 transition-opacity mx-auto">
                            Rincian <ChevronRight size={10} />
                        </button>
                    </div>
                    <div className="absolute -bottom-4 -right-4 opacity-10 transform rotate-12 group-hover:scale-110 transition-transform duration-500">
                        <ArrowUpRight size={100} />
                    </div>
                </div>

                {/* Transaction Count */}
                <div className="bg-blue-500 dark:bg-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
                    <div className="relative z-10 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">Jumlah Transaksi</p>
                        <h3 className="text-3xl font-bold mb-4">{stats.txCount}</h3>
                        <button className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 opacity-60 hover:opacity-100 transition-opacity mx-auto">
                            Rincian <ChevronRight size={10} />
                        </button>
                    </div>
                    <div className="absolute -bottom-4 -right-4 opacity-10 transform rotate-12 group-hover:scale-110 transition-transform duration-500">
                        <Activity size={100} />
                    </div>
                </div>

                {/* Active Stock */}
                <div className="bg-blue-500 dark:bg-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
                    <div className="relative z-10 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">Stok Item Aktif</p>
                        <h3 className="text-3xl font-bold mb-4">{stats.activeItems}</h3>
                        <button className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 opacity-60 hover:opacity-100 transition-opacity mx-auto">
                            Rincian <ChevronRight size={10} />
                        </button>
                    </div>
                    <div className="absolute -bottom-4 -right-4 opacity-10 transform rotate-12 group-hover:scale-110 transition-transform duration-500">
                        <Package size={100} />
                    </div>
                </div>
            </div>

            {/* Bottom Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
                
                {/* Movement Chart */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Pergerakan Stok Keluar</h3>
                        <div className="flex gap-2">
                            <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-600 rounded-full cursor-pointer">Harian</span>
                            <span className="text-xs font-bold px-3 py-1 text-slate-400 cursor-pointer">Bulanan</span>
                        </div>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#94a3b8'}} stroke="#e2e8f0" axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} stroke="#e2e8f0" axisLine={false} tickLine={false} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '8px 12px' }}
                                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Items List */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Item Terlaris (Outbound)</h3>
                        <span className="text-xs font-bold text-blue-500 cursor-pointer">Semua Produk</span>
                    </div>
                    
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span>Peringkat & Nama</span>
                        <span>Unit Terjual</span>
                    </div>

                    <div className="flex-1 overflow-auto space-y-4 pr-2">
                        {topItems.length === 0 ? (
                            <div className="text-center text-slate-400 italic mt-10">Belum ada data transaksi keluar.</div>
                        ) : (
                            topItems.map((item, index) => (
                                <div key={index} className="flex justify-between items-center group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md ${
                                            index === 0 ? 'bg-yellow-400' : 
                                            index === 1 ? 'bg-slate-400' : 
                                            index === 2 ? 'bg-orange-400' : 'bg-blue-100 text-blue-600'
                                        }`}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 transition-colors">{item.name}</div>
                                            <div className="text-[10px] text-slate-400">{item.code} • {item.category}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.qty.toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-400">Total Qty</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
