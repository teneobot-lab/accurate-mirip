
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, UnitConversion } from '../types';
import { Search, Trash2, RefreshCw, Plus, Edit3, Eye, Package, X, Save, AlertCircle, Layers, ArrowRight, Settings2 } from 'lucide-react';
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
            setFormData({ ...item, conversions: item.conversions ? [...item.conversions] : [] });
        } else {
            setEditingId(null);
            setFormData({ code: '', name: '', category: '', baseUnit: 'PCS', minStock: 0, isActive: true, conversions: [] });
        }
        setIsModalOpen(true);
    };

    const handleAddConversion = () => {
        const currentConversions = formData.conversions || [];
        setFormData({
            ...formData,
            conversions: [...currentConversions, { name: '', ratio: 1, operator: '*' }]
        });
    };

    const handleRemoveConversion = (index: number) => {
        const currentConversions = formData.conversions || [];
        setFormData({
            ...formData,
            conversions: currentConversions.filter((_, i) => i !== index)
        });
    };

    const updateConversion = (index: number, field: keyof UnitConversion, value: any) => {
        const currentConversions = [...(formData.conversions || [])];
        (currentConversions[index] as any)[field] = value;
        setFormData({ ...formData, conversions: currentConversions });
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
                            <tr key={item.id} className={`h-8 hover:bg-blue-50/40 group transition-colors ${!item.isActive ? 'bg-slate-50 opacity-60' : ''}`}>
                                <td className="px-4 text-center text-[10px] text-slate-400 font-medium">{index + 1}</td>
                                <td className="px-4 text-[11px] font-mono text-slate-600 truncate">{item.code}</td>
                                <td className="px-4 text-[11px] font-semibold text-slate-800 truncate">{item.name}</td>
                                <td className="px-4 text-[10px] text-slate-500 truncate uppercase">{item.category}</td>
                                <td className="px-4 text-right text-[11px] font-bold text-slate-700">
                                    <span className={item.isActive && item.totalStock <= item.minStock ? 'text-rose-600' : ''}>
                                        {item.totalStock.toLocaleString()}
                                    </span>
                                </td>
                                <td className="px-4 text-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.baseUnit}</span>
                                </td>
                                <td className="px-4 text-center">
                                    <span className={`text-[9px] font-bold uppercase px-1 rounded ${item.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
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
            
            {/* Modal Detail Barang (Enhanced for Multi-Unit) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-[2px] p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
                        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">{editingId ? 'Edit Barang' : 'Barang Baru'}</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">Konfigurasi detail item dan konversi satuan</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={20}/></button>
                        </div>
                        
                        <form onSubmit={handleSaveItem} className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* GENERAL INFO */}
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">Kode SKU <span className="text-rose-500">*</span></label>
                                    <input required type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold uppercase outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all" placeholder="CTH: BRG-001" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Kategori</label>
                                    <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all" placeholder="Umum" />
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">Nama Barang <span className="text-rose-500">*</span></label>
                                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all" placeholder="Nama lengkap produk..." />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">Satuan Dasar <span className="text-rose-500">*</span></label>
                                    <input required type="text" value={formData.baseUnit} onChange={e => setFormData({...formData, baseUnit: e.target.value.toUpperCase()})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center uppercase outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all" placeholder="PCS" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Min. Stock Alert</label>
                                    <input type="number" value={formData.minStock} onChange={e => setFormData({...formData, minStock: Number(e.target.value)})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all" />
                                </div>
                                <div className="col-span-2 pt-2">
                                    <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer hover:bg-white transition-colors">
                                        <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700">Status Aktif</span>
                                            <span className="text-[10px] text-slate-400">Nonaktifkan barang jika sudah tidak digunakan (tidak akan muncul di pencarian).</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* UNIT CONVERSION SECTION */}
                            <div className="border-t border-slate-100 pt-5">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Settings2 size={14}/> Konversi Satuan
                                    </h4>
                                    <button type="button" onClick={handleAddConversion} className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                                        + TAMBAH SATUAN
                                    </button>
                                </div>
                                
                                {(!formData.conversions || formData.conversions.length === 0) && (
                                    <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs italic">
                                        Tidak ada konversi satuan. Barang hanya menggunakan satuan dasar <strong>{formData.baseUnit || '...'}</strong>.
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {formData.conversions?.map((conv, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 animate-in slide-in-from-left-2">
                                            <div className="w-8 h-8 flex items-center justify-center bg-white rounded border border-slate-200 text-slate-400 text-[10px] font-bold">1</div>
                                            <input 
                                                type="text" 
                                                placeholder="NAMASATUAN" 
                                                value={conv.name}
                                                onChange={e => updateConversion(idx, 'name', e.target.value.toUpperCase())}
                                                className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold uppercase text-center outline-none focus:border-blue-400"
                                            />
                                            <div className="text-slate-400 text-[10px] font-bold">=</div>
                                            <input 
                                                type="number" 
                                                placeholder="1" 
                                                value={conv.ratio}
                                                onChange={e => updateConversion(idx, 'ratio', Number(e.target.value))}
                                                className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-right outline-none focus:border-blue-400"
                                            />
                                            <select 
                                                value={conv.operator}
                                                onChange={e => updateConversion(idx, 'operator', e.target.value)}
                                                className="w-12 px-1 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-center outline-none"
                                            >
                                                <option value="*">x</option>
                                                <option value="/">/</option>
                                            </select>
                                            <div className="text-xs font-bold text-slate-500 uppercase px-2">{formData.baseUnit || 'UNIT'}</div>
                                            <button type="button" onClick={() => handleRemoveConversion(idx)} className="ml-auto p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-all">
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>
                        
                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors">Batal</button>
                            <button onClick={handleSaveItem} disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
                                {isSaving ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>} {isSaving ? 'Menyimpan...' : 'Simpan Barang'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
