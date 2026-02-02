
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, UnitConversion } from '../types';
import { Search, Upload, Download, Trash2, Box, RefreshCw, Plus, X, ArrowRight, Loader2, CheckSquare, Square, Filter, Columns, List, Edit3, Save, Layers, FileSpreadsheet, Info, AlertCircle } from 'lucide-react';
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

                if (payloadItems.length === 0) throw new Error("Data tidak valid (Kode/Nama kosong)");

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
            } as Item;
            await StorageService.saveItem(payload);
            showToast(editingItem ? "Data barang diperbarui" : "Barang baru ditambahkan", "success");
            setShowItemModal(false);
            loadData();
        } catch (e) {
            showToast("Gagal menyimpan ke server.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenEdit = (item: Item) => {
        setEditingItem(item);
        setItemForm({ ...item });
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
        if (!confirm(`Hapus ${selectedIds.size} item terpilih secara permanen?`)) return;
        setIsLoading(true);
        try {
            await StorageService.deleteItems(Array.from(selectedIds));
            showToast("Item terpilih berhasil dihapus", "success");
            setSelectedIds(new Set());
            loadData();
        } catch (e) {
            showToast("Gagal menghapus data.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-3 gap-3 transition-colors">
            {/* Professional Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Cari item (Kode/Nama)..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 w-64 dark:bg-slate-800 dark:border-slate-700"
                        />
                    </div>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                    <button onClick={() => setIsZebra(!isZebra)} title="Zebra View" className={`p-1.5 rounded-lg ${isZebra ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}><Layers size={16}/></button>
                    <button onClick={() => setShowColumnFilter(!showColumnFilter)} title="Columns" className={`p-1.5 rounded-lg ${showColumnFilter ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}><Columns size={16}/></button>
                </div>

                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100">
                            <Trash2 size={14}/> Hapus ({selectedIds.size})
                        </button>
                    )}
                    <button onClick={downloadTemplate} className="flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all border border-slate-200 dark:border-slate-700">
                        <Download size={14}/> Unduh Template
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportXLSX} />
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isImporting}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-100 hover:bg-emerald-100 disabled:opacity-50"
                    >
                        {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14}/>} 
                        {isImporting ? 'Mengimpor...' : 'Import XLSX'}
                    </button>
                    <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', minStock: 10, conversions: [] }); setShowItemModal(true); }} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-black shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
                        <Plus size={16}/> Item Baru
                    </button>
                    <button onClick={loadData} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
                </div>
            </div>

            {/* Robust Data Table */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1 scrollbar-thin">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10 border-b dark:border-slate-700">
                            <tr>
                                <th className="p-3 w-10 text-center">
                                    <button onClick={handleToggleSelectAll}>
                                        {selectedIds.size === inventoryData.length && inventoryData.length > 0 ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16}/>}
                                    </button>
                                </th>
                                {visibleColumns.has('code') && <th className="p-3 w-32">Kode</th>}
                                {visibleColumns.has('name') && <th className="p-3 w-auto">Nama Barang</th>}
                                {visibleColumns.has('category') && <th className="p-3 w-32">Kategori</th>}
                                {warehouses.map(wh => (
                                    <th key={wh.id} className="p-3 w-20 text-right text-blue-600 font-bold border-l dark:border-slate-700">{wh.name}</th>
                                ))}
                                {visibleColumns.has('total') && <th className="p-3 w-24 text-right bg-blue-50/50 dark:bg-blue-900/20 font-black">Total</th>}
                                {visibleColumns.has('unit') && <th className="p-3 w-20 text-center">Unit</th>}
                                {visibleColumns.has('actions') && <th className="p-3 w-16 text-center">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody className="text-[11px]">
                            {inventoryData.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-20 text-center text-slate-400 italic font-bold">Data Kosong</td>
                                </tr>
                            ) : inventoryData.map((item, idx) => (
                                <tr key={item.id} className={`border-b dark:border-slate-800 transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50/50 dark:bg-blue-900/30' : (isZebra && idx % 2 !== 0 ? 'bg-slate-50/30 dark:bg-slate-800/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40')}`}>
                                    <td className="p-3 text-center">
                                        <button onClick={() => handleToggleSelect(item.id)}>
                                            {selectedIds.has(item.id) ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16} className="text-slate-300"/>}
                                        </button>
                                    </td>
                                    {visibleColumns.has('code') && <td className="p-3 font-mono font-bold text-slate-500 uppercase">{item.code}</td>}
                                    {visibleColumns.has('name') && <td className="p-3 font-black text-slate-700 dark:text-slate-200 truncate">{item.name}</td>}
                                    {visibleColumns.has('category') && <td className="p-3 text-slate-400 font-bold">{item.category}</td>}
                                    {item.whBreakdown.map(bd => (
                                        <td key={bd.whId} className="p-3 text-right font-mono text-slate-600 border-l dark:border-slate-800/50">{bd.qty.toLocaleString()}</td>
                                    ))}
                                    {visibleColumns.has('total') && <td className="p-3 text-right font-black font-mono text-blue-600 text-sm">{item.totalStock.toLocaleString()}</td>}
                                    {visibleColumns.has('unit') && <td className="p-3 text-center"><span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-500">{item.baseUnit}</span></td>}
                                    {visibleColumns.has('actions') && (
                                        <td className="p-3 text-center">
                                            <button onClick={() => handleOpenEdit(item)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg"><Edit3 size={14}/></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Aesthetic Enhanced Item Modal */}
            {showItemModal && (
                <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-300">
                        
                        {/* Modal Header */}
                        <div className="bg-slate-900 text-white px-8 py-6 flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-12 bg-blue-600/10 rounded-full blur-3xl -mr-12 -mt-12"></div>
                            <div className="relative z-10 flex items-center gap-4">
                                <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30">
                                    <Box size={24} className="text-white"/>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight leading-none mb-1">
                                        {editingItem ? 'Edit Master Data' : 'Registrasi Barang Baru'}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sinkronisasi Database MySQL Active</p>
                                </div>
                            </div>
                            <button onClick={() => setShowItemModal(false)} className="relative z-10 p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-8 overflow-y-auto max-h-[75vh] scrollbar-hide">
                            
                            {/* Section 1: Identitas Utama */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                                    <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Identitas Master</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Kode Barang</label>
                                        <input 
                                            type="text" 
                                            className="form-input font-mono font-bold" 
                                            placeholder="KOD-001" 
                                            value={itemForm.code} 
                                            onChange={e => setItemForm({...itemForm, code: e.target.value.toUpperCase()})} 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Kategori</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="Elektronik / Bahan Baku" 
                                            value={itemForm.category} 
                                            onChange={e => setItemForm({...itemForm, category: e.target.value})} 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nama Deskriptif Barang</label>
                                    <input 
                                        type="text" 
                                        className="form-input text-sm font-black" 
                                        placeholder="Contoh: Laptop Dell XPS 13 i7 16GB" 
                                        value={itemForm.name} 
                                        onChange={e => setItemForm({...itemForm, name: e.target.value})} 
                                    />
                                </div>
                            </div>

                            {/* Section 2: Logistik & Stok */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-emerald-600 rounded-full"></div>
                                    <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Parameter Logistik</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Satuan Dasar</label>
                                        <input 
                                            type="text" 
                                            className="form-input bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/50 font-bold text-emerald-700 dark:text-emerald-400" 
                                            placeholder="Pcs / Kg / Meter" 
                                            value={itemForm.baseUnit} 
                                            onChange={e => setItemForm({...itemForm, baseUnit: e.target.value})} 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Min. Stock Alert</label>
                                        <input 
                                            type="number" 
                                            className="form-input font-mono font-bold" 
                                            value={itemForm.minStock} 
                                            onChange={e => setItemForm({...itemForm, minStock: Number(e.target.value)})} 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Multi Unit (Conversion) */}
                            <div className="pt-6 border-t dark:border-slate-800">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                                        <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Multi Satuan Konversi</h4>
                                    </div>
                                    <button 
                                        onClick={() => setItemForm({...itemForm, conversions: [...(itemForm.conversions || []), { name: '', ratio: 1 }]})} 
                                        className="px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase rounded-lg border border-amber-100 dark:border-amber-800/50 flex items-center gap-1 hover:bg-amber-100 transition-colors"
                                    >
                                        <Plus size={12}/> Tambah Level
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {itemForm.conversions?.map((c, i) => (
                                        <div key={i} className="flex gap-3 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border dark:border-slate-800 group animate-in slide-in-from-left duration-200" style={{ animationDelay: `${i*50}ms` }}>
                                            <div className="flex-1 flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-slate-400">1</span>
                                                <input 
                                                    type="text" 
                                                    className="bg-transparent text-xs font-black border-b border-dashed border-slate-300 dark:border-slate-700 outline-none w-full pb-1 focus:border-blue-500" 
                                                    placeholder="Contoh: BOX / DUS" 
                                                    value={c.name} 
                                                    onChange={e => {
                                                        const next = [...(itemForm.conversions || [])];
                                                        next[i].name = e.target.value.toUpperCase();
                                                        setItemForm({...itemForm, conversions: next});
                                                    }} 
                                                />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <ArrowRight size={14} className="text-slate-300"/>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        className="w-16 bg-slate-100 dark:bg-slate-900 text-xs font-black p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-right focus:ring-1 focus:ring-blue-500" 
                                                        value={c.ratio} 
                                                        onChange={e => {
                                                            const next = [...(itemForm.conversions || [])];
                                                            next[i].ratio = Number(e.target.value);
                                                            setItemForm({...itemForm, conversions: next});
                                                        }} 
                                                    />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">{itemForm.baseUnit}</span>
                                                </div>
                                                <button 
                                                    onClick={() => setItemForm({...itemForm, conversions: itemForm.conversions?.filter((_, idx) => idx !== i)})} 
                                                    className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {(!itemForm.conversions || itemForm.conversions.length === 0) && (
                                        <div className="bg-slate-50 dark:bg-slate-800/30 border border-dashed dark:border-slate-800 rounded-2xl p-6 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic flex items-center justify-center gap-2">
                                                <Info size={12}/> Hanya Satuan Tunggal ({itemForm.baseUnit})
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 dark:bg-slate-950 p-6 border-t dark:border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-slate-400">
                                <AlertCircle size={14}/>
                                <span className="text-[9px] font-bold uppercase tracking-tighter italic">Pastikan data sesuai dengan standar operasional gudang</span>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setShowItemModal(false)} className="px-6 py-2.5 text-xs font-black text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors uppercase tracking-widest">Batal</button>
                                <button 
                                    onClick={handleSaveItem} 
                                    disabled={isLoading} 
                                    className="px-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-blue-500/20 flex items-center gap-2 active:scale-95 transition-all"
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                                    {editingItem ? 'PERBARUI DATABASE' : 'SIMPAN KE MYSQL'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .form-input { 
                    @apply w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-2xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm; 
                }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};
