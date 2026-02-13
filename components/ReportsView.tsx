
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Warehouse, TransactionType } from '../types';
import { Plus, Edit3, Trash2, Filter, RefreshCw, Printer, Search, Calendar, ChevronDown, ChevronRight, X, Info, LayoutGrid, FileSpreadsheet, Download, ArrowDown, ArrowUp, Building2 } from 'lucide-react';
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

    // UI States
    const [showNewDropdown, setShowNewDropdown] = useState(false);
    const newButtonRef = useRef<HTMLButtonElement>(null);

    // Filter States
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
            setTransactions(Array.isArray(txs) ? txs : []);
            setWarehouses(Array.isArray(whs) ? whs : []);
        } catch (error) {
            showToast("Gagal memuat data.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { refreshData(); }, [isFilterDateActive, startDate, endDate]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (newButtonRef.current && !newButtonRef.current.contains(event.target as Node)) {
                setShowNewDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredTransactions = useMemo(() => {
        const lower = searchQuery.toLowerCase().trim();
        return transactions.filter(tx => {
            const matchSearch = !lower || 
                tx.referenceNo.toLowerCase().includes(lower) || 
                (tx.notes && tx.notes.toLowerCase().includes(lower)) ||
                (tx.partnerName && tx.partnerName.toLowerCase().includes(lower)) ||
                tx.items.some(it => it.name?.toLowerCase().includes(lower));
            
            const matchWhFrom = filterWhFrom === 'ALL' || tx.sourceWarehouseId === filterWhFrom;
            
            return matchSearch && matchWhFrom;
        });
    }, [transactions, searchQuery, filterWhFrom]);

    // HANDLERS
    const handleDelete = async () => {
        if (!selectedTxId) return;
        if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini? Data stok akan dikembalikan.')) return;
        
        try {
            await StorageService.deleteTransaction(selectedTxId);
            showToast('Transaksi berhasil dihapus', 'success');
            setSelectedTxId(null);
            refreshData();
        } catch (e: any) {
            showToast(e.message || 'Gagal menghapus data', 'error');
        }
    };

    const handleExportExcel = () => {
        if (filteredTransactions.length === 0) return showToast('Tidak ada data untuk diexport', 'warning');
        
        const data = filteredTransactions.map(tx => ({
            'No. Referensi': tx.referenceNo,
            'Tanggal': tx.date,
            'Tipe': tx.type,
            'Gudang Asal': warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || '-',
            'Partner / Customer': tx.partnerName || '-',
            'Total Item': tx.items.length,
            'Keterangan': tx.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Laporan Mutasi");
        XLSX.writeFile(wb, `Mutasi_Stok_${startDate}_${endDate}.xlsx`);
        showToast('Export Excel Berhasil', 'success');
    };

    const handlePrint = () => {
        if (filteredTransactions.length === 0) return showToast('Tidak ada data untuk dicetak', 'warning');

        const doc = new jsPDF();
        
        doc.setFontSize(14);
        doc.text("Laporan Mutasi Stok", 14, 15);
        doc.setFontSize(10);
        doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 22);

        const tableBody = filteredTransactions.map(tx => [
            tx.referenceNo,
            tx.date,
            tx.type,
            warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || '-',
            tx.partnerName || '-',
            tx.items.length.toString(),
            tx.notes || ''
        ]);

        autoTable(doc, {
            head: [['No Ref', 'Tanggal', 'Tipe', 'Gudang', 'Partner', 'Items', 'Ket']],
            body: tableBody,
            startY: 30,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [51, 81, 87] }
        });

        doc.save(`Laporan_Mutasi_${new Date().getTime()}.pdf`);
        showToast('Dokumen PDF berhasil dibuat', 'success');
    };

    const ToolbarButton = ({ icon: Icon, label, onClick, disabled = false, color = "text-slate-700", active = false, customRef }: any) => (
        <button 
            ref={customRef}
            onClick={onClick} 
            disabled={disabled}
            className={`flex flex-col items-center justify-center px-3 py-1 border-r border-slate-300 transition-colors disabled:opacity-30 min-w-[50px] relative ${active ? 'bg-slate-300 shadow-inner' : 'hover:bg-slate-200'} ${color}`}
        >
            <Icon size={18} />
            <span className="text-[10px] font-bold mt-0.5">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-[#d4d0c8] select-none font-sans overflow-hidden">
            
            {/* 1. TOP TOOLBAR - INTEGRATED FILTERS */}
            <div className="flex bg-[#f0f0f0] border-b border-[#999] shadow-sm shrink-0 items-stretch h-14 overflow-x-auto">
                <div className="relative">
                    <ToolbarButton 
                        customRef={newButtonRef}
                        icon={Plus} 
                        label="Baru" 
                        onClick={() => setShowNewDropdown(!showNewDropdown)} 
                        color="text-green-700" 
                        active={showNewDropdown}
                    />
                    {showNewDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-[#999] shadow-xl z-[100] w-48 rounded-b">
                            <button onClick={() => { onCreateTransaction('IN'); setShowNewDropdown(false); }} className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-100">
                                <ArrowDown size={14} className="text-emerald-500"/> Penerimaan (IN)
                            </button>
                            <button onClick={() => { onCreateTransaction('OUT'); setShowNewDropdown(false); }} className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-slate-100 text-xs font-bold text-slate-700">
                                <ArrowUp size={14} className="text-red-500"/> Pengiriman (OUT)
                            </button>
                        </div>
                    )}
                </div>

                <ToolbarButton icon={Edit3} label="Ubah" onClick={() => {
                    const tx = transactions.find(t => t.id === selectedTxId);
                    if (tx) onEditTransaction(tx);
                }} disabled={!selectedTxId} color="text-blue-700" />
                
                <ToolbarButton icon={Trash2} label="Hapus" onClick={handleDelete} disabled={!selectedTxId} color="text-red-700" />
                
                <div className="w-px h-8 bg-slate-400 my-auto mx-1"></div>

                {/* INLINE FILTERS SECTION */}
                <div className="flex items-center px-4 gap-4 bg-slate-200/50 border-r border-slate-300">
                    {/* Gudang Filter */}
                    <div className="flex flex-col">
                        <label className="text-[9px] font-black text-slate-500 uppercase leading-none mb-1">Gudang</label>
                        <select 
                            value={filterWhFrom}
                            onChange={e => setFilterWhFrom(e.target.value)}
                            className="bg-white border border-[#999] px-1 py-0.5 text-[11px] font-bold outline-none h-6 min-w-[120px]"
                        >
                            <option value="ALL">Semua Gudang</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>

                    {/* Periode Filter */}
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                            <label className="text-[9px] font-black text-slate-500 uppercase leading-none mb-1">Dari Tanggal</label>
                            <div className="flex items-center bg-white border border-[#999] h-6 px-1">
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[11px] font-bold outline-none border-none bg-transparent w-24 h-full" />
                                <Calendar size={12} className="text-slate-400 ml-1" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[9px] font-black text-slate-500 uppercase leading-none mb-1">S/D Tanggal</label>
                            <div className="flex items-center bg-white border border-[#999] h-6 px-1">
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[11px] font-bold outline-none border-none bg-transparent w-24 h-full" />
                                <Calendar size={12} className="text-slate-400 ml-1" />
                            </div>
                        </div>
                    </div>
                </div>
                
                <ToolbarButton icon={RefreshCw} label="Perbarui" onClick={refreshData} />
                <ToolbarButton icon={Printer} label="Print" onClick={handlePrint} />
                <ToolbarButton icon={FileSpreadsheet} label="Excel" onClick={handleExportExcel} color="text-emerald-700"/>
                
                <div className="ml-auto flex items-center px-4">
                    <div className="flex items-center gap-2 bg-white border border-[#999] px-2 py-1 rounded shadow-inner">
                        <Search size={14} className="text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Cari No. Ref / Partner..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none text-[11px] font-bold outline-none w-48" 
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* 3. MAIN DATA GRID - FULL WIDTH */}
                <div className="flex-1 bg-white flex flex-col overflow-hidden relative shadow-inner">
                    <div className="overflow-auto flex-1 scroll-smooth">
                        <table className="w-full border-collapse table-fixed min-w-[900px]">
                            <thead className="bg-[#e1e1e1] sticky top-0 z-10 border-b border-[#999]">
                                <tr>
                                    <th className="px-2 py-1 text-left text-[10px] font-bold text-slate-700 border-r border-[#ccc] w-40 group cursor-pointer hover:bg-slate-200">
                                        No. Referensi <span className="text-yellow-500 ml-1">▼</span>
                                    </th>
                                    <th className="px-2 py-1 text-left text-[10px] font-bold text-slate-700 border-r border-[#ccc] w-24 group cursor-pointer hover:bg-slate-200">
                                        Tanggal
                                    </th>
                                    <th className="px-2 py-1 text-left text-[10px] font-bold text-slate-700 border-r border-[#ccc] w-20 group cursor-pointer hover:bg-slate-200">
                                        Tipe
                                    </th>
                                    <th className="px-2 py-1 text-left text-[10px] font-bold text-slate-700 border-r border-[#ccc] group cursor-pointer hover:bg-slate-200">
                                        Keterangan / Item Info
                                    </th>
                                    <th className="px-2 py-1 text-left text-[10px] font-bold text-slate-700 border-r border-[#ccc] w-48 group cursor-pointer hover:bg-slate-200">
                                        Partner / Customer
                                    </th>
                                    <th className="px-2 py-1 text-left text-[10px] font-bold text-slate-700 w-48 group cursor-pointer hover:bg-slate-200">
                                        Gudang
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#eee]">
                                {filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-20 text-center text-slate-400 italic text-xs uppercase tracking-widest bg-slate-50">Data Tidak Ditemukan</td>
                                    </tr>
                                ) : filteredTransactions.map((tx) => (
                                    <tr 
                                        key={tx.id} 
                                        onClick={() => setSelectedTxId(tx.id)}
                                        onDoubleClick={() => onEditTransaction(tx)}
                                        className={`h-7 cursor-default transition-colors ${
                                            selectedTxId === tx.id 
                                            ? 'bg-[#0055dd] text-white font-bold' 
                                            : 'hover:bg-[#e8f1ff] odd:bg-white even:bg-[#fafafa]'
                                        }`}
                                    >
                                        <td className="px-2 border-r border-[#eee] text-[11px] font-mono truncate">{tx.referenceNo}</td>
                                        <td className="px-2 border-r border-[#eee] text-[11px] truncate">
                                            {new Date(tx.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </td>
                                        <td className="px-2 border-r border-[#eee] text-[10px] truncate text-center">
                                            <span className={`px-1 rounded border ${tx.type === 'IN' ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-red-100 border-red-300 text-red-700'}`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="px-2 border-r border-[#eee] text-[11px] truncate">
                                            {tx.notes ? tx.notes : (tx.items.length > 0 ? `${tx.items[0].name} ${tx.items.length > 1 ? `(+${tx.items.length - 1} more)` : ''}` : '-')}
                                        </td>
                                        <td className="px-2 border-r border-[#eee] text-[11px] truncate font-bold opacity-80 uppercase">
                                            {tx.partnerName || '-'}
                                        </td>
                                        <td className="px-2 text-[11px] truncate font-bold opacity-80 uppercase">
                                            {warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || '-'}
                                        </td>
                                    </tr>
                                ))}
                                {/* FILLER ROWS */}
                                {[...Array(Math.max(0, 25 - filteredTransactions.length))].map((_, i) => (
                                    <tr key={`fill-${i}`} className="h-7 bg-white odd:bg-white even:bg-[#fafafa]">
                                        <td className="px-2 border-r border-[#eee]"></td>
                                        <td className="px-2 border-r border-[#eee]"></td>
                                        <td className="px-2 border-r border-[#eee]"></td>
                                        <td className="px-2 border-r border-[#eee]"></td>
                                        <td className="px-2 border-r border-[#eee]"></td>
                                        <td className="px-2"></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* STATUS BAR */}
                    <div className="bg-[#f0f0f0] border-t border-[#999] px-3 py-1 flex items-center justify-between text-[10px] font-bold text-slate-600 shrink-0">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1"><Info size={10}/> Total Baris: {filteredTransactions.length}</span>
                            <span>|</span>
                            <span className="text-emerald-600 uppercase">Mode Laporan Akurat</span>
                            <span>|</span>
                            <span>{isLoading ? 'Memuat data...' : 'Siap'}</span>
                        </div>
                        <div className="italic">GudangPro Management System</div>
                    </div>
                </div>
            </div>
            
            <style>{`
                /* Accurate Scrollbar Style */
                ::-webkit-scrollbar { width: 14px; height: 14px; }
                ::-webkit-scrollbar-track { background: #f0f0f0; border: 1px solid #ccc; }
                ::-webkit-scrollbar-thumb { background: #d4d0c8; border: 2px solid #f0f0f0; outline: 1px solid #999; }
                ::-webkit-scrollbar-thumb:hover { background: #c0c0c0; }
                
                /* Custom styling for compact date input */
                input[type="date"]::-webkit-calendar-picker-indicator {
                    cursor: pointer;
                    filter: invert(0.5);
                }
            `}</style>
        </div>
    );
};
