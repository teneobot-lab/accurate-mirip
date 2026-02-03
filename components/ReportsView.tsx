
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Warehouse } from '../types';
import { Filter, Search, Calendar, RefreshCw, FileSpreadsheet, Edit3, Trash2, Loader2, ChevronDown, ChevronRight, Box, User, Hash, Terminal, Copy } from 'lucide-react';
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

    // FITUR REQUEST: COPY CURL COMMAND
    const handleCopyCurl = (id: string) => {
        const curlCommand = `curl -v -X DELETE http://localhost:3000/api/transactions/${id}`;
        navigator.clipboard.writeText(curlCommand).then(() => {
            showToast("Perintah CURL disalin! Jalankan di terminal VPS.", "info");
        }).catch(() => {
            showToast("Gagal menyalin clipboard", "error");
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
            {/* Filter Bar (Compact) */}
            <div className="bg-gable p-2 rounded border border-spectra flex flex-wrap gap-2 items-end shadow-sm">
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-cutty uppercase tracking-widest ml-1">Periode</label>
                    <div className="flex items-center gap-1 bg-daintree p-1 rounded border border-spectra">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-white text-[10px] font-bold outline-none w-24" />
                        <span className="text-cutty font-bold text-[10px]">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-white text-[10px] font-bold outline-none w-24" />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-cutty uppercase tracking-widest ml-1">Gudang & Tipe</label>
                    <div className="flex gap-1">
                        <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="bg-daintree text-white text-[10px] font-bold outline-none p-1.5 rounded border border-spectra w-32">
                            <option value="ALL">Semua Gudang</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-daintree text-white text-[10px] font-bold outline-none p-1.5 rounded border border-spectra w-24">
                            <option value="ALL">Semua Tipe</option>
                            <option value="IN">Masuk</option>
                            <option value="OUT">Keluar</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-cutty uppercase tracking-widest ml-1">Pencarian</label>
                    <div className="flex items-center gap-2 bg-daintree px-2 py-1 rounded border border-spectra w-full">
                        <Search className="text-cutty" size={12} />
                        <input type="text" placeholder="Cari No. Bukti / Barang..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent text-white text-[10px] font-bold outline-none w-full placeholder:text-cutty" />
                    </div>
                </div>

                <div className="flex gap-1">
                    <button onClick={refreshData} className="p-1.5 bg-daintree rounded hover:bg-spectra/20 text-cutty border border-spectra"><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''}/></button>
                    <button onClick={handleExport} className="px-3 py-1.5 bg-emerald-900/30 text-emerald-400 border border-emerald-900 rounded text-[10px] font-black flex items-center gap-1 hover:bg-emerald-900/50"><FileSpreadsheet size={12}/> EXPORT</button>
                </div>
            </div>

            {/* DENSE TABLE (Accurate Style) */}
            <div className="flex-1 bg-gable border border-spectra overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1 scrollbar-thin">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-daintree text-[9px] font-black text-cutty uppercase tracking-widest sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-1 w-8 text-center border-b border-r border-spectra">#</th>
                                <th className="p-1 w-24 border-b border-r border-spectra">Tanggal</th>
                                <th className="p-1 w-36 border-b border-r border-spectra">No. Bukti</th>
                                <th className="p-1 w-16 text-center border-b border-r border-spectra">Tipe</th>
                                <th className="p-1 border-b border-r border-spectra">Keterangan (Partner / Gudang)</th>
                                <th className="p-1 w-16 text-right border-b border-r border-spectra">Item</th>
                                <th className="p-1 w-32 text-center border-b border-spectra">Aksi (Server/App)</th>
                            </tr>
                        </thead>
                        <tbody className="text-[10px] text-slate-300 bg-gable">
                            {filteredTransactions.map((tx, idx) => (
                                <React.Fragment key={tx.id}>
                                    <tr className={`hover:bg-spectra/10 transition-colors group border-b border-spectra/20 ${expandedTx.has(tx.id) ? 'bg-spectra/5' : ''}`}>
                                        <td className="p-1 text-center border-r border-spectra/20">
                                            <button onClick={() => toggleExpand(tx.id)} className="text-cutty hover:text-white">
                                                {expandedTx.has(tx.id) ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                                            </button>
                                        </td>
                                        <td className="p-1 border-r border-spectra/20 font-mono text-emerald-500">{tx.date}</td>
                                        <td className="p-1 border-r border-spectra/20 font-bold text-white">{tx.referenceNo}</td>
                                        <td className="p-1 text-center border-r border-spectra/20">
                                            <span className={`px-1 rounded text-[9px] font-black ${tx.type === 'IN' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="p-1 border-r border-spectra/20">
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold text-slate-200">{tx.partnerName || '-'}</span>
                                                <span className="text-cutty">@</span>
                                                <span className="text-cutty uppercase font-bold">{warehouses.find(w => w.id === tx.sourceWarehouseId)?.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-1 text-right font-bold text-white border-r border-spectra/20">{tx.items.length}</td>
                                        <td className="p-1 text-center">
                                            <div className="flex justify-center gap-1">
                                                {/* TOMBOL COPY CURL */}
                                                <button 
                                                    onClick={() => handleCopyCurl(tx.id)} 
                                                    className="p-1 bg-slate-800 text-yellow-400 border border-slate-600 rounded hover:bg-yellow-400 hover:text-black transition-colors"
                                                    title="Salin Perintah CURL Delete (Untuk VPS)"
                                                >
                                                    <Terminal size={10} />
                                                </button>
                                                
                                                <button onClick={() => onEditTransaction(tx)} className="p-1 text-blue-400 hover:bg-blue-900/30 rounded"><Edit3 size={10}/></button>
                                                
                                                {/* TOMBOL DELETE BIASA */}
                                                <button onClick={() => handleDelete(tx.id)} className="p-1 text-red-400 hover:bg-red-900/30 rounded"><Trash2 size={10}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedTx.has(tx.id) && (
                                        <tr className="bg-daintree/30">
                                            <td colSpan={7} className="p-2 border-b border-spectra">
                                                <table className="w-full text-left bg-black/20 border border-spectra/30">
                                                    <thead className="bg-black/30 text-[9px] text-cutty uppercase">
                                                        <tr>
                                                            <th className="p-1 pl-2">SKU</th>
                                                            <th className="p-1">Nama Barang</th>
                                                            <th className="p-1 text-right">Qty</th>
                                                            <th className="p-1 text-center">Unit</th>
                                                            <th className="p-1 text-right pr-2">Total Base</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-[10px] text-slate-400">
                                                        {tx.items.map((it, i) => (
                                                            <tr key={i} className="border-b border-spectra/10 last:border-0">
                                                                <td className="p-1 pl-2 font-mono text-emerald-600">{it.code}</td>
                                                                <td className="p-1 text-white">{it.name}</td>
                                                                <td className="p-1 text-right font-bold">{it.qty}</td>
                                                                <td className="p-1 text-center">{it.unit}</td>
                                                                <td className="p-1 text-right pr-2 font-mono">{(it.qty * (it.ratio || 1))}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
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
