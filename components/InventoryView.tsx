
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, UnitConversion } from '../types';
import { Search, Upload, Download, Trash2, Box, RefreshCw, Plus, X, ArrowRight, Loader2, CheckSquare, Square, Filter, Columns, List, Edit3, Save, Layers, FileSpreadsheet, Info, AlertCircle, LayoutGrid, Database, Tag, ShieldCheck, Equal } from 'lucide-react';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';

export const InventoryView: React.FC = () => {
    const { showToast } = useToast();
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // UI States
    const [isZebra, setIsZebra] = useState(true);
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['code', 'name', 'category', 'total', 'unit', 'actions']));
    const [showColumnFilter, setShowColumnFilter] = useState(false);

    // Modal States
    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [itemForm, setItemForm] = useState<Partial<Item>>({
        code: '',
        name: '',
        category: '',
        baseUnit: 'Pcs',
        minStock: '' as any, // Global sanitization: Set empty instead of 10
        initialStock: '' as any, // Global sanitization: Set empty instead of 0
        conversions: []
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedItems, fetchedWh, fetchedStocks] = await Promise.all([
                StorageService.fetchItems(),
                StorageService.fetchWarehouses(),
                StorageService.fetchStocks()
            ]);
            setItems(fetchedItems || []);
            setWarehouses(fetchedWh || []);
            setStocks(fetchedStocks || []);
        } catch (error) {
            showToast("Gagal memuat database server.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const inventoryData = useMemo(() => {
        return items.map(item => {
            const itemStocks = stocks.filter(s => s.itemId === item.id);
            const totalStock = itemStocks.reduce((acc, s) => acc + Number(s.qty), 0);
            const whBreakdown = warehouses.map(wh => {
                const s = itemStocks.find(stk => stk.warehouseId === wh.id);
                return { whId: wh.id, qty: s ? Number(s.qty) : 0 };
            });
            return { ...item, totalStock, whBreakdown };
        }).filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.code.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [items, stocks, warehouses, searchTerm]);

    const handleImportXLSX = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
                
                if (rawData.length === 0) throw new Error("File kosong");

                const payloadItems = rawData.map(row => ({
                    id: crypto.randomUUID(),
                    code: String(row.Kode || row.code || '').trim(),
                    name: String(row.Nama || row.name || '').trim(),
                    category: String(row.Kategori || row.category || 'Umum').trim(),
                    baseUnit: String(row.Satuan_Dasar || row.baseUnit || 'Pcs').trim(),
                    minStock: Number(row.Stok_Minimum || row.minStock || 0),
                    conversions: []
                })).filter(it => it.code && it.name);

                await StorageService.bulkSaveItems(payloadItems);
                showToast(`Berhasil import ${payloadItems.length} item`, "success");
                loadData();
            } catch (err: any) {
                showToast(err.message || "Gagal import", "error");
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSaveItem = async () => {
        if (!itemForm.code || !itemForm.name) return showToast("Kode & Nama wajib diisi.", "warning");
        setIsLoading(true);
        try {
            const payload = {
                ...itemForm,
                id: editingItem?.id || crypto.randomUUID(),
                minStock: Number(itemForm.minStock) || 0,
                initialStock: Number(itemForm.initialStock) || 0,
                conversions: (itemForm.conversions || []).filter(c => c.name && c.ratio > 0).map(c => ({
                    ...c,
                    operator: c.operator || '*'
                }))
            } as Item;
            await StorageService.saveItem(payload);
            showToast("Simpan Berhasil", "success");
            setShowItemModal(false);
            loadData();
        } catch (e: any) {
            showToast(e.message || "Gagal simpan", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenEdit = (item: Item) => {
        setEditingItem(item);
        setItemForm({ 
            ...item, 
            initialStock: '' as any, // Always clean initial stock on edit
            conversions: item.conversions ? [...item.conversions] : []
        }); 
        setShowItemModal(true);
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.size === inventoryData.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(inventoryData.map(i => i.id)));
    };

    const handleToggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Hapus ${selectedIds.size} item?`)) return;
        setIsLoading(true);
        try {
            const result = await StorageService.deleteItems(Array.from(selectedIds));
            showToast(`${result.count} berhasil dihapus`, "success");
            setSelectedIds(new Set());
            loadData();
        } catch (e: any) {
            showToast(e.message || "Gagal hapus.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const updateConversion = (index: number, updates: Partial<UnitConversion>) => {
        const next = [...(itemForm.conversions || [])];
        next[index] = { ...next[index], ...updates };
        setItemForm({ ...itemForm, conversions: next });
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-950 p-4 gap-4 transition-colors font-sans">
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={15} />
                        <input 
                            type="text" 
                            placeholder="" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-blue-500 focus:bg-white border rounded-xl text-sm outline-none w-72 transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-100 transition-all animate-in zoom-in">
                            <Trash2 size={15}/> Hapus ({selectedIds.size})
                        </button>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportXLSX} />
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isImporting}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold border border-emerald-100 hover:bg-emerald-100 disabled:opacity-50 transition-all"
                    >
                        {isImporting ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15}/>} 
                        Import
                    </button>
                    <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', minStock: '' as any, initialStock: '' as any, conversions: [] }); setShowItemModal(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all">
                        <Plus size={18}/> Item Baru
                    </button>
                    <button onClick={loadData} className="p-2.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
                </div>
            </div>

            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1 scrollbar-thin">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-[#fcfdfe] dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10 border-b dark:border-slate-700">
                            <tr>
                                <th className="p-4 w-12 text-center">
                                    <button onClick={handleToggleSelectAll} className="hover:scale-110 transition-transform">
                                        {selectedIds.size === inventoryData.length && inventoryData.length > 0 ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18} className="text-slate-300"/>}
                                    </button>
                                </th>
                                {visibleColumns.has('code') && <th className="p-4 w-36">Kode Ref</th>}
                                {visibleColumns.has('name') && <th className="p-4 w-auto">Nama</th>}
                                {visibleColumns.has('category') && <th className="p-4 w-36">Kategori</th>}
                                {warehouses.map(wh => (
                                    <th key={wh.id} className="p-4 w-24 text-right text-blue-500 border-l dark:border-slate-700/50">{wh.name}</th>
                                ))}
                                {visibleColumns.has('total') && <th className="p-4 w-28 text-right bg-blue-50/30 dark:bg-blue-900/10 font-black">Stok</th>}
                                {visibleColumns.has('unit') && <th className="p-4 w-20 text-center">Unit</th>}
                                {visibleColumns.has('actions') && <th className="p-4 w-16 text-center">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody className="text-[11px] divide-y dark:divide-slate-800">
                            {inventoryData.length === 0 ? (
                                <tr>
                                    <td colSpan={15} className="p-24 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <Database size={48}/>
                                            <p className="font-black uppercase tracking-widest">Kosong</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : inventoryData.map((item, idx) => (
                                <tr key={item.id} className={`group transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50/50 dark:bg-blue-900/30' : (isZebra && idx % 2 !== 0 ? 'bg-[#fafbfc]/50 dark:bg-slate-800/20' : 'hover:bg-[#f1f5f9]/50 dark:hover:bg-slate-800/40')}`}>
                                    <td className="p-4 text-center">
                                        <button onClick={() => handleToggleSelect(item.id)} className="transition-transform active:scale-75">
                                            {selectedIds.has(item.id) ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18} className="text-slate-200 group-hover:text-slate-400"/>}
                                        </button>
                                    </td>
                                    {visibleColumns.has('code') && <td className="p-4 font-mono font-bold text-slate-500">{item.code}</td>}
                                    {visibleColumns.has('name') && <td className="p-4 font-black text-slate-700 dark:text-slate-200 truncate group-hover:text-blue-600 transition-colors">{item.name}</td>}
                                    {visibleColumns.has('category') && <td className="p-4 text-slate-400 font-bold uppercase tracking-tight">{item.category}</td>}
                                    {item.whBreakdown.map(bd => (
                                        <td key={bd.whId} className="p-4 text-right font-mono text-slate-600 border-l dark:border-slate-800/30">{bd.qty.toLocaleString()}</td>
                                    ))}
                                    {visibleColumns.has('total') && <td className="p-4 text-right font-black font-mono text-blue-600 text-[13px]">{item.totalStock.toLocaleString()}</td>}
                                    {visibleColumns.has('unit') && <td className="p-4 text-center"><span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-500 border border-slate-200 dark:border-slate-700">{item.baseUnit}</span></td>}
                                    {visibleColumns.has('actions') && (
                                        <td className="p-4 text-center">
                                            <button onClick={() => handleOpenEdit(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all"><Edit3 size={15}/></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showItemModal && (
                <div className="fixed inset-0 bg-slate-950/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-3xl shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        
                        <div className="bg-slate-900 text-white px-10 py-8 flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                            
                            <div className="relative z-10 flex items-center gap-6">
                                <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-700 rounded-3xl shadow-xl shadow-blue-500/20 ring-4 ring-white/10">
                                    <Box size={28} className="text-white"/>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black tracking-tight leading-none">
                                        {editingItem ? 'Edit Item' : 'Barang Baru'}
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                                        <ShieldCheck size={12} className="text-emerald-500"/> MySQL Connected
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowItemModal(false)} className="relative z-10 p-3 hover:bg-white/10 rounded-2xl transition-all group"><X size={24} className="group-hover:rotate-90 transition-transform"/></button>
                        </div>

                        <div className="p-10 space-y-10 overflow-y-auto max-h-[70vh] scrollbar-hide">
                            <div className="grid grid-cols-12 gap-8">
                                <div className="col-span-12 flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600"><Tag size={16}/></div>
                                    <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Identitas</h4>
                                </div>
                                
                                <div className="col-span-4 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Kode</label>
                                    <input 
                                        type="text" 
                                        className="accurate-input font-mono font-bold text-blue-600 uppercase" 
                                        placeholder="" 
                                        value={itemForm.code} 
                                        onChange={e => setItemForm({...itemForm, code: e.target.value})} 
                                    />
                                </div>
                                <div className="col-span-8 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Nama Barang</label>
                                    <input 
                                        type="text" 
                                        className="accurate-input font-black text-slate-800 dark:text-white" 
                                        placeholder="" 
                                        value={itemForm.name} 
                                        onChange={e => setItemForm({...itemForm, name: e.target.value})} 
                                    />
                                </div>
                                <div className="col-span-12 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Kategori</label>
                                    <input 
                                        type="text" 
                                        className="accurate-input" 
                                        placeholder="" 
                                        value={itemForm.category} 
                                        onChange={e => setItemForm({...itemForm, category: e.target.value.toUpperCase()})} 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-8 pt-8 border-t dark:border-slate-800">
                                <div className="col-span-12 flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600"><Database size={16}/></div>
                                    <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Manajemen Stok</h4>
                                </div>

                                <div className="col-span-4 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Satuan Dasar</label>
                                    <input 
                                        type="text" 
                                        className="accurate-input border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-900/10 font-black text-emerald-700 dark:text-emerald-400" 
                                        placeholder="" 
                                        value={itemForm.baseUnit} 
                                        onChange={e => setItemForm({...itemForm, baseUnit: e.target.value})} 
                                    />
                                </div>
                                <div className="col-span-4 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Min. Stok</label>
                                    <input 
                                        type="number" 
                                        className="accurate-input text-right font-mono font-bold" 
                                        value={itemForm.minStock} 
                                        onChange={e => setItemForm({...itemForm, minStock: e.target.value as any})} 
                                    />
                                </div>
                                {!editingItem && (
                                    <div className="col-span-4 space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Stok Awal</label>
                                        <input 
                                            type="number" 
                                            className="accurate-input text-right font-mono font-black text-blue-600 bg-blue-50/30 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/50" 
                                            value={itemForm.initialStock} 
                                            onChange={e => setItemForm({...itemForm, initialStock: e.target.value as any})} 
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-[#fcfdfe] dark:bg-slate-950 p-8 border-t dark:border-slate-800 flex justify-between items-center shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
                            <div className="flex items-center gap-3 text-slate-400 max-w-xs">
                                <AlertCircle size={18} className="flex-shrink-0 text-amber-500"/>
                                <span className="text-[10px] font-bold uppercase leading-tight tracking-tight">Database Synced.</span>
                            </div>
                            <div className="flex gap-6 items-center">
                                <button onClick={() => setShowItemModal(false)} className="text-xs font-black text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-widest px-4">Batal</button>
                                <button 
                                    onClick={handleSaveItem} 
                                    disabled={isLoading} 
                                    className="px-12 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[20px] font-black text-xs shadow-2xl shadow-blue-500/40 flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                                    {editingItem ? 'SIMPAN' : 'POSTING'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .accurate-input { 
                    @apply w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-2xl px-5 py-3.5 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm; 
                }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};
