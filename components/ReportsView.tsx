
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Warehouse, TransactionType } from '../types';
import { Plus, Edit3, Trash2, RefreshCw, Printer, Search, Calendar, ChevronDown, X, Info, FileSpreadsheet, ArrowDown, ArrowUp, CheckCircle2 } from 'lucide-react';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';

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

    const handleEdit = () => {
        const tx = transactions.find(t => t.id === selectedTxId);
        if (tx) onEditTransaction(tx);
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
            className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-mist-300 transition-colors disabled:opacity-30 ${active ? 'bg-mist-200' : 'hover:bg-mist-100'} ${color}`}
        >
            <Icon size={14} />
            <span className="text-[11px] font-bold uppercase tracking-tight">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-mist-50 font-sans overflow-hidden relative">
            {/* COMPACT TOOLBAR - STICKY TOP */}
            <div className="sticky top-0 h-10 border-b border-mist-300 bg-white flex items-center justify-between px-2 shrink-0 z-30 shadow-sm">
                <div className="flex items-center h-full">
                    <div className="relative h-full flex items-center">
                        <ToolBtn icon={Plus} label="Baru" onClick={() => setShowNewDropdown(!showNewDropdown)} active={showNewDropdown} customRef={newButtonRef} color="text-emerald-600" />
                        {showNewDropdown && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-mist-300 shadow-xl z-[100] w-40 rounded-lg overflow-hidden py-1 animate-in fade-in slide-in-from-top-1">
                                <button onClick={()=>{onCreateTransaction('IN'); setShowNewDropdown(false);}} className="w-full text-left px-3 py-1.5 hover:bg-mist-50 text-[11px] font-semibold text-emerald-600 flex items-center gap-2"><ArrowDown size={12}/> Penerimaan (IN)</button>
                                <button onClick={()=>{onCreateTransaction('OUT'); setShowNewDropdown(false);}} className="w-full text-left px-3 py-1.5 hover:bg-mist-50 text-[11px] font-semibold text-rose-600 flex items-center gap-2"><ArrowUp size={12}/> Pengiriman (OUT)</button>
                            </div>
                        )}
                    </div>
                    <div className="hidden md:flex h-full items-center">
                        <ToolBtn icon={Edit3} label="Ubah" onClick={handleEdit} disabled={!selectedTxId} color="text-blue-600" />
                        <ToolBtn icon={Trash2} label="Hapus" onClick={handleDelete} disabled={!selectedTxId} color="text-rose-600" />
                    </div>
                    <ToolBtn icon={RefreshCw} label="Segarkan" onClick={refreshData} />
                    <ToolBtn icon={FileSpreadsheet} label="Excel" onClick={handleExportExcel} color="text-emerald-600" />
                </div>
                
                <div className="flex items-center gap-2 px-2 h-full">
                    <div className="flex items-center gap-2 bg-white border border-mist-300 rounded px-2 py-0.5">
                        <Calendar size={12} className="text-slate-400" />
                        <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="text-[10px] font-bold outline-none border-none bg-transparent w-24" />
                        <span className="text-slate-300">/</span>
                        <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="text-[10px] font-bold outline-none border-none bg-transparent w-24" />
                    </div>
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Cari Ref..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="pl-7 pr-3 py-1 bg-white border border-mist-300 rounded text-[10px] font-bold outline-none w-32 focus:border-blue-400" />
                    </div>
                </div>
            </div>

            {/* DENSE DATA GRID */}
            <div className="flex-1 overflow-auto bg-mist-50 pb-20"> 
                <table className="w-full border-collapse table-fixed text-left min-w-[800px]">
                    {/* SILVER MIST HEADER - STICKY (Below Toolbar) */}
                    <thead className="bg-mist-300 sticky top-0 z-20 shadow-[0_2px_4px_rgba(0,0,0,0.05)] border-b border-mist-300">
                        <tr className="h-7">
                            <th className="px-3 py-1 text-[10px] font-extrabold text-slate-700 uppercase w-[15%] tracking-tight">Referensi</th>
                            <th className="px-3 py-1 text-[10px] font-extrabold text-slate-700 uppercase w-[12%] tracking-tight">Tanggal</th>
                            <th className="px-3 py-1 text-[10px] font-extrabold text-slate-700 uppercase w-[8%] text-center tracking-tight">Tipe</th>
                            <th className="px-3 py-1 text-[10px] font-extrabold text-slate-700 uppercase w-[35%] tracking-tight">Partner / Keterangan</th>
                            <th className="px-3 py-1 text-[10px] font-extrabold text-slate-700 uppercase w-[20%] tracking-tight">Gudang</th>
                            <th className="px-3 py-1 text-[10px] font-extrabold text-slate-700 uppercase w-[10%] text-center tracking-tight">Items</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-mist-50 bg-white">
                        {filteredTransactions.map(tx => {
                            const isSelected = selectedTxId === tx.id;
                            return (
                                <tr 
                                    key={tx.id} 
                                    onClick={() => setSelectedTxId(isSelected ? null : tx.id)}
                                    className={`h-7 cursor-pointer transition-all group ${
                                        isSelected 
                                        ? 'bg-blue-600 text-white shadow-inner' 
                                        : 'hover:bg-mist-100 text-slate-700'
                                    }`}
                                >
                                    <td className={`px-3 py-0.5 text-[10px] font-mono truncate ${isSelected ? 'text-blue-100' : 'text-slate-600 group-hover:text-blue-600'}`}>
                                        {tx.referenceNo}
                                    </td>
                                    <td className={`px-3 py-0.5 text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                        {tx.date}
                                    </td>
                                    <td className="px-3 py-0.5 text-center">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${
                                            isSelected 
                                            ? 'bg-white/20 text-white border-white/20' 
                                            : (tx.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100')
                                        }`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className={`px-3 py-0.5 text-[10px] font-medium truncate ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                                        {tx.partnerName || tx.notes || '-'}
                                    </td>
                                    <td className={`px-3 py-0.5 text-[9px] font-bold uppercase truncate ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                        {warehouses.find(w=>w.id===tx.sourceWarehouseId)?.name || '-'}
                                    </td>
                                    <td className={`px-3 py-0.5 text-center text-[10px] font-bold font-mono ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                        {tx.items.length}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredTransactions.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-slate-400 italic text-xs flex flex-col items-center justify-center gap-2">
                                    <Info size={16} className="opacity-50"/>
                                    Tidak ada data transaksi ditemukan
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* FLOATING ACTION BAR (DYNAMIC ISLAND) */}
            {selectedTxId && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <div className="flex items-center gap-1.5 p-1.5 bg-slate-800/95 text-white rounded-full shadow-2xl backdrop-blur-md border border-slate-700/50">
                        <div className="px-4 py-1.5 text-xs font-bold border-r border-slate-600/50 flex items-center gap-2 text-slate-200">
                            <CheckCircle2 size={14} className="text-emerald-400 fill-emerald-400/20"/>
                            1 Terpilih
                        </div>
                        
                        <button 
                            onClick={handleEdit}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-xs font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95 group"
                        >
                            <Edit3 size={14} className="group-hover:-translate-y-0.5 transition-transform"/> 
                            Ubah
                        </button>
                        
                        <button 
                            onClick={handleDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-full text-xs font-bold transition-all shadow-lg shadow-rose-900/20 active:scale-95 group"
                        >
                            <Trash2 size={14} className="group-hover:-translate-y-0.5 transition-transform"/> 
                            Hapus
                        </button>

                        <button 
                            onClick={() => setSelectedTxId(null)}
                            className="p-2 hover:bg-slate-700/80 rounded-full text-slate-400 hover:text-white transition-all ml-1"
                            title="Batal Pilih"
                        >
                            <X size={16}/>
                        </button>
                    </div>
                </div>
            )}

            {/* STATUS BAR */}
            <div className="h-6 bg-mist-100 border-t border-mist-300 flex items-center justify-between px-3 text-[10px] font-semibold text-slate-400 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Info size={10}/> Total: {filteredTransactions.length} Transaksi</span>
                    <span className="uppercase tracking-widest text-[8px] opacity-60">Database: MySQL Local</span>
                </div>
                <div className="italic">GudangPro Management System v2.1</div>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cdcfdb; border-radius: 10px; }
            `}</style>
        </div>
    );
};
