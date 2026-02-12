
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Warehouse } from '../types';
import { Plus, Edit3, Trash2, Filter, RefreshCw, Printer, Search, Calendar, ChevronDown, ChevronRight, X, Info, LayoutGrid, FileSpreadsheet } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
    onEditTransaction: (tx: Transaction) => void;
}

export const ReportsView: React.FC<Props> = ({ onEditTransaction }) => {
    const { showToast } = useToast();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [filterWhFrom, setFilterWhFrom] = useState('ALL');
    const [filterWhTo, setFilterWhTo] = useState('ALL');
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

    const filteredTransactions = useMemo(() => {
        const lower = searchQuery.toLowerCase().trim();
        return transactions.filter(tx => {
            const matchSearch = !lower || 
                tx.referenceNo.toLowerCase().includes(lower) || 
                (tx.notes && tx.notes.toLowerCase().includes(lower)) ||
                tx.items.some(it => it.name?.toLowerCase().includes(lower));
            
            const matchWhFrom = filterWhFrom === 'ALL' || tx.sourceWarehouseId === filterWhFrom;
            
            return matchSearch && matchWhFrom;
        });
    }, [transactions, searchQuery, filterWhFrom]);

    const ToolbarButton = ({ icon: Icon, label, onClick, disabled = false, color = "text-slate-700" }: any) => (
        <button 
            onClick={onClick} 
            disabled={disabled}
            className={`flex flex-col items-center justify-center px-3 py-1 border-r border-slate-300 hover:bg-slate-200 transition-colors disabled:opacity-30 ${color}`}
        >
            <Icon size={18} />
            <span className="text-[10px] font-bold mt-0.5">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-[#d4d0c8] select-none font-sans overflow-hidden">
            
            {/* 1. TOP TOOLBAR - CLASSIC VFP STYLE */}
            <div className="flex bg-[#f0f0f0] border-b border-[#999] shadow-sm shrink-0">
                <ToolbarButton icon={Plus} label="Baru" onClick={() => {}} color="text-green-700" />
                <ToolbarButton icon={Edit3} label="Ubah" onClick={() => {
                    const tx = transactions.find(t => t.id === selectedTxId);
                    if (tx) onEditTransaction(tx);
                }} disabled={!selectedTxId} color="text-blue-700" />
                <ToolbarButton icon={Trash2} label="Hapus" onClick={() => {}} disabled={!selectedTxId} color="text-red-700" />
                <div className="w-px h-10 bg-slate-300 my-auto"></div>
                <ToolbarButton icon={Filter} label="Filter" onClick={() => {}} />
                <ToolbarButton icon={RefreshCw} label="Perbarui" onClick={refreshData} />
                <ToolbarButton icon={Printer} label="Print" onClick={() => {}} />
                <div className="ml-auto flex items-center px-4">
                    <div className="flex items-center gap-2 bg-white border border-[#999] px-2 py-1 rounded shadow-inner">
                        <Search size={14} className="text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Live search..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none text-[11px] font-bold outline-none w-40" 
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                
                {/* 2. LEFT SIDEBAR FILTER - ACCURATE STYLE */}
                <aside className="w-56 bg-[#f0f0f0] border-r border-[#999] flex flex-col p-2 gap-4 shrink-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    <div className="bg-[#335157] text-white px-2 py-1 flex justify-between items-center text-[10px] font-black uppercase">
                        <span>Panel Filter</span>
                        <X size={12} className="cursor-pointer hover:scale-110" />
                    </div>

                    <div className="space-y-3">
                        {/* Cari Filter */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-600 uppercase">Cari:</label>
                            <input 
                                type="text" 
                                placeholder="<No. Transfer>" 
                                className="w-full bg-white border border-[#999] p-1.5 text-[11px] font-medium outline-none focus:border-blue-500" 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Gudang Asal */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-600 uppercase">Pindah dari:</label>
                            <select 
                                value={filterWhFrom}
                                onChange={e => setFilterWhFrom(e.target.value)}
                                className="w-full bg-white border border-[#999] p-1.5 text-[11px] font-bold outline-none"
                            >
                                <option value="ALL">&lt;Semua&gt;</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>

                        {/* Gudang Tujuan */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-600 uppercase">Pindah ke:</label>
                            <select 
                                value={filterWhTo}
                                onChange={e => setFilterWhTo(e.target.value)}
                                className="w-full bg-white border border-[#999] p-1.5 text-[11px] font-bold outline-none"
                            >
                                <option value="ALL">&lt;Semua&gt;</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>

                        {/* Filter Tanggal */}
                        <div className="pt-2 border-t border-[#ccc] space-y-2">
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="filterDate" 
                                    checked={isFilterDateActive}
                                    onChange={e => setIsFilterDateActive(e.target.checked)}
                                    className="accent-blue-600"
                                />
                                <label htmlFor="filterDate" className="text-[10px] font-black text-slate-700 uppercase">Filter Tanggal</label>
                            </div>
                            
                            <div className={`space-y-2 transition-opacity ${isFilterDateActive ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-bold text-slate-500 w-8">Dari</span>
                                    <div className="flex-1 flex items-center bg-white border border-[#999]">
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-1 text-[11px] font-bold outline-none border-none" />
                                        <Calendar size={12} className="mr-1 text-slate-400" />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-bold text-slate-500 w-8">s/d</span>
                                    <div className="flex-1 flex items-center bg-white border border-[#999]">
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-1 text-[11px] font-bold outline-none border-none" />
                                        <Calendar size={12} className="mr-1 text-slate-400" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto p-2 bg-slate-200 rounded border border-slate-300 text-center">
                        <div className="text-[14px] font-black text-slate-700">{filteredTransactions.length}</div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Total Transaksi</div>
                    </div>
                </aside>

                {/* 3. MAIN DATA GRID - ULTRA DENSE */}
                <div className="flex-1 bg-white flex flex-col overflow-hidden relative shadow-inner">
                    <div className="overflow-auto flex-1 scroll-smooth">
                        <table className="w-full border-collapse table-fixed min-w-[800px]">
                            <thead className="bg-[#e1e1e1] sticky top-0 z-10 border-b border-[#999]">
                                <tr>
                                    <th className="px-2 py-1 text-left text-[10px] font-bold text-slate-700 border-r border-[#ccc] w-48 group cursor-pointer hover:bg-slate-200">
                                        No. Transfer <span className="text-yellow-500 ml-1">▼</span>
                                    </th>
                                    <th className="px-2 py-1 text-left text-[10px] font-bold text-slate-700 border-r border-[#ccc] w-32 group cursor-pointer hover:bg-slate-200">
                                        Tanggal
                                    </th>
                                    <th className="px-2 py-1 text-left text-[10px] font-bold text-slate-700 border-r border-[#ccc] group cursor-pointer hover:bg-slate-200">
                                        Keterangan / Partner
                                    </th>
                                    <th className="px-2 py-1 text-left text-[10px] font-bold text-slate-700 border-r border-[#ccc] w-48 group cursor-pointer hover:bg-slate-200">
                                        Dari
                                    </th>
                                    <th className="px-2 py-1 text-left text-[10px] font-bold text-slate-700 w-48 group cursor-pointer hover:bg-slate-200">
                                        s/d
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#eee]">
                                {filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-20 text-center text-slate-400 italic text-xs uppercase tracking-widest bg-slate-50">Data Tidak Ditemukan</td>
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
                                        <td className="px-2 border-r border-[#eee] text-[11px] truncate">
                                            {tx.partnerName || tx.notes || '-'}
                                        </td>
                                        <td className="px-2 border-r border-[#eee] text-[11px] truncate font-bold opacity-80 uppercase">
                                            {warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || '-'}
                                        </td>
                                        <td className="px-2 text-[11px] truncate font-bold opacity-80 uppercase">
                                            {tx.partnerName || 'PENERIMA'}
                                        </td>
                                    </tr>
                                ))}
                                {/* FILLER ROWS TO MAINTAIN APPEARANCE */}
                                {[...Array(Math.max(0, 20 - filteredTransactions.length))].map((_, i) => (
                                    <tr key={`fill-${i}`} className="h-7 bg-white odd:bg-white even:bg-[#fafafa]">
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
                            <span className="text-blue-600">Enterprise Edition v5.1</span>
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
                
                input[type="date"]::-webkit-calendar-picker-indicator {
                    display: none;
                    -webkit-appearance: none;
                }
            `}</style>
        </div>
    );
};
