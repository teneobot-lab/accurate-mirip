
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse } from '../types';
import { Search, Upload, Download, Trash2, Box, RefreshCw, Plus, X, Loader2, CheckSquare, Square, Filter, Columns, Edit3, Database, Tag, ShieldCheck, ChevronDown, Package, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
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

    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [itemForm, setItemForm] = useState<Partial<Item>>({ code: '', name: '', category: '', baseUnit: 'Pcs', minStock: 10, isActive: true, conversions: [] });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedItems, fetchedWh, fetchedStocks] = await Promise.all([
                StorageService.fetchItems(),
                StorageService.fetchWarehouses(),
                StorageService.fetchStocks()
            ]);
            setItems(fetchedItems || []); setWarehouses(fetchedWh || []); setStocks(fetchedStocks || []);
        } catch (error) {
            showToast("Database Offline", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const inventoryData = useMemo(() => {
        return items.map(item => {
            const itemStocks = stocks.filter(s => s.itemId === item.id);
            return { ...item, totalStock: itemStocks.reduce((acc, s) => acc + Number(s.qty), 0) };
        }).filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.code.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [items, stocks, searchTerm]);

    return (
        <div className="flex flex-col h-full p-2 lg:p-4 gap-4">
            {/* TOOLBAR - ADAPTIVE STACK */}
            <div className="bg-gable p-3 rounded-2xl border border-spectra flex flex-col sm:flex-row justify-between gap-4 shadow-lg">
                <div className="relative group w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input type="text" placeholder="Cari Kode / Nama..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-daintree border border-spectra rounded-xl text-xs font-bold text-white outline-none" />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                    {selectedIds.size > 0 && (
                        <button onClick={() => {}} className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-red-900/20 text-red-500 rounded-xl text-[10px] font-black border border-red-900/30 uppercase"><Trash2 size={14}/> ({selectedIds.size})</button>
                    )}
                    <button onClick={loadData} className="p-2.5 bg-daintree border border-spectra rounded-xl text-slate-400 hover:text-white shrink-0"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
                    <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', minStock: 10, isActive: true, conversions: [] }); setShowItemModal(true); }} className="shrink-0 flex items-center gap-2 px-6 py-2.5 bg-spectra text-white rounded-xl text-[10px] font-black shadow-lg uppercase tracking-widest active:scale-95"><Plus size={16}/> Item Baru</button>
                </div>
            </div>

            {/* DATA TABLE - FLEXIBLE CONTAINER */}
            <div className="flex-1 bg-gable rounded-2xl border border-spectra overflow-hidden flex flex-col shadow-sm">
                <div className="overflow-auto flex-1 scrollbar-thin">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-daintree text-[10px] font-black text-cutty uppercase tracking-widest sticky top-0 z-10 border-b border-spectra">
                            <tr>
                                <th className="px-4 py-3 w-12 text-center"><Square size={16} className="opacity-20"/></th>
                                <th className="px-4 py-3 w-40">Kode Ref</th>
                                <th className="px-4 py-3">Deskripsi Barang</th>
                                <th className="px-4 py-3 w-32 text-right">Sisa Stok</th>
                                <th className="px-4 py-3 w-20 text-center">Unit</th>
                                <th className="px-4 py-3 w-24 text-center">Status</th>
                                <th className="px-4 py-3 w-16 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-spectra/10">
                            {inventoryData.map(item => (
                                <tr key={item.id} className={`hover:bg-white/5 transition-colors ${!item.isActive ? 'opacity-50 grayscale' : ''}`}>
                                    <td className="px-4 py-2 text-center"><Square size={16} className="text-slate-700"/></td>
                                    <td className="px-4 py-2 font-mono font-bold text-slate-400 text-xs uppercase">{item.code}</td>
                                    <td className="px-4 py-2">
                                        <div className="font-bold text-white text-xs">{item.name}</div>
                                        <div className="text-[9px] text-cutty font-black uppercase">{item.category}</div>
                                    </td>
                                    <td className={`px-4 py-2 text-right font-black font-mono text-sm ${item.totalStock <= item.minStock ? 'text-red-400' : 'text-emerald-400'}`}>{item.totalStock.toLocaleString()}</td>
                                    <td className="px-4 py-2 text-center"><span className="px-2 py-0.5 rounded bg-daintree text-[9px] font-black text-slate-500 border border-spectra uppercase">{item.baseUnit}</span></td>
                                    <td className="px-4 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${item.isActive ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                            {item.isActive ? 'Aktif' : 'Off'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <button onClick={() => { setEditingItem(item); setItemForm(item); setShowItemModal(true); }} className="p-1.5 text-slate-500 hover:text-white transition-colors"><Edit3 size={14}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <style>{`
                .scrollbar-thin::-webkit-scrollbar { width: 4px; height: 4px; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background: #335157; border-radius: 10px; }
            `}</style>
        </div>
    );
};
