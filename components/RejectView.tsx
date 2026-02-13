
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Item, RejectBatch, RejectItem, Stock } from '../types';
import { Trash2, Plus, CornerDownLeft, Loader2, History, MapPin, Search, Calendar, X, Eye, Save, Database, Tag, Edit3, Info, Copy, FileSpreadsheet, Check, RefreshCw, ChevronRight, Filter } from 'lucide-react';
import { useToast } from './Toast';
import ExcelJS from 'exceljs';
import { Decimal } from 'decimal.js';
import { highlightMatch } from '../search/highlightMatch';

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
        if (!query || pendingItem) return [];
        const lower = query.toLowerCase();
        return rejectMasterItems.filter(it => 
            it.code.toLowerCase().includes(lower) || it.name.toLowerCase().includes(lower)
        ).slice(0, 10);
    }, [query, rejectMasterItems, pendingItem]);

    const filteredMasterItems = useMemo(() => {
        if (!debouncedMasterSearch) return rejectMasterItems;
        const lower = debouncedMasterSearch.toLowerCase();
        return rejectMasterItems.filter(it => 
            it.code.toLowerCase().includes(lower) || it.name.toLowerCase().includes(lower)
        );
    }, [debouncedMasterSearch, rejectMasterItems]);

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

    const handleSaveMasterItem = async () => {
        if (!itemForm.code || !itemForm.name || !itemForm.baseUnit) {
            return showToast("Kode, Nama, dan Satuan Dasar wajib diisi", "warning");
        }
        try {
            const payload = { ...itemForm, id: editingItem?.id || undefined } as Item;
            await StorageService.saveRejectMasterItem(payload);
            showToast(editingItem ? "Data barang diperbarui" : "Barang baru ditambahkan", "success");
            setShowItemModal(false);
            loadData();
        } catch (error: any) {
            showToast(error.message || "Gagal menyimpan data", "error");
        }
    };

    const handleCopyToClipboard = (batch: RejectBatch) => {
        if (!batch.items || batch.items.length === 0) return;
        const d = new Date(batch.date);
        const formattedDate = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`;
        let text = `Data Reject ${batch.outlet} ${formattedDate}\n`;
        batch.items.forEach((it) => {
            const match = it.reason.match(/\(([^)]+)\)/);
            const originalInputText = match ? match[1].toLowerCase().trim() : `${it.qty} ${it.unit.toLowerCase()}`;
            const pureReason = it.reason.split('(')[0].trim().toLowerCase();
            const itemName = it.name.toLowerCase();
            const line = `- ${itemName} ${originalInputText} ${pureReason}`.replace(/\s+/g, ' ').trim();
            text += `${line}\n`;
        });
        navigator.clipboard.writeText(text.trim()).then(() => showToast("Disalin ke clipboard", "success"));
    };

    const handleExportMatrix = async () => {
        // Filter data berdasarkan outlet dan periode
        const filteredBatches = batches.filter(b => 
            (selectedOutlet === 'ALL' || !selectedOutlet || b.outlet === selectedOutlet) &&
            b.date >= exportStart && b.date <= exportEnd
        );

        if (filteredBatches.length === 0) return showToast("Tidak ada data untuk periode ini", "warning");

        try {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Matrix Reject');
            
            // Generate List Tanggal
            const dateList: string[] = [];
            let curr = new Date(exportStart);
            const end = new Date(exportEnd);
            while (curr <= end) { 
                dateList.push(curr.toISOString().split('T')[0]); 
                curr.setDate(curr.getDate() + 1); 
            }

            // Agregasi Data Per Barang
            const itemMap = new Map<string, any>();
            filteredBatches.forEach(batch => {
                batch.items.forEach(it => {
                    if (!itemMap.has(it.itemId)) {
                        itemMap.set(it.itemId, { 
                            code: it.sku, 
                            name: it.name, 
                            unit: it.unit, 
                            dateValues: new Map() 
                        });
                    }
                    const data = itemMap.get(it.itemId)!;
                    const currentVal = data.dateValues.get(batch.date) || new Decimal(0);
                    data.dateValues.set(batch.date, currentVal.plus(it.baseQty));
                });
            });

            // 1. Title Row
            const titleRow = sheet.addRow(['LAPORAN REJECT MINGGUAN']);
            titleRow.font = { bold: true, size: 12, name: 'Arial' };
            titleRow.alignment = { horizontal: 'center' };
            sheet.mergeCells(1, 1, 1, 5 + dateList.length);

            // 2. Header Row
            const headers = [
                'NO', 'KODE', 'NAMA BARANG', 'SATUAN', 
                ...dateList.map(d => {
                    const dt = d.split('-');
                    return `${dt[2]}/${dt[1]}`;
                }), 
                'TOTAL'
            ];
            const headerRow = sheet.addRow(headers);
            
            // Apply Excel AutoFilter
            sheet.autoFilter = {
                from: { row: 2, column: 1 },
                to: { row: 2, column: headers.length }
            };
            
            // Styling Header (Warna Kuning & Underline Border ONLY)
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFF00' } // Kuning
                };
                cell.font = { bold: true, size: 10, name: 'Arial' };
                // REMOVE FULL BORDER, ONLY BOTTOM UNDERLINE
                cell.border = {
                    bottom: { style: 'medium' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });

            // 3. Data Rows
            let rowCounter = 1;
            const itemsArray = Array.from(itemMap.values()); // Convert to array for index check

            itemsArray.forEach((item, index) => {
                const rowData = [rowCounter++, item.code, item.name, item.unit];
                let total = new Decimal(0);
                
                dateList.forEach(d => {
                    const qty = item.dateValues.get(d) || new Decimal(0);
                    rowData.push(qty.equals(0) ? null : qty.toNumber());
                    total = total.plus(qty);
                });
                
                rowData.push(total.toNumber() || null);
                const row = sheet.addRow(rowData);

                const isLastRow = index === itemsArray.length - 1;

                // Styling Sel Data
                row.eachCell((cell, colNumber) => {
                    // BORDER LOGIC: Only bottom border on the last row
                    if (isLastRow) {
                        cell.border = {
                            bottom: { style: 'medium' }
                        };
                    } else {
                        cell.border = {}; // Clear borders for standard rows
                    }

                    cell.font = { name: 'Arial', size: 10 };
                    
                    if (colNumber === 1) cell.alignment = { horizontal: 'center' };
                    if (colNumber > 4) {
                        cell.alignment = { horizontal: 'right' };
                        cell.numFmt = '#,##0.0'; 
                        
                        // Style Kolom Total
                        if (colNumber === rowData.length) {
                            cell.font = { bold: true, name: 'Arial', size: 10 };
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFF9F9F9' } // Sedikit abu-abu untuk total
                            };
                        }
                    }
                });
            });

            // Auto Column Width
            sheet.columns.forEach((col, idx) => {
                if (idx === 0) col.width = 5;
                else if (idx === 1) col.width = 15;
                else if (idx === 2) col.width = 35;
                else if (idx === 3) col.width = 10;
                else col.width = 8;
            });

            // 4. Filename Logic (Format: Laporan Reject Mingguan [Outlet] [DD MMM] - [DD MMM] [YYYY])
            const monthNames = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
            const formatD = (dStr: string) => {
                const d = new Date(dStr);
                return `${String(d.getDate()).padStart(2, '0')} ${monthNames[d.getMonth()]}`;
            };
            
            const startF = formatD(exportStart);
            const endF = formatD(exportEnd);
            const yearF = new Date(exportEnd).getFullYear();
            
            let outletName = 'SEMUA OUTLET';
            if (selectedOutlet && selectedOutlet !== 'ALL') {
                outletName = selectedOutlet.toUpperCase();
            }
            
            const fileName = `Laporan Reject Mingguan ${outletName} ${startF} - ${endF} ${yearF}.xlsx`;

            // Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            showToast("Laporan Berhasil Diekspor", "success");
        } catch (e) { 
            console.error(e);
            showToast("Gagal Export", "error"); 
        }
    };

    return (
        <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
            {/* COMPACT TOOLBAR */}
            <div className="h-10 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between px-2 shrink-0">
                <div className="flex items-center h-full">
                    {[
                        { id: 'NEW', label: 'Input', icon: Plus },
                        { id: 'HISTORY', label: 'Riwayat', icon: History },
                        { id: 'MASTER_ITEMS', label: 'Katalog', icon: Database },
                        { id: 'MASTER', label: 'Outlet', icon: MapPin }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-1.5 px-3 h-full border-r border-slate-200 transition-colors ${
                                activeTab === tab.id 
                                ? 'bg-white text-blue-600 shadow-[0_-2px_0_inset_currentColor]' 
                                : 'text-slate-500 hover:bg-white/50'
                            }`}
                        >
                            <tab.icon size={13}/>
                            <span className="text-[11px] font-semibold uppercase tracking-tight">{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 pr-2 h-full">
                    {/* Global Outlet Filter */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                        <Filter size={10} className="text-slate-400"/>
                        <select 
                            value={selectedOutlet} 
                            onChange={e => setSelectedOutlet(e.target.value)} 
                            className="bg-transparent text-[10px] font-bold text-slate-600 outline-none cursor-pointer"
                        >
                            <option value="ALL">SEMUA OUTLET</option>
                            {outlets.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                        </select>
                    </div>

                    {activeTab === 'NEW' && (
                        <>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-400" />
                            <button onClick={handleSaveBatch} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold shadow-sm flex items-center gap-1.5">
                                <Save size={13}/> Simpan
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center text-slate-400 gap-2 text-xs font-medium">
                        <Loader2 className="animate-spin" size={16}/> Memuat data...
                    </div>
                ) : activeTab === 'NEW' ? (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                                    <tr className="h-8">
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-10 text-center">#</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase">Barang & SKU</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-24 text-right">Qty Base</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-20 text-center">Satuan</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase">Catatan / Alasan</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rejectLines.map((line, idx) => (
                                        <tr key={idx} className="h-7 hover:bg-slate-50 group transition-colors">
                                            <td className="px-3 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                                            <td className="px-3 truncate">
                                                <span className="font-semibold text-slate-700 text-[11px]">{line.name}</span>
                                                <span className="ml-2 text-[10px] text-slate-400 font-mono italic">{line.sku}</span>
                                            </td>
                                            <td className="px-3 text-right font-mono font-bold text-rose-600 text-[11px]">{line.qty.toLocaleString()}</td>
                                            <td className="px-3 text-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{line.unit}</span>
                                            </td>
                                            <td className="px-3 text-slate-500 italic text-[11px] truncate">{line.reason}</td>
                                            <td className="px-3 text-center">
                                                <button onClick={() => setRejectLines(rejectLines.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    
                                    {/* INLINE ENTRY ROW */}
                                    <tr className="h-9 bg-blue-50/20 border-t-2 border-slate-200">
                                        <td className="px-3 py-1 text-center"><Plus size={13} className="text-blue-500 mx-auto"/></td>
                                        <td className="p-0 relative">
                                            <input 
                                                ref={itemInputRef}
                                                type="text" placeholder="Cari barang..." 
                                                value={query} 
                                                onChange={e => { setQuery(e.target.value); if(pendingItem) setPendingItem(null); setIsDropdownOpen(true); }}
                                                onFocus={() => setIsDropdownOpen(true)}
                                                onKeyDown={e => {
                                                    if(e.key==='Enter' && filteredItems[selectedIndex]) selectItem(filteredItems[selectedIndex]);
                                                    if(e.key==='ArrowDown') { e.preventDefault(); setSelectedIndex(p => (p+1)%filteredItems.length); }
                                                    if(e.key==='ArrowUp') { e.preventDefault(); setSelectedIndex(p => (p-1+filteredItems.length)%filteredItems.length); }
                                                }} 
                                                className="w-full h-full bg-transparent px-3 text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                                                autoComplete="off"
                                            />
                                            {isDropdownOpen && query && filteredItems.length > 0 && (
                                                <div ref={dropdownRef} className="fixed w-full max-w-sm mt-1 bg-white border border-slate-300 shadow-2xl rounded-lg z-[999] overflow-hidden animate-in fade-in slide-in-from-top-1" style={{ top: itemInputRef.current?.getBoundingClientRect().bottom, left: itemInputRef.current?.getBoundingClientRect().left }}>
                                                    {filteredItems.map((it, idx) => (
                                                        <div 
                                                            key={it.id} 
                                                            onMouseDown={() => selectItem(it)} 
                                                            onMouseEnter={()=>setSelectedIndex(idx)} 
                                                            className={`px-3 py-2 cursor-pointer text-[11px] flex justify-between items-center border-b border-slate-50 last:border-0 ${idx===selectedIndex ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                                                        >
                                                            <div className="min-w-0">
                                                                <div className={`font-semibold truncate ${idx===selectedIndex ? 'text-white' : 'text-slate-700'}`}>{highlightMatch(it.name, query)}</div>
                                                                <div className={`text-[10px] font-mono mt-0.5 ${idx===selectedIndex ? 'text-blue-100' : 'text-slate-400'}`}>{highlightMatch(it.code, query)}</div>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0 ml-3">
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${idx===selectedIndex ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{it.baseUnit}</span>
                                                                {idx === selectedIndex && <ChevronRight size={12} className="text-blue-200" />}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-0 relative">
                                            <input 
                                                ref={qtyInputRef}
                                                type="number" placeholder="0" 
                                                value={pendingQty} onChange={e => setPendingQty(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && reasonInputRef.current?.focus()}
                                                disabled={!pendingItem}
                                                className="w-full h-full bg-transparent px-3 text-right text-[11px] font-semibold text-blue-600 outline-none focus:bg-white/50 disabled:bg-transparent disabled:text-slate-300"
                                            />
                                            {conversionResult && !('error' in conversionResult) && (
                                                <div className="absolute right-0.5 -top-2.5 text-[8px] font-bold text-emerald-600 bg-white px-1 border border-emerald-100 shadow-sm rounded z-10">
                                                    = {conversionResult.baseQty}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-0">
                                            <select 
                                                value={pendingUnit} onChange={e => setPendingUnit(e.target.value)}
                                                disabled={!pendingItem}
                                                className="w-full h-full bg-transparent px-1 text-center text-[10px] font-semibold text-slate-600 outline-none appearance-none cursor-pointer disabled:opacity-30"
                                            >
                                                {pendingItem ? (
                                                    <>
                                                        <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>
                                                        {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                                    </>
                                                ) : <option>-</option>}
                                            </select>
                                        </td>
                                        <td className="p-0">
                                            <input 
                                                ref={reasonInputRef}
                                                type="text" placeholder="Tulis alasan..." 
                                                value={pendingReason} onChange={e => setPendingReason(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddLine()}
                                                disabled={!pendingItem}
                                                className="w-full h-full bg-transparent px-3 text-[11px] outline-none italic text-slate-500 focus:bg-white/50 disabled:bg-transparent"
                                            />
                                        </td>
                                        <td className="p-0 text-center">
                                            <button onClick={handleAddLine} disabled={!pendingItem} className="w-full h-full flex items-center justify-center text-blue-600 hover:bg-blue-100 disabled:opacity-30 transition-colors">
                                                <CornerDownLeft size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeTab === 'HISTORY' ? (
                    <div className="h-full flex flex-col">
                        <div className="h-9 px-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Periode:</span>
                                    <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="bg-transparent text-[11px] font-semibold text-slate-600 outline-none w-28"/>
                                    <span className="text-slate-300">-</span>
                                    <input type="date" value={exportEnd} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-[11px] font-semibold text-slate-600 outline-none w-28"/>
                                </div>
                            </div>
                            <button onClick={handleExportMatrix} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-sm flex items-center gap-1.5 transition-colors">
                                <FileSpreadsheet size={12}/> EXPORT MATRIX
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full border-collapse table-fixed text-left">
                                <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                                    <tr className="h-8">
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-32">ID Batch</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-24">Tanggal</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase">Outlet</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-20 text-center">Items</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-24 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {batches
                                        .filter(b => (selectedOutlet === 'ALL' || b.outlet === selectedOutlet) && b.date >= exportStart && b.date <= exportEnd)
                                        .map(b => (
                                        <tr key={b.id} className="h-7 hover:bg-slate-50 group transition-colors">
                                            <td className="px-3 text-[11px] font-mono text-slate-500">{b.id}</td>
                                            <td className="px-3 text-[11px] text-slate-600">{b.date}</td>
                                            <td className="px-3 text-[11px] font-semibold text-slate-700 uppercase">{b.outlet}</td>
                                            <td className="px-3 text-center text-[11px] font-semibold text-slate-500">{b.items.length}</td>
                                            <td className="px-3 text-center">
                                                <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setViewingBatch(b)} className="p-1 text-blue-500 hover:bg-blue-100 rounded" title="Lihat Detail"><Eye size={12}/></button>
                                                    <button onClick={() => handleCopyToClipboard(b)} className="p-1 text-slate-400 hover:bg-slate-200 rounded" title="Copy Teks"><Copy size={12}/></button>
                                                    <button onClick={() => { if(confirm('Hapus riwayat ini?')) StorageService.deleteRejectBatch(b.id).then(loadData); }} className="p-1 text-rose-400 hover:bg-rose-100 rounded" title="Hapus"><Trash2 size={12}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeTab === 'MASTER_ITEMS' ? (
                    <div className="h-full flex flex-col">
                        <div className="h-9 px-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                <input type="text" placeholder="Cari master barang..." value={masterSearch} onChange={e => setMasterSearch(e.target.value)} className="pl-7 pr-3 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold w-48 outline-none focus:border-blue-400" />
                            </div>
                            <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', baseUnit: 'Pcs', conversions: [] }); setShowItemModal(true); }} className="px-3 py-1 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700 shadow-sm transition-colors">
                                + BARANG BARU
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full border-collapse table-fixed text-left">
                                <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                                    <tr className="h-8">
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-32">Kode SKU</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase">Nama Produk</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-20 text-center">Unit</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-32">Multi-Unit</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-20 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredMasterItems.map(item => (
                                        <tr key={item.id} className="h-7 hover:bg-slate-50 group transition-colors">
                                            <td className="px-3 text-[11px] font-mono text-slate-500">{item.code}</td>
                                            <td className="px-3 text-[11px] font-semibold text-slate-700 truncate">{item.name}</td>
                                            <td className="px-3 text-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.baseUnit}</span>
                                            </td>
                                            <td className="px-3 text-[10px] text-slate-400 truncate italic">
                                                {item.conversions?.length ? item.conversions.map(c => c.name).join(', ') : '-'}
                                            </td>
                                            <td className="px-3 text-center">
                                                <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditingItem(item); setItemForm({...item, conversions: item.conversions ? [...item.conversions] : []}); setShowItemModal(true); }} className="p-1 text-amber-500 hover:bg-amber-100 rounded" title="Edit"><Edit3 size={12}/></button>
                                                    <button onClick={() => { if(confirm('Hapus master item ini?')) StorageService.deleteRejectMasterItem(item.id).then(loadData); }} className="p-1 text-rose-400 hover:bg-rose-100 rounded" title="Hapus"><Trash2 size={12}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* MASTER OUTLET */
                    <div className="p-6 max-w-md mx-auto h-full overflow-auto">
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                                <MapPin size={16} className="text-slate-400"/>
                                <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Master Outlet</h3>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" placeholder="Nama outlet baru..." 
                                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded text-[11px] font-semibold outline-none focus:border-blue-400"
                                        onKeyDown={e => {
                                            if(e.key === 'Enter' && e.currentTarget.value) {
                                                StorageService.saveRejectOutlet(e.currentTarget.value).then(loadData);
                                                (e.target as HTMLInputElement).value = '';
                                            }
                                        }} 
                                    />
                                    <button className="px-4 py-1.5 bg-blue-600 text-white rounded text-[11px] font-bold shadow-sm hover:bg-blue-700 transition-colors">TAMBAH</button>
                                </div>
                                <div className="space-y-1 divide-y divide-slate-100 border-t border-slate-100">
                                    {outlets.map(o => (
                                        <div key={o} className="py-2 flex justify-between items-center group">
                                            <span className="text-[11px] font-semibold text-slate-700 uppercase">{o}</span>
                                            <button className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-50 rounded p-1 transition-all"><Trash2 size={12}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL MASTER ITEM (HIGH DENSITY) */}
            {showItemModal && (
                <div className="fixed inset-0 bg-slate-900/10 z-[1000] flex items-center justify-center p-4 backdrop-blur-[1px] animate-in fade-in">
                    <div className="bg-white rounded-lg w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                         <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                             <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{editingItem ? 'Edit Barang' : 'Barang Baru'}</h3>
                             <button onClick={()=>setShowItemModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={16}/></button>
                         </div>
                         
                         <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
                             <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1">
                                     <label className="text-[10px] font-bold text-slate-400 uppercase">Kode SKU</label>
                                     <input type="text" className="w-full px-2 py-1.5 border border-slate-200 rounded text-[11px] font-mono font-semibold uppercase outline-none focus:border-blue-400" value={itemForm.code} onChange={e=>setItemForm({...itemForm, code:e.target.value.toUpperCase()})} />
                                 </div>
                                 <div className="space-y-1">
                                     <label className="text-[10px] font-bold text-slate-400 uppercase">Unit Dasar</label>
                                     <input type="text" className="w-full px-2 py-1.5 border border-slate-200 rounded text-[11px] font-semibold uppercase text-center outline-none focus:border-blue-400" value={itemForm.baseUnit} onChange={e=>setItemForm({...itemForm, baseUnit:e.target.value.toUpperCase()})} />
                                 </div>
                                 <div className="col-span-2 space-y-1">
                                     <label className="text-[10px] font-bold text-slate-400 uppercase">Nama Lengkap Barang</label>
                                     <input type="text" className="w-full px-2 py-1.5 border border-slate-200 rounded text-[11px] font-medium text-slate-700 outline-none focus:border-blue-400" value={itemForm.name} onChange={e=>setItemForm({...itemForm, name:e.target.value})} />
                                 </div>
                             </div>

                             <div className="pt-4 border-t border-slate-100">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Konversi Multi-Unit</h4>
                                    <button 
                                        onClick={() => setItemForm({...itemForm, conversions: [...(itemForm.conversions || []), { name: '', ratio: 1, operator: '*' }]})} 
                                        className="text-[10px] font-bold text-blue-600 hover:underline"
                                    >+ Tambah Unit</button>
                                </div>
                                
                                <div className="space-y-2">
                                    {(itemForm.conversions || []).map((c, i) => (
                                        <div key={i} className="flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-100">
                                            <input type="text" placeholder="BOX" className="w-16 px-1.5 py-1 border border-slate-200 rounded text-[10px] uppercase font-semibold outline-none focus:bg-white" value={c.name} onChange={e => {
                                                const next = [...(itemForm.conversions || [])];
                                                next[i].name = e.target.value.toUpperCase();
                                                setItemForm({...itemForm, conversions: next});
                                            }} />
                                            <select className="px-1.5 py-1 border border-slate-200 rounded text-[10px] font-semibold outline-none bg-white" value={c.operator} onChange={e => {
                                                const next = [...(itemForm.conversions || [])];
                                                next[i].operator = e.target.value as any;
                                                setItemForm({...itemForm, conversions: next});
                                            }}>
                                                <option value="*">x</option>
                                                <option value="/">/</option>
                                            </select>
                                            <input type="number" placeholder="Rasio" className="w-16 px-1.5 py-1 border border-slate-200 rounded text-[10px] font-mono font-semibold outline-none text-right focus:bg-white" value={c.ratio} onChange={e => {
                                                const next = [...(itemForm.conversions || [])];
                                                next[i].ratio = Number(e.target.value);
                                                setItemForm({...itemForm, conversions: next});
                                            }} />
                                            <span className="text-[10px] font-semibold text-slate-400 uppercase">{itemForm.baseUnit}</span>
                                            <button onClick={() => setItemForm({...itemForm, conversions: itemForm.conversions?.filter((_, idx) => idx !== i)})} className="ml-auto text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                             </div>
                         </div>

                         <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                             <button onClick={()=>setShowItemModal(false)} className="px-4 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-200 rounded transition-colors">Batal</button>
                             <button onClick={handleSaveMasterItem} className="px-6 py-1.5 bg-blue-600 text-white rounded text-[11px] font-bold shadow-sm hover:bg-blue-700 transition-all active:scale-95">
                                 SIMPAN
                             </button>
                         </div>
                    </div>
                </div>
            )}

            {/* DETAIL RIWAYAT MODAL (DENSE) */}
            {viewingBatch && (
                <div className="fixed inset-0 bg-slate-900/10 z-[1100] flex items-center justify-center p-4 backdrop-blur-[1px] animate-in fade-in">
                     <div className="bg-white rounded-lg w-full max-w-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                         <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                             <div>
                                 <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Detail Batch Reject</h3>
                                 <p className="text-[11px] font-mono text-slate-400 mt-0.5">{viewingBatch.id} • {viewingBatch.outlet} • {viewingBatch.date}</p>
                             </div>
                             <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleCopyToClipboard(viewingBatch)}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    <Copy size={12}/> COPY TEKS
                                </button>
                                <button onClick={()=>setViewingBatch(null)} className="text-slate-400 hover:text-rose-500"><X size={18}/></button>
                             </div>
                         </div>
                         <div className="overflow-auto custom-scrollbar">
                            <table className="w-full text-[11px] text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 uppercase tracking-tighter">
                                    <tr className="h-7">
                                        <th className="px-3 text-[10px] font-bold text-slate-400 w-10 text-center">#</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400">Nama Barang</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 w-20 text-right">Qty</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400 w-16 text-center">Unit</th>
                                        <th className="px-3 text-[10px] font-bold text-slate-400">Alasan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {viewingBatch.items.map((it,i)=>(
                                        <tr key={i} className="hover:bg-slate-50 h-7 transition-colors">
                                            <td className="px-3 text-center text-slate-400 font-mono text-[10px]">{i + 1}</td>
                                            <td className="px-3">
                                                <div className="font-semibold text-slate-700 truncate max-w-[200px]">{it.name}</div>
                                                <div className="text-[9px] text-slate-400 font-mono uppercase">{it.sku}</div>
                                            </td>
                                            <td className="text-right px-3 font-mono font-semibold text-rose-600">{it.qty.toLocaleString()}</td>
                                            <td className="text-center px-3 font-semibold text-[10px] uppercase text-slate-400">{it.unit}</td>
                                            <td className="px-3 text-slate-500 italic text-[10px] truncate">{it.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                     </div>
                </div>
            )}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default RejectView;
