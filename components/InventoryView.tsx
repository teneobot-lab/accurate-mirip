
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, UnitConversion } from '../types';
import { Search, Trash2, RefreshCw, Plus, Edit3, Eye, Package, Square, CheckSquare, X, Save, AlertCircle, Layers, ArrowRight } from 'lucide-react';
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

    // --- HANDLERS ---

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

    // Conversion Logic
    const addConversion = () => {
        const current = formData.conversions || [];
        setFormData({ ...formData, conversions: [...current, { name: '', ratio: 1, operator: '*' }] });
    };

    const removeConversion = (idx: number) => {
        const current = formData.conversions || [];
        setFormData({ ...formData, conversions: current.filter((_, i) => i !== idx) });
    };

    const updateConversion = (idx: number, field: keyof UnitConversion, value: any) => {
        const current = [...(formData.conversions || [])];
        (current[idx] as any)[field] = value;
        setFormData({ ...formData, conversions: current });
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] p-6 lg:p-8 font-sans">
            
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" placeholder="Cari Kode SKU atau Nama Barang..." 
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/5 transition-all" 
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button onClick={loadData} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-brand hover:border-brand shadow-sm transition-all">
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/>
                    </button>
                    <button onClick={() => handleOpenModal()} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold shadow-lg shadow-brand/20 active:scale-95 transition-all">
                        <Plus size={18}/> Barang Baru
                    </button>
                </div>
            </div>

            {/* Inventory Table */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 w-16 text-center">#</th>
                                <th className="px-6 py-3 w-48">Kode SKU</th>
                                <th className="px-6 py-3">Nama Barang & Kategori</th>
                                <th className="px-6 py-3 w-32 text-right">Stok Total</th>
                                <th className="px-6 py-3 w-28 text-center">Satuan</th>
                                <th className="px-6 py-3 w-28 text-center">Status</th>
                                <th className="px-6 py-3 w-32 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {inventoryData.map((item, index) => (
                                <tr key={item.id} className={`hover:bg-slate-50 transition-colors group ${!item.isActive ? 'bg-slate-50/50' : ''}`}>
                                    <td className="px-6 py-3 text-center text-slate-400 font-medium text-xs">{index + 1}</td>
                                    <td className="px-6 py-3 font-mono font-medium text-slate-600 tracking-tight">{item.code}</td>
                                    <td className="px-6 py-3">
                                        <div className={`font-semibold ${!item.isActive ? 'text-slate-400 decoration-slate-300' : 'text-slate-800'}`}>{item.name}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">{item.category}</div>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <span className={`font-mono font-semibold ${item.totalStock <= item.minStock ? 'text-rose-600' : 'text-slate-700'}`}>
                                            {item.totalStock.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <span className="inline-block px-2 py-1 rounded bg-slate-100 text-xs font-medium text-slate-500 border border-slate-200">
                                            {item.baseUnit}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${item.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                            {item.isActive ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            {onViewItem && (
                                                <button onClick={() => onViewItem(item)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Lihat Kartu Stok"><Eye size={16}/></button>
                                            )}
                                            <button onClick={() => handleOpenModal(item)} className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Barang"><Edit3 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {inventoryData.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Package size={48} className="mb-3 opacity-20"/>
                            <p className="text-sm font-medium">Data barang tidak ditemukan.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL ADD / EDIT ITEM */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">{editingId ? 'Edit Data Barang' : 'Tambah Barang Baru'}</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Lengkapi informasi detail barang dan satuan.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"><X size={20}/></button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveItem} className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Kode SKU */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Kode SKU <span className="text-rose-500">*</span></label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="CONTOH: SKU-001"
                                        value={formData.code}
                                        onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-medium text-slate-800 focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none uppercase"
                                    />
                                </div>

                                {/* Kategori */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Kategori</label>
                                    <input 
                                        type="text" 
                                        placeholder="Elektronik, Makanan, dll"
                                        value={formData.category}
                                        onChange={e => setFormData({...formData, category: e.target.value})}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none"
                                    />
                                </div>

                                {/* Nama Barang (Full Width) */}
                                <div className="col-span-1 md:col-span-2 space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Nama Barang <span className="text-rose-500">*</span></label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="Masukkan nama barang lengkap..."
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none"
                                    />
                                </div>

                                {/* Satuan Dasar */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Satuan Dasar (Base Unit) <span className="text-rose-500">*</span></label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="PCS / KG / METER"
                                            value={formData.baseUnit}
                                            onChange={e => setFormData({...formData, baseUnit: e.target.value.toUpperCase()})}
                                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none uppercase text-center"
                                        />
                                        <div className="group relative">
                                            <AlertCircle size={16} className="text-slate-400 cursor-help"/>
                                            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                Satuan terkecil untuk stok. Semua konversi akan mengacu ke satuan ini.
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Min Stock */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">Stok Minimum (Alert)</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={formData.minStock}
                                        onChange={e => setFormData({...formData, minStock: Number(e.target.value)})}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none"
                                    />
                                </div>

                                {/* Status Toggle */}
                                <div className="col-span-1 md:col-span-2 pt-2 pb-2">
                                    <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.isActive}
                                            onChange={e => setFormData({...formData, isActive: e.target.checked})}
                                            className="w-5 h-5 text-brand rounded focus:ring-brand border-gray-300"
                                        />
                                        <div>
                                            <span className="block text-sm font-bold text-slate-700">Status Aktif</span>
                                            <span className="block text-xs text-slate-400">Barang non-aktif tidak akan muncul di form transaksi.</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Conversion Section */}
                            <div className="mt-8 pt-6 border-t border-slate-200">
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            <Layers size={16} className="text-brand"/> Satuan Konversi (Multi-Unit)
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-1">Tambahkan satuan lain (misal: Lusin, Box) yang mengacu ke Satuan Dasar.</p>
                                    </div>
                                    <button type="button" onClick={addConversion} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors">
                                        + Tambah Satuan
                                    </button>
                                </div>

                                {(!formData.conversions || formData.conversions.length === 0) ? (
                                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 bg-slate-50/50">
                                        <span className="text-xs italic">Belum ada satuan konversi. Transaksi hanya menggunakan <b>{formData.baseUnit || 'Satuan Dasar'}</b>.</span>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {formData.conversions.map((conv, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                <div className="flex-1 flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-400 px-2">1</span>
                                                    <input 
                                                        type="text" 
                                                        placeholder="NAMA SATUAN (Mis: BOX)" 
                                                        value={conv.name}
                                                        onChange={e => updateConversion(idx, 'name', e.target.value.toUpperCase())}
                                                        className="flex-1 px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold uppercase text-slate-700 focus:border-brand outline-none"
                                                    />
                                                </div>
                                                <div className="text-slate-400"><ArrowRight size={14}/></div>
                                                <div className="flex-[2] flex items-center gap-2">
                                                    <select 
                                                        value={conv.operator} 
                                                        onChange={e => updateConversion(idx, 'operator', e.target.value)}
                                                        className="px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                                    >
                                                        <option value="*">Dikali (x)</option>
                                                        <option value="/">Dibagi (/)</option>
                                                    </select>
                                                    <input 
                                                        type="number" 
                                                        placeholder="RASIO" 
                                                        value={conv.ratio}
                                                        onChange={e => updateConversion(idx, 'ratio', Number(e.target.value))}
                                                        className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 focus:border-brand outline-none text-right"
                                                    />
                                                    <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1.5 rounded min-w-[3rem] text-center">
                                                        {formData.baseUnit || '?'}
                                                    </span>
                                                </div>
                                                <button type="button" onClick={() => removeConversion(idx)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors">
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </form>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold text-sm hover:bg-slate-200 rounded-xl transition-colors">
                                Batal
                            </button>
                            <button onClick={handleSaveItem} disabled={isSaving} className="px-6 py-2.5 bg-brand text-white font-bold text-sm rounded-xl hover:bg-brand/90 shadow-lg shadow-brand/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70">
                                {isSaving ? 'Menyimpan...' : (
                                    <><Save size={18}/> Simpan Barang</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
