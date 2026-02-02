
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

    // Modal States
    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [itemForm, setItemForm] = useState<Partial<Item>>({
        code: '', name: '', category: '', baseUnit: 'Pcs', minStock: 10, initialStock: 0, conversions: []
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
        setItemForm({ ...item, conversions: item.conversions ? [...item.conversions] : [] }); 
        setShowItemModal(true);
    };

    const handleToggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 transition-colors font-sans">
            {/* Action Bar */}
            <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Cari kode atau nama barang..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-11 pr-5 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm outline-none w-80 focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-700 transition-all shadow-inner"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-100 transition-all animate-in zoom-in">
                            <Trash2 size={16}/> Hapus ({selectedIds.size})
                        </button>
                    )}
                    <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', minStock: 10, initialStock: 0, conversions: [] }); setShowItemModal(true); }} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">
                        <Plus size={18}/> Registrasi Barang
                    </button>
                    <button onClick={loadData} className="p-2.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto scrollbar-thin">
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                        <tr>
                            <th className="p-4 w-12 text-center"><Square size={18} className="text-slate-200 mx-auto"/></th>
                            <th className="p-4 w-32">Kode Ref</th>
                            <th className="p-4">Deskripsi Item</th>
                            <th className="p-4 w-32">Kategori</th>
                            {warehouses.map(wh => (
                                <th key={wh.id} className="p-4 w-24 text-right border-l border-slate-100/50 dark:border-slate-800/50">{wh.name}</th>
                            ))}
                            <th className="p-4 w-28 text-right bg-blue-50/50 dark:bg-blue-900/10 font-bold text-blue-600">Total Stok</th>
                            <th className="p-4 w-20 text-center">Unit</th>
                            <th className="p-4 w-16 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="text-[13px] divide-y divide-slate-100 dark:divide-slate-800">
                        {inventoryData.map((item, idx) => (
                            <tr key={item.id} className={`group hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50/50' : (isZebra && idx % 2 !== 0 ? 'bg-[#fcfdfe]/80' : '')}`}>
                                <td className="p-4 text-center">
                                    <button onClick={() => handleToggleSelect(item.id)} className="transition-transform active:scale-75">
                                        {selectedIds.has(item.id) ? <CheckSquare size={18} className="text-blue-600 mx-auto"/> : <Square size={18} className="text-slate-200 group-hover:text-slate-300 mx-auto"/>}
                                    </button>
                                </td>
                                <td className="p-4 font-mono font-bold text-slate-500">{item.code}</td>
                                <td className="p-4">
                                    <div className="font-bold text-slate-900 dark:text-slate-200">{item.name}</div>
                                    {item.totalStock <= item.minStock && <div className="text-[9px] text-red-500 font-bold uppercase mt-1 flex items-center gap-1"><AlertCircle size={10}/> Stok Menipis</div>}
                                </td>
                                <td className="p-4"><span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase">{item.category || 'UMUM'}</span></td>
                                {item.whBreakdown.map(bd => (
                                    <td key={bd.whId} className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">{bd.qty.toLocaleString()}</td>
                                ))}
                                <td className="p-4 text-right font-bold font-mono text-blue-600 text-sm bg-blue-50/20">{item.totalStock.toLocaleString()}</td>
                                <td className="p-4 text-center"><span className="text-[10px] font-black uppercase text-slate-400">{item.baseUnit}</span></td>
                                <td className="p-4 text-center">
                                    <button onClick={() => handleOpenEdit(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Registration Modal */}
            {showItemModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 modal-backdrop">
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="bg-slate-900 text-white px-10 py-8 flex justify-between items-center relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-xl font-bold tracking-tight">{editingItem ? 'Perbarui Data Barang' : 'Registrasi Barang Baru'}</h3>
                                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">Master Data Central</p>
                            </div>
                            <button onClick={() => setShowItemModal(false)} className="relative z-10 p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24}/></button>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
                        </div>

                        <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-hide">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Kode SKU / Ref</label>
                                    <input className="accurate-input font-mono font-bold text-blue-600 uppercase" value={itemForm.code} onChange={e => setItemForm({...itemForm, code: e.target.value})} placeholder="CONTOH: BRG-001" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Kategori</label>
                                    <input className="accurate-input" value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})} placeholder="Elektronik, Pangan, dll" />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nama Barang Lengkap</label>
                                    <input className="accurate-input font-semibold" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="Masukkan nama barang..." />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Satuan Dasar</label>
                                    <input className="accurate-input font-bold text-emerald-600" value={itemForm.baseUnit} onChange={e => setItemForm({...itemForm, baseUnit: e.target.value})} placeholder="Pcs, Box, Kg" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Stok Minimum</label>
                                    <input type="number" className="accurate-input text-right font-mono" value={itemForm.minStock} onChange={e => setItemForm({...itemForm, minStock: Number(e.target.value)})} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950 p-8 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-3 text-slate-400">
                                <ShieldCheck size={20} className="text-emerald-500"/>
                                <span className="text-[10px] font-bold uppercase tracking-tight">Terverifikasi Sistem</span>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setShowItemModal(false)} className="px-6 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase">Batal</button>
                                <button onClick={handleSaveItem} className="px-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xl shadow-blue-200 flex items-center gap-2 active:scale-95 transition-all">
                                    <Save size={16}/> {editingItem ? 'PERBARUI' : 'SIMPAN DATA'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .accurate-input { 
                    @apply w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-5 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-white shadow-sm; 
                }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};
