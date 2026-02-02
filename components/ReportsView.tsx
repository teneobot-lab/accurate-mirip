
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Item, Warehouse } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Filter, Search, Calendar, RefreshCw, ChevronDown, Package, User, Truck, FileSpreadsheet, FileText, X, TrendingDown, Edit3, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Props {
    onEditTransaction: (tx: Transaction) => void;
}

export const ReportsView: React.FC<Props> = ({ onEditTransaction }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [filterWh, setFilterWh] = useState('ALL');
    const [filterType, setFilterType] = useState('ALL');
    const [filterItem, setFilterItem] = useState('ALL');
    const [itemSearchQuery, setItemSearchQuery] = useState('');
    const [showItemSuggestions, setShowItemSuggestions] = useState(false);
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
            const [txs, its, whs] = await Promise.all([
                StorageService.fetchTransactions().catch(() => []),
                StorageService.fetchItems().catch(() => []),
                StorageService.fetchWarehouses().catch(() => [])
            ]);
            setTransactions(Array.isArray(txs) ? txs : []);
            setItems(Array.isArray(its) ? its : []);
            setWarehouses(Array.isArray(whs) ? whs : []);
        } catch (error) {
            console.error("Failed to load reports data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { refreshData(); }, []);

    const flattenedMutations = useMemo(() => {
        // DEFENSIVE: Ensure we have arrays
        const safeTxs = Array.isArray(transactions) ? transactions : [];
        const safeItems = Array.isArray(items) ? items : [];
        const safeWhs = Array.isArray(warehouses) ? warehouses : [];

        const mutations: any[] = [];
        const lowerSearch = searchQuery.toLowerCase().trim();
        
        safeTxs.forEach(tx => {
            if (!tx || !tx.date) return;
            if (tx.date < startDate || tx.date > endDate) return;
            if (filterType !== 'ALL' && tx.type !== filterType) return;
            
            const isMatchWh = filterWh === 'ALL' || tx.sourceWarehouseId === filterWh || tx.targetWarehouseId === filterWh;
            if (!isMatchWh) return;

            // Safe access to items line
            const txLines = Array.isArray(tx.items) ? tx.items : [];

            txLines.forEach(line => {
                if (filterItem !== 'ALL' && line.itemId !== filterItem) return;

                const itemDef = safeItems.find(i => i.id === line.itemId);
                const itemCode = itemDef?.code || '???';
                const itemName = itemDef?.name || 'Unknown Item';

                const searchMatch = !lowerSearch || 
                    tx.referenceNo.toLowerCase().includes(lowerSearch) || 
                    itemCode.toLowerCase().includes(lowerSearch) || 
                    itemName.toLowerCase().includes(lowerSearch);

                if (!searchMatch) return;

                const whSourceName = safeWhs.find(w => w.id === tx.sourceWarehouseId)?.name || 'Central';
                
                let inQty = 0;
                let outQty = 0;
                if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') inQty = line.qty;
                else outQty = line.qty;

                mutations.push({
                    txId: tx.id,
                    date: tx.date,
                    ref: tx.referenceNo,
                    type: tx.type,
                    wh: whSourceName,
                    itemCode,
                    itemName,
                    in: inQty,
                    out: outQty,
                    unit: line.unit,
                    party: tx.supplier || '-'
                });
            });
        });
        
        return mutations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, items, warehouses, startDate, endDate, filterWh, filterType, filterItem, searchQuery]);

    if (isLoading) return (
        <div className="h-full flex items-center justify-center text-slate-400 gap-3">
            <Loader2 className="animate-spin text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest">Memuat Laporan...</span>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 p-3 gap-3 overflow-hidden transition-colors">
            {/* Professional Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Periode</label>
                    <div className="flex items-center gap-1">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border dark:border-slate-700 dark:bg-slate-800 rounded p-1.5 text-xs outline-none" />
                        <span className="text-slate-400">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border dark:border-slate-700 dark:bg-slate-800 rounded p-1.5 text-xs outline-none" />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Warehouse</label>
                    <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="border dark:border-slate-700 dark:bg-slate-800 rounded p-1.5 text-xs outline-none w-32">
                        <option value="ALL">Semua WH</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Tipe</label>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border dark:border-slate-700 dark:bg-slate-800 rounded p-1.5 text-xs outline-none w-32">
                        <option value="ALL">Semua Tipe</option>
                        <option value="IN">Masuk</option>
                        <option value="OUT">Keluar</option>
                        <option value="TRANSFER">Transfer</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Pencarian Cepat</label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input type="text" placeholder="No. Ref / Nama Barang..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border dark:border-slate-700 dark:bg-slate-800 rounded text-xs outline-none" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={refreshData} className="p-2 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 transition-colors"><RefreshCw size={16}/></button>
                    <button onClick={() => XLSX.utils.book_new()} className="px-4 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold flex items-center gap-2"><FileSpreadsheet size={16}/> Excel</button>
                </div>
            </div>

            {/* Main Table Area */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b dark:border-slate-700 sticky top-0 z-10">
                            <tr>
                                <th className="p-2.5 w-24">Tanggal</th>
                                <th className="p-2.5 w-32">No. Ref</th>
                                <th className="p-2.5 w-20">Tipe</th>
                                <th className="p-2.5">Nama Barang</th>
                                <th className="p-2.5 w-24 text-right">Masuk</th>
                                <th className="p-2.5 w-24 text-right">Keluar</th>
                                <th className="p-2.5 w-16 text-center">Satuan</th>
                                <th className="p-2.5 w-32">Party</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px] divide-y dark:divide-slate-800">
                            {flattenedMutations.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-20 text-center text-slate-400 italic">
                                        Data tidak ditemukan untuk filter ini.
                                    </td>
                                </tr>
                            ) : flattenedMutations.map((m, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="p-2.5 font-mono text-slate-500">{m.date}</td>
                                    <td className="p-2.5 font-bold text-slate-700 dark:text-slate-200">{m.ref}</td>
                                    <td className="p-2.5">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                            m.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 
                                            m.type === 'OUT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                        }`}>{m.type}</span>
                                    </td>
                                    <td className="p-2.5">
                                        <div className="font-bold">{m.itemName}</div>
                                        <div className="text-[9px] text-slate-400 font-mono">{m.itemCode}</div>
                                    </td>
                                    <td className="p-2.5 text-right font-bold text-emerald-600 font-mono">{m.in || ''}</td>
                                    <td className="p-2.5 text-right font-bold text-red-600 font-mono">{m.out || ''}</td>
                                    <td className="p-2.5 text-center font-bold text-slate-400">{m.unit}</td>
                                    <td className="p-2.5 truncate max-w-[120px]" title={m.party}>{m.party}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
