
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Warehouse } from '../types';
import { Filter, Search, Calendar, RefreshCw, FileSpreadsheet, Edit3, Trash2, Loader2, ChevronDown, ChevronRight, Box, User, Hash, Terminal } from 'lucide-react';
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

    // --- FITUR BARU: COPY CURL UNTUK MANUAL DELETE DI SERVER ---
    const handleCopyCurl = (id: string) => {
        // Perintah ini bisa dijalankan user di terminal VPS jika tombol delete UI gagal (502)
        const cmd = `curl -v -X DELETE http://localhost:3000/api/transactions/${id}`;
        navigator.clipboard.writeText(cmd).then(() => {
            showToast("Perintah CURL disalin! Jalankan di Terminal Server.", "info");
        }).catch(() => {
            showToast("Gagal menyalin perintah", "error");
        });
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
        <div className="flex flex-col h-full bg-daintree p-2 gap-2 overflow-hidden font-sans">
            {/* Header & Filter Bar - Dense Layout */}
            <div className="bg-gable p-2 rounded-lg border border-spectra flex flex-wrap gap-3 items-end shadow-sm">
                <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-cutty uppercase tracking-widest ml-1">Periode</span>
                    <div className="flex items-center gap-1">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-daintree border border-spectra rounded px-2 py-1 text-[10px] text-white outline-none focus:border-white transition-colors" />
                        <span className="text-cutty font-bold text-[10px]">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-daintree border border-spectra rounded px-2 py-1 text-[10px] text-white outline-none focus:border-white transition-colors" />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-cutty uppercase tracking-widest ml-1">Filter</span>
                    <div className="flex gap-1">
                        <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="bg-daintree border border-spectra rounded px-2 py-1 text-[10px] text-white outline-none focus:border-white transition-colors w-32">
                            <option value="ALL">Semua Gudang</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-daintree border border-spectra rounded px-2 py-1 text-[10px] text-white outline-none focus:border-white transition-colors w-24">
                            <option value="ALL">Semua Tipe</option>
                            <option value="IN">Masuk</option>
                            <option value="OUT">Keluar</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-cutty uppercase tracking-widest ml-1">Pencarian</span>
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1.5 text-cutty"/>
                        <input type="text" placeholder="Cari No. Bukti / Barang..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-daintree border border-spectra rounded px-2 py-1 pl-7 text-[10px] text-white outline-none focus:border-white transition-colors placeholder:text-cutty" />
                    </div>
                </div>

                <div className="flex gap-1">
                    <button onClick={refreshData} className="p-1.5 bg-daintree border border-spectra rounded text-slate-400 hover:text-white transition-colors"><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''}/></button>
                    <button onClick={handleExport} className="px-3 py-1.5 bg-spectra text-white text-[10px] font-bold rounded flex items-center gap-1 hover:bg-white hover:text-spectra transition-colors"><FileSpreadsheet size={12}/> XLS</button>
                </div>
            </div>

            {/* Table - Dense Accurate Style */}
            <div className="flex-1 rounded-lg border border-spectra overflow-hidden flex flex-col bg-gable">
                <div className="overflow-auto flex-1 scrollbar-thin">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-daintree text-[9px] font-black text-cutty uppercase tracking-widest sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-2 w-8 text-center border-b border-r border-spectra">#</th>
                                <th className="p-2 w-20 border-b border-r border-spectra">Tanggal</th>
                                <th className="p-2 w-32 border-b border-r border-spectra">No. Bukti</th>
                                <th className="p-2 w-16 text-center border-b border-r border-spectra">Tipe</th>
                                <th className="p-2 border-b border-r border-spectra">Keterangan (Partner / Gudang)</th>
                                <th className="p-2 w-16 text-right border-b border-r border-spectra">Item</th>
                                <th className="p-2 w-28 text-center border-b border-spectra">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="text-[10px] text-slate-300">
                             {filteredTransactions.map((tx, idx) => (
                                 <React.Fragment key={tx.id}>
                                     <tr className={`hover:bg-spectra/10 border-b border-spectra/20 transition-colors ${expandedTx.has(tx.id) ? 'bg-spectra/5' : ''}`}>
                                        <td className="p-1 text-center border-r border-spectra/20">
                                            <button onClick={() => toggleExpand(tx.id)} className="text-cutty hover:text-white transition-colors"><ChevronDown size={12}/></button>
                                        </td>
                                        <td className="p-1 px-2 border-r border-spectra/20 font-mono text-emerald-500">{tx.date}</td>
                                        <td className="p-1 px-2 border-r border-spectra/20 font-bold text-white">{tx.referenceNo}</td>
                                        <td className="p-1 text-center border-r border-spectra/20">
                                             <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${tx.type === 'IN' ? 'text-emerald-400 bg-emerald-900/20' : 'text-red-400 bg-red-900/20'}`}>{tx.type}</span>
                                        </td>
                                        <td className="p-1 px-2 border-r border-spectra/20">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-200">{tx.partnerName || '-'}</span>
                                                <span className="text-cutty">@</span>
                                                <span className="text-[9px] text-cutty uppercase font-bold">{warehouses.find(w => w.id === tx.sourceWarehouseId)?.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-1 px-2 text-right border-r border-spectra/20 font-mono text-white font-bold">{tx.items.length}</td>
                                        <td className="p-1 text-center">
                                            <div className="flex justify-center gap-1">
                                                {/* TOMBOL COPY CURL */}
                                                <button onClick={() => handleCopyCurl(tx.id)} className="p-1 text-yellow-500 hover:bg-yellow-900/30 rounded transition-colors" title="Salin Perintah CURL Delete (Untuk Server)"><Terminal size={12}/></button>
                                                
                                                <button onClick={() => onEditTransaction(tx)} className="p-1 text-blue-400 hover:bg-blue-900/30 rounded transition-colors"><Edit3 size={12}/></button>
                                                <button onClick={() => handleDelete(tx.id)} className="p-1 text-red-400 hover:bg-red-900/30 rounded transition-colors"><Trash2 size={12}/></button>
                                            </div>
                                        </td>
                                     </tr>
                                     {expandedTx.has(tx.id) && (
                                         <tr className="bg-daintree/30 animate-in fade-in slide-in-from-top-1">
                                             <td colSpan={7} className="p-0 border-b border-spectra">
                                                 <div className="p-2">
                                                     <table className="w-full text-[10px] bg-black/20 border border-spectra/30">
                                                         <thead className="text-cutty uppercase bg-black/30 font-bold">
                                                             <tr><th className="p-1 pl-2">SKU</th><th className="p-1">Nama Barang</th><th className="p-1 text-right">Qty</th><th className="p-1 text-center">Unit</th><th className="p-1 text-right pr-2">Total Base</th></tr>
                                                         </thead>
                                                         <tbody>
                                                             {tx.items.map((it, i) => (
                                                                 <tr key={i} className="border-b border-spectra/10 last:border-0">
                                                                     <td className="p-1 pl-2 font-mono text-emerald-500">{it.code}</td>
                                                                     <td className="p-1 text-white">{it.name}</td>
                                                                     <td className="p-1 text-right font-bold">{it.qty.toLocaleString()}</td>
                                                                     <td className="p-1 text-center text-slate-400">{it.unit}</td>
                                                                     <td className="p-1 text-right pr-2 font-mono text-slate-500">{(it.qty * (it.ratio || 1)).toLocaleString()}</td>
                                                                 </tr>
                                                             ))}
                                                         </tbody>
                                                     </table>
                                                     {tx.notes && <div className="mt-1 px-2 text-[10px] text-slate-500 italic">Catatan: {tx.notes}</div>}
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
        </div>
    );
};
