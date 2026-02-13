
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Item, RejectBatch, RejectItem, Stock } from '../types';
import { Trash2, Plus, CornerDownLeft, Loader2, History, MapPin, Search, Calendar, X, Eye, Save, Building, Database, Tag, Edit3, Equal, Info, Box, Share2, Ruler, LayoutGrid, AlertCircle, Copy, FileSpreadsheet, Download, Check, RefreshCw } from 'lucide-react';
import { useToast } from './Toast';
import ExcelJS from 'exceljs';
import { Decimal } from 'decimal.js';

// --- PERFORMANCE HOOK ---
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export const RejectView: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY' | 'MASTER_ITEMS' | 'MASTER'>('NEW');
    const [rejectMasterItems, setRejectMasterItems] = useState<Item[]>([]);
    const [outlets, setOutlets] = useState<string[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Master Item States
    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [itemForm, setItemForm] = useState<Partial<Item>>({ code: '', name: '', baseUnit: 'Pcs', conversions: [] });
    const [masterSearch, setMasterSearch] = useState('');
    const debouncedMasterSearch = useDebounce(masterSearch, 300);

    // Entry States
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedOutlet, setSelectedOutlet] = useState('');
    const [rejectLines, setRejectLines] = useState<RejectItem[]>([]);
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 300);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const [pendingItem, setPendingItem] = useState<Item | null>(null);
    const [pendingUnit, setPendingUnit] = useState('');
    const [pendingQty, setPendingQty] = useState<string>('');
    const [pendingReason, setPendingReason] = useState('');

    const itemInputRef = useRef<HTMLInputElement>(null);
    const qtyInputRef = useRef<HTMLInputElement>(null);
    const reasonInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // History & Export States
    const [batches, setBatches] = useState<RejectBatch[]>([]);
    const [viewingBatch, setViewingBatch] = useState<RejectBatch | null>(null);
    
    const [exportStart, setExportStart] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [exportEnd, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [rmits, ols, bts, stks] = await Promise.all([
                StorageService.fetchRejectMasterItems().catch(() => []),
                StorageService.fetchRejectOutlets().catch(() => []),
                StorageService.fetchRejectBatches().catch(() => []),
                StorageService.fetchStocks().catch(() => [])
            ]);
            setRejectMasterItems(rmits);
            setOutlets(ols);
            setBatches(bts);
            setStocks(stks);
            if (ols.length > 0 && !selectedOutlet) setSelectedOutlet(ols[0]);
        } catch (e) {
            showToast("Gagal memuat data", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && 
                itemInputRef.current && !itemInputRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- CONVERSION ENGINE ---
    const conversionResult = useMemo(() => {
        if (!pendingItem || !pendingQty || isNaN(Number(pendingQty))) return null;
        try {
            const qty = new Decimal(pendingQty);
            let ratio = new Decimal(1);
            if (pendingUnit !== pendingItem.baseUnit) {
                const conv = pendingItem.conversions?.find(c => c.name === pendingUnit);
                if (conv) {
                    const convRatio = new Decimal(conv.ratio);
                    ratio = conv.operator === '/' ? new Decimal(1).dividedBy(convRatio) : convRatio;
                } else {
                    return { error: 'Unit Invalid' };
                }
            }
            const baseQty = qty.times(ratio).toNumber();
            return { baseQty, unit: pendingItem.baseUnit };
        } catch (e) { return { error: 'Error' }; }
    }, [pendingItem, pendingQty, pendingUnit]);

    const filteredItems = useMemo(() => {
        if (!debouncedQuery || pendingItem) return [];
        const lower = debouncedQuery.toLowerCase();
        return rejectMasterItems.filter(it => 
            it.code.toLowerCase().includes(lower) || it.name.toLowerCase().includes(lower)
        ).slice(0, 8);
    }, [debouncedQuery, rejectMasterItems, pendingItem]);

    const selectItem = (item: Item) => {
        setPendingItem(item);
        setQuery(item.name);
        const savedUnit = localStorage.getItem(`reject_unit_pref_${item.id}`);
        setPendingUnit(savedUnit || item.baseUnit);
        setIsDropdownOpen(false);
        setTimeout(() => qtyInputRef.current?.focus(), 50);
    };

    const handleAddLine = () => {
        if (!pendingItem || !conversionResult || 'error' in conversionResult) return;
        if (conversionResult.baseQty <= 0) return showToast("Qty harus > 0", "warning");

        const newLine: RejectItem = {
            itemId: pendingItem.id,
            sku: pendingItem.code,
            name: pendingItem.name,
            qty: conversionResult.baseQty,
            unit: pendingItem.baseUnit,
            baseQty: conversionResult.baseQty,
            reason: `${pendingReason || ''} (${pendingQty} ${pendingUnit})` 
        };

        localStorage.setItem(`reject_unit_pref_${pendingItem.id}`, pendingUnit);
        setRejectLines([...rejectLines, newLine]);
        setQuery(''); setPendingItem(null); setPendingQty(''); setPendingReason(''); setPendingUnit('');
        setTimeout(() => itemInputRef.current?.focus(), 50);
    };

    const handleSaveBatch = async () => {
        if (!selectedOutlet) return showToast("Pilih outlet", "warning");
        if (rejectLines.length === 0) return showToast("Item kosong", "warning");
        try {
            await StorageService.saveRejectBatch({
                id: `REJ-${Date.now().toString().slice(-6)}`,
                date,
                outlet: selectedOutlet,
                createdAt: Date.now(),
                items: rejectLines
            });
            showToast("Data Reject Tersimpan", "success");
            setRejectLines([]); loadData();
        } catch (e) { showToast("Gagal simpan", "error"); }
    };

    const handleCopyToClipboard = (batch: RejectBatch) => {
        if (!batch.items || batch.items.length === 0) return;
        
        const d = new Date(batch.date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = String(d.getFullYear()).slice(-2);
        const formattedDate = `${day}${month}${year}`;

        let text = `Data Reject ${batch.outlet} ${formattedDate}\n`;
        
        batch.items.forEach((it) => {
            // EKSTRAKSI QTY & UNIT ASLI DARI FIELD REASON (disimpan di handleAddLine)
            const match = it.reason.match(/\(([^)]+)\)/);
            // match[1] berisi nilai input user seperti "39 grm" atau "9 prs"
            const originalInputText = match ? match[1].toLowerCase().trim() : `${it.qty} ${it.unit.toLowerCase()}`;
            
            // Ambil alasan murni (teks sebelum tanda kurung)
            const pureReason = it.reason.split('(')[0].trim().toLowerCase();
            const itemName = it.name.toLowerCase();
            
            // Format: - [nama] [qty unit asli] [alasan]
            const line = `- ${itemName} ${originalInputText} ${pureReason}`.replace(/\s+/g, ' ').trim();
            text += `${line}\n`;
        });

        navigator.clipboard.writeText(text.trim()).then(() => {
            showToast("Format laporan disalin (Lowercase & Unit Asli)", "success");
        }).catch(() => {
            showToast("Gagal menyalin data", "error");
        });
    };

    // --- ENTERPRISE EXPORT MATRIX ---
    const handleExportMatrix = async () => {
        const filteredBatches = batches.filter(b => b.date >= exportStart && b.date <= exportEnd);
        if (filteredBatches.length === 0) return showToast("Tidak ada data", "warning");

        try {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Matrix Reject');
            const dateList: string[] = [];
            let curr = new Date(exportStart);
            const end = new Date(exportEnd);
            while (curr <= end) { dateList.push(curr.toISOString().split('T')[0]); curr.setDate(curr.getDate() + 1); }

            const itemMap = new Map<string, any>();
            filteredBatches.forEach(batch => {
                batch.items.forEach(it => {
                    if (!itemMap.has(it.itemId)) itemMap.set(it.itemId, { code: it.sku, name: it.name, unit: it.unit, dateValues: new Map() });
                    const data = itemMap.get(it.itemId)!;
                    const currentVal = data.dateValues.get(batch.date) || new Decimal(0);
                    data.dateValues.set(batch.date, currentVal.plus(it.baseQty));
                });
            });

            sheet.addRow(['LAPORAN REJECT MINGGUAN', '', '', '', ...dateList.map(() => '')]);
            sheet.getRow(1).font = { bold: true, size: 14 };
            
            const headerRow = sheet.addRow(['NO', 'KODE', 'NAMA BARANG', 'SATUAN', ...dateList.map(d => `${d.split('-')[2]}/${d.split('-')[1]}`), 'TOTAL']);
            headerRow.font = { bold: true };
            headerRow.eachCell(c => c.border = { bottom: { style: 'thin' } });

            let rowIdx = 1;
            Array.from(itemMap.values()).forEach(item => {
                const row = [rowIdx++, item.code, item.name, item.unit];
                let total = new Decimal(0);
                dateList.forEach(d => {
                    const qty = item.dateValues.get(d) || new Decimal(0);
                    row.push(qty.toNumber() || null);
                    total = total.plus(qty);
                });
                row.push(total.toNumber() || null);
                sheet.addRow(row);
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Matrix_Reject_${exportStart}.xlsx`;
            a.click();
            showToast("Export Berhasil", "success");
        } catch (e) { showToast("Gagal Export", "error"); }
    };

    const handleSaveMasterItem = async () => {
        if (!itemForm.code || !itemForm.name) return showToast("Lengkapi data barang", "warning");
        try {
            await StorageService.saveRejectMasterItem({ ...itemForm, id: editingItem?.id || crypto.randomUUID() } as Item);
            showToast("Master Item Tersimpan", "success");
            setShowItemModal(false); loadData();
        } catch (e) { showToast("Gagal simpan", "error"); }
    };

    const filteredMasterItems = useMemo(() => {
        const lower = debouncedMasterSearch.toLowerCase();
        return rejectMasterItems.filter(i => i.name.toLowerCase().includes(lower) || i.code.toLowerCase().includes(lower));
    }, [debouncedMasterSearch, rejectMasterItems]);

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9] font-sans">
            
            {/* Header / Tabs - Compact */}
            <div className="px-4 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-20 shadow-sm shrink-0">
                <div className="flex gap-1">
                    {[
                        { id: 'NEW', label: 'Input Reject', icon: Plus },
                        { id: 'HISTORY', label: 'Riwayat', icon: History },
                        { id: 'MASTER_ITEMS', label: 'Katalog', icon: Database },
                        { id: 'MASTER', label: 'Outlet', icon: MapPin }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                                activeTab === tab.id 
                                ? 'bg-slate-800 text-white shadow-sm' 
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                            }`}
                        >
                            <tab.icon size={12}/> {tab.label}
                        </button>
                    ))}
                </div>
                {activeTab === 'NEW' && (
                    <div className="flex items-center gap-2">
                        <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-brand">
                            {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-brand" />
                        <button onClick={handleSaveBatch} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold shadow-sm transition-colors flex items-center gap-1.5">
                            <Save size={12}/> Simpan
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-hidden p-3 lg:p-4">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center text-slate-400 gap-2 text-xs font-medium">
                        <Loader2 className="animate-spin" size={16}/> Memuat data...
                    </div>
                ) : activeTab === 'NEW' ? (
                    <div className="h-full flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        {/* ULTRA DENSE TABLE */}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 sticky top-0 z-10 border-b border-slate-200 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-3 py-1.5 w-10 text-center">#</th>
                                        <th className="px-3 py-1.5">Barang & SKU</th>
                                        <th className="px-3 py-1.5 w-24 text-right">Qty Base</th>
                                        <th className="px-3 py-1.5 w-20 text-center">Satuan</th>
                                        <th className="px-3 py-1.5">Catatan / Alasan</th>
                                        <th className="px-3 py-1.5 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-[11px]">
                                    {rejectLines.map((line, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 group transition-colors h-8">
                                            <td className="px-3 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                                            <td className="px-3 truncate">
                                                <span className="font-bold text-slate-700">{line.name}</span>
                                                <span className="ml-2 text-[9px] text-slate-400 font-mono italic">{line.sku}</span>
                                            </td>
                                            <td className="px-3 text-right font-mono font-bold text-rose-600">{line.qty.toLocaleString()}</td>
                                            <td className="px-3 text-center"><span className="text-[9px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{line.unit}</span></td>
                                            <td className="px-3 text-slate-500 italic truncate">{line.reason}</td>
                                            <td className="px-3 text-center">
                                                <button onClick={() => setRejectLines(rejectLines.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    
                                    {/* Ultra Dense Inline Input Row */}
                                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                                        <td className="px-3 py-1 text-center"><Plus size={12} className="text-slate-400 mx-auto"/></td>
                                        <td className="p-1 relative">
                                            <input 
                                                ref={itemInputRef}
                                                type="text" placeholder="Cari Barang..." 
                                                value={query} 
                                                onChange={e => { setQuery(e.target.value); if(pendingItem) setPendingItem(null); setIsDropdownOpen(true); }}
                                                onKeyDown={e => {
                                                    if(e.key==='Enter' && filteredItems[selectedIndex]) selectItem(filteredItems[selectedIndex]);
                                                    if(e.key==='ArrowDown') { e.preventDefault(); setSelectedIndex(p => (p+1)%filteredItems.length); }
                                                    if(e.key==='ArrowUp') { e.preventDefault(); setSelectedIndex(p => (p-1+filteredItems.length)%filteredItems.length); }
                                                }} 
                                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px] font-bold outline-none focus:border-brand placeholder:text-slate-400"
                                            />
                                            {isDropdownOpen && filteredItems.length > 0 && (
                                                <div ref={dropdownRef} className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-48 overflow-auto">
                                                    {filteredItems.map((it, idx) => (
                                                        <div key={it.id} onMouseDown={() => selectItem(it)} onMouseEnter={()=>setSelectedIndex(idx)} className={`px-3 py-1.5 cursor-pointer text-[10px] flex justify-between items-center ${idx===selectedIndex ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                                                            <div>
                                                                <div className="font-bold text-slate-700">{it.name}</div>
                                                                <div className="text-[9px] text-slate-400 font-mono">{it.code}</div>
                                                            </div>
                                                            <div className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1 py-0.5 rounded">{it.baseUnit}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-1 relative">
                                            <input 
                                                ref={qtyInputRef}
                                                type="number" placeholder="0" 
                                                value={pendingQty} onChange={e => setPendingQty(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && reasonInputRef.current?.focus()}
                                                disabled={!pendingItem}
                                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-right text-[11px] font-black text-slate-800 outline-none focus:border-brand disabled:bg-slate-100"
                                            />
                                            {conversionResult && !('error' in conversionResult) && (
                                                <div className="absolute right-1 -top-2.5 text-[8px] font-black text-emerald-600 bg-white px-1 rounded border border-emerald-100 shadow-sm">
                                                    = {conversionResult.baseQty} {conversionResult.unit}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-1">
                                            <select 
                                                value={pendingUnit} onChange={e => setPendingUnit(e.target.value)}
                                                disabled={!pendingItem}
                                                className="w-full bg-white border border-slate-300 rounded px-1 py-1 text-center text-[10px] font-black text-slate-600 outline-none focus:border-brand disabled:bg-slate-100"
                                            >
                                                {pendingItem ? (
                                                    <>
                                                        <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>
                                                        {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                                    </>
                                                ) : <option>-</option>}
                                            </select>
                                        </td>
                                        <td className="p-1">
                                            <input 
                                                ref={reasonInputRef}
                                                type="text" placeholder="Catatan (Enter)..." 
                                                value={pendingReason} onChange={e => setPendingReason(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddLine()}
                                                disabled={!pendingItem}
                                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px] outline-none focus:border-brand disabled:bg-slate-100 italic text-slate-600"
                                            />
                                        </td>
                                        <td className="p-1 text-center">
                                            <button onClick={handleAddLine} disabled={!pendingItem} className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded shadow-sm disabled:opacity-50 transition-colors">
                                                <CornerDownLeft size={12}/>
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeTab === 'HISTORY' ? (
                    <div className="h-full flex flex-col gap-3">
                        <div className="bg-white p-2 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase">Periode</span>
                                    <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="bg-transparent text-[11px] font-bold text-slate-700 outline-none w-24"/>
                                    <span className="text-slate-300">-</span>
                                    <input type="date" value={exportEnd} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-[11px] font-bold text-slate-700 outline-none w-24"/>
                                </div>
                            </div>
                            <button onClick={handleExportMatrix} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors">
                                <FileSpreadsheet size={14}/> Matrix Export
                            </button>
                        </div>

                        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-auto shadow-sm">
                            <table className="w-full text-left text-[11px] border-collapse">
                                <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200 sticky top-0 uppercase tracking-tighter">
                                    <tr>
                                        <th className="px-3 py-2">ID Batch</th>
                                        <th className="px-3 py-2">Tanggal</th>
                                        <th className="px-3 py-2">Outlet</th>
                                        <th className="px-3 py-2 text-right">Items</th>
                                        <th className="px-3 py-2 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {batches.filter(b => b.date >= exportStart && b.date <= exportEnd).map(b => (
                                        <tr key={b.id} className="hover:bg-slate-50 transition-colors h-8">
                                            <td className="px-3 font-mono text-slate-500">{b.id}</td>
                                            <td className="px-3 font-bold text-slate-700">{b.date}</td>
                                            <td className="px-3 font-black text-slate-800 uppercase tracking-tight">{b.outlet}</td>
                                            <td className="px-3 text-right font-mono font-bold text-rose-600">{b.items.length}</td>
                                            <td className="px-3 text-center flex justify-center gap-1 py-1">
                                                <button onClick={() => setViewingBatch(b)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Detail"><Eye size={12}/></button>
                                                <button onClick={() => handleCopyToClipboard(b)} className="p-1 text-slate-600 hover:bg-slate-100 rounded" title="Copy (Format Laporan)"><Copy size={12}/></button>
                                                <button onClick={() => { if(confirm('Hapus?')) StorageService.deleteRejectBatch(b.id).then(loadData); }} className="p-1 text-rose-500 hover:bg-rose-50 rounded" title="Hapus"><Trash2 size={12}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeTab === 'MASTER_ITEMS' ? (
                    <div className="h-full flex flex-col gap-3">
                        <div className="bg-white p-2 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm shrink-0">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                <input type="text" placeholder="Cari SKU / Nama..." value={masterSearch} onChange={e => setMasterSearch(e.target.value)} className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold w-56 outline-none focus:border-brand transition-all" />
                            </div>
                            <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', baseUnit: 'Pcs', conversions: [] }); setShowItemModal(true); }} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 hover:bg-slate-700 transition-colors">
                                <Plus size={12}/> Barang Baru
                            </button>
                        </div>
                        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-auto shadow-sm">
                            <table className="w-full text-left text-[11px] border-collapse">
                                <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200 sticky top-0 uppercase">
                                    <tr>
                                        <th className="px-3 py-2">Kode SKU</th>
                                        <th className="px-3 py-2">Nama Produk</th>
                                        <th className="px-3 py-2 text-center">Unit</th>
                                        <th className="px-3 py-2 text-center">Multi-Unit</th>
                                        <th className="px-3 py-2 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredMasterItems.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors h-8">
                                            <td className="px-3 font-mono font-bold text-slate-600">{item.code}</td>
                                            <td className="px-3 font-black text-slate-800 truncate">{item.name}</td>
                                            <td className="px-3 text-center"><span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9px] font-black text-slate-600">{item.baseUnit}</span></td>
                                            <td className="px-3 text-center text-slate-500 text-[9px] italic">
                                                {item.conversions?.length ? item.conversions.map(c => c.name).join(', ') : '-'}
                                            </td>
                                            <td className="px-3 text-center flex justify-center gap-1 py-1">
                                                <button onClick={() => { setEditingItem(item); setItemForm({...item, conversions: item.conversions ? [...item.conversions] : []}); setShowItemModal(true); }} className="text-amber-500 hover:bg-amber-50 p-1 rounded"><Edit3 size={12}/></button>
                                                <button onClick={() => { if(confirm('Hapus?')) StorageService.deleteRejectMasterItem(item.id).then(loadData); }} className="text-rose-500 hover:bg-rose-50 p-1 rounded"><Trash2 size={12}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* MASTER OUTLET */
                    <div className="flex-1 max-w-lg mx-auto w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600"><MapPin size={20}/></div>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Daftar Outlet</h3>
                                <p className="text-[10px] text-slate-500">Lokasi sumber barang afkir</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Nama Outlet..." onKeyDown={e => {
                                if(e.key === 'Enter' && e.currentTarget.value) {
                                    StorageService.saveRejectOutlet(e.currentTarget.value).then(loadData);
                                    (e.target as HTMLInputElement).value = '';
                                }
                            }} className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-[11px] font-bold focus:border-brand" />
                            <button className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-[11px] shadow hover:bg-slate-700 transition-all">TAMBAH</button>
                        </div>
                        <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                            {outlets.map(o => (
                                <div key={o} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg flex justify-between items-center group hover:border-slate-300 transition-colors">
                                    <span className="text-[11px] font-black text-slate-700 uppercase">{o}</span>
                                    <button className="opacity-0 group-hover:opacity-100 text-rose-500 hover:bg-rose-50 p-1 rounded transition-all"><Trash2 size={12}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL MASTER ITEM - Compact */}
            {showItemModal && (
                <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
                         <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                             <div>
                                 <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight">{editingItem ? 'Edit Barang' : 'Barang Baru'}</h3>
                                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Katalog Barang Afkir</p>
                             </div>
                             <button onClick={()=>setShowItemModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200"><X size={18}/></button>
                         </div>
                         
                         <div className="p-4 overflow-y-auto space-y-4">
                             <div className="grid grid-cols-2 gap-3">
                                 <div className="space-y-0.5">
                                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kode SKU</label>
                                     <input type="text" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-[11px] font-mono font-bold uppercase outline-none focus:border-brand" value={itemForm.code} onChange={e=>setItemForm({...itemForm, code:e.target.value.toUpperCase()})} placeholder="SKU-001" />
                                 </div>
                                 <div className="space-y-0.5">
                                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit Dasar</label>
                                     <input type="text" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-[11px] font-black uppercase outline-none focus:border-brand" value={itemForm.baseUnit} onChange={e=>setItemForm({...itemForm, baseUnit:e.target.value.toUpperCase()})} placeholder="PCS" />
                                 </div>
                                 <div className="col-span-2 space-y-0.5">
                                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nama Barang</label>
                                     <input type="text" className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-[11px] font-black outline-none focus:border-brand" value={itemForm.name} onChange={e=>setItemForm({...itemForm, name:e.target.value})} placeholder="Nama Barang Lengkap" />
                                 </div>
                             </div>

                             <div className="space-y-2 pt-3 border-t border-slate-100">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Konversi Satuan</h4>
                                    <button 
                                        onClick={() => setItemForm({...itemForm, conversions: [...(itemForm.conversions || []), { name: '', ratio: 1, operator: '*' }]})} 
                                        className="text-[9px] font-black text-brand hover:underline"
                                    >+ TAMBAH UNIT</button>
                                </div>
                                
                                <div className="space-y-1.5">
                                    {(itemForm.conversions || []).map((c, i) => (
                                        <div key={i} className="flex gap-1.5 items-center bg-slate-50 p-1.5 rounded-md border border-slate-200">
                                            <input type="text" placeholder="BOX" className="w-16 px-1.5 py-1 border border-slate-300 rounded text-[10px] uppercase font-black outline-none" value={c.name} onChange={e => {
                                                const next = [...(itemForm.conversions || [])];
                                                next[i].name = e.target.value.toUpperCase();
                                                setItemForm({...itemForm, conversions: next});
                                            }} />
                                            <select className="px-1.5 py-1 border border-slate-300 rounded text-[9px] font-bold outline-none bg-white" value={c.operator} onChange={e => {
                                                const next = [...(itemForm.conversions || [])];
                                                next[i].operator = e.target.value as any;
                                                setItemForm({...itemForm, conversions: next});
                                            }}>
                                                <option value="*">x</option>
                                                <option value="/">/</option>
                                            </select>
                                            <input type="number" placeholder="Rasio" className="w-16 px-1.5 py-1 border border-slate-300 rounded text-[10px] font-mono font-bold outline-none text-right" value={c.ratio} onChange={e => {
                                                const next = [...(itemForm.conversions || [])];
                                                next[i].ratio = Number(e.target.value);
                                                setItemForm({...itemForm, conversions: next});
                                            }} />
                                            <span className="text-[9px] font-bold text-slate-400">{itemForm.baseUnit}</span>
                                            <button onClick={() => setItemForm({...itemForm, conversions: itemForm.conversions?.filter((_, idx) => idx !== i)})} className="ml-auto text-slate-400 hover:text-rose-500"><Trash2 size={12}/></button>
                                        </div>
                                    ))}
                                </div>
                             </div>
                         </div>

                         <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                             <button onClick={()=>setShowItemModal(false)} className="px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-200 rounded-md">Batal</button>
                             <button onClick={handleSaveMasterItem} className="px-5 py-1.5 bg-slate-800 text-white rounded-md text-[11px] font-black shadow-md hover:bg-slate-700 transition-all active:scale-95">
                                 SIMPAN
                             </button>
                         </div>
                    </div>
                </div>
            )}

            {/* DETAIL BATCH MODAL - Compact */}
            {viewingBatch && (
                <div className="fixed inset-0 bg-slate-900/30 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                     <div className="bg-white rounded-xl w-full max-w-xl border border-slate-200 overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                         <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                             <div>
                                 <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-tighter">Detail Batch Afkir</h3>
                                 <p className="text-[9px] font-mono text-slate-500 uppercase">{viewingBatch.id} • {viewingBatch.outlet}</p>
                             </div>
                             <div className="flex items-center gap-1.5">
                                <button 
                                    onClick={() => handleCopyToClipboard(viewingBatch)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded text-[9px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase"
                                >
                                    <Copy size={10}/> Copy Data
                                </button>
                                <button onClick={()=>setViewingBatch(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                             </div>
                         </div>
                         <div className="p-0 overflow-auto">
                            <table className="w-full text-[11px] text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-500 font-black border-b border-slate-200 sticky top-0 uppercase tracking-tighter">
                                    <tr>
                                        <th className="px-3 py-1.5 w-10 text-center">#</th>
                                        <th className="px-3 py-1.5">Nama Barang</th>
                                        <th className="px-3 py-1.5 w-20 text-right">Qty</th>
                                        <th className="px-3 py-1.5 w-16 text-center">Unit</th>
                                        <th className="px-3 py-1.5">Alasan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {viewingBatch.items.map((it,i)=>(
                                        <tr key={i} className="hover:bg-slate-50 h-7 transition-colors">
                                            <td className="px-3 text-center text-slate-400 font-mono text-[10px]">{i + 1}</td>
                                            <td className="px-3">
                                                <div className="font-black text-slate-700 truncate max-w-[150px]">{it.name}</div>
                                                <div className="text-[9px] text-slate-400 font-mono uppercase">{it.sku}</div>
                                            </td>
                                            <td className="text-right px-3 font-mono font-bold text-rose-600">{it.qty.toLocaleString()}</td>
                                            <td className="text-center px-3 font-black text-[9px] uppercase text-slate-500 tracking-tighter">{it.unit}</td>
                                            <td className="px-3 text-slate-500 italic text-[10px] truncate max-w-[150px]">{it.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                     </div>
                </div>
            )}
        </div>
    );
};

export default RejectView;
