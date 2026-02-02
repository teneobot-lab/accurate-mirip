
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
        minStock: 10,
        initialStock: 0,
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

    const downloadTemplate = () => {
        const templateData = [
            { "Kode": "BRG-001", "Nama": "Contoh Barang A", "Kategori": "Elektronik", "Satuan_Dasar": "Pcs", "Stok_Minimum": 10 },
            { "Kode": "BRG-002", "Nama": "Contoh Barang B", "Kategori": "ATK", "Satuan_Dasar": "Pack", "Stok_Minimum": 5 }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Template_Master_Barang.xlsx");
        showToast("Template berhasil diunduh", "success");
    };

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
                
                if (rawData.length === 0) throw new Error("File kosong atau format salah");

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
                showToast(`Berhasil mengimpor ${payloadItems.length} item`, "success");
                loadData();
            } catch (err: any) {
                showToast(err.message || "Gagal mengimpor file", "error");
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
                conversions: (itemForm.conversions || []).filter(c => c.name && c.ratio > 0).map(c => ({
                    ...c,
                    operator: c.operator || '*'
                }))
            } as Item;
            await StorageService.saveItem(payload);
            showToast(editingItem ? "Data barang diperbarui" : "Barang baru ditambahkan", "success");
            setShowItemModal(false);
            loadData();
        } catch (e: any) {
            showToast(e.message || "Gagal menyimpan ke server.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenEdit = (item: Item) => {
        setEditingItem(item);
        setItemForm({ 
            ...item, 
            initialStock: 0,
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
        if (!confirm(`Hapus ${selectedIds.size} item terpilih secara permanen? Data yang sudah ada riwayat transaksinya akan ditolak sistem.`)) return;
        setIsLoading(true);
        try {
            const result = await StorageService.deleteItems(Array.from(selectedIds));
            showToast(`${result.count} item berhasil dihapus`, "success");
            setSelectedIds(new Set());
            loadData();
        } catch (e: any) {
            showToast(e.message || "Gagal menghapus data.", "error");
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
            {/* Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={15} />
                        <input 
                            type="text" 
                            placeholder="Cari Master Barang..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-blue-500 focus:bg-white border rounded-xl text-sm outline-none w-72 transition-all shadow-sm"
                        />
                    </div>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>
                    <button onClick={() => setIsZebra(!isZebra)} title="Zebra View" className={`p-2 rounded-xl transition-all ${isZebra ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Layers size={18}/></button>
                    <div className="relative">
                        <button onClick={() => setShowColumnFilter(!showColumnFilter)} title="Filter Kolom" className={`p-2 rounded-xl transition-all ${showColumnFilter ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Columns size={18}/></button>
                        {showColumnFilter && (
                            <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-3 animate-in fade-in slide-in-from-top-2">
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-3 px-1 flex items-center gap-2"><Filter size={10}/> Visibilitas Kolom</p>
                                <div className="space-y-1">
                                    {['code', 'name', 'category', 'total', 'unit'].map(c => (
                                        <label key={c} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer text-xs transition-colors">
                                            <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" checked={visibleColumns.has(c)} onChange={() => {
                                                const next = new Set(visibleColumns);
                                                if (next.has(c)) next.delete(c); else next.add(c);
                                                setVisibleColumns(next);
                                            }} /> 
                                            <span className="capitalize font-medium text-slate-600 dark:text-slate-300">{c === 'code' ? 'Kode' : c === 'name' ? 'Nama' : c === 'total' ? 'Stok' : c}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-100 transition-all animate-in zoom-in">
                            <Trash2 size={15}/> Hapus ({selectedIds.size})
                        </button>
                    )}
                    <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700">
                        <Download size={15}/> Template
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportXLSX} />
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isImporting}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold border border-emerald-100 hover:bg-emerald-100 disabled:opacity-50 transition-all"
                    >
                        {isImporting ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15}/>} 
                        Import
                    </button>
                    <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', minStock: 10, initialStock: 0, conversions: [] }); setShowItemModal(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all">
                        <Plus size={18}/> Item Baru
                    </button>
                    <button onClick={loadData} className="p-2.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
                </div>
            </div>

            {/* Data Table */}
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
                                {visibleColumns.has('name') && <th className="p-4 w-auto">Nama Deskriptif Barang</th>}
                                {visibleColumns.has('category') && <th className="p-4 w-36">Kategori</th>}
                                {warehouses.map(wh => (
                                    <th key={wh.id} className="p-4 w-24 text-right text-blue-500 border-l dark:border-slate-700/50">{wh.name}</th>
                                ))}
                                {visibleColumns.has('total') && <th className="p-4 w-28 text-right bg-blue-50/30 dark:bg-blue-900/10 font-black">Total Stok</th>}
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
                                            <p className="font-black uppercase tracking-widest">Database Kosong</p>
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

            {/* Item Modal */}
            {showItemModal && (
                <div className="fixed inset-0 bg-slate-950/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-3xl shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        
                        {/* Header */}
                        <div className="bg-slate-900 text-white px-10 py-8 flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                            
                            <div className="relative z-10 flex items-center gap-6">
                                <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-700 rounded-3xl shadow-xl shadow-blue-500/20 ring-4 ring-white/10">
                                    <Box size={28} className="text-white"/>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-xl font-black tracking-tight leading-none">
                                            {editingItem ? 'Informasi Perubahan Item' : 'Registrasi Barang Baru'}
                                        </h3>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                                        <ShieldCheck size={12} className="text-emerald-500"/> Terkoneksi ke MySQL Instance: gp_waresix_db
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowItemModal(false)} className="relative z-10 p-3 hover:bg-white/10 rounded-2xl transition-all group"><X size={24} className="group-hover:rotate-90 transition-transform"/></button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-10 space-y-10 overflow-y-auto max-h-[70vh] scrollbar-hide">
                            <div className="grid grid-cols-12 gap-8">
                                <div className="col-span-12 flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600"><Tag size={16}/></div>
                                    <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Spesifikasi Identitas</h4>
                                </div>
                                
                                <div className="col-span-4 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Katalog / Kode</label>
                                    <input 
                                        type="text" 
                                        className="accurate-input font-mono font-bold text-blue-600 uppercase" 
                                        placeholder="EX: SKU-001" 
                                        value={itemForm.code} 
                                        onChange={e => setItemForm({...itemForm, code: e.target.value})} 
                                    />
                                </div>
                                <div className="col-span-8 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Nama Deskriptif (Wajib)</label>
                                    <input 
                                        type="text" 
                                        className="accurate-input font-black text-slate-800 dark:text-white" 
                                        placeholder="Contoh: SEMEN TIGA RODA 50KG" 
                                        value={itemForm.name} 
                                        onChange={e => setItemForm({...itemForm, name: e.target.value})} 
                                    />
                                </div>
                                <div className="col-span-12 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Kategori Inventaris</label>
                                    <input 
                                        type="text" 
                                        className="accurate-input" 
                                        placeholder="Contoh: MATERIAL / ELEKTRONIK / MAKANAN" 
                                        value={itemForm.category} 
                                        onChange={e => setItemForm({...itemForm, category: e.target.value.toUpperCase()})} 
                                    />
                                </div>
                            </div>

                            {/* Unit & Stock Control */}
                            <div className="grid grid-cols-12 gap-8 pt-8 border-t dark:border-slate-800">
                                <div className="col-span-12 flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600"><Database size={16}/></div>
                                    <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Manajemen Kontrol Stok</h4>
                                </div>

                                <div className="col-span-4 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Satuan Terkecil</label>
                                    <input 
                                        type="text" 
                                        className="accurate-input border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-900/10 font-black text-emerald-700 dark:text-emerald-400" 
                                        placeholder="Pcs / Box / Kg" 
                                        value={itemForm.baseUnit} 
                                        onChange={e => setItemForm({...itemForm, baseUnit: e.target.value})} 
                                    />
                                </div>
                                <div className="col-span-4 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Minimal Stok Alert</label>
                                    <input 
                                        type="number" 
                                        className="accurate-input text-right font-mono font-bold" 
                                        value={itemForm.minStock} 
                                        onChange={e => setItemForm({...itemForm, minStock: Number(e.target.value)})} 
                                    />
                                </div>
                                {!editingItem && (
                                    <div className="col-span-4 space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Stok Awal (Saldo)</label>
                                        <input 
                                            type="number" 
                                            className="accurate-input text-right font-mono font-black text-blue-600 bg-blue-50/30 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/50" 
                                            value={itemForm.initialStock} 
                                            onChange={e => setItemForm({...itemForm, initialStock: Number(e.target.value)})} 
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Multi-Unit Conversion Section */}
                            <div className="pt-8 border-t dark:border-slate-800">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600"><LayoutGrid size={16}/></div>
                                        <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Unit Conversion Engine</h4>
                                    </div>
                                    <button 
                                        onClick={() => setItemForm({...itemForm, conversions: [...(itemForm.conversions || []), { name: '', ratio: 1, operator: '*' }]})} 
                                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-all active:scale-95"
                                    >
                                        <Plus size={14}/> Tambah Satuan
                                    </button>
                                </div>
                                
                                <div className="space-y-4">
                                    {itemForm.conversions?.map((c, i) => (
                                        <div key={i} className="flex flex-col gap-4 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[24px] border dark:border-slate-800 group hover:border-blue-300 transition-all shadow-sm">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center text-[10px] font-black">L{i+1}</span>
                                                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Level Satuan {i+1}</h5>
                                                </div>
                                                <button 
                                                    onClick={() => setItemForm({...itemForm, conversions: itemForm.conversions?.filter((_, idx) => idx !== i)})} 
                                                    className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-12 gap-6 items-end">
                                                <div className="col-span-4 space-y-1.5">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nama Satuan</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-white dark:bg-slate-900 p-3 rounded-xl border dark:border-slate-700 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-blue-500" 
                                                        placeholder="BOX / DUS / KG" 
                                                        value={c.name} 
                                                        onChange={e => updateConversion(i, { name: e.target.value.toUpperCase() })} 
                                                    />
                                                </div>

                                                <div className="col-span-3 space-y-1.5">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Operator Logika</label>
                                                    <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border dark:border-slate-700 gap-1">
                                                        <button 
                                                            onClick={() => updateConversion(i, { operator: '*' })}
                                                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${c.operator === '*' || !c.operator ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                        >KALI (*)</button>
                                                        <button 
                                                            onClick={() => updateConversion(i, { operator: '/' })}
                                                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${c.operator === '/' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                        >BAGI (/)</button>
                                                    </div>
                                                </div>

                                                <div className="col-span-5 space-y-1.5">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Rasio terhadap {itemForm.baseUnit}</label>
                                                    <div className="flex items-center gap-3">
                                                        <input 
                                                            type="number" 
                                                            className="flex-1 bg-white dark:bg-slate-900 p-3 rounded-xl border dark:border-slate-700 text-sm font-black text-right outline-none focus:ring-2 focus:ring-blue-500" 
                                                            value={c.ratio} 
                                                            onChange={e => updateConversion(i, { ratio: Number(e.target.value) })} 
                                                        />
                                                        <span className="text-[10px] font-black text-slate-500 uppercase w-12">{itemForm.baseUnit}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Human readable logic helper */}
                                            <div className="bg-white dark:bg-slate-950/40 p-3 rounded-xl border border-dashed dark:border-slate-800 flex items-center justify-center gap-3">
                                                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-[10px] font-black text-slate-600 dark:text-slate-300">1 {c.name || '...'}</div>
                                                <Equal size={12} className="text-slate-300"/>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">{c.ratio}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{c.operator === '/' ? 'BAGI' : 'KALI'}</span>
                                                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">{itemForm.baseUnit}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!itemForm.conversions || itemForm.conversions.length === 0) && (
                                        <div className="bg-slate-50 dark:bg-slate-800/30 border-2 border-dashed dark:border-slate-800 rounded-2xl p-8 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-3">
                                                <Info size={16}/> Gunakan konversi jika item memiliki satuan bertingkat (Box, Dus, Pack)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-[#fcfdfe] dark:bg-slate-950 p-8 border-t dark:border-slate-800 flex justify-between items-center shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
                            <div className="flex items-center gap-3 text-slate-400 max-w-xs">
                                <AlertCircle size={18} className="flex-shrink-0 text-amber-500"/>
                                <span className="text-[10px] font-bold uppercase leading-tight tracking-tight">Data dikirim via Waresix API. Pastikan rasio konversi akurat sebelum registrasi.</span>
                            </div>
                            <div className="flex gap-6 items-center">
                                <button onClick={() => setShowItemModal(false)} className="text-xs font-black text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-widest px-4">Batal</button>
                                <button 
                                    onClick={handleSaveItem} 
                                    disabled={isLoading} 
                                    className="px-12 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[20px] font-black text-xs shadow-2xl shadow-blue-500/40 flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                                    {editingItem ? 'PERBARUI MASTER ITEM' : 'REGISTRASI KE DATABASE'}
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
