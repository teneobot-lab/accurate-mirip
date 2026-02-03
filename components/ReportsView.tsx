
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
        <div className="flex flex-col h-full bg-daintree p-4 gap-4 overflow-hidden font-sans">
            {/* Header & Filter Bar */}
            <div className="bg-gable p-4 rounded-xl shadow-lg border border-spectra flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-cutty uppercase tracking-widest ml-1">Rentang Tanggal</label>
                    <div className="flex items-center gap-2 bg-daintree p-1 rounded-xl border border-spectra">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-white text-xs font-bold outline-none px-2 py-1 w-32" />
                        <span className="text-cutty font-bold text-xs">s/d</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-white text-xs font-bold outline-none px-2 py-1 w-32" />
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
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cutty group-focus-within:text-spectra transition-colors" size={14} />
                        <input type="text" placeholder="Ketik keyword..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="report-input w-full pl-10 focus:ring-1 focus:ring-spectra" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={refreshData} className="p-2.5 bg-daintree rounded-xl hover:bg-spectra/20 hover:text-white transition-colors shadow-sm text-cutty border border-spectra"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
                    <button onClick={handleExport} className="px-5 py-2.5 bg-spectra hover:bg-daintree text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-black/20 active:scale-95 transition-all border border-spectra/50"><FileSpreadsheet size={16}/> EXPORT XLSX</button>
                </div>
            </div>

            {/* Transaction Grid - Rounded Wrapper & Dense - THE BLUEPRINT */}
            <div className="flex-1 rounded-xl shadow-xl border border-spectra overflow-hidden flex flex-col bg-gable">
                <div className="overflow-auto flex-1 scrollbar-thin">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="bg-daintree text-[10px] font-black text-cutty uppercase tracking-widest sticky top-0 z-10 shadow-md">
                            <tr>
                                <th className="p-3 w-10 border-b border-spectra"></th>
                                <th className="px-4 py-2.5 w-32 border-b border-spectra">Tanggal</th>
                                <th className="px-4 py-2.5 w-44 border-b border-spectra">Nomor Bukti</th>
                                <th className="px-4 py-2.5 w-28 border-b border-spectra">Tipe</th>
                                <th className="px-4 py-2.5 border-b border-spectra">Warehouse / Partner</th>
                                <th className="px-4 py-2.5 w-24 text-right border-b border-spectra">Total Items</th>
                                <th className="px-4 py-2.5 w-36 text-center border-b border-spectra">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px] divide-y divide-spectra/20 text-slate-300">
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
                                    <tr className={`group hover:bg-spectra/10 transition-colors ${expandedTx.has(tx.id) ? 'bg-spectra/5' : ''}`}>
                                        <td className="p-2 text-center">
                                            <button onClick={() => toggleExpand(tx.id)} className="p-1 hover:bg-daintree rounded-lg transition-colors text-cutty">
                                                {expandedTx.has(tx.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2.5 font-mono font-bold text-emerald-500 tracking-tight">{tx.date}</td>
                                        <td className="px-4 py-2.5 font-black text-slate-200">
                                            <div className="flex items-center gap-2"><Hash size={12} className="text-cutty"/> {tx.referenceNo}</div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight border ${
                                                tx.type === 'IN' ? 'bg-emerald-900/10 text-emerald-400 border-emerald-900/30' : 'bg-red-900/10 text-red-400 border-red-900/30'
                                            }`}>{tx.type === 'IN' ? 'Barang Masuk' : 'Barang Keluar'}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex flex-col">
                                                <div className="font-bold flex items-center gap-1.5 text-slate-200"><Box size={12} className="text-cutty"/> {warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || 'Default WH'}</div>
                                                {tx.partnerName && <div className="text-[9px] font-bold text-cutty flex items-center gap-1.5 uppercase mt-0.5"><User size={10}/> {tx.partnerName}</div>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-black text-white">{tx.items.length}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => onEditTransaction(tx)} className="p-1.5 text-slate-400 hover:text-white hover:bg-spectra rounded-lg transition-colors" title="Edit"><Edit3 size={14}/></button>
                                                <button onClick={() => handleDelete(tx.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors" title="Hapus"><Trash2 size={14}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedTx.has(tx.id) && (
                                        <tr className="bg-daintree/30 animate-in fade-in slide-in-from-top-1">
                                            <td colSpan={7} className="p-0 border-b border-spectra/50">
                                                <div className="px-10 py-4">
                                                    {/* Nested Table Wrapper - EXACT MATCH with Main Table Wrapper */}
                                                    <div className="rounded-xl border border-spectra overflow-hidden bg-gable shadow-inner">
                                                        <table className="w-full text-left border-separate border-spacing-0">
                                                            {/* Match Header: bg-daintree text-[10px] font-black text-cutty uppercase tracking-widest */}
                                                            <thead className="bg-daintree text-[10px] font-black text-cutty uppercase tracking-widest">
                                                                <tr>
                                                                    {/* Match TH: px-4 py-2.5 border-b border-spectra */}
                                                                    <th className="px-4 py-2.5 border-b border-spectra w-10 text-center">#</th>
                                                                    <th className="px-4 py-2.5 border-b border-spectra">Kode SKU</th>
                                                                    <th className="px-4 py-2.5 border-b border-spectra">Deskripsi Barang</th>
                                                                    <th className="px-4 py-2.5 border-b border-spectra text-right">Kuantitas</th>
                                                                    <th className="px-4 py-2.5 border-b border-spectra text-center">Satuan</th>
                                                                    <th className="px-4 py-2.5 border-b border-spectra text-right">Total Base</th>
                                                                </tr>
                                                            </thead>
                                                            {/* Match Body: text-[11px] divide-y divide-spectra/20 text-slate-300 */}
                                                            <tbody className="text-[11px] divide-y divide-spectra/20 text-slate-300">
                                                                {tx.items.map((it, idx) => (
                                                                    <tr key={idx} className="hover:bg-spectra/10 transition-colors">
                                                                        {/* Match TD: px-4 py-2.5 */}
                                                                        <td className="px-4 py-2.5 text-center text-cutty font-mono">{idx + 1}</td>
                                                                        <td className="px-4 py-2.5 font-mono text-emerald-500 font-bold">{it.code}</td>
                                                                        <td className="px-4 py-2.5 font-bold text-slate-200 uppercase">{it.name}</td>
                                                                        <td className="px-4 py-2.5 text-right font-black text-white">{it.qty.toLocaleString()}</td>
                                                                        <td className="px-4 py-2.5 text-center font-bold text-cutty">{it.unit}</td>
                                                                        <td className="px-4 py-2.5 text-right font-black text-cutty">{(it.qty * (it.ratio || 1)).toLocaleString()}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        {tx.notes && (
                                                            // Match padding px-4 py-2.5
                                                            <div className="px-4 py-2.5 border-t border-spectra bg-daintree/20 flex gap-2 text-[11px]">
                                                                <span className="font-black uppercase text-cutty">Catatan:</span>
                                                                <span className="text-slate-400 italic">{tx.notes}</span>
                                                            </div>
                                                        )}
                                                    </div>
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
                    @apply border border-spectra bg-daintree text-white rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-spectra focus:bg-gable transition-all shadow-inner placeholder:text-cutty appearance-none; 
                }
            `}</style>
        </div>
    );
};
