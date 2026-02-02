
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, UnitConversion } from '../types';
import { Search, Upload, Download, Trash2, Box, RefreshCw, Plus, X, ArrowRight, Loader2 } from 'lucide-react';
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

    const [showNewItemModal, setShowNewItemModal] = useState(false);
    const [newItemForm, setNewItemForm] = useState({
        code: '',
        name: '',
        category: '',
        baseUnit: 'Pcs',
        minStock: 10,
        initialStock: 0
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedItems, fetchedWh, fetchedStocks] = await Promise.all([
                StorageService.fetchItems(),
                StorageService.fetchWarehouses(),
                StorageService.fetchStocks()
            ]);
            setItems(fetchedItems);
            setWarehouses(fetchedWh);
            setStocks(fetchedStocks);
        } catch (error) {
            showToast("Gagal memuat database server.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

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

    const handleCreateItem = async () => {
        if (!newItemForm.code || !newItemForm.name) {
            showToast("Kode dan Nama wajib diisi.", 'warning');
            return;
        }
        try {
            const newItem: any = {
                ...newItemForm,
                conversions: []
            };
            await StorageService.saveItem(newItem);
            showToast("Barang berhasil disimpan ke Database.", 'success');
            setShowNewItemModal(false);
            setNewItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', minStock: 10, initialStock: 0 });
            loadData();
        } catch (e) {
            showToast("Gagal menyimpan ke server.", "error");
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-3 gap-3 transition-colors font-sans">
            {/* Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Cari item di MySQL..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-3 py-1.5 border rounded-md text-xs outline-none focus:ring-1 focus:ring-blue-500 w-64 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadData} className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => setShowNewItemModal(true)} className="btn-primary flex items-center gap-1.5 text-[11px]">
                        <Plus size={14} /> Item Baru
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1 scrollbar-thin">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center flex-col gap-2 text-slate-400">
                            <Loader2 size={32} className="animate-spin" />
                            <span className="text-xs font-bold uppercase tracking-widest">Sinkronisasi Database...</span>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="p-2 w-8 text-center">#</th>
                                    <th className="p-2 w-24">Kode</th>
                                    <th className="p-2 w-auto">Nama Barang</th>
                                    {warehouses.map(wh => (
                                        <th key={wh.id} className="p-2 w-20 text-right text-blue-600 border-l border-slate-200 dark:border-slate-700">{wh.name}</th>
                                    ))}
                                    <th className="p-2 w-20 text-right bg-blue-50 dark:bg-blue-900/20 font-black">Total</th>
                                    <th className="p-2 w-16 text-center">Unit</th>
                                </tr>
                            </thead>
                            <tbody className="text-[11px]">
                                {inventoryData.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                        <td className="p-1.5 text-center text-slate-400">{idx + 1}</td>
                                        <td className="p-1.5 font-mono text-slate-500">{item.code}</td>
                                        <td className="p-1.5 font-bold text-slate-700 dark:text-slate-200">{item.name}</td>
                                        {item.whBreakdown.map(bd => (
                                            <td key={bd.whId} className="p-1.5 text-right font-mono border-l border-slate-50 dark:border-slate-800">{bd.qty}</td>
                                        ))}
                                        <td className="p-1.5 text-right font-black font-mono bg-blue-50/30">{item.totalStock}</td>
                                        <td className="p-1.5 text-center"><span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-bold">{item.baseUnit}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showNewItemModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-sm shadow-2xl border border-slate-200">
                        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-b flex justify-between items-center font-bold text-xs uppercase">
                            <span>Input Item Database</span>
                            <button onClick={() => setShowNewItemModal(false)}><X size={16}/></button>
                        </div>
                        <div className="p-4 space-y-3">
                            <input type="text" placeholder="Kode Barang" className="input-dense" value={newItemForm.code} onChange={e => setNewItemForm({...newItemForm, code: e.target.value})} />
                            <input type="text" placeholder="Nama Barang" className="input-dense" value={newItemForm.name} onChange={e => setNewItemForm({...newItemForm, name: e.target.value})} />
                            <div className="grid grid-cols-2 gap-3">
                                <input type="text" placeholder="Satuan" className="input-dense" value={newItemForm.baseUnit} onChange={e => setNewItemForm({...newItemForm, baseUnit: e.target.value})} />
                                <input type="number" placeholder="Saldo Awal" className="input-dense" value={newItemForm.initialStock} onChange={e => setNewItemForm({...newItemForm, initialStock: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 border-t flex justify-end gap-2">
                            <button onClick={handleCreateItem} className="px-4 py-1.5 bg-blue-600 text-white rounded font-bold text-xs">Simpan ke MySQL</button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .btn-primary { @apply px-3 py-1.5 bg-blue-600 text-white rounded font-bold shadow-sm; }
                .input-dense { @apply w-full border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500; }
            `}</style>
        </div>
    );
};
