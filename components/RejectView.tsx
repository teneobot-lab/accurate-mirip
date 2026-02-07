import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Item, RejectBatch, RejectItem, Stock } from '../types';
import { Trash2, Plus, CornerDownLeft, Loader2, History, MapPin, Search, Calendar, X, Eye, Save, Building, Database, Tag, Edit3, Equal, Info, Box, Share2, Ruler, LayoutGrid, AlertCircle, Copy, FileSpreadsheet, Download } from 'lucide-react';
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

const cleanNum = (val: string | number): number => {
    try {
        return new Decimal(val).toNumber();
    } catch {
        return 0;
    }
};

// Helper untuk mendapatkan nama hari Indonesia
const getDayNameID = (dateStr: string) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[new Date(dateStr).getDay()];
};

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

    // History & Export States
    const [batches, setBatches] = useState<RejectBatch[]>([]);
    const [viewingBatch, setViewingBatch] = useState<RejectBatch | null>(null);
    
    // Fixed: Local Date for 1st of month (Export/History Filter)
    const [exportStart, setExportStart] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [exportEnd, setExportEnd] = useState(new Date().toISOString().split('T')[0]);

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

    // --- CONVERSION ENGINE WITH DECIMAL.JS ---
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

            const baseQty = qty.times(ratio).toNumber(); // Clean number
            return { baseQty, unit: pendingItem.baseUnit };
        } catch (e) {
            return { error: 'Calc Error' };
        }
    }, [pendingItem, pendingQty, pendingUnit]);

    const filteredItems = useMemo(() => {
        if (!debouncedQuery || pendingItem) return [];
        const lower = debouncedQuery.toLowerCase();
        return rejectMasterItems.filter(it => 
            it.code.toLowerCase().includes(lower) || it.name.toLowerCase().includes(lower)
        ).slice(0, 10);
    }, [debouncedQuery, rejectMasterItems, pendingItem]);

    const selectItem = (item: Item) => {
        setPendingItem(item);
        setQuery(item.name);
        
        // --- SMART UNIT MEMORY ---
        // Cari di history input lokal untuk item ini
        const savedUnit = localStorage.getItem(`reject_unit_pref_${item.id}`);
        if (savedUnit) {
            setPendingUnit(savedUnit);
        } else {
            setPendingUnit(item.baseUnit);
        }

        setIsDropdownOpen(false);
        setTimeout(() => qtyInputRef.current?.focus(), 50);
    };

    const handleAddLine = () => {
        if (!pendingItem || !conversionResult || 'error' in conversionResult) return showToast("Data tidak valid", "warning");
        if (conversionResult.baseQty <= 0) return showToast("Qty harus lebih dari 0", "warning");

        const newLine: RejectItem = {
            itemId: pendingItem.id,
            sku: pendingItem.code,
            name: pendingItem.name,
            qty: conversionResult.baseQty, // DISIMPAN DALAM BASE QTY
            unit: pendingItem.baseUnit,    // DISIMPAN DALAM BASE UNIT
            baseQty: conversionResult.baseQty,
            reason: `${pendingReason || ''} (Input: ${pendingQty} ${pendingUnit})` 
        };

        // Simpan preferensi unit ke history
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
            showToast("Reject Saved", "success");
            setRejectLines([]); loadData();
        } catch (e) { showToast("Gagal simpan", "error"); }
    };

    // --- ENTERPRISE EXPORT MATRIX (EXCELJS) ---
    const handleExportMatrix = async () => {
        const filteredBatches = batches.filter(b => b.date >= exportStart && b.date <= exportEnd);
        if (filteredBatches.length === 0) return showToast("Tidak ada data di periode ini", "warning");

        try {
            showToast("Membangun Laporan Enterprise...", "info");
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Matrix Reject');

            // 1. Generate List of Dates
            const dateList: string[] = [];
            let curr = new Date(exportStart);
            const end = new Date(exportEnd);
            while (curr <= end) {
                dateList.push(curr.toISOString().split('T')[0]);
                curr.setDate(curr.getDate() + 1);
            }

            // 2. Map Data: ItemID -> Date -> TotalBaseQty using DECIMAL.JS
            const itemMap = new Map<string, { code: string, name: string, unit: string, dateValues: Map<string, Decimal> }>();

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
                    // Gunakan Decimal untuk penjumlahan
                    data.dateValues.set(batch.date, currentVal.plus(it.baseQty));
                });
            });

            // 3. Header Structure (High Contrast)
            sheet.mergeCells(1, 1, 1, 5 + dateList.length);
            const titleCell = sheet.getCell(1, 1);
            titleCell.value = `LAPORAN BARANG REJECT MINGGUAN`;
            titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }; // Putih
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; // Dark Slate
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            const headerRow = sheet.getRow(2);
            const headerValues: any[] = ['NO', 'KODE', 'NAMA BARANG', 'SATUAN'];
            dateList.forEach(d => {
                headerValues.push(`${getDayNameID(d).toUpperCase()}\n${d.split('-').reverse().slice(0, 2).join('/')}`);
            });
            headerValues.push('TOTAL');
            headerRow.values = headerValues;

            // Header Style (Explicit High Contrast)
            headerRow.height = 35;
            headerRow.eachCell((cell) => {
                cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }; // Putih Jelas
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF335157' } }; // Spectra / Deep Teal
                cell.border = { top: {style:'thin', color: {argb:'FFFFFFFF'}}, left: {style:'thin', color: {argb:'FFFFFFFF'}}, bottom: {style:'thin', color: {argb:'FFFFFFFF'}}, right: {style:'thin', color: {argb:'FFFFFFFF'}} };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            });

            // 4. Populate Rows (Clean Data / Zero Suppressed)
            let rowIdx = 3;
            Array.from(itemMap.values())
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach((item, idx) => {
                    const row = sheet.getRow(rowIdx++);
                    const vals: (number | string | null)[] = [idx + 1, item.code, item.name, item.unit];
                    
                    let rowTotal = new Decimal(0);
                    dateList.forEach(d => {
                        const qty = item.dateValues.get(d) || new Decimal(0);
                        // HILANGKAN ANGKA 0 DEFAULT (SUPPRESS ZEROS)
                        // Gunakan toNumber() untuk memastikan Excel menerima angka bersih
                        vals.push(qty.greaterThan(0) ? qty.toNumber() : null); 
                        rowTotal = rowTotal.plus(qty);
                    });
                    vals.push(rowTotal.greaterThan(0) ? rowTotal.toNumber() : null);
                    
                    row.values = vals as ExcelJS.CellValue[];
                    
                    // Style
                    const isEven = rowIdx % 2 === 0;
                    row.eachCell((cell, colNum) => {
                        cell.border = { 
                            top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, 
                            left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, 
                            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, 
                            right: { style: 'thin', color: { argb: 'FFD1D5DB' } } 
                        };
                        cell.font = { name: 'Arial', size: 9, color: { argb: 'FF111827' } }; // Hampir Hitam
                        if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; // Very Light Gray
                        
                        if (colNum >= 5) {
                            // FORMAT CLEAN NUMBER
                            // #,##0.### artinya:
                            // - Gunakan pemisah ribuan
                            // - Tampilkan desimal jika ada (hingga 3 digit)
                            // - JANGAN tampilkan desimal jika bilangan bulat
                            cell.numFmt = '#,##0.###;[Red]-#,##0.###'; 
                            cell.alignment = { horizontal: 'center', vertical: 'middle' };
                            
                            if (cell.value !== null) {
                                cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FF111827' } };
                            }
                        } else {
                            cell.alignment = { vertical: 'middle', horizontal: 'left' };
                        }
                        
                        // No & Satuan Center
                        if (colNum === 1 || colNum === 4) cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    });
                });

            // 5. Formatting Columns
            sheet.getColumn(1).width = 5;   // NO
            sheet.getColumn(2).width = 15;  // Kode
            sheet.getColumn(3).width = 45;  // Nama
            sheet.getColumn(4).width = 8;   // Satuan
            dateList.forEach((_, i) => { sheet.getColumn(5 + i).width = 12; });
            sheet.getColumn(5 + dateList.length).width = 14;

            // Freeze panes
            sheet.views = [{ state: 'frozen', xSplit: 4, ySplit: 2 }];

            // 6. Generate and Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `Weekly_Reject_${exportStart}_${exportEnd}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
            showToast("Matrix Clean Format Berhasil Diunduh", "success");

        } catch (e) {
            console.error(e);
            showToast("Gagal Export Matrix", "error");
        }
    };

    const handleSaveMasterItem = async () => {
        if (!itemForm.code || !itemForm.name) return showToast("Kode & Nama wajib diisi", "warning");
        try {
            const payload = { ...itemForm, id: editingItem?.id || crypto.randomUUID() } as Item;
            await StorageService.saveRejectMasterItem(payload);
            showToast("Master Item Saved", "success");
            setShowItemModal(false); loadData();
        } catch (e) { showToast("Gagal simpan master", "error"); }
    };

    const handleCopyToClipboard = (batch: RejectBatch) => {
        const d = new Date(batch.date);
        const dateStr = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`;
        let text = `Data Reject ${batch.outlet} ${dateStr}\n`;

        batch.items.forEach(it => {
            let qtyDisplay = it.qty.toString();
            let unitDisplay = it.unit;
            let reasonDisplay = it.reason || '';
            const inputMatch = it.reason ? it.reason.match(/\(Input:\s*([0-9.]+)\s*(.+?)\)/i) : null;
            if (inputMatch) {
                qtyDisplay = inputMatch[1];
                unitDisplay = inputMatch[2];
                reasonDisplay = it.reason.replace(inputMatch[0], '').trim();
            }
            if (reasonDisplay === '-' || reasonDisplay === '') reasonDisplay = '';
            text += `- ${it.name.toLowerCase()} ${qtyDisplay} ${unitDisplay.toLowerCase()}`;
            if (reasonDisplay) text += ` ${reasonDisplay.toLowerCase()}`;
            text += `\n`;
        });

        navigator.clipboard.writeText(text).then(() => {
            showToast("Tersalin (Satuan Input)", "success");
        }).catch(() => showToast("Gagal menyalin", "error"));
    };

    const filteredMasterItems = useMemo(() => {
        const lower = debouncedMasterSearch.toLowerCase();
        return rejectMasterItems.filter(i => i.name.toLowerCase().includes(lower) || i.code.toLowerCase().includes(lower));
    }, [debouncedMasterSearch, rejectMasterItems]);

    return (
        <div className="flex flex-col h-full bg-daintree p-4 gap-4 font-sans">
            {/* Header Tabs */}
            <div className="bg-gable p-2 rounded-2xl shadow-lg border border-spectra flex flex-wrap gap-2">
                <TabBtn active={activeTab === 'NEW'} onClick={() => setActiveTab('NEW')} label="Entry Reject" icon={<Plus size={16}/>} />
                <TabBtn active={activeTab === 'HISTORY'} onClick={() => setActiveTab('HISTORY')} label="Riwayat & Matrix" icon={<History size={16}/>} />
                <TabBtn active={activeTab === 'MASTER_ITEMS'} onClick={() => setActiveTab('MASTER_ITEMS')} label="Katalog Reject" icon={<Database size={16}/>} />
                <TabBtn active={activeTab === 'MASTER'} onClick={() => setActiveTab('MASTER')} label="Master Outlet" icon={<MapPin size={16}/>} />
            </div>

            {isLoading && activeTab === 'NEW' ? (
                <div className="flex-1 flex items-center justify-center text-cutty animate-pulse text-xs font-bold"><Loader2 className="animate-spin mr-2"/> Sinkronisasi Data...</div>
            ) : activeTab === 'NEW' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-gable p-4 rounded-2xl border border-spectra grid grid-cols-2 gap-4 shadow-sm">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-cutty uppercase ml-1">Outlet Sumber</label>
                            <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} className="w-full bg-daintree border border-spectra rounded-xl p-3 text-xs font-bold text-white outline-none">
                                {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-cutty uppercase ml-1">Tanggal Transaksi</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-daintree border border-spectra rounded-xl p-3 text-xs font-bold text-white outline-none" />
                        </div>
                    </div>

                    <div className="flex-1 bg-gable rounded-2xl border border-spectra flex flex-col overflow-hidden shadow-sm">
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-[11px] text-left">
                                <thead className="bg-daintree sticky top-0 font-black uppercase text-cutty border-b border-spectra tracking-widest p-4 z-10">
                                    <tr>
                                        <th className="px-4 py-3">Item (Base Unit)</th>
                                        <th className="px-4 py-3 w-32 text-right">Qty Base</th>
                                        <th className="px-4 py-3 w-20 text-center">Unit</th>
                                        <th className="px-4 py-3">Log (Input Asli)</th>
                                        <th className="px-4 py-3 w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-spectra/20">
                                    {rejectLines.map((line, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-white">{line.name}</div>
                                                <div className="text-[9px] text-slate-500 font-mono uppercase">{line.sku}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-red-400 font-bold">{line.qty.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded bg-daintree border border-spectra text-[9px] font-black text-slate-400 uppercase">{line.unit}</span></td>
                                            <td className="px-4 py-3 text-slate-400 italic text-[10px]">{line.reason}</td>
                                            <td className="px-4 py-3 text-center"><button onClick={() => setRejectLines(rejectLines.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-400"><Trash2 size={14}/></button></td>
                                        </tr>
                                    ))}
                                    
                                    <tr className="bg-daintree/30 border-t border-spectra">
                                        <td className="p-3 relative">
                                            <input 
                                                ref={itemInputRef}
                                                type="text"
                                                placeholder="CARI ITEM..." 
                                                value={query} 
                                                onChange={e => { setQuery(e.target.value); if(pendingItem) setPendingItem(null); }} 
                                                onKeyDown={(e) => {
                                                    if (e.key === 'ArrowDown') setSelectedIndex(s => (s + 1) % filteredItems.length);
                                                    if (e.key === 'ArrowUp') setSelectedIndex(s => (s - 1 + filteredItems.length) % filteredItems.length);
                                                    if (e.key === 'Enter' && filteredItems[selectedIndex]) selectItem(filteredItems[selectedIndex]);
                                                }}
                                                onFocus={() => setIsDropdownOpen(true)}
                                                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                                className="w-full bg-black/20 border border-spectra rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-spectra font-bold uppercase" 
                                            />
                                            {isDropdownOpen && filteredItems.length > 0 && (
                                                <div className="absolute left-3 right-3 top-full mt-1 bg-gable border border-spectra rounded-xl shadow-2xl z-[100] max-h-48 overflow-auto">
                                                    {filteredItems.map((it, idx) => (
                                                        <div key={it.id} onMouseDown={() => selectItem(it)} className={`px-4 py-2 cursor-pointer text-xs border-b border-spectra/30 flex justify-between ${idx === selectedIndex ? 'bg-spectra text-white' : 'hover:bg-daintree'}`}>
                                                            <span>{it.name} <b className="text-[10px] opacity-50 ml-2">{it.code}</b></span>
                                                            <span className="text-[10px] font-black opacity-40 uppercase">{it.baseUnit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="relative">
                                                <input ref={qtyInputRef} type="number" placeholder="Qty" value={pendingQty} onChange={e => setPendingQty(e.target.value)} onKeyDown={e => e.key === 'Enter' && reasonInputRef.current?.focus()} className="w-full bg-black/20 border border-spectra rounded-xl p-2.5 text-right text-xs text-white font-bold outline-none" />
                                                {conversionResult && !('error' in conversionResult) && (
                                                    <div className="absolute -top-5 right-0 text-[9px] font-black text-emerald-400 animate-in fade-in slide-in-from-bottom-1">
                                                        PREVIEW: {conversionResult.baseQty} {conversionResult.unit}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <select value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="w-full bg-black/20 border border-spectra rounded-xl p-2.5 text-center text-[10px] font-black text-slate-300 outline-none uppercase">
                                                {pendingItem ? (
                                                    <>
                                                        <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>
                                                        {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>) || null}
                                                    </>
                                                ) : <option value="">-</option>}
                                            </select>
                                        </td>
                                        <td className="p-3">
                                            <input ref={reasonInputRef} type="text" placeholder="Alasan..." value={pendingReason} onChange={e => setPendingReason(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddLine()} className="w-full bg-black/20 border border-spectra rounded-xl p-2.5 text-xs text-white outline-none" />
                                        </td>
                                        <td className="p-3 text-center">
                                            <button onClick={handleAddLine} disabled={!pendingItem} className="p-2.5 bg-spectra text-white rounded-xl hover:bg-white hover:text-spectra transition-all disabled:opacity-30"><Plus size={16}/></button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-5 border-t border-spectra bg-daintree flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-spectra/20 rounded-lg border border-spectra text-cutty"><Info size={16}/></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Database: Base Unit. Clipboard: Input Unit.</span>
                            </div>
                            <button onClick={handleSaveBatch} className="px-10 py-3 bg-spectra hover:bg-white hover:text-daintree text-white rounded-xl font-black text-xs shadow-lg transition-all active:scale-95 border border-spectra">SIMPAN DATA AFKIR</button>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'HISTORY' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    {/* Filter & Export Bar */}
                    <div className="bg-gable p-4 rounded-2xl border border-spectra flex flex-wrap items-end justify-between gap-4 shadow-sm">
                        <div className="flex gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-cutty uppercase ml-1">Dari Tanggal</label>
                                <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="bg-daintree border border-spectra rounded-xl p-2.5 text-xs font-bold text-white outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-cutty uppercase ml-1">Sampai Tanggal</label>
                                <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="bg-daintree border border-spectra rounded-xl p-2.5 text-xs font-bold text-white outline-none" />
                            </div>
                        </div>
                        <button 
                            onClick={handleExportMatrix}
                            className="px-6 py-2.5 bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-emerald-900/40 transition-all active:scale-95"
                        >
                            <FileSpreadsheet size={16}/> Export Laporan Mingguan
                        </button>
                    </div>

                    <div className="flex-1 bg-gable rounded-2xl border border-spectra overflow-auto shadow-sm">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-daintree uppercase font-black text-cutty border-b border-spectra sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">ID Batch</th>
                                    <th className="px-4 py-3">Tanggal</th>
                                    <th className="px-4 py-3">Outlet</th>
                                    <th className="px-4 py-3 text-right">Total Item</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-spectra/20 text-white">
                                {batches.filter(b => b.date >= exportStart && b.date <= exportEnd).map(b => (
                                    <tr key={b.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-mono text-cutty">{b.id}</td>
                                        <td className="px-4 py-3 font-bold text-emerald-500">{b.date}</td>
                                        <td className="px-4 py-3 font-bold">{b.outlet}</td>
                                        <td className="px-4 py-3 text-right font-black text-red-400">{b.items.length}</td>
                                        <td className="px-4 py-3 text-center flex justify-center gap-2">
                                            <button onClick={() => handleCopyToClipboard(b)} className="p-1.5 text-emerald-400 bg-emerald-900/20 rounded-lg hover:bg-emerald-900/40" title="Copy to Clipboard (Satuan Input)"><Copy size={14}/></button>
                                            <button onClick={() => setViewingBatch(b)} className="p-1.5 text-blue-400 bg-blue-900/20 rounded-lg hover:bg-blue-900/40"><Eye size={14}/></button>
                                            <button onClick={() => { if(confirm('Hapus riwayat ini?')) StorageService.deleteRejectBatch(b.id).then(loadData); }} className="p-1.5 text-red-400 bg-red-900/20 rounded-lg hover:bg-red-900/40"><Trash2 size={14}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === 'MASTER_ITEMS' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-gable p-3 rounded-2xl border border-spectra flex justify-between items-center shadow-sm">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cutty" size={14} />
                            <input type="text" placeholder="Cari Master..." value={masterSearch} onChange={e => setMasterSearch(e.target.value)} className="pl-9 pr-4 py-2.5 bg-daintree border border-spectra rounded-xl text-xs font-bold text-white outline-none w-64 focus:ring-2 focus:ring-spectra" />
                        </div>
                        <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', baseUnit: 'Pcs', conversions: [] }); setShowItemModal(true); }} className="px-5 py-2.5 bg-spectra text-white rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-white hover:text-spectra transition-all border border-spectra"><Plus size={16}/> PRODUK REJECT BARU</button>
                    </div>
                    <div className="flex-1 bg-gable rounded-2xl border border-spectra overflow-auto">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-daintree font-black uppercase text-cutty border-b border-spectra sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Kode SKU</th>
                                    <th className="px-4 py-3">Nama Produk</th>
                                    <th className="px-4 py-3 text-center">Base Unit</th>
                                    <th className="px-4 py-3 text-center">Unit Konversi</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-spectra/20 text-white">
                                {filteredMasterItems.map(item => (
                                    <tr key={item.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-mono font-bold text-slate-400 uppercase">{item.code}</td>
                                        <td className="px-4 py-3 font-bold">{item.name}</td>
                                        <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded bg-emerald-900/20 border border-emerald-900 text-[9px] font-black text-emerald-400 uppercase">{item.baseUnit}</span></td>
                                        <td className="px-4 py-3 text-center text-[10px] text-slate-500 font-bold uppercase">
                                            {item.conversions?.length ? item.conversions.map(c => c.name).join(', ') : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center flex justify-center gap-2">
                                            <button onClick={() => { setEditingItem(item); setItemForm({...item, conversions: item.conversions ? [...item.conversions] : []}); setShowItemModal(true); }} className="text-blue-400 hover:bg-blue-900/20 p-1.5 rounded-lg"><Edit3 size={14}/></button>
                                            <button onClick={() => { if(confirm('Hapus?')) StorageService.deleteRejectMasterItem(item.id).then(loadData); }} className="text-red-400 hover:bg-red-900/20 p-1.5 rounded-lg"><Trash2 size={14}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex-1 max-w-lg mx-auto w-full bg-gable p-8 rounded-[32px] border border-spectra space-y-6 shadow-2xl">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-4 bg-spectra/20 rounded-2xl border border-spectra text-spectra"><MapPin size={32}/></div>
                        <div>
                            <h3 className="text-xl font-black text-white">Kelola Outlet</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Lokasi sumber barang afkir</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <input type="text" placeholder="NAMA OUTLET BARU..." onKeyDown={e => {
                            if(e.key === 'Enter' && e.currentTarget.value) {
                                StorageService.saveRejectOutlet(e.currentTarget.value).then(loadData);
                                (e.target as HTMLInputElement).value = '';
                            }
                        }} className="flex-1 p-4 bg-daintree border border-spectra rounded-2xl outline-none text-xs font-bold text-white focus:ring-2 focus:ring-spectra" />
                        <button className="px-8 py-4 bg-spectra text-white rounded-2xl font-black text-xs shadow-lg hover:bg-white hover:text-spectra transition-all">TAMBAH</button>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                        {outlets.map(o => (
                            <div key={o} className="p-4 bg-daintree/50 rounded-2xl border border-spectra flex justify-between items-center group">
                                <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">{o}</span>
                                <button className="opacity-0 group-hover:opacity-100 text-red-500 transition-opacity"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal Master Item - STRICT MULTI UNIT */}
            {showItemModal && (
                <div className="fixed inset-0 bg-daintree/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-gable rounded-[32px] w-full max-w-2xl shadow-2xl border border-spectra overflow-hidden flex flex-col max-h-[90vh]">
                         <div className="bg-daintree p-6 border-b border-spectra flex justify-between items-center">
                             <div className="flex items-center gap-4">
                                 <div className="p-3 bg-gable rounded-xl border border-spectra text-white shadow-sm"><Tag size={24}/></div>
                                 <div>
                                     <h3 className="font-black text-base uppercase tracking-widest text-white">{editingItem ? 'Edit Katalog Afkir' : 'Produk Afkir Baru'}</h3>
                                     <p className="text-[10px] text-cutty font-bold uppercase tracking-wider">Definisikan Satuan & Konversi</p>
                                 </div>
                             </div>
                             <button onClick={()=>setShowItemModal(false)} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5"><X size={24}/></button>
                         </div>
                         
                         <div className="p-8 overflow-y-auto space-y-8 scrollbar-thin">
                             <div className="grid grid-cols-12 gap-6">
                                 <div className="col-span-4 space-y-1.5">
                                     <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Kode SKU</label>
                                     <input type="text" className="rej-input font-mono uppercase tracking-widest text-emerald-400" value={itemForm.code} onChange={e=>setItemForm({...itemForm, code:e.target.value.toUpperCase()})} />
                                 </div>
                                 <div className="col-span-8 space-y-1.5">
                                     <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Nama Lengkap Barang</label>
                                     <input type="text" className="rej-input font-bold text-white" value={itemForm.name} onChange={e=>setItemForm({...itemForm, name:e.target.value})} />
                                 </div>
                                 <div className="col-span-12 space-y-1.5">
                                     <div className="flex items-center justify-between">
                                         <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Satuan Dasar (BASE UNIT)</label>
                                         <div className="flex items-center gap-1.5 text-[9px] text-amber-500 font-bold bg-amber-900/10 px-2 py-0.5 rounded border border-amber-900/30 uppercase"><AlertCircle size={10}/> Semua stok di database akan disimpan dalam unit ini</div>
                                     </div>
                                     <input type="text" placeholder="Pcs / Gram / Ml..." className="rej-input text-center font-black uppercase text-white bg-spectra/10" value={itemForm.baseUnit} onChange={e=>setItemForm({...itemForm, baseUnit:e.target.value.toUpperCase()})} />
                                 </div>
                             </div>

                             <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-spectra/50 pb-2">
                                    <h4 className="text-[10px] font-black uppercase text-cutty tracking-widest flex items-center gap-2"><LayoutGrid size={14}/> Tabel Konversi Satuan Input</h4>
                                    <button 
                                        onClick={() => setItemForm({...itemForm, conversions: [...(itemForm.conversions || []), { name: '', ratio: 1, operator: '*' }]})} 
                                        className="text-[9px] font-black text-spectra hover:text-white bg-spectra/10 hover:bg-spectra px-4 py-1.5 rounded-full transition-all border border-spectra/50"
                                    >+ TAMBAH SATUAN BARU</button>
                                </div>
                                
                                <div className="rounded-2xl border border-spectra/50 overflow-hidden bg-daintree/30 shadow-inner">
                                    <table className="w-full text-left">
                                        <thead className="bg-daintree text-[9px] font-black uppercase text-cutty tracking-widest">
                                            <tr>
                                                <th className="px-4 py-3">Nama Satuan</th>
                                                <th className="px-4 py-3 w-32 text-center">Logika Konversi</th>
                                                <th className="px-4 py-3 w-32 text-right">Rasio ({itemForm.baseUnit})</th>
                                                <th className="px-4 py-3 w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-spectra/10">
                                            {(itemForm.conversions || []).map((c, i) => (
                                                <tr key={i} className="group hover:bg-white/5 transition-colors">
                                                    <td className="p-2">
                                                        <input type="text" className="rej-input h-9 text-center uppercase" placeholder="BOX / DUS" value={c.name} onChange={e => {
                                                            const next = [...(itemForm.conversions || [])];
                                                            next[i].name = e.target.value.toUpperCase();
                                                            setItemForm({...itemForm, conversions: next});
                                                        }} />
                                                    </td>
                                                    <td className="p-2">
                                                        <select className="rej-input h-9 text-center appearance-none cursor-pointer" value={c.operator} onChange={e => {
                                                            const next = [...(itemForm.conversions || [])];
                                                            next[i].operator = e.target.value as any;
                                                            setItemForm({...itemForm, conversions: next});
                                                        }}>
                                                            <option value="*">x (Multiplayer)</option>
                                                            <option value="/">/ (Divisor)</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-2">
                                                        <input type="number" className="rej-input h-9 text-right font-mono text-emerald-400" value={c.ratio} onChange={e => {
                                                            const next = [...(itemForm.conversions || [])];
                                                            next[i].ratio = Number(e.target.value);
                                                            setItemForm({...itemForm, conversions: next});
                                                        }} />
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <button onClick={() => setItemForm({...itemForm, conversions: itemForm.conversions?.filter((_, idx) => idx !== i)})} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(itemForm.conversions || []).length === 0 && (
                                                <tr><td colSpan={4} className="p-10 text-center text-[10px] text-slate-600 italic font-bold uppercase tracking-widest opacity-40">Hanya Mendukung Satuan Tunggal ({itemForm.baseUnit})</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                             </div>
                         </div>

                         <div className="bg-daintree p-6 border-t border-spectra flex justify-end gap-3 shadow-2xl">
                             <button onClick={()=>setShowItemModal(false)} className="px-6 py-2.5 text-xs font-black text-slate-500 hover:text-white uppercase transition-all tracking-widest">Batal</button>
                             <button onClick={handleSaveMasterItem} className="px-10 py-2.5 bg-spectra text-white rounded-xl text-xs font-black shadow-lg hover:bg-white hover:text-spectra transition-all border border-spectra active:scale-95 flex items-center gap-2">
                                 <Save size={16}/> SIMPAN MASTER DATA
                             </button>
                         </div>
                    </div>
                </div>
            )}

            {/* DETAIL VIEW BATCH */}
            {viewingBatch && (
                <div className="fixed inset-0 bg-daintree/90 z-[110] flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in-95">
                     <div className="bg-gable rounded-[32px] w-full max-w-lg border border-spectra overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                         <div className="p-5 bg-daintree border-b border-spectra flex justify-between items-center">
                             <div>
                                 <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2"><Eye size={16} className="text-blue-400"/> Detail Batch Afkir</h3>
                                 <p className="text-[10px] font-mono text-cutty mt-0.5">{viewingBatch.id} • {viewingBatch.outlet}</p>
                             </div>
                             <button onClick={()=>setViewingBatch(null)}><X size={20} className="text-slate-400 hover:text-white"/></button>
                         </div>
                         <div className="p-4 overflow-auto scrollbar-thin">
                            <table className="w-full text-[10px] text-white">
                                <thead className="text-cutty uppercase font-black border-b border-spectra/30 text-center">
                                    <tr>
                                        <th className="py-2 text-left">Nama Barang</th>
                                        <th className="py-2 text-right">Kuantitas Base</th>
                                        <th className="py-2">Unit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-spectra/10">
                                    {viewingBatch.items.map((it,i)=>(
                                        <tr key={i} className="hover:bg-white/5">
                                            <td className="py-3">
                                                <div className="font-bold">{it.name}</div>
                                                <div className="text-slate-500 text-[8px] italic">{it.reason}</div>
                                            </td>
                                            <td className="text-right py-3 text-red-400 font-mono font-black text-xs">{it.qty.toLocaleString()}</td>
                                            <td className="text-center py-3"><span className="px-2 py-0.5 rounded bg-daintree border border-spectra text-[8px] font-black uppercase text-slate-400">{it.unit}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                         <div className="bg-daintree p-4 border-t border-spectra text-center">
                             <p className="text-[9px] font-black text-cutty uppercase tracking-[0.2em]">Data Audit Terkalkulasi (Base Unit)</p>
                         </div>
                     </div>
                </div>
            )}
            
            <style>{` 
                .rej-input { 
                    width: 100%; 
                    background-color: #0b1619 !important; 
                    border: 1px solid #335157 !important; 
                    outline: none !important; 
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.4) !important;
                    border-radius: 1rem; 
                    padding: 0.6rem 1rem;
                    font-size: 0.75rem; 
                    transition: border-color 0.2s ease, ring 0.2s ease;
                }
                .rej-input:focus { border-color: #496569 !important; box-shadow: 0 0 0 2px rgba(51,81,87,0.3), inset 0 2px 4px rgba(0,0,0,0.4) !important; }
                .rej-input::placeholder { color: #2a3d40 !important; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
                input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                .scrollbar-thin::-webkit-scrollbar { width: 4px; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background: #335157; border-radius: 10px; }
            `}</style>
        </div>
    );
};

const TabBtn = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
    <button onClick={onClick} className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${active ? 'bg-spectra text-white shadow-lg shadow-black/20 border border-spectra/50' : 'text-slate-400 hover:bg-daintree hover:text-white border border-transparent'}`}>
        {icon} {label}
    </button>
);