
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
        <div className="flex flex-col h-full bg-gradient-to-br from-cutty to-daintree p-4 gap-4 overflow-hidden transition-colors font-sans">
            {/* Header & Filter Bar */}
            <div className="bg-gable p-4 rounded-2xl shadow-xl border border-spectra flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-cutty uppercase tracking-widest ml-1">Rentang Tanggal</label>
                    <div className="flex items-center gap-2">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="report-input w-36" />
                        <span className="text-cutty font-bold">s/d</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="report-input w-36" />
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-cutty uppercase tracking-widest ml-1">Gudang</label>
                    <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="report-input w-40">
                        <option value="ALL">Semua Gudang</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-cutty uppercase tracking-widest ml-1">Jenis Transaksi</label>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className="report-input w-40">
                        <option value="ALL">Semua Jenis</option>
                        <option value="IN">Masuk (Inbound)</option>
                        <option value="OUT">Keluar (Outbound)</option>
                    </select>
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-cutty uppercase tracking-widest ml-1">Cari No. Bukti / Barang</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cutty" size={14} />
                        <input type="text" placeholder="Ketik keyword..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="report-input w-full pl-10" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={refreshData} className="p-2.5 bg-daintree rounded-xl hover:bg-spectra transition-colors shadow-sm text-cutty border border-transparent ring-1 ring-cutty/20"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
                    <button onClick={handleExport} className="px-5 py-2.5 bg-spectra hover:bg-daintree text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-black/20 active:scale-95 transition-all"><FileSpreadsheet size={16}/> EXPORT XLSX</button>
                </div>
            </div>

            {/* Transaction Grid */}
            <div className="flex-1 bg-gable rounded-2xl shadow-2xl border border-spectra overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1 scrollbar-thin">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="bg-daintree text-[10px] font-bold text-cutty uppercase tracking-widest sticky top-0 z-10 shadow-md">
                            <tr>
                                <th className="p-4 w-10 border-b border-spectra/50"></th>
                                <th className="p-4 w-32 border-b border-spectra/50">Tanggal</th>
                                <th className="p-4 w-44 border-b border-spectra/50">Nomor Bukti</th>
                                <th className="p-4 w-28 border-b border-spectra/50">Tipe</th>
                                <th className="p-4 border-b border-spectra/50">Warehouse / Partner</th>
                                <th className="p-4 w-24 text-right border-b border-spectra/50">Total Items</th>
                                <th className="p-4 w-36 text-center border-b border-spectra/50">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px] divide-y divide-spectra/30 text-slate-300">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={10} className="p-20 text-center">
                                        <Loader2 className="animate-spin text-spectra mx-auto mb-3" size={32} />
                                        <p className="text-[10px] font-black text-cutty uppercase tracking-widest">Sinkronisasi Database...</p>
                                    </td>
                                </tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-20 text-center text-cutty italic font-bold">Tidak ada transaksi ditemukan</td>
                                </tr>
                            ) : filteredTransactions.map((tx) => (
                                <React.Fragment key={tx.id}>
                                    <tr className={`group hover:bg-spectra/20 transition-all ${expandedTx.has(tx.id) ? 'bg-spectra/10' : ''}`}>
                                        <td className="p-4 text-center">
                                            <button onClick={() => toggleExpand(tx.id)} className="p-1.5 hover:bg-daintree rounded-lg transition-colors text-cutty">
                                                {expandedTx.has(tx.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                            </button>
                                        </td>
                                        {/* Tanggal - Warna mirip Export Button (Cutty/Greenish) */}
                                        <td className="p-4 font-mono font-bold text-emerald-500 tracking-tight">{tx.date}</td>
                                        
                                        <td className="p-4 font-black text-slate-300">
                                            <div className="flex items-center gap-2"><Hash size={12} className="text-cutty"/> {tx.referenceNo}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${
                                                tx.type === 'IN' ? 'bg-emerald-900/20 text-emerald-400' : 'bg-red-900/20 text-red-400'
                                            }`}>{tx.type === 'IN' ? 'Barang Masuk' : 'Barang Keluar'}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <div className="font-bold flex items-center gap-1.5 text-slate-300"><Box size={12} className="text-cutty"/> {warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || 'Default WH'}</div>
                                                {tx.partnerName && <div className="text-[9px] font-bold text-cutty flex items-center gap-1.5 uppercase mt-0.5"><User size={10}/> {tx.partnerName}</div>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-black text-emerald-500">{tx.items.length} Line</td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2.5">
                                                {/* Edit Button */}
                                                <button 
                                                    onClick={() => onEditTransaction(tx)} 
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-spectra/20 text-white hover:bg-spectra border border-spectra/50 rounded-xl transition-all shadow-sm active:scale-90"
                                                    title="Edit Transaksi"
                                                >
                                                    <Edit3 size={14}/>
                                                    <span className="text-[10px] font-black uppercase tracking-tighter">Edit</span>
                                                </button>
                                                
                                                {/* Delete Button */}
                                                <button 
                                                    onClick={() => handleDelete(tx.id)} 
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 text-red-400 hover:bg-red-900 border border-red-900/50 rounded-xl transition-all shadow-sm active:scale-90"
                                                    title="Hapus Transaksi"
                                                >
                                                    <Trash2 size={14}/>
                                                    <span className="text-[10px] font-black uppercase tracking-tighter">Hapus</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedTx.has(tx.id) && (
                                        <tr className="bg-daintree/40 animate-in fade-in slide-in-from-top-1">
                                            <td colSpan={7} className="p-0">
                                                <div className="px-16 py-6 space-y-3">
                                                    <div className="grid grid-cols-12 gap-4 text-[9px] font-black uppercase text-cutty tracking-wider mb-2 border-b border-spectra pb-2">
                                                        <div className="col-span-1">#</div>
                                                        <div className="col-span-2">Kode SKU</div>
                                                        <div className="col-span-3">Deskripsi Barang</div>
                                                        <div className="col-span-2 text-right">Kuantitas</div>
                                                        <div className="col-span-2 text-center">Satuan</div>
                                                        <div className="col-span-2 text-right">Total Base</div>
                                                    </div>
                                                    {tx.items.map((it, idx) => (
                                                        <div key={idx} className="grid grid-cols-12 gap-4 text-[10px] items-center py-1.5 hover:bg-gable rounded-lg px-2 -mx-2 transition-colors">
                                                            <div className="col-span-1 text-cutty font-mono">{idx + 1}</div>
                                                            <div className="col-span-2 font-mono text-emerald-500 font-bold">{it.code}</div>
                                                            <div className="col-span-3 font-bold text-slate-300 uppercase truncate">{it.name}</div>
                                                            <div className="col-span-2 text-right font-black text-white">{it.qty.toLocaleString()}</div>
                                                            <div className="col-span-2 text-center font-bold text-cutty">{it.unit}</div>
                                                            <div className="col-span-2 text-right font-black text-cutty">
                                                                {(it.qty * (it.ratio || 1)).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {tx.notes && (
                                                        <div className="mt-4 p-4 bg-gable rounded-2xl border border-spectra border-dashed italic text-[10px] text-cutty shadow-inner">
                                                            <div className="font-black not-italic uppercase mb-1 text-cutty tracking-widest text-[8px]">Memo Internal:</div>
                                                            {tx.notes}
                                                        </div>
                                                    )}
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
                .report-input { 
                    @apply border-none bg-daintree text-white rounded-xl px-4 py-2.5 text-[11px] font-bold outline-none ring-1 ring-cutty/30 focus:ring-2 focus:ring-spectra transition-all shadow-inner placeholder:text-cutty; 
                }
            `}</style>
        </div>
    );
};
