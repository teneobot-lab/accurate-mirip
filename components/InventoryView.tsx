
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, UnitConversion } from '../types';
import { Search, Trash2, RefreshCw, Plus, Edit3, Eye, Package, X, Save, AlertCircle, Layers, ArrowRight } from 'lucide-react';
import { useToast } from './Toast';

interface InventoryViewProps {
    onViewItem?: (item: Item) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onViewItem }) => {
    const { showToast } = useToast();
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    
    // Form State
    const [formData, setFormData] = useState<Partial<Item>>({
        code: '', name: '', category: '', baseUnit: 'PCS', minStock: 0, isActive: true, conversions: []
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedItems, fetchedStocks] = await Promise.all([
                StorageService.fetchItems(),
                StorageService.fetchStocks()
            ]);
            setItems(fetchedItems || []); 
            setStocks(fetchedStocks || []);
        } catch (error) {
            showToast("Gagal memuat database.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const inventoryData = useMemo(() => {
        return items.map(item => {
            const itemStocks = stocks.filter(s => s.itemId === item.id);
            return { ...item, totalStock: itemStocks.reduce((acc, s) => acc + Number(s.qty), 0) };
        }).filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.code.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [items, stocks, searchTerm]);

    const handleOpenModal = (item?: Item) => {
        if (item) {
            setEditingId(item.id);
            setFormData({ ...item, conversions: item.conversions || [] });
        } else {
            setEditingId(null);
            setFormData({ code: '', name: '', category: '', baseUnit: 'PCS', minStock: 0, isActive: true, conversions: [] });
        }
        setIsModalOpen(true);
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code || !formData.name || !formData.baseUnit) {
            return showToast("Kode, Nama, dan Satuan Dasar wajib diisi", "warning");
        }

        setIsSaving(true);
        try {
            const payload = { ...formData, id: editingId || undefined } as Item;
            await StorageService.saveItem(payload);
            showToast(editingId ? "Data barang diperbarui" : "Barang baru ditambahkan", "success");
            setIsModalOpen(false);
            loadData();
        } catch (error: any) {
            showToast(error.message || "Gagal menyimpan data", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white font-sans">
            {/* COMPACT TOOLBAR */}
            <div className="h-12 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" placeholder="Cari Master Barang..." 
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
                            className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-700 outline-none w-64 focus:border-blue-400 transition-all" 
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadData} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/>
                    </button>
                    <button onClick={() => handleOpenModal()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center gap-2 transition-all shadow-sm">
                        <Plus size={14}/> Barang Baru
                    </button>
                </div>
            </div>

            {/* DENSE TABLE */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                        <tr className="h-8">
                            <th className="px-4 text-[10px] font-bold text-slate-400 uppercase w-12 text-center">#</th>
                            <th className="px-4 text-[10px] font-bold text-slate-400 uppercase w-32">Kode SKU</th>
                            <th className="px-4 text-[10px] font-bold text-slate-400 uppercase">Nama Barang</th>
                            <th className="px-4 text-[10px] font-bold text-slate-400 uppercase w-32">Kategori</th>
                            <th className="px-4 text-[10px] font-bold text-slate-400 uppercase w-24 text-right">Stok Total</th>
                            <th className="px-4 text-[10px] font-bold text-slate-400 uppercase w-20 text-center">Satuan</th>
                            <th className="px-4 text-[10px] font-bold text-slate-400 uppercase w-20 text-center">Status</th>
                            <th className="px-4 text-[10px] font-bold text-slate-400 uppercase w-20 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {inventoryData.map((item, index) => (
                            <tr key={item.id} className="h-8 hover:bg-blue-50/40 group transition-colors">
                                <td className="px-4 text-center text-[10px] text-slate-400 font-medium">{index + 1}</td>
                                <td className="px-4 text-[11px] font-mono text-slate-600 truncate">{item.code}</td>
                                <td className="px-4 text-[11px] font-semibold text-slate-800 truncate">{item.name}</td>
                                <td className="px-4 text-[10px] text-slate-500 truncate uppercase">{item.category}</td>
                                <td className="px-4 text-right text-[11px] font-bold text-slate-700">
                                    <span className={item.totalStock <= item.minStock ? 'text-rose-600' : ''}>
                                        {item.totalStock.toLocaleString()}
                                    </span>
                                </td>
                                <td className="px-4 text-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.baseUnit}</span>
                                </td>
                                <td className="px-4 text-center">
                                    <span className={`text-[9px] font-bold uppercase px-1 rounded ${item.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                        {item.isActive ? 'Aktif' : 'OFF'}
                                    </span>
                                </td>
                                <td className="px-4 text-center">
                                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {onViewItem && (
                                            <button onClick={() => onViewItem(item)} className="p-1 text-blue-500 hover:bg-blue-100 rounded" title="Lihat Kartu Stok"><Eye size={14}/></button>
                                        )}
                                        <button onClick={() => handleOpenModal(item)} className="p-1 text-amber-500 hover:bg-amber-100 rounded" title="Edit Barang"><Edit3 size={14}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Modal Detail Barang (Sama seperti sebelumnya namun dipoles paddingnya) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px] p-4">
                    <div className="bg-white w-full max-w-lg rounded-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">{editingId ? 'Edit Barang' : 'Barang Baru'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={18}/></button>
                        </div>
                        <form onSubmit={handleSaveItem} className="p-5 space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Kode SKU</label>
                                    <input required type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold uppercase outline-none focus:border-blue-400" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Kategori</label>
                                    <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs outline-none focus:border-blue-400" />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Nama Lengkap Barang</label>
                                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold outline-none focus:border-blue-400" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Satuan Dasar</label>
                                    <input required type="text" value={formData.baseUnit} onChange={e => setFormData({...formData, baseUnit: e.target.value.toUpperCase()})} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-center uppercase outline-none focus:border-blue-400" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Min. Stock Alert</label>
                                    <input type="number" value={formData.minStock} onChange={e => setFormData({...formData, minStock: Number(e.target.value)})} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold outline-none focus:border-blue-400" />
                                </div>
                            </div>
                        </form>
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-200 rounded transition-colors">Batal</button>
                            <button onClick={handleSaveItem} disabled={isSaving} className="px-4 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded shadow-sm hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">
                                {isSaving ? 'Menyimpan...' : 'Simpan Barang'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
