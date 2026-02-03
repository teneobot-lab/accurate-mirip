
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Warehouse } from '../types';
import { Filter, Search, Calendar, RefreshCw, FileSpreadsheet, Edit3, Trash2, Loader2, ChevronDown, ChevronRight, Box, User, Hash, AlertTriangle } from 'lucide-react';
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
                StorageService.fetchTransactions(filters),
                StorageService.fetchWarehouses()
            ]);
            setTransactions(txs || []);
            setWarehouses(whs || []);
        } catch (error) {
            showToast("Gagal memuat data", "error");
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
        if (!confirm("Hapus transaksi ini secara permanen?")) return;
        setIsLoading(true);
        try {
            await StorageService.deleteTransaction(id);
            showToast("Berhasil dihapus", "success");
            refreshData();
        } catch (e: any) {
            showToast(e.message || "Gagal menghapus", "error");
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9] p-2 gap-2 overflow-hidden font-sans">
            {/* Filter Panel (Accurate Style) */}
            <div className="erp-card p-2 flex flex-wrap gap-4 items-end border-acc-border">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Periode</span>
                    <div className="flex items-center gap-1">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-28" />
                        <span className="text-slate-400 font-bold">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-28" />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Gudang</span>
                    <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="w-32">
                        <option value="ALL">SEMUA</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Tipe</span>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-32">
                        <option value="ALL">SEMUA</option>
                        <option value="IN">MASUK</option>
                        <option value="OUT">KELUAR</option>
                    </select>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Pencarian</span>
                    <input type="text" placeholder="No. Bukti / SKU..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full" />
                </div>
                <div className="flex gap-1">
                    <button onClick={refreshData} className="px-3 py-1 bg-white border border-acc-border hover:bg-slate-50 rounded text-slate-600"><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''}/></button>
                    <button onClick={() => {}} className="px-3 py-1 bg-acc-blue text-white rounded text-[11px] font-bold uppercase flex items-center gap-1"><FileSpreadsheet size={14}/> EXPORT</button>
                </div>
            </div>

            {/* Grid (Accurate Style - Super Dense) */}
            <div className="flex-1 erp-card overflow-hidden flex flex-col">
                <div className="erp-header">Daftar Transaksi Persediaan</div>
                <div className="overflow-auto flex-1 scrollbar-thin">
                    <table className="w-full dense-table border-collapse border-acc-border">
                        <thead className="sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="w-8"></th>
                                <th className="w-24">Tanggal</th>
                                <th className="w-40">No. Bukti</th>
                                <th className="w-20">Tipe</th>
                                <th>Partner / Gudang</th>
                                <th className="w-20 text-right">Items</th>
                                <th className="w-24 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white text-[12px]">
                            {filteredTransactions.map(tx => (
                                <React.Fragment key={tx.id}>
                                    <tr className="hover:bg-blue-50/50 group">
                                        <td className="text-center">
                                            <button onClick={() => {
                                                const next = new Set(expandedTx);
                                                if (next.has(tx.id)) next.delete(tx.id); else next.add(tx.id);
                                                setExpandedTx(next);
                                            }} className="text-slate-400">
                                                {expandedTx.has(tx.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                            </button>
                                        </td>
                                        <td className="font-mono text-slate-500">{tx.date}</td>
                                        <td className="font-bold text-acc-blue uppercase">{tx.referenceNo}</td>
                                        <td className="text-center">
                                            <span className={`px-1 rounded text-[10px] font-bold ${tx.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{tx.partnerName || '-'}</span>
                                                <span className="text-slate-400">@</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">{warehouses.find(w => w.id === tx.sourceWarehouseId)?.name}</span>
                                            </div>
                                        </td>
                                        <td className="text-right font-bold">{tx.items.length}</td>
                                        <td className="text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => onEditTransaction(tx)} className="text-slate-400 hover:text-acc-blue"><Edit3 size={14}/></button>
                                                <button onClick={() => handleDelete(tx.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedTx.has(tx.id) && (
                                        <tr className="bg-slate-50 shadow-inner">
                                            <td colSpan={7} className="p-4">
                                                <table className="w-full dense-table bg-white border-acc-border">
                                                    <thead>
                                                        <tr className="bg-slate-100">
                                                            <th className="w-8">#</th>
                                                            <th className="w-32">SKU</th>
                                                            <th>Nama Barang</th>
                                                            <th className="w-20 text-right">Qty</th>
                                                            <th className="w-20 text-center">Unit</th>
                                                            <th className="w-24 text-right">Total Dasar</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {tx.items.map((it, i) => (
                                                            <tr key={i}>
                                                                <td className="text-center text-slate-400">{i+1}</td>
                                                                <td className="font-mono text-slate-500">{it.code}</td>
                                                                <td className="font-bold">{it.name}</td>
                                                                <td className="text-right font-bold">{it.qty.toLocaleString()}</td>
                                                                <td className="text-center text-slate-500">{it.unit}</td>
                                                                <td className="text-right font-mono text-slate-400">{(it.qty * (it.ratio || 1)).toLocaleString()}</td>
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
