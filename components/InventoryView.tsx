
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, UnitConversion } from '../types';
import { Search, Upload, Download, Trash2, Box, RefreshCw, Plus, X, ArrowRight, Loader2, CheckSquare, Square, Filter, Columns, List, Edit3, Save, Layers } from 'lucide-react';
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

    // Actions
    const handleToggleSelectAll = () => {
        if (selectedIds.size === inventoryData.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(inventoryData.map(i => i.id)));
        }
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
            showToast("Bulk delete berhasil.", "success");
            setSelectedIds(new Set());
            loadData();
        } catch (e) {
            showToast("Gagal menghapus data.", "error");
        } finally {
            setIsLoading(false);
        }
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
            showToast(editingItem ? "Update Berhasil" : "Simpan Berhasil", "success");
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

    const handleImportXLSX = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const data: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
                
                showToast(`Memproses ${data.length} data...`, "info");
                for (const row of data) {
                    await StorageService.saveItem({
                        id: crypto.randomUUID(),
                        code: String(row.Kode || row.code),
                        name: String(row.Nama || row.name),
                        category: String(row.Kategori || row.category || 'Umum'),
                        baseUnit: String(row.Satuan || row.baseUnit || 'Pcs'),
                        minStock: Number(row.MinStock || 0),
                        conversions: []
                    });
                }
                showToast("Import selesai.", "success");
                loadData();
            } catch (err) {
                showToast("Format file tidak didukung.", "error");
            }
        };
        reader.readAsBinaryString(file);
    };

    const toggleColumn = (col: string) => {
        const next = new Set(visibleColumns);
        if (next.has(col)) next.delete(col);
        else next.add(col);
        setVisibleColumns(next);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-3 gap-3 transition-colors font-sans">
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
                            className="pl-8 pr-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 w-64 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                        />
                    </div>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                    <button onClick={() => setIsZebra(!isZebra)} title="Zebra View" className={`p-1.5 rounded-lg ${isZebra ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}><Layers size={16}/></button>
                    <div className="relative">
                        <button onClick={() => setShowColumnFilter(!showColumnFilter)} title="Columns" className={`p-1.5 rounded-lg ${showColumnFilter ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}><Columns size={16}/></button>
                        {showColumnFilter && (
                            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-50 p-2">
                                <div className="text-[10px] font-black uppercase text-slate-400 mb-2 px-2">Show Columns</div>
                                {['code', 'name', 'category', 'total', 'unit'].map(c => (
                                    <label key={c} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer text-xs capitalize">
                                        <input type="checkbox" checked={visibleColumns.has(c)} onChange={() => toggleColumn(c)} /> {c}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100 transition-all">
                            <Trash2 size={14}/> Hapus ({selectedIds.size})
                        </button>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportXLSX} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-100 hover:bg-emerald-100">
                        <Upload size={14}/> Import XLSX
                    </button>
                    <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', minStock: 10, conversions: [] }); setShowItemModal(true); }} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-black shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all">
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
                                    <td colSpan={10} className="p-20 text-center text-slate-400 italic uppercase font-bold tracking-widest">Database Kosong / Hasil Tidak Ditemukan</td>
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
                                            <button onClick={() => handleOpenEdit(item)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-all"><Edit3 size={14}/></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Unified Item Modal (Add & Edit) */}
            {showItemModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl shadow-2xl border dark:border-slate-800 overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-slate-800 text-white px-5 py-3 flex justify-between items-center">
                            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <Box size={16} className="text-blue-400"/> {editingItem ? 'Edit Master Item' : 'Tambah Item Baru'}
                            </h3>
                            <button onClick={() => setShowItemModal(false)}><X size={18}/></button>
                        </div>
                        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Kode Barang</label>
                                    <input type="text" className="input-field" placeholder="KOD-001" value={itemForm.code} onChange={e => setItemForm({...itemForm, code: e.target.value.toUpperCase()})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Kategori</label>
                                    <input type="text" className="input-field" placeholder="Elektronik" value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400">Nama Lengkap Barang</label>
                                <input type="text" className="input-field font-bold" placeholder="Contoh: Laptop Dell XPS 13" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Satuan Dasar</label>
                                    <input type="text" className="input-field" placeholder="Pcs" value={itemForm.baseUnit} onChange={e => setItemForm({...itemForm, baseUnit: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Min. Stock Alert</label>
                                    <input type="number" className="input-field" value={itemForm.minStock} onChange={e => setItemForm({...itemForm, minStock: Number(e.target.value)})} />
                                </div>
                            </div>

                            <div className="pt-4 border-t dark:border-slate-800">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400">Multi Unit Conversion</h4>
                                    <button onClick={() => setItemForm({...itemForm, conversions: [...(itemForm.conversions || []), { name: '', ratio: 1 }]})} className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
                                        <Plus size={10}/> Tambah Satuan
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {itemForm.conversions?.map((c, i) => (
                                        <div key={i} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border dark:border-slate-700">
                                            <span className="text-[10px] font-bold text-slate-400">1</span>
                                            <input type="text" className="flex-1 bg-transparent text-xs border-b outline-none font-bold" placeholder="Box" value={c.name} onChange={e => {
                                                const next = [...(itemForm.conversions || [])];
                                                next[i].name = e.target.value;
                                                setItemForm({...itemForm, conversions: next});
                                            }} />
                                            <span className="text-[10px] font-bold text-slate-400">=</span>
                                            <input type="number" className="w-16 bg-transparent text-xs border-b outline-none font-bold text-right" value={c.ratio} onChange={e => {
                                                const next = [...(itemForm.conversions || [])];
                                                next[i].ratio = Number(e.target.value);
                                                setItemForm({...itemForm, conversions: next});
                                            }} />
                                            <span className="text-[10px] font-bold text-slate-400">{itemForm.baseUnit}</span>
                                            <button onClick={() => setItemForm({...itemForm, conversions: itemForm.conversions?.filter((_, idx) => idx !== i)})} className="text-red-400 ml-2"><X size={14}/></button>
                                        </div>
                                    ))}
                                    {(!itemForm.conversions || itemForm.conversions.length === 0) && (
                                        <div className="text-[10px] italic text-slate-400 text-center py-2">Hanya menggunakan satuan dasar.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 border-t dark:border-slate-700 flex justify-end gap-3">
                            <button onClick={() => setShowItemModal(false)} className="px-5 py-2 text-xs font-bold text-slate-500">Batal</button>
                            <button onClick={handleSaveItem} disabled={isLoading} className="px-8 py-2 bg-blue-600 text-white rounded-xl font-black text-xs shadow-xl flex items-center gap-2 active:scale-95 transition-all">
                                {isLoading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                                {editingItem ? 'PERBARUI DATABASE' : 'SIMPAN KE DATABASE'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .input-field { @apply w-full border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all; }
            `}</style>
        </div>
    );
};
