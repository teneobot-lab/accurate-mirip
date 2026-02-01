
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Item, RejectBatch, RejectItem, UnitConversion } from '../types';
import { Trash2, Plus, Save, Upload, Download, Copy, Search, Calendar, MapPin, FileSpreadsheet, History, Eye, X, CornerDownLeft, Database, Edit3, ArrowRight, CheckSquare, Square, FlaskConical } from 'lucide-react';
import * as XLSX from 'xlsx';

export const RejectView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY' | 'DATABASE'>('NEW');
    const [items, setItems] = useState<Item[]>([]);
    const [outlets, setOutlets] = useState<string[]>([]);
    
    // --- New Entry State ---
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedOutlet, setSelectedOutlet] = useState('');
    const [newOutletName, setNewOutletName] = useState('');
    const [showAddOutlet, setShowAddOutlet] = useState(false);
    const [rejectLines, setRejectLines] = useState<RejectItem[]>([]);

    // --- Input Line State ---
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Item[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [pendingItem, setPendingItem] = useState<Item | null>(null);
    const [pendingQty, setPendingQty] = useState<number | ''>('');
    const [pendingUnit, setPendingUnit] = useState('');
    const [pendingReason, setPendingReason] = useState('');

    // --- History State ---
    const [batches, setBatches] = useState<RejectBatch[]>([]);
    const [viewingBatch, setViewingBatch] = useState<RejectBatch | null>(null);
    const [historyStartDate, setHistoryStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [historyEndDate, setHistoryEndDate] = useState(new Date().toISOString().split('T')[0]);

    // --- Database Tab State ---
    const [dbSearch, setDbSearch] = useState('');
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [selectedDbIds, setSelectedDbIds] = useState<Set<string>>(new Set());

    // --- Refs ---
    const queryRef = useRef<HTMLInputElement>(null);
    const qtyRef = useRef<HTMLInputElement>(null);
    const reasonRef = useRef<HTMLInputElement>(null);
    const unitRef = useRef<HTMLSelectElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null); 
    const masterFileInputRef = useRef<HTMLInputElement>(null); 

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setItems(StorageService.getItems());
        setOutlets(StorageService.getRejectOutlets());
        setBatches(StorageService.getRejectBatches());
        const savedOutlets = StorageService.getRejectOutlets();
        if (savedOutlets.length > 0 && !selectedOutlet) setSelectedOutlet(savedOutlets[0]);
        setSelectedDbIds(new Set());
    };

    // --- Search & Autocomplete ---
    useEffect(() => {
        if (!query.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        if (pendingItem && query === pendingItem.name) return;

        const lower = query.toLowerCase();
        const matches = items.filter(i => 
            i.code.toLowerCase().includes(lower) || 
            i.name.toLowerCase().includes(lower)
        ).slice(0, 10);
        
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
        setHighlightedIndex(0);
    }, [query, items, pendingItem]);

    const handleQueryKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (suggestions.length > 0) {
                selectItem(suggestions[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const selectItem = (item: Item) => {
        setPendingItem(item);
        setQuery(item.name);
        
        const lastUnit = localStorage.getItem(`reject_last_unit_${item.id}`);
        setPendingUnit(lastUnit || item.baseUnit);
        
        setPendingQty('');
        setShowSuggestions(false);
        setTimeout(() => qtyRef.current?.focus(), 50);
    };

    const calculateBase = (qty: number, unitName: string, item: Item) => {
        if (unitName === item.baseUnit) return qty;
        const conv = item.conversions.find(c => c.name === unitName);
        if (!conv) return qty;
        
        if (conv.operator === '/') {
            return qty / conv.ratio;
        } else {
            return qty * conv.ratio;
        }
    };

    const handleAddLine = () => {
        if (!pendingItem) return;
        const qty = Number(pendingQty);
        if (qty <= 0) return alert("Invalid Qty");
        if (!pendingReason.trim()) return alert("Reason is required");

        const baseQty = calculateBase(qty, pendingUnit, pendingItem);

        const newLine: RejectItem = {
            itemId: pendingItem.id,
            sku: pendingItem.code,
            name: pendingItem.name,
            qty: qty,
            unit: pendingUnit,
            baseQty: baseQty,
            reason: pendingReason
        };

        setRejectLines(prev => [...prev, newLine]);
        localStorage.setItem(`reject_last_unit_${pendingItem.id}`, pendingUnit);

        setPendingItem(null);
        setQuery('');
        setPendingQty('');
        setPendingReason('');
        queryRef.current?.focus();
    };

    const handleRemoveLine = (idx: number) => {
        setRejectLines(prev => {
            const newLines = [...prev];
            newLines.splice(idx, 1);
            return newLines;
        });
    };

    const handleSaveBatch = () => {
        if (rejectLines.length === 0) return alert("No items to save");
        if (!selectedOutlet) return alert("Please select an outlet");

        const batch: RejectBatch = {
            id: `REJ-${Date.now().toString().slice(-6)}`,
            date,
            outlet: selectedOutlet,
            createdAt: Date.now(),
            items: rejectLines
        };

        StorageService.saveRejectBatch(batch);
        setRejectLines([]);
        setBatches(StorageService.getRejectBatches());
        alert("Reject Batch Saved!");
    };

    const filteredBatches = useMemo(() => {
        return batches.filter(b => b.date >= historyStartDate && b.date <= historyEndDate);
    }, [batches, historyStartDate, historyEndDate]);

    const handleBatchClipboard = (batch: RejectBatch) => {
        const dateStr = batch.date.split('-').reverse().join(''); 
        const shortDate = dateStr.substring(0, 4) + dateStr.substring(6, 8);
        let text = `Data Reject ${batch.outlet} ${shortDate}\n`;
        batch.items.forEach(line => {
            text += `- ${line.name} ${line.qty} ${line.unit} ${line.reason}\n`;
        });
        navigator.clipboard.writeText(text).then(() => alert("Copied to Clipboard!"));
    };

    const handleMatrixExport = () => {
        if (filteredBatches.length === 0) return alert("No data in selected date range.");
        const uniqueDates: string[] = Array.from(new Set(filteredBatches.map(b => b.date))).sort();
        const matrix: Record<string, any> = {};

        filteredBatches.forEach(batch => {
            batch.items.forEach(line => {
                if (!matrix[line.sku]) {
                    matrix[line.sku] = {
                        'Kode Barang': line.sku,
                        'Nama Barang': line.name,
                        'Satuan': line.unit,
                    };
                    uniqueDates.forEach(d => matrix[line.sku][d] = 0);
                }
                const current = matrix[line.sku][batch.date] || 0;
                matrix[line.sku][batch.date] = current + line.qty;
            });
        });

        const rows = Object.values(matrix).map(row => {
            const cleanRow: any = { ...row };
            uniqueDates.forEach((d: string) => {
                if (cleanRow[d] === 0) cleanRow[d] = '';
                else cleanRow[d] = Number(cleanRow[d].toFixed(1));
            });
            return cleanRow;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Matrix Report");
        XLSX.writeFile(wb, `Reject_Matrix_${historyStartDate}_to_${historyEndDate}.xlsx`);
    };

    const handleSessionClipboard = () => {
        const dateStr = date.split('-').reverse().join(''); 
        const shortDate = dateStr.substring(0, 4) + dateStr.substring(6, 8);
        let text = `Data Reject ${selectedOutlet} ${shortDate}\n`;
        rejectLines.forEach(line => {
            text += `- ${line.name} ${line.qty} ${line.unit} ${line.reason}\n`;
        });
        navigator.clipboard.writeText(text).then(() => alert("Copied to Clipboard!"));
    };

    const handleTransactionImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data: any[] = XLSX.utils.sheet_to_json(ws);
            const imported: RejectItem[] = [];
            data.forEach(row => {
                const item = items.find(i => i.code === String(row.SKU).trim());
                if (item && row.Qty > 0) {
                    const unit = row.Unit || item.baseUnit;
                    imported.push({
                        itemId: item.id,
                        sku: item.code,
                        name: item.name,
                        qty: row.Qty,
                        unit: unit,
                        baseQty: calculateBase(row.Qty, unit, item),
                        reason: row.Reason || 'Imported'
                    });
                }
            });
            setRejectLines(prev => [...prev, ...imported]);
            e.target.value = '';
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadMasterTemplate = () => {
        const headers = [['Code', 'Name', 'Category', 'BaseUnit', 'MinStock']];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(headers);
        XLSX.utils.book_append_sheet(wb, ws, "MasterTemplate");
        XLSX.writeFile(wb, "Master_Data_Template.xlsx");
    };

    const handleImportMasterData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data: any[] = XLSX.utils.sheet_to_json(ws);
            
            const newItems: Item[] = [];
            data.forEach(row => {
                if (row.Code && row.Name) {
                    newItems.push({
                        id: crypto.randomUUID(),
                        code: String(row.Code).trim(),
                        name: String(row.Name).trim(),
                        category: row.Category || 'General',
                        baseUnit: row.BaseUnit || 'Pcs',
                        minStock: Number(row.MinStock) || 0,
                        conversions: []
                    });
                }
            });
            StorageService.importItems(newItems);
            loadData();
            alert(`Imported ${newItems.length} Master Items`);
            e.target.value = '';
        };
        reader.readAsBinaryString(file);
    };

    const handleSaveConversions = () => {
        if (editingItem) {
             const updated = { ...editingItem, conversions: editingItem.conversions.filter(c => c.name && c.ratio > 0) };
             StorageService.saveItem(updated);
             loadData();
             setEditingItem(null);
        }
    };

    const handleDbSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = items.map(i => i.id);
            setSelectedDbIds(new Set(allIds));
        } else {
            setSelectedDbIds(new Set());
        }
    };

    const handleDbSelectRow = (id: string) => {
        setSelectedDbIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleDbBulkDelete = () => {
        if (selectedDbIds.size === 0) return;
        if (confirm(`Delete ${selectedDbIds.size} items?`)) {
            StorageService.deleteItems(Array.from(selectedDbIds));
            loadData();
        }
    };

    const handleGenerateSampleData = () => {
        if (!confirm("Generate 1 month of sample reject data?")) return;
        const outletsList = outlets.length > 0 ? outlets : ['Outlet Pusat', 'Outlet Cabang'];
        if(outlets.length === 0) {
            outletsList.forEach(o => StorageService.saveRejectOutlet(o));
            setOutlets(StorageService.getRejectOutlets());
        }
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(new Date().getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const numBatches = Math.floor(Math.random() * 4); 
            for (let b = 0; b < numBatches; b++) {
                 const batchItems: RejectItem[] = [];
                 const numItems = Math.floor(Math.random() * 5) + 1;
                 for(let k=0; k<numItems; k++) {
                     if(items.length === 0) break;
                     const randomItem = items[Math.floor(Math.random() * items.length)];
                     const qty = Math.floor(Math.random() * 10) + 1;
                     batchItems.push({
                         itemId: randomItem.id,
                         sku: randomItem.code,
                         name: randomItem.name,
                         qty: qty,
                         unit: randomItem.baseUnit,
                         baseQty: qty,
                         reason: ['Expired', 'Broken', 'Rotten', 'Damaged'][Math.floor(Math.random() * 4)]
                     });
                 }
                 if (batchItems.length > 0) {
                     StorageService.saveRejectBatch({
                         id: `MOCK-${Date.now()}-${i}-${b}`,
                         date: dateStr,
                         outlet: outletsList[Math.floor(Math.random() * outletsList.length)],
                         createdAt: Date.now(),
                         items: batchItems
                     });
                 }
            }
        }
        loadData();
        alert("Sample data generated.");
    };

    const getUnits = (item: Item) => [{ name: item.baseUnit }, ...item.conversions];

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 gap-4 transition-colors">
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
                <div className="flex gap-2">
                    <button 
                        onClick={() => setActiveTab('NEW')}
                        className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'NEW' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <CornerDownLeft size={16}/> New Reject Entry
                    </button>
                    <button 
                        onClick={() => setActiveTab('HISTORY')}
                        className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'HISTORY' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <History size={16}/> Reject History
                    </button>
                     <button 
                        onClick={() => setActiveTab('DATABASE')}
                        className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'DATABASE' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <Database size={16}/> Database Reject
                    </button>
                </div>
            </div>

            {activeTab === 'NEW' && (
                <div className="flex flex-col gap-4 flex-1 overflow-hidden">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-end">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1"><Calendar size={12}/> Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border p-2 rounded text-sm w-36 focus:ring-1 focus:ring-red-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                        </div>
                        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1"><MapPin size={12}/> Outlet / Location</label>
                            <div className="flex gap-2">
                                <select 
                                    value={selectedOutlet} 
                                    onChange={e => setSelectedOutlet(e.target.value)} 
                                    className="border p-2 rounded text-sm flex-1 outline-none focus:ring-1 focus:ring-red-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                                >
                                    {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                <button onClick={() => setShowAddOutlet(true)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><Plus size={16}/></button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded text-sm hover:bg-slate-900 dark:hover:bg-slate-600 flex items-center gap-2 shadow-sm">
                                <Upload size={14}/> Import Transaction
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleTransactionImport} />
                        </div>
                    </div>

                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 w-10 text-center">#</th>
                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700">Item</th>
                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 w-24 text-right">Qty</th>
                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 w-24">Unit</th>
                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 w-24 text-right">Base</th>
                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700">Reason</th>
                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 w-10 text-center">Act</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {rejectLines.map((line, idx) => (
                                        <tr key={`line-${line.itemId}-${idx}`} className="border-b border-slate-50 dark:border-slate-800 hover:bg-red-50/10 dark:hover:bg-red-900/10 transition-colors">
                                            <td className="p-2 text-center text-slate-400 dark:text-slate-500">{idx + 1}</td>
                                            <td className="p-2">
                                                <div className="font-medium text-slate-700 dark:text-slate-200">{line.name}</div>
                                                <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">{line.sku}</div>
                                            </td>
                                            <td className="p-2 text-right font-bold font-mono text-red-600 dark:text-red-400">{line.qty}</td>
                                            <td className="p-2 text-slate-500 dark:text-slate-400">{line.unit}</td>
                                            <td className="p-2 text-right font-mono text-slate-400 dark:text-slate-500">{Number(line.baseQty.toFixed(2))}</td>
                                            <td className="p-2 text-slate-600 dark:text-slate-300">{line.reason}</td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => handleRemoveLine(idx)} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr key="input-row-stable" className="bg-red-50/20 dark:bg-red-900/10 border-t-2 border-red-100 dark:border-red-900/30">
                                        <td className="p-2 text-center text-red-300 dark:text-red-400"><Plus size={16} className="mx-auto"/></td>
                                        <td className="p-2 relative">
                                            <div className="relative">
                                                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input 
                                                    ref={queryRef}
                                                    type="text" 
                                                    className="w-full pl-8 pr-2 py-1.5 border border-red-200 dark:border-red-900/50 rounded text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white dark:bg-slate-800 dark:text-white"
                                                    placeholder="Scan or type item..."
                                                    value={query}
                                                    onChange={e => setQuery(e.target.value)}
                                                    onKeyDown={handleQueryKeyDown}
                                                    onFocus={() => { if(query) setShowSuggestions(true); }}
                                                    autoComplete="off"
                                                />
                                                {showSuggestions && (
                                                    <div className="absolute left-0 top-full mt-1 w-[400px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                                        {suggestions.map((item, idx) => (
                                                            <div 
                                                                key={item.id}
                                                                className={`px-3 py-2 cursor-pointer flex justify-between items-center ${idx === highlightedIndex ? 'bg-red-600 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
                                                                onClick={() => selectItem(item)}
                                                            >
                                                                <div>
                                                                    <div className="font-medium text-sm">{item.name}</div>
                                                                    <div className={`text-xs ${idx === highlightedIndex ? 'text-red-100' : 'text-slate-400 dark:text-slate-500'}`}>{item.code}</div>
                                                                </div>
                                                                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${idx === highlightedIndex ? 'bg-red-500' : 'bg-slate-100 dark:bg-slate-700'}`}>{item.baseUnit}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                ref={qtyRef}
                                                type="number" 
                                                className="w-full text-right py-1.5 px-2 border border-red-200 dark:border-red-900/50 rounded text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white dark:bg-slate-800 dark:text-white"
                                                placeholder="Qty"
                                                value={pendingQty}
                                                onChange={e => setPendingQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                onKeyDown={e => e.key === 'Enter' && unitRef.current?.focus()}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <select 
                                                ref={unitRef}
                                                className="w-full py-1.5 px-2 border border-red-200 dark:border-red-900/50 rounded text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white dark:bg-slate-800 dark:text-white"
                                                value={pendingUnit}
                                                onChange={e => setPendingUnit(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && reasonRef.current?.focus()}
                                                disabled={!pendingItem}
                                            >
                                                {pendingItem && getUnits(pendingItem).map(u => (
                                                    <option key={u.name} value={u.name}>{u.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-2 text-right text-slate-400 dark:text-slate-500 font-mono text-xs italic bg-slate-50 dark:bg-slate-800/30">
                                            {pendingItem && pendingQty !== '' ? Number(calculateBase(Number(pendingQty), pendingUnit, pendingItem).toFixed(2)) : '-'}
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                ref={reasonRef}
                                                type="text" 
                                                className="w-full py-1.5 px-2 border border-red-200 dark:border-red-900/50 rounded text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white dark:bg-slate-800 dark:text-white"
                                                placeholder="Reason"
                                                value={pendingReason}
                                                onChange={e => setPendingReason(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddLine();
                                                    }
                                                }}
                                                autoComplete="off"
                                                autoCorrect="off"
                                                spellCheck={false}
                                            />
                                        </td>
                                        <td className="p-2 text-center">
                                            <button onClick={handleAddLine} disabled={!pendingItem} className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                                                <Plus size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                             <div className="text-xs text-slate-500 dark:text-slate-400">
                                 {rejectLines.length} Items ready.
                             </div>
                             <div className="flex gap-2">
                                 <button onClick={handleSessionClipboard} className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded text-sm hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-2 shadow-sm">
                                    <Copy size={16}/> Copy to Clipboard
                                 </button>
                                 <button onClick={handleSaveBatch} className="px-6 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 font-bold flex items-center gap-2 shadow-sm">
                                    <Save size={16}/> Save Batch
                                 </button>
                             </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'HISTORY' && (
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 justify-between items-center bg-slate-50 dark:bg-slate-800">
                        <div className="flex items-center gap-4">
                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Batch History</div>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded border border-slate-200 dark:border-slate-700">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 pl-1 uppercase">Date Range:</label>
                                <input type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} className="text-xs border-0 outline-none text-slate-600 dark:text-slate-300 bg-transparent" />
                                <span className="text-slate-300 dark:text-slate-600">-</span>
                                <input type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} className="text-xs border-0 outline-none text-slate-600 dark:text-slate-300 bg-transparent" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleGenerateSampleData} className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 flex items-center gap-2 shadow-sm">
                                <FlaskConical size={14}/> Test Data
                            </button>
                            <button onClick={handleMatrixExport} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 flex items-center gap-2 shadow-sm">
                                <FileSpreadsheet size={14}/> Export Matrix
                            </button>
                        </div>
                    </div>
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase sticky top-0">
                                <tr>
                                    <th className="p-3">ID</th>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Outlet</th>
                                    <th className="p-3 text-right">Items</th>
                                    <th className="p-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-sm">
                                {filteredBatches.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400 dark:text-slate-500 italic">No batches found.</td>
                                    </tr>
                                ) : filteredBatches.map(batch => (
                                    <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="p-3 font-mono text-slate-500 dark:text-slate-400">{batch.id}</td>
                                        <td className="p-3 text-slate-700 dark:text-slate-300">{batch.date}</td>
                                        <td className="p-3 font-medium text-slate-700 dark:text-slate-200">{batch.outlet}</td>
                                        <td className="p-3 text-right font-bold text-red-600 dark:text-red-400">{batch.items.length}</td>
                                        <td className="p-3 text-center flex justify-center gap-2">
                                            <button onClick={() => handleBatchClipboard(batch)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">
                                                <Copy size={16}/>
                                            </button>
                                            <button onClick={() => setViewingBatch(batch)} className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">
                                                <Eye size={16}/>
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if(confirm('Delete batch?')) {
                                                        StorageService.deleteRejectBatch(batch.id);
                                                        setBatches(StorageService.getRejectBatches());
                                                    }
                                                }} 
                                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'DATABASE' && (
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-2 relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search Master Data..." 
                                className="pl-8 pr-3 py-1.5 border rounded text-sm w-64 outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                                value={dbSearch}
                                onChange={e => setDbSearch(e.target.value)}
                            />
                            {selectedDbIds.size > 0 && (
                                <button onClick={handleDbBulkDelete} className="ml-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center gap-1">
                                    <Trash2 size={14}/> Delete ({selectedDbIds.size})
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                             <button onClick={handleDownloadMasterTemplate} className="px-3 py-1.5 border bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-600 dark:text-slate-200 rounded text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <Download size={14}/> Master Template
                            </button>
                            <button onClick={() => masterFileInputRef.current?.click()} className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded text-xs flex items-center gap-2 hover:bg-slate-900 dark:hover:bg-slate-600 shadow-sm">
                                <Upload size={14}/> Import Master Data
                            </button>
                            <input type="file" ref={masterFileInputRef} className="hidden" accept=".xlsx" onChange={handleImportMasterData} />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase sticky top-0">
                                <tr>
                                    <th className="p-3 w-10 text-center">
                                        <input type="checkbox" onChange={handleDbSelectAll} checked={items.length > 0 && selectedDbIds.size === items.length} />
                                    </th>
                                    <th className="p-3">SKU</th>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">Base Unit</th>
                                    <th className="p-3">Category</th>
                                    <th className="p-3">Conversions</th>
                                    <th className="p-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-sm">
                                {items.filter(i => i.name.toLowerCase().includes(dbSearch.toLowerCase()) || i.code.toLowerCase().includes(dbSearch.toLowerCase())).map(item => (
                                    <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedDbIds.has(item.id) ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                                        <td className="p-3 text-center">
                                            <input type="checkbox" checked={selectedDbIds.has(item.id)} onChange={() => handleDbSelectRow(item.id)} />
                                        </td>
                                        <td className="p-3 font-mono text-slate-500 dark:text-slate-400">{item.code}</td>
                                        <td className="p-3 font-medium text-slate-700 dark:text-slate-200">{item.name}</td>
                                        <td className="p-3"><span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-bold">{item.baseUnit}</span></td>
                                        <td className="p-3 text-slate-500 dark:text-slate-400">{item.category}</td>
                                        <td className="p-3 text-xs text-slate-500 dark:text-slate-400">
                                            {item.conversions.map(c => `${c.name} (${c.operator === '/' ? '/' : '*'}${c.ratio})`).join(', ') || '-'}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button 
                                                onClick={() => setEditingItem(JSON.parse(JSON.stringify(item)))}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded"
                                            >
                                                <Edit3 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showAddOutlet && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-xl w-80 border border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Add New Outlet</h3>
                        <input autoFocus className="w-full border p-2 rounded mb-4 dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="Outlet Name" value={newOutletName} onChange={e => setNewOutletName(e.target.value)} />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAddOutlet(false)} className="px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">Cancel</button>
                            <button 
                                onClick={() => {
                                    if(newOutletName) {
                                        StorageService.saveRejectOutlet(newOutletName);
                                        setOutlets(StorageService.getRejectOutlets());
                                        setSelectedOutlet(newOutletName);
                                        setShowAddOutlet(false);
                                        setNewOutletName('');
                                    }
                                }} 
                                className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                            > Add </button>
                        </div>
                    </div>
                </div>
            )}

            {viewingBatch && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[80vh] border border-slate-200 dark:border-slate-800">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 rounded-t-lg">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">Reject Batch Details</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{viewingBatch.id} • {viewingBatch.date} • {viewingBatch.outlet}</p>
                            </div>
                            <button onClick={() => setViewingBatch(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 uppercase">
                                    <tr>
                                        <th className="p-3">Item</th>
                                        <th className="p-3 text-right">Qty</th>
                                        <th className="p-3">Unit</th>
                                        <th className="p-3 text-right">Base Qty</th>
                                        <th className="p-3">Reason</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {viewingBatch.items.map((line, i) => (
                                        <tr key={i}>
                                            <td className="p-3">
                                                <div className="font-medium text-slate-700 dark:text-slate-200">{line.name}</div>
                                                <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">{line.sku}</div>
                                            </td>
                                            <td className="p-3 text-right font-bold text-red-600 dark:text-red-400">{line.qty}</td>
                                            <td className="p-3 text-slate-500 dark:text-slate-400">{line.unit}</td>
                                            <td className="p-3 text-right font-mono text-slate-400 dark:text-slate-500">{Number(line.baseQty.toFixed(2))}</td>
                                            <td className="p-3 text-slate-600 dark:text-slate-300">{line.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-b-lg text-right">
                             <button onClick={() => setViewingBatch(null)} className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-sm text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {editingItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 dark:text-slate-200">Manage Units: {editingItem.code}</h3>
                            <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={18}/></button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="mb-4 text-xs text-slate-500 dark:text-slate-400"> Base Unit: <strong className="text-slate-800 dark:text-slate-200">{editingItem.baseUnit}</strong> </div>
                            <div className="space-y-3">
                                {editingItem.conversions.map((conv, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Unit Name</label>
                                            <input className="w-full border rounded px-2 py-1 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={conv.name} onChange={e => {
                                                const nc = [...editingItem.conversions];
                                                nc[idx].name = e.target.value;
                                                setEditingItem({...editingItem, conversions: nc});
                                            }} />
                                        </div>
                                        <div className="flex flex-col items-center pt-4"> <ArrowRight size={14} className="text-slate-300"/> </div>
                                        <div className="w-20">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Operator</label>
                                            <select className="w-full border rounded px-1 py-1 text-sm bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={conv.operator || '*'} onChange={e => {
                                                const nc = [...editingItem.conversions];
                                                nc[idx].operator = e.target.value as '*' | '/';
                                                setEditingItem({...editingItem, conversions: nc});
                                            }}>
                                                <option value="*">Multiply (*)</option>
                                                <option value="/">Divide (/)</option>
                                            </select>
                                        </div>
                                        <div className="w-24">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Ratio</label>
                                            <input type="number" className="w-full border rounded px-2 py-1 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={conv.ratio} onChange={e => {
                                                const nc = [...editingItem.conversions];
                                                nc[idx].ratio = parseFloat(e.target.value);
                                                setEditingItem({...editingItem, conversions: nc});
                                            }} />
                                        </div>
                                        <div className="pt-4">
                                             <button onClick={() => {
                                                const nc = editingItem.conversions.filter((_, i) => i !== idx);
                                                setEditingItem({...editingItem, conversions: nc});
                                            }} className="text-slate-300 hover:text-red-500"> <Trash2 size={16}/> </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setEditingItem({...editingItem, conversions: [...editingItem.conversions, { name: '', ratio: 1, operator: '*' }]})} className="mt-4 w-full py-2 border-2 border-dashed border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-bold flex items-center justify-center gap-2"> <Plus size={16}/> Add Unit </button>
                        </div>
                        <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                             <button onClick={() => setEditingItem(null)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded text-sm">Cancel</button>
                             <button onClick={handleSaveConversions} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 shadow-sm">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
