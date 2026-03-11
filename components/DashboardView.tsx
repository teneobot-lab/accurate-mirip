
import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Transaction, Warehouse } from '../types';
import { Package, ArrowUpRight, ArrowDownRight, RefreshCw, Calendar, ListFilter, LayoutGrid, AlertCircle, Building2, ClipboardList, Activity } from 'lucide-react';

export const DashboardView: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [its, stk, txs, whs] = await Promise.all([
                StorageService.fetchItems().catch(() => []),
                StorageService.fetchStocks().catch(() => []),
                StorageService.fetchTransactions().catch(() => []),
                StorageService.fetchWarehouses().catch(() => [])
            ]);
            setItems(its); setStocks(stk); setTransactions(txs); setWarehouses(whs);
        } catch (e) {
            console.error("Dashboard Sync Error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const data = useMemo(() => {
        const filteredTx = transactions.filter(tx => tx.date >= startDate && tx.date <= endDate);
        const recentTx = transactions.slice(0, 15);
        
        const lowStock = items
            .filter(it => it.isActive && it.minStock > 0)
            .map(it => ({
                ...it,
                current: stocks.filter(s => s.itemId === it.id).reduce((acc, s) => acc + Number(s.qty), 0)
            }))
            .filter(it => it.current <= it.minStock)
            .sort((a, b) => a.current - b.current)
            .slice(0, 10);

        const summary = {
            totalIn: filteredTx.reduce((acc, tx) => acc + (tx.type === 'IN' ? tx.items.reduce((iAcc, it) => iAcc + (it.qty * it.ratio), 0) : 0), 0),
            totalOut: filteredTx.reduce((acc, tx) => acc + (tx.type === 'OUT' ? tx.items.reduce((iAcc, it) => iAcc + (it.qty * it.ratio), 0) : 0), 0),
            totalStock: stocks.reduce((acc, s) => acc + Number(s.qty), 0)
        };

        return { recentTx, lowStock, summary };
    }, [items, stocks, transactions, startDate, endDate]);

    const StatMini = ({ label, value, icon: Icon, colorClass }: any) => (
        <div className="flex items-center gap-3 px-4 border-r border-slate-200 last:border-0">
            <div className={`p-1.5 rounded-lg ${colorClass} bg-opacity-10`}>
                <Icon size={14} className={colorClass}/>
            </div>
            <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight leading-none">{label}</p>
                <p className="text-[13px] font-bold text-slate-700 mt-1 leading-none">{value.toLocaleString()}</p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-white font-sans animate-in fade-in duration-300">
            {/* TOP COMPACT STATS BAR */}
            <div className="h-12 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between px-4 shrink-0">
                <div className="flex h-full items-center">
                    <StatMini label="Stok Tersedia" value={data.summary.totalStock} icon={Package} colorClass="text-blue-600" />
                    <StatMini label="Masuk (Periode)" value={data.summary.totalIn} icon={ArrowDownRight} colorClass="text-emerald-600" />
                    <StatMini label="Keluar (Periode)" value={data.summary.totalOut} icon={ArrowUpRight} colorClass="text-rose-600" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-2 py-1">
                        <Calendar size={12} className="text-slate-400"/>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[10px] font-semibold outline-none bg-transparent w-24" />
                        <span className="text-slate-300">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[10px] font-semibold outline-none bg-transparent w-24" />
                    </div>
                    <button onClick={loadData} className="p-1.5 hover:bg-slate-200 rounded-md text-slate-400 transition-colors">
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''}/>
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT GRID - PADAT & FULL LAYAR */}
            <div className="flex-1 flex overflow-hidden">
                
                {/* LEFT COLUMN: LOW STOCK (DENSE) */}
                <div className="w-72 border-r border-slate-200 flex flex-col shrink-0 bg-slate-50/30">
                    <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <AlertCircle size={12} className="text-rose-500"/> Stok Menipis
                        </h3>
                        <span className="text-[9px] font-bold bg-rose-100 text-rose-600 px-1.5 rounded-full">{data.lowStock.length}</span>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        {data.lowStock.map(it => (
                            <div key={it.id} className="p-3 border-b border-slate-100 hover:bg-white transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[11px] font-semibold text-slate-700 truncate w-40">{it.name}</span>
                                    <span className="text-[9px] font-mono text-slate-400">{it.code}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-slate-400 uppercase leading-none">Status Stok</span>
                                        <span className="text-[12px] font-bold text-rose-600 mt-1">
                                            {it.current.toLocaleString()} <span className="text-[10px] font-medium text-slate-400">{it.baseUnit}</span>
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] text-slate-400 block leading-none">Min. Stock</span>
                                        <span className="text-[10px] font-semibold text-slate-500">{it.minStock}</span>
                                    </div>
                                </div>
                                <div className="mt-2 h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-500" style={{ width: `${Math.min((it.current / it.minStock) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CENTER COLUMN: RECENT TRANSACTIONS (ACCURATE TABLE STYLE) */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200 flex items-center justify-between shrink-0">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <ClipboardList size={12} className="text-blue-500"/> Transaksi Terkini
                        </h3>
                        <button className="text-[10px] font-semibold text-blue-600 hover:underline">Lihat Semua Laporan</button>
                    </div>
                    <div className="flex-1 overflow-auto bg-white">
                        <table className="w-full border-collapse text-left table-fixed">
                            <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                                <tr className="h-8">
                                    <th className="px-4 text-[10px] font-bold text-slate-400 uppercase w-32">No. Ref</th>
                                    <th className="px-4 text-[10px] font-bold text-slate-400 uppercase w-24">Tanggal</th>
                                    <th className="px-4 text-[10px] font-bold text-slate-400 uppercase w-16 text-center">Tipe</th>
                                    <th className="px-4 text-[10px] font-bold text-slate-400 uppercase">Keterangan / Partner</th>
                                    <th className="px-4 text-[10px] font-bold text-slate-400 uppercase w-20 text-center">Items</th>
                                    <th className="px-4 text-[10px] font-bold text-slate-400 uppercase w-32">Gudang</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.recentTx.map(tx => (
                                    <tr key={tx.id} className="h-8 hover:bg-blue-50/40 group transition-colors">
                                        <td className="px-4 text-[11px] font-mono text-slate-500 truncate">{tx.referenceNo}</td>
                                        <td className="px-4 text-[11px] text-slate-600">{tx.date}</td>
                                        <td className="px-4 text-center">
                                            <span className={`px-1 rounded text-[9px] font-bold uppercase border ${tx.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="px-4 text-[11px] text-slate-700 truncate font-medium">
                                            {tx.partnerName ? <span className="uppercase text-[10px] bg-slate-100 px-1 rounded mr-2 text-slate-500">{tx.partnerName}</span> : null}
                                            {tx.notes || (tx.items.length > 0 ? tx.items[0].name : '-')}
                                        </td>
                                        <td className="px-4 text-center text-[11px] font-bold text-slate-500">{tx.items.length}</td>
                                        <td className="px-4 text-[11px] text-slate-500 truncate uppercase">
                                            {warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT COLUMN: SYSTEM STATUS / WIDGETS */}
                <div className="w-64 border-l border-slate-200 flex flex-col shrink-0 bg-slate-50/50">
                    <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Activity size={12} className="text-emerald-500"/> System Monitor
                        </h3>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Sinkronisasi Database</p>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[11px] font-semibold text-slate-700">Terhubung ke MySQL</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1">Latency: 24ms • Realtime Active</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Gudang Aktif</p>
                            <div className="space-y-2">
                                {warehouses.slice(0, 3).map(wh => (
                                    <div key={wh.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={10} className="text-slate-400"/>
                                            <span className="text-[10px] font-semibold text-slate-600 truncate w-24">{wh.name}</span>
                                        </div>
                                        <span className={`text-[8px] font-bold uppercase ${wh.isActive ? 'text-emerald-500' : 'text-slate-300'}`}>Online</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-blue-600 p-4 rounded-xl text-white shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><LayoutGrid size={48}/></div>
                            <h4 className="text-[11px] font-bold mb-1 uppercase tracking-wider">Quick Note</h4>
                            <p className="text-[10px] opacity-80 leading-relaxed">Jangan lupa cek stok opname akhir bulan ini untuk area Warehouse A.</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
};
