
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, UnitConversion } from '../types';
import { Search, Upload, Download, Trash2, Box, RefreshCw, Plus, X, Loader2, CheckSquare, Square, Filter, Columns, Edit3, Save, Layers, Database, Tag, ShieldCheck, Equal, ChevronDown, Barcode, Package, Ruler, AlertTriangle } from 'lucide-react';
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
        code: '', name: '', category: '', baseUnit: 'Pcs', minStock: 10, initialStock: 0, conversions: []
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedItems, fetchedWh, fetchedStocks] = await Promise.all([
                StorageService.fetchItems(), StorageService.fetchWarehouses(), StorageService.fetchStocks()
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

    // Fix: Added handleOpenEdit function to resolve "Cannot find name 'handleOpenEdit'" error
    const handleOpenEdit = (item: Item) => {
        setEditingItem(item);
        setItemForm({ ...item });
        setShowItemModal(true);
    };

    const handleSaveItem = async () => {
        if (!itemForm.code || !itemForm.name) return showToast("Kode & Nama wajib diisi.", "warning");
        setIsLoading(true);
        try {
            const payload = {
                ...itemForm,
                id: editingItem?.id || crypto.randomUUID(),
                conversions: (itemForm.conversions || []).filter(c => c.name && c.ratio > 0).map(c => ({
                    ...c, operator: c.operator || '*'
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

    return (
        <div className="flex flex-col h-full p-2 lg:p-4 gap-2 lg:gap-4 transition-colors font-sans overflow-hidden">
            {/* Toolbar - Adaptive Grid */}
            <div className="bg-gable p-2 rounded-xl shadow-sm border border-spectra flex flex-col sm:flex-row justify-between items-center gap-2">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input 
                            type="text" 
                            placeholder="Cari SKU..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-daintree border border-spectra rounded-lg text-xs font-medium outline-none focus:border-spectra text-slate-200"
                        />
                    </div>
                    <button onClick={loadData} className="p-2 text-slate-400 hover:bg-spectra/20 rounded-lg border border-spectra"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar py-1">
                    <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', minStock: 10, initialStock: 0, conversions: [] }); setShowItemModal(true); }} className="whitespace-nowrap flex items-center gap-2 px-4 py-2 bg-spectra text-white rounded-lg text-xs font-bold shadow-lg shadow-black/20 hover:bg-white hover:text-daintree transition-all border border-spectra">
                        <Plus size={16}/> Item Baru
                    </button>
                    <div className="h-6 w-px bg-spectra hidden sm:block"></div>
                    <button onClick={() => setIsZebra(!isZebra)} className={`p-2 rounded-lg border ${isZebra ? 'bg-spectra/30 border-spectra text-white' : 'border-spectra text-slate-400'}`}><Layers size={16}/></button>
                </div>
            </div>

            {/* Data Table - Scrollable Container */}
            <div className="flex-1 rounded-xl border border-spectra overflow-hidden flex flex-col shadow-sm bg-gable">
                <div className="overflow-auto flex-1 scrollbar-thin">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-daintree text-[10px] font-black text-cutty uppercase tracking-wider sticky top-0 z-10 border-b border-spectra shadow-md">
                            <tr>
                                <th className="px-3 py-2 w-10 text-center">#</th>
                                {visibleColumns.has('code') && <th className="px-3 py-2 w-32 border-l border-spectra">Kode</th>}
                                {visibleColumns.has('name') && <th className="px-3 py-2 border-l border-spectra">Nama Barang</th>}
                                {warehouses.map(wh => (
                                    <th key={wh.id} className="px-3 py-2 w-24 text-right border-l border-spectra">{wh.name}</th>
                                ))}
                                {visibleColumns.has('total') && <th className="px-3 py-2 w-24 text-right bg-spectra/10 text-white border-l border-spectra">Stok</th>}
                                {visibleColumns.has('unit') && <th className="px-3 py-2 w-16 text-center border-l border-spectra">Unit</th>}
                                {visibleColumns.has('actions') && <th className="px-3 py-2 w-16 text-center border-l border-spectra">Opsi</th>}
                            </tr>
                        </thead>
                        <tbody className="text-[11px] divide-y divide-spectra/20">
                            {inventoryData.map((item, idx) => (
                                <tr key={item.id} className={`group transition-colors ${isZebra && idx % 2 !== 0 ? 'bg-daintree/30' : 'hover:bg-spectra/10'}`}>
                                    <td className="px-3 py-2 text-center text-slate-500 font-mono">{idx + 1}</td>
                                    {visibleColumns.has('code') && <td className="px-3 py-2 font-mono font-bold text-emerald-500">{item.code}</td>}
                                    {visibleColumns.has('name') && <td className="px-3 py-2 font-bold text-slate-200">{item.name}</td>}
                                    {item.whBreakdown.map(bd => (
                                        <td key={bd.whId} className={`px-3 py-2 text-right font-mono ${bd.qty > 0 ? 'text-slate-200 font-bold' : 'text-slate-600'}`}>{bd.qty > 0 ? bd.qty.toLocaleString() : '-'}</td>
                                    ))}
                                    {visibleColumns.has('total') && <td className="px-3 py-2 text-right font-black font-mono text-emerald-400 bg-spectra/5">{item.totalStock.toLocaleString()}</td>}
                                    {visibleColumns.has('unit') && <td className="px-3 py-2 text-center"><span className="px-1.5 py-0.5 rounded bg-daintree text-[9px] font-black text-slate-400 border border-spectra">{item.baseUnit}</span></td>}
                                    {visibleColumns.has('actions') && (
                                        <td className="px-3 py-2 text-center">
                                            <button onClick={() => handleOpenEdit(item)} className="p-1 text-slate-400 hover:text-white transition-colors"><Edit3 size={14}/></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Item Modal - Simplified for Mobile */}
            {showItemModal && (
                <div className="fixed inset-0 bg-daintree/90 z-[100] flex items-center justify-center p-0 sm:p-4 backdrop-blur-md">
                    <div className="bg-gable w-full h-full sm:h-auto sm:max-w-2xl sm:rounded-2xl border border-spectra overflow-hidden flex flex-col shadow-2xl">
                        <div className="bg-daintree px-6 py-4 flex justify-between items-center border-b border-spectra">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">{editingItem ? 'Edit Item' : 'Master Baru'}</h3>
                            <button onClick={() => setShowItemModal(false)} className="p-2 text-slate-400 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-cutty uppercase tracking-widest">Kode SKU</label>
                                    <input type="text" className="w-full bg-daintree border border-spectra rounded-lg p-3 text-sm text-emerald-400 font-mono font-bold outline-none" value={itemForm.code} onChange={e => setItemForm({...itemForm, code: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-cutty uppercase tracking-widest">Kategori</label>
                                    <input type="text" className="w-full bg-daintree border border-spectra rounded-lg p-3 text-sm text-white font-bold outline-none" value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-cutty uppercase tracking-widest">Nama Barang</label>
                                <input type="text" className="w-full bg-daintree border border-spectra rounded-lg p-3 text-sm text-white font-bold outline-none" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-cutty uppercase tracking-widest">Satuan Dasar</label>
                                    <input type="text" className="w-full bg-daintree border border-spectra rounded-lg p-3 text-sm text-white font-bold outline-none" value={itemForm.baseUnit} onChange={e => setItemForm({...itemForm, baseUnit: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-cutty uppercase tracking-widest">Min. Stock Alert</label>
                                    <input type="number" className="w-full bg-daintree border border-spectra rounded-lg p-3 text-sm text-red-400 font-mono font-bold outline-none text-right" value={itemForm.minStock} onChange={e => setItemForm({...itemForm, minStock: Number(e.target.value)})} />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-daintree border-t border-spectra flex gap-2">
                            <button onClick={() => setShowItemModal(false)} className="flex-1 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Batal</button>
                            <button onClick={handleSaveItem} disabled={isLoading} className="flex-1 py-3 bg-spectra text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg">
                                {isLoading ? 'SIMPAN...' : 'SIMPAN DATA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
