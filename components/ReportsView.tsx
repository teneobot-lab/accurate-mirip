
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Warehouse, TransactionType } from '../types';
import { Plus, Edit3, Trash2, RefreshCw, Printer, Search, Calendar, ChevronDown, X, Info, FileSpreadsheet, ArrowDown, ArrowUp } from 'lucide-react';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
    onEditTransaction: (tx: Transaction) => void;
    onCreateTransaction: (type: TransactionType) => void;
}

export const ReportsView: React.FC<Props> = ({ onEditTransaction, onCreateTransaction }) => {
    const { showToast } = useToast();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

    const [showNewDropdown, setShowNewDropdown] = useState(false);
    const newButtonRef = useRef<HTMLButtonElement>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterWhFrom, setFilterWhFrom] = useState('ALL');
    const [isFilterDateActive, setIsFilterDateActive] = useState(true);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const refreshData = async () => {
        setIsLoading(true);
        try {
            const filters = isFilterDateActive ? { start: startDate, end: endDate } : {};
            const [txs, whs] = await Promise.all([
                StorageService.fetchTransactions(filters).catch(() => []),
                StorageService.fetchWarehouses().catch(() => [])
            ]);
            setTransactions(txs);
            setWarehouses(whs);
        } catch (error) { showToast("Gagal memuat data", "error"); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { refreshData(); }, [startDate, endDate]);

    const filteredTransactions = useMemo(() => {
        const lower = searchQuery.toLowerCase().trim();
        return transactions.filter(tx => {
            const matchSearch = !lower || tx.referenceNo.toLowerCase().includes(lower) || (tx.partnerName && tx.partnerName.toLowerCase().includes(lower));
            const matchWhFrom = filterWhFrom === 'ALL' || tx.sourceWarehouseId === filterWhFrom;
            return matchSearch && matchWhFrom;
        });
    }, [transactions, searchQuery, filterWhFrom]);

    const handleDelete = async () => {
        if (!selectedTxId || !confirm('Hapus transaksi ini? Stok akan dikembalikan.')) return;
        try {
            await StorageService.deleteTransaction(selectedTxId);
            showToast('Transaksi dihapus', 'success');
            setSelectedTxId(null);
            refreshData();
        } catch (e: any) { showToast(e.message, 'error'); }
    };

    const handleExportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredTransactions.map(tx => ({
            'Ref': tx.referenceNo, 'Tgl': tx.date, 'Tipe': tx.type, 'Gudang': warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || '-', 'Partner': tx.partnerName || '-', 'Items': tx.items.length
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Mutasi");
        XLSX.writeFile(wb, `Mutasi_${startDate}.xlsx`);
    };

    const ToolBtn = ({ icon: Icon, label, onClick, disabled = false, color = "text-slate-600", active = false, customRef }: any) => (
        <button 
            ref={customRef} onClick={onClick} disabled={disabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-slate-200 transition-colors disabled:opacity-30 ${active ? 'bg-slate-100' : 'hover:bg-slate-50'} ${color}`}
        >
            <Icon size={14} />
            <span className="text-[11px] font-bold uppercase tracking-tight">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
            {/* COMPACT TOOLBAR */}
            <div className="h-10 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between px-2 shrink-0">
                <div className="flex items-center h-full">
                    <div className="relative h-full flex items-center">
                        <ToolBtn icon={Plus} label="Baru" onClick={() => setShowNewDropdown(!showNewDropdown)} active={showNewDropdown} customRef={newButtonRef} color="text-emerald-600" />
                        {showNewDropdown && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 shadow-xl z-[100] w-40 rounded-lg overflow-hidden py-1 animate-in fade-in slide-in-from-top-1">
                                <button onClick={()=>{onCreateTransaction('IN'); setShowNewDropdown(false);}} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-emerald-600 flex items-center gap-2"><ArrowDown size={12}/> Penerimaan (IN)</button>
                                <button onClick={()=>{onCreateTransaction('OUT'); setShowNewDropdown(false);}} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-rose-600 flex items-center gap-2"><ArrowUp size={12}/> Pengiriman (OUT)</button>
                            </div>
                        )}
                    </div>
                    <ToolBtn icon={Edit3} label="Ubah" onClick={() => { const tx = transactions.find(t=>t.id===selectedTxId); if(tx) onEditTransaction(tx); }} disabled={!selectedTxId} color="text-blue-600" />
                    <ToolBtn icon={Trash2} label="Hapus" onClick={handleDelete} disabled={!selectedTxId} color="text-rose-600" />
                    <ToolBtn icon={RefreshCw} label="Segarkan" onClick={refreshData} />
                    <ToolBtn icon={FileSpreadsheet} label="Excel" onClick={handleExportExcel} color="text-emerald-600" />
                </div>
                
                <div className="flex items-center gap-2 px-2 h-full">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2 py-0.5">
                        <Calendar size={12} className="text-slate-400" />
                        <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="text-[10px] font-bold outline-none border-none bg-transparent w-24" />
                        <span className="text-slate-300">/</span>
                        <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="text-[10px] font-bold outline-none border-none bg-transparent w-24" />
                    </div>
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Cari..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="pl-7 pr-3 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold outline-none w-32 focus:border-blue-400" />
                    </div>
                </div>
            </div>

            {/* DENSE DATA GRID */}
            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse table-fixed text-left">
                    <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                        <tr className="h-8">
                            <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-32">Referensi</th>
                            <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-24">Tanggal</th>
                            <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-16 text-center">Tipe</th>
                            <th className="px-3 text-[10px] font-bold text-slate-400 uppercase">Partner / Keterangan</th>
                            <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-32">Gudang</th>
                            <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-16 text-center">Items</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredTransactions.map(tx => (
                            <tr 
                                key={tx.id} onClick={()=>setSelectedTxId(tx.id)}
                                className={`h-7 cursor-default group transition-colors ${selectedTxId === tx.id ? 'bg-blue-50/80' : 'hover:bg-slate-50/50'}`}
                            >
                                <td className="px-3 text-[11px] font-mono text-slate-500 truncate">{tx.referenceNo}</td>
                                <td className="px-3 text-[11px] text-slate-600">{tx.date}</td>
                                <td className="px-3 text-center">
                                    <span className={`px-1 rounded text-[9px] font-bold border ${tx.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{tx.type}</span>
                                </td>
                                <td className="px-3 text-[11px] font-medium text-slate-700 truncate">{tx.partnerName || tx.notes || '-'}</td>
                                <td className="px-3 text-[11px] text-slate-500 uppercase truncate">{warehouses.find(w=>w.id===tx.sourceWarehouseId)?.name || '-'}</td>
                                <td className="px-3 text-center text-[11px] font-bold text-slate-400">{tx.items.length}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* STATUS BAR */}
            <div className="h-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-3 text-[10px] font-semibold text-slate-400 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Info size={10}/> Total: {filteredTransactions.length} Transaksi</span>
                    <span className="uppercase tracking-widest text-[8px] opacity-60">Database: MySQL Local</span>
                </div>
                <div className="italic">GudangPro Management System v2.1</div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
};
