
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, UnitConversion } from '../types';
import { Search, Upload, Download, Trash2, Box, RefreshCw, Plus, X, ArrowRight, Loader2, CheckSquare, Square, Filter, Columns, List, Edit3, Save, Layers, FileSpreadsheet, Info, AlertCircle, LayoutGrid, Database, Tag, ShieldCheck, Equal, ChevronDown, Barcode, Package, Ruler, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
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
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['code', 'name', 'category', 'total', 'unit', 'status', 'actions']));
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
        isActive: true, // Default active
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
                    isActive: true,
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
                isActive: itemForm.isActive === undefined ? true : itemForm.isActive,
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
            isActive: item.isActive,
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
        <div className="flex flex-col h-full p-4 gap-4 transition-colors font-sans">
            {/* Toolbar - Gable Green Card */}
            <div className="bg-gable p-3 rounded-xl shadow-sm border border-spectra flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-spectra transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Cari Master Barang..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-daintree border border-spectra rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-spectra/20 focus:border-spectra w-80 transition-all text-slate-200 placeholder:text-slate-400"
                        />
                    </div>
                    <div className="h-8 w-px bg-spectra"></div>
                    <button onClick={() => setIsZebra(!isZebra)} title="Toggle Striped Rows" className={`p-2.5 rounded-xl transition-all border ${isZebra ? 'bg-spectra/10 border-spectra/30 text-cutty' : 'border-transparent text-slate-400 hover:bg-daintree'}`}><Layers size={18}/></button>
                    <div className="relative">
                        <button onClick={() => setShowColumnFilter(!showColumnFilter)} title="Filter Kolom" className={`p-2.5 rounded-xl transition-all border ${showColumnFilter ? 'bg-spectra/10 border-spectra/30 text-cutty' : 'border-transparent text-slate-400 hover:bg-daintree'}`}><Columns size={18}/></button>
                        {showColumnFilter && (
                            <div className="absolute top-full left-0 mt-2 w-56 bg-gable border border-spectra rounded-xl shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-2">
                                <p className="text-[10px] font-bold uppercase text-slate-400 mb-3 px-1 flex items-center gap-2"><Filter size={12}/> Visibilitas Kolom</p>
                                <div className="space-y-1">
                                    {['code', 'name', 'category', 'total', 'unit', 'status'].map(c => (
                                        <label key={c} className="flex items-center gap-3 p-2 hover:bg-spectra/20 rounded-lg cursor-pointer text-xs transition-colors select-none">
                                            <input type="checkbox" className="rounded text-spectra focus:ring-spectra" checked={visibleColumns.has(c)} onChange={() => {
                                                const next = new Set(visibleColumns);
                                                if (next.has(c)) next.delete(c); else next.add(c);
                                                setVisibleColumns(next);
                                            }} /> 
                                            <span className="capitalize font-bold text-slate-300">{c === 'code' ? 'Kode' : c === 'name' ? 'Nama' : c === 'total' ? 'Stok' : c}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-200 hover:bg-red-100 transition-all animate-in zoom-in">
                            <Trash2 size={16}/> Hapus ({selectedIds.size})
                        </button>
                    )}
                    <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2.5 text-slate-300 hover:bg-spectra/20 rounded-xl text-xs font-bold transition-all border border-spectra bg-daintree">
                        <Download size={16}/> Template
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportXLSX} />
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isImporting}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-900/20 text-emerald-400 rounded-xl text-xs font-bold border border-emerald-800 hover:bg-emerald-900 disabled:opacity-50 transition-all"
                    >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16}/>} 
                        Import
                    </button>
                    <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', minStock: 10, initialStock: 0, isActive: true, conversions: [] }); setShowItemModal(true); }} className="flex items-center gap-2 px-6 py-2.5 bg-daintree text-white rounded-xl text-xs font-bold shadow-lg shadow-black/20 hover:bg-spectra active:scale-95 transition-all">
                        <Plus size={18}/> Item Baru
                    </button>
                    <button onClick={loadData} className="p-2.5 text-slate-400 hover:bg-spectra/20 rounded-xl border border-transparent hover:border-spectra"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
                </div>
            </div>

            {/* Data Table - Rounded Wrapper & Dense */}
            <div className="flex-1 rounded-xl border border-spectra overflow-hidden flex flex-col shadow-sm bg-gable">
                <div className="overflow-auto flex-1 scrollbar-thin">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-daintree text-[11px] font-bold text-cutty uppercase tracking-wider sticky top-0 z-10 border-b border-spectra shadow-md">
                            <tr>
                                <th className="px-4 py-2.5 w-12 text-center">
                                    <button onClick={handleToggleSelectAll} className="hover:scale-110 transition-transform">
                                        {selectedIds.size === inventoryData.length && inventoryData.length > 0 ? <CheckSquare size={18} className="text-white"/> : <Square size={18} className="text-white/30 dark:text-spectra/50"/>}
                                    </button>
                                </th>
                                {visibleColumns.has('code') && <th className="px-4 py-2.5 w-40 border-l border-white/10 dark:border-spectra">Kode Ref</th>}
                                {visibleColumns.has('name') && <th className="px-4 py-2.5 w-auto border-l border-white/10 dark:border-spectra">Nama Barang</th>}
                                {visibleColumns.has('category') && <th className="px-4 py-2.5 w-40 border-l border-white/10 dark:border-spectra">Kategori</th>}
                                {warehouses.map(wh => (
                                    <th key={wh.id} className="px-4 py-2.5 w-28 text-right text-slate-400 border-l border-white/10 dark:border-spectra">{wh.name}</th>
                                ))}
                                {visibleColumns.has('total') && <th className="px-4 py-2.5 w-28 text-right bg-spectra/10 text-cutty border-l border-white/10 dark:border-spectra">Total Stok</th>}
                                {visibleColumns.has('unit') && <th className="px-4 py-2.5 w-24 text-center border-l border-white/10 dark:border-spectra">Unit</th>}
                                {visibleColumns.has('status') && <th className="px-4 py-2.5 w-24 text-center border-l border-white/10 dark:border-spectra">Status</th>}
                                {visibleColumns.has('actions') && <th className="px-4 py-2.5 w-20 text-center border-l border-white/10 dark:border-spectra">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-spectra/30">
                            {inventoryData.length === 0 ? (
                                <tr>
                                    <td colSpan={15} className="p-24 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-40">
                                            <div className="p-4 bg-daintree rounded-full"><Database size={40} className="text-white"/></div>
                                            <p className="font-bold uppercase tracking-widest text-slate-400">Database Kosong</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : inventoryData.map((item, idx) => (
                                <tr key={item.id} className={`group transition-colors ${selectedIds.has(item.id) ? 'bg-spectra/20' : (isZebra && idx % 2 !== 0 ? 'bg-daintree/30' : 'hover:bg-spectra/20')} ${!item.isActive ? 'opacity-60 grayscale' : ''}`}>
                                    <td className="px-4 py-2 text-center">
                                        <button onClick={() => handleToggleSelect(item.id)} className="transition-transform active:scale-90">
                                            {selectedIds.has(item.id) ? <CheckSquare size={18} className="text-spectra"/> : <Square size={18} className="text-slate-300 dark:text-spectra/50 group-hover:text-slate-400"/>}
                                        </button>
                                    </td>
                                    {visibleColumns.has('code') && <td className="px-4 py-2 font-mono font-bold text-slate-400 border-l border-transparent">{item.code}</td>}
                                    {visibleColumns.has('name') && <td className="px-4 py-2 font-bold text-slate-200 truncate group-hover:text-cutty transition-colors border-l border-transparent">{item.name}</td>}
                                    {visibleColumns.has('category') && <td className="px-4 py-2 text-slate-500 font-bold text-[10px] uppercase tracking-wide border-l border-transparent">{item.category}</td>}
                                    {item.whBreakdown.map(bd => (
                                        <td key={bd.whId} className={`px-4 py-2 text-right font-mono border-l ${bd.qty > 0 ? 'text-slate-200 font-bold' : 'text-slate-600'}`}>{bd.qty > 0 ? bd.qty.toLocaleString() : '-'}</td>
                                    ))}
                                    {visibleColumns.has('total') && <td className="px-4 py-2 text-right font-black font-mono text-cutty border-l border-spectra/30 group-hover:border-transparent text-[13px]">{item.totalStock.toLocaleString()}</td>}
                                    {visibleColumns.has('unit') && <td className="px-4 py-2 text-center border-l border-transparent"><span className="px-2 py-0.5 rounded bg-daintree text-[10px] font-bold uppercase text-slate-400 border border-spectra">{item.baseUnit}</span></td>}
                                    {visibleColumns.has('status') && (
                                        <td className="px-4 py-2 text-center border-l border-transparent">
                                            {item.isActive ? 
                                                <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-900">Aktif</span> : 
                                                <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Nonaktif</span>
                                            }
                                        </td>
                                    )}
                                    {visibleColumns.has('actions') && (
                                        <td className="px-4 py-2 text-center border-l border-transparent">
                                            <button onClick={() => handleOpenEdit(item)} className="p-1.5 text-slate-400 hover:text-spectra hover:bg-spectra/10 rounded-lg transition-all"><Edit3 size={16}/></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Item Modal - Fully Rounded & Dense */}
            {showItemModal && (
                <div className="fixed inset-0 bg-daintree/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300 font-sans">
                    <div className="bg-gable rounded-[32px] w-full max-w-3xl border border-spectra overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95">
                        
                        {/* Header */}
                        <div className="bg-daintree border-b border-spectra px-8 py-5 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-gable rounded-xl shadow-sm border border-spectra text-cutty">
                                    <Box size={20}/>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-white uppercase tracking-tight leading-none mb-1">
                                        {editingItem ? 'Edit Master Item' : 'Registrasi Barang Baru'}
                                    </h3>
                                    <p className="text-[10px] text-cutty font-bold uppercase tracking-widest flex items-center gap-2">
                                        <ShieldCheck size={12} className="text-emerald-500"/> Database Management
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowItemModal(false)} className="p-2 text-slate-400 hover:bg-spectra/20 rounded-xl transition-all"><X size={20}/></button>
                        </div>

                        {/* Modal Body - Vertical Layout */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin">
                            
                            {/* Section 1: Identitas Produk (Card Style) */}
                            <div className="bg-daintree/30 p-5 rounded-2xl border border-spectra/30 space-y-4 shadow-sm">
                                <div className="flex items-center justify-between pb-2 border-b border-spectra/50">
                                    <div className="flex items-center gap-2">
                                        <Tag size={14} className="text-spectra"/>
                                        <h4 className="text-[10px] font-black uppercase text-cutty tracking-widest">Identitas Produk</h4>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-bold uppercase ${itemForm.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>{itemForm.isActive ? 'Item Aktif' : 'Nonaktif'}</span>
                                        <button onClick={() => setItemForm({...itemForm, isActive: !itemForm.isActive})} className={`transition-colors ${itemForm.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                                            {itemForm.isActive ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-12 gap-5">
                                    <div className="col-span-3 space-y-2 group">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-focus-within:text-spectra transition-colors">Kode SKU</label>
                                        <div className="relative">
                                            <Barcode size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none"/>
                                            <input 
                                                type="text" 
                                                className="modal-input" 
                                                style={{ paddingLeft: '2.75rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                                placeholder="AUTO" 
                                                autoComplete="off"
                                                value={itemForm.code} 
                                                onChange={e => setItemForm({...itemForm, code: e.target.value})} 
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-5 space-y-2 group">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-focus-within:text-spectra transition-colors">Nama Barang</label>
                                        <div className="relative">
                                            <Package size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors pointer-events-none"/>
                                            <input 
                                                type="text" 
                                                className="modal-input" 
                                                style={{ paddingLeft: '2.75rem', color: 'white', letterSpacing: '0.025em', fontWeight: 'bold' }}
                                                placeholder="Nama Item..." 
                                                autoComplete="off"
                                                value={itemForm.name} 
                                                onChange={e => setItemForm({...itemForm, name: e.target.value})} 
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-4 space-y-2 group">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-focus-within:text-spectra transition-colors">Kategori</label>
                                        <div className="relative">
                                            <Layers size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-spectra transition-colors pointer-events-none"/>
                                            <input 
                                                type="text" 
                                                className="modal-input" 
                                                style={{ paddingLeft: '2.75rem', fontWeight: 'bold', color: '#e2e8f0' }}
                                                placeholder="Ketik Kategori..." 
                                                autoComplete="off"
                                                value={itemForm.category} 
                                                onChange={e => setItemForm({...itemForm, category: e.target.value.toUpperCase()})} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Kontrol Stok (Card Style) */}
                            <div className="bg-daintree/30 p-5 rounded-2xl border border-spectra/30 space-y-4 shadow-sm">
                                <div className="flex items-center gap-2 pb-2 border-b border-spectra/50">
                                    <Database size={14} className="text-emerald-600"/>
                                    <h4 className="text-[10px] font-black uppercase text-cutty tracking-widest">Kontrol Stok</h4>
                                </div>
                                <div className="grid grid-cols-12 gap-5">
                                    <div className="col-span-4 space-y-2 group">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-focus-within:text-spectra transition-colors">Satuan Dasar</label>
                                        <div className="relative">
                                            <Ruler size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors pointer-events-none"/>
                                            <input 
                                                type="text" 
                                                className="modal-input" 
                                                style={{ paddingLeft: '2.5rem', fontWeight: '900', color: 'white', textAlign: 'center' }}
                                                placeholder="Pcs" 
                                                autoComplete="off"
                                                value={itemForm.baseUnit} 
                                                onChange={e => setItemForm({...itemForm, baseUnit: e.target.value})} 
                                            />
                                        </div>
                                    </div>
                                    {!editingItem && (
                                        <div className="col-span-4 space-y-2 group">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-focus-within:text-spectra transition-colors">Stok Awal</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    className="modal-input" 
                                                    style={{ textAlign: 'right', fontFamily: 'monospace', color: '#34d399', fontWeight: 'bold', paddingRight: '1rem' }}
                                                    autoComplete="off"
                                                    value={itemForm.initialStock} 
                                                    onChange={e => setItemForm({...itemForm, initialStock: Number(e.target.value)})} 
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="col-span-4 space-y-2 group">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-focus-within:text-red-400 transition-colors">Min. Alert</label>
                                        <div className="relative">
                                            <AlertTriangle size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-red-400 transition-colors pointer-events-none"/>
                                            <input 
                                                type="number" 
                                                className="modal-input" 
                                                style={{ textAlign: 'right', fontFamily: 'monospace', color: '#fca5a5', fontWeight: 'bold', paddingLeft: '2.5rem' }}
                                                autoComplete="off"
                                                value={itemForm.minStock} 
                                                onChange={e => setItemForm({...itemForm, minStock: Number(e.target.value)})} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Multi-Unit Conversion (Table Style) */}
                            <div className="space-y-3 pt-2">
                                <div className="flex justify-between items-center pb-2 px-1">
                                    <div className="flex items-center gap-2">
                                        <LayoutGrid size={14} className="text-amber-600"/>
                                        <h4 className="text-[10px] font-black uppercase text-cutty tracking-widest">Konversi Satuan</h4>
                                    </div>
                                    <button 
                                        onClick={() => setItemForm({...itemForm, conversions: [...(itemForm.conversions || []), { name: '', ratio: 1, operator: '*' }]})} 
                                        className="text-[10px] font-bold text-spectra hover:text-white bg-spectra/10 hover:bg-spectra px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                                    >
                                        <Plus size={12}/> Tambah Baris
                                    </button>
                                </div>
                                
                                {/* TABLE WRAPPER (ROUNDED & DENSE) */}
                                <div className="rounded-2xl border border-spectra/50 overflow-hidden bg-daintree/20 shadow-inner">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-daintree text-[9px] font-black uppercase text-cutty tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3 w-12 text-center border-b border-spectra/50">#</th>
                                                <th className="px-4 py-3 border-b border-spectra/50">Nama Satuan</th>
                                                <th className="px-4 py-3 w-36 border-b border-spectra/50">Operator</th>
                                                <th className="px-4 py-3 w-36 text-right border-b border-spectra/50">Rasio ({itemForm.baseUnit})</th>
                                                <th className="px-4 py-3 w-12 border-b border-spectra/50"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-spectra/20 text-xs bg-gable/30">
                                            {(itemForm.conversions || []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-[10px] text-slate-500 italic">
                                                        <div className="flex flex-col items-center gap-2 opacity-50">
                                                            <Equal size={20}/>
                                                            <span>Belum ada satuan konversi tambahan</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                itemForm.conversions?.map((c, i) => (
                                                    <tr key={i} className="hover:bg-daintree/50 transition-colors group">
                                                        <td className="px-4 py-2 text-center text-[10px] text-slate-500 font-bold align-middle">{i+1}</td>
                                                        <td className="px-4 py-2 align-middle">
                                                            <input 
                                                                type="text" 
                                                                className="table-input" 
                                                                placeholder="BOX"
                                                                autoComplete="off"
                                                                value={c.name} 
                                                                onChange={e => updateConversion(i, { name: e.target.value.toUpperCase() })} 
                                                            />
                                                        </td>
                                                        <td className="px-4 py-2 align-middle">
                                                            <div className="relative">
                                                                <select 
                                                                    className="table-input appearance-none pr-8 cursor-pointer"
                                                                    value={c.operator}
                                                                    onChange={e => updateConversion(i, { operator: e.target.value as any })}
                                                                >
                                                                    <option value="*">KALI (*)</option>
                                                                    <option value="/">BAGI (/)</option>
                                                                </select>
                                                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-cutty pointer-events-none"/>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 align-middle">
                                                            <input 
                                                                type="number" 
                                                                className="table-input text-right font-mono" 
                                                                autoComplete="off"
                                                                value={c.ratio} 
                                                                onChange={e => updateConversion(i, { ratio: Number(e.target.value) })} 
                                                            />
                                                        </td>
                                                        <td className="px-4 py-2 text-center align-middle">
                                                            <button 
                                                                onClick={() => setItemForm({...itemForm, conversions: itemForm.conversions?.filter((_, idx) => idx !== i)})} 
                                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors"
                                                            >
                                                                <Trash2 size={14}/>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-daintree p-6 border-t border-spectra flex justify-end gap-3 shrink-0">
                            <button onClick={() => setShowItemModal(false)} className="px-6 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest rounded-xl hover:bg-white/5 border border-transparent">Batal</button>
                            <button 
                                onClick={handleSaveItem} 
                                disabled={isLoading} 
                                className="px-8 py-3 bg-spectra hover:bg-daintree text-white rounded-xl font-black text-xs shadow-lg shadow-black/20 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 border border-spectra"
                            >
                                {isLoading ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                                {editingItem ? 'SIMPAN PERUBAHAN' : 'SIMPAN DATA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .modal-input { 
                    width: 100%;
                    height: 2.75rem;
                    background-color: #0b1619 !important; /* Darker BG */
                    border: 1px solid #335157 !important;
                    outline: none !important;
                    border-radius: 9999px;
                    padding: 0 1rem;
                    font-size: 0.75rem;
                    color: white !important;
                    transition: all 150ms;
                    box-shadow: inset 0 1px 3px 0 rgba(0, 0, 0, 0.2);
                    appearance: none;
                    -webkit-appearance: none;
                }
                .modal-input:focus {
                    background-color: #0f1f22 !important;
                    outline: none !important;
                    box-shadow: 0 0 0 2px #335157 !important;
                    border-color: #335157 !important;
                }
                .modal-input::placeholder { color: #64748b !important; }

                .table-input {
                    width: 100%;
                    height: 2.25rem;
                    background-color: #0b1619 !important;
                    border: 0 !important;
                    outline: none !important;
                    border-radius: 9999px;
                    padding: 0 0.75rem;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: white !important;
                    transition: all 150ms;
                    appearance: none;
                    -webkit-appearance: none;
                }
                .table-input:focus {
                    background-color: #0f1f22 !important;
                    outline: none !important;
                    box-shadow: inset 0 0 0 1px #335157 !important;
                }
                .table-input::placeholder { color: #64748b; }

                .scrollbar-thin::-webkit-scrollbar { width: 5px; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background-color: #496569; border-radius: 9999px; }

                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                    -webkit-appearance: none; 
                    margin: 0; 
                }
            `}</style>
        </div>
    );
};
