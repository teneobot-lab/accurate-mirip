
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Warehouse } from '../types';
import { Filter, Search, Calendar, RefreshCw, FileSpreadsheet, Edit3, Trash2, Loader2, ChevronDown, ChevronRight, Box, User, Hash } from 'lucide-react';
import * as XLSX from 'xlsx';
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
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
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
            console.error("Failed to load reports data", error);
            showToast("Gagal memuat data dari database", "error");
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
            tx.items.some(it => it.name?.toLowerCase().includes(lower) || it.code?.toLowerCase().includes(lower))
        );
    }, [transactions, searchQuery]);

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus transaksi ini? Stok akan otomatis disesuaikan kembali.")) return;
        try {
            await StorageService.deleteTransaction(id);
            showToast("Transaksi berhasil dihapus & stok dikoreksi", "success");
            refreshData();
        } catch (e: any) {
            showToast(e.message || "Gagal menghapus transaksi", "error");
        }
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expandedTx);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpandedTx(next);
    };

    const handleExport = () => {
        const data = filteredTransactions.flatMap(tx => tx.items.map(it => ({
            "Tanggal": tx.date,
            "No. Ref": tx.referenceNo,
            "Tipe": tx.type,
            "Gudang": warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || 'Default',
            "Partner": tx.partnerName || '-',
            "Item Code": it.code,
            "Item Name": it.name,
            "Qty": it.qty,
            "Unit": it.unit,
            "Catatan": it.note || tx.notes || '-'
        })));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Mutasi");
        XLSX.writeFile(wb, `Laporan_Mutasi_${startDate}_${endDate}.xlsx`);
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-950 p-4 gap-4 overflow-hidden transition-colors">
            {/* Header & Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rentang Tanggal</label>
                    <div className="flex items-center gap-2">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="report-input w-36" />
                        <span className="text-slate-300">s/d</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="report-input w-36" />
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gudang</label>
                    <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="report-input w-40">
                        <option value="ALL">Semua Gudang</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Transaksi</label>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className="report-input w-40">
                        <option value="ALL">Semua Jenis</option>
                        <option value="IN">Masuk (Inbound)</option>
                        <option value="OUT">Keluar (Outbound)</option>
                    </select>
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cari No. Bukti / Barang</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input type="text" placeholder="Ketik keyword..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="report-input w-full pl-10" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={refreshData} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition-colors"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
                    <button onClick={handleExport} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-500/20"><FileSpreadsheet size={16}/> EXPORT XLSX</button>
                </div>
            </div>

            {/* Transaction Grid */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1 scrollbar-thin">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="bg-[#fcfdfe] dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                            <tr>
                                <th className="p-4 w-10"></th>
                                <th className="p-4 w-32 border-b dark:border-slate-700">Tanggal</th>
                                <th className="p-4 w-44 border-b dark:border-slate-700">Nomor Bukti</th>
                                <th className="p-4 w-28 border-b dark:border-slate-700">Tipe</th>
                                <th className="p-4 border-b dark:border-slate-700">Warehouse / Partner</th>
                                <th className="p-4 w-24 text-right border-b dark:border-slate-700">Total Items</th>
                                <th className="p-4 w-32 text-center border-b dark:border-slate-700">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px] divide-y dark:divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={10} className="p-20 text-center">
                                        <Loader2 className="animate-spin text-blue-500 mx-auto mb-3" size={32} />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sinkronisasi Database...</p>
                                    </td>
                                </tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-20 text-center text-slate-400 italic font-bold">Tidak ada transaksi ditemukan</td>
                                </tr>
                            ) : filteredTransactions.map((tx) => (
                                <React.Fragment key={tx.id}>
                                    <tr className={`hover:bg-[#f1f5f9]/50 dark:hover:bg-slate-800/40 transition-colors ${expandedTx.has(tx.id) ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                        <td className="p-4 text-center">
                                            <button onClick={() => toggleExpand(tx.id)} className="p-1 hover:bg-blue-100 rounded transition-colors">
                                                {expandedTx.has(tx.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                            </button>
                                        </td>
                                        <td className="p-4 font-mono font-bold text-slate-500">{tx.date}</td>
                                        <td className="p-4 font-black text-slate-800 dark:text-slate-200">
                                            <div className="flex items-center gap-2"><Hash size={12} className="text-slate-300"/> {tx.referenceNo}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                                                tx.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                            }`}>{tx.type === 'IN' ? 'Barang Masuk' : 'Barang Keluar'}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <div className="font-bold flex items-center gap-1.5"><Box size={12} className="text-blue-500"/> {warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || 'Default WH'}</div>
                                                {tx.partnerName && <div className="text-[9px] font-bold text-slate-400 flex items-center gap-1.5 uppercase mt-0.5"><User size={10}/> {tx.partnerName}</div>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-black text-slate-500">{tx.items.length} Line</td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => onEditTransaction(tx)} className="p-2 text-blue-500 hover:bg-blue-100 rounded-xl transition-all" title="Edit Transaksi"><Edit3 size={15}/></button>
                                                <button onClick={() => handleDelete(tx.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-xl transition-all" title="Hapus Transaksi"><Trash2 size={15}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedTx.has(tx.id) && (
                                        <tr className="bg-slate-50/50 dark:bg-slate-900/50 animate-in fade-in slide-in-from-top-1">
                                            <td colSpan={7} className="p-0">
                                                <div className="px-16 py-4 space-y-2">
                                                    <div className="grid grid-cols-12 gap-4 text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2 border-b pb-1">
                                                        <div className="col-span-1">#</div>
                                                        <div className="col-span-2">Kode SKU</div>
                                                        <div className="col-span-5">Deskripsi Barang</div>
                                                        <div className="col-span-2 text-right">Kuantitas</div>
                                                        <div className="col-span-2">Satuan</div>
                                                    </div>
                                                    {tx.items.map((it, idx) => (
                                                        <div key={idx} className="grid grid-cols-12 gap-4 text-[10px] items-center py-1">
                                                            <div className="col-span-1 text-slate-300 font-mono">{idx + 1}</div>
                                                            <div className="col-span-2 font-mono text-blue-600 font-bold">{it.code}</div>
                                                            <div className="col-span-5 font-bold text-slate-600 dark:text-slate-300 uppercase">{it.name}</div>
                                                            <div className="col-span-2 text-right font-black text-slate-800 dark:text-white">{it.qty.toLocaleString()}</div>
                                                            <div className="col-span-2 font-bold text-slate-400">{it.unit}</div>
                                                        </div>
                                                    ))}
                                                    {tx.notes && <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-xl border italic text-[10px] text-slate-500">Note: {tx.notes}</div>}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <style>{`
                .report-input { @apply border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-2.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm; }
                .group:hover .opacity-0 { opacity: 1 !important; }
            `}</style>
        </div>
    );
};
