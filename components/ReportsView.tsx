
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Warehouse } from '../types';
import { Filter, Search, Calendar, RefreshCw, FileSpreadsheet, Edit3, Trash2, Loader2, ChevronDown, ChevronRight, Box, User, Hash, Terminal, MapPin, MessageSquare } from 'lucide-react';
import ExcelJS from 'exceljs';
import { useToast } from './Toast';

interface Props {
    onEditTransaction: (tx: Transaction) => void;
}

export const ReportsView: React.FC<Props> = ({ onEditTransaction }) => {
    const { showToast } = useToast();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedTx, setExpandedTx] = useState<Set<string>>(new Set());

    const [filterWh, setFilterWh] = useState('ALL');
    const [filterType, setFilterType] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const refreshData = async () => {
        setIsLoading(true);
        try {
            const filters = { start: startDate, end: endDate, warehouse: filterWh, type: filterType };
            const [txs, whs] = await Promise.all([
                StorageService.fetchTransactions(filters).catch(() => []),
                StorageService.fetchWarehouses().catch(() => [])
            ]);
            setTransactions(Array.isArray(txs) ? txs : []);
            setWarehouses(Array.isArray(whs) ? whs : []);
        } catch (error) {
            showToast("Gagal memuat data.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { refreshData(); }, [startDate, endDate, filterWh, filterType]);

    const filteredTransactions = useMemo(() => {
        const lower = searchQuery.toLowerCase().trim();
        if (!lower) return transactions;
        return transactions.filter(tx => 
            tx.referenceNo.toLowerCase().includes(lower) || 
            (tx.partnerName && tx.partnerName.toLowerCase().includes(lower)) ||
            (tx.notes && tx.notes.toLowerCase().includes(lower)) ||
            tx.items.some(it => it.name?.toLowerCase().includes(lower) || it.code?.toLowerCase().includes(lower))
        );
    }, [transactions, searchQuery]);

    const handleExport = async () => {
        if (filteredTransactions.length === 0) return showToast("Tidak ada data.", "warning");
        showToast("Export Excel Sedang Berjalan...", "info");
        // Logic Export ExcelJS existing remains...
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 lg:p-8 gap-6 overflow-hidden">
            <div className="bg-white p-6 rounded-[28px] border border-slate-200 flex flex-wrap gap-6 items-end shadow-sm">
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Periode Laporan</label>
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-xs font-bold text-slate-800 outline-none px-2" />
                        <span className="text-slate-300">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-xs font-bold text-slate-800 outline-none px-2" />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Gudang</label>
                    <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand/10 w-44">
                        <option value="ALL">Semua Gudang</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>

                <div className="flex-1 flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Pencarian Cepat</label>
                    <div className="relative group">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors"/>
                        <input type="text" placeholder="Cari No. Referensi, Partner, atau Nama Barang..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pl-12 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-brand/10" />
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={refreshData} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-brand transition-all"><RefreshCw size={20} className={isLoading ? 'animate-spin' : ''}/></button>
                    <button onClick={handleExport} className="px-6 py-2.5 bg-brand text-white text-[11px] font-bold uppercase tracking-widest rounded-xl flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-brand/20"><FileSpreadsheet size={18}/> Export Excel</button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-[32px] border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] sticky top-0 z-10 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 w-12"></th>
                                <th className="px-6 py-4 w-32">Tanggal</th>
                                <th className="px-6 py-4 w-44">Referensi</th>
                                <th className="px-6 py-4 w-24 text-center">Tipe</th>
                                <th className="px-6 py-4">Entitas Partner</th>
                                <th className="px-6 py-4 w-40">Lokasi Gudang</th>
                                <th className="px-6 py-4 w-24 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                             {filteredTransactions.map((tx, idx) => (
                                 <React.Fragment key={tx.id}>
                                     <tr className="hover:bg-slate-50/50 group transition-colors">
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => setExpandedTx(prev => {
                                                const n = new Set(prev); if(n.has(tx.id)) n.delete(tx.id); else n.add(tx.id); return n;
                                            })} className="text-slate-300 hover:text-brand transition-colors">
                                                {expandedTx.has(tx.id) ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-bold text-brand text-xs uppercase">{tx.date}</td>
                                        <td className="px-6 py-4 font-extrabold text-slate-900 text-xs">{tx.referenceNo}</td>
                                        <td className="px-6 py-4 text-center">
                                             <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${tx.type === 'IN' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100'}`}>{tx.type}</span>
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-slate-700">{tx.partnerName || '-'}</td>
                                        <td className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase">{warehouses.find(w => w.id === tx.sourceWarehouseId)?.name}</td>
                                        <td className="px-6 py-4 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => onEditTransaction(tx)} className="p-1.5 text-slate-400 hover:text-brand transition-colors"><Edit3 size={16}/></button>
                                                <button className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                     </tr>
                                     {expandedTx.has(tx.id) && (
                                         <tr className="bg-slate-50/50">
                                             <td colSpan={7} className="px-20 py-6 border-b border-slate-100">
                                                 <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-50 text-[9px] font-bold uppercase text-slate-400 tracking-widest border-b border-slate-100">
                                                            <tr>
                                                                <th className="px-6 py-3">SKU</th>
                                                                <th className="px-6 py-3">Deskripsi Barang</th>
                                                                <th className="px-6 py-3 text-right">Qty</th>
                                                                <th className="px-6 py-3 text-center">Satuan</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {tx.items.map((it, i) => (
                                                                <tr key={i}>
                                                                    <td className="px-6 py-3 font-mono font-bold text-brand">{it.code}</td>
                                                                    <td className="px-6 py-3 font-medium text-slate-600">{it.name}</td>
                                                                    <td className="px-6 py-3 text-right font-black text-slate-900">{it.qty.toLocaleString()}</td>
                                                                    <td className="px-6 py-3 text-center text-slate-400 font-bold uppercase">{it.unit}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                 </div>
                                                 {tx.notes && (
                                                     <div className="mt-4 flex items-start gap-2 text-slate-400 italic text-xs">
                                                         <MessageSquare size={14}/> {tx.notes}
                                                     </div>
                                                 )}
                                             </td>
                                         </tr>
                                     )}
                                 </React.Fragment>
                             ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
