
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse } from '../types';
import { Search, Trash2, RefreshCw, Plus, Edit3, Eye, Package, Square, CheckSquare } from 'lucide-react';
import { useToast } from './Toast';

interface InventoryViewProps {
    onViewItem?: (item: Item) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onViewItem }) => {
    const { showToast } = useToast();
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
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
        }).filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.code.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [items, stocks, searchTerm]);

    return (
        <div className="flex flex-col h-full p-6 lg:p-8 gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" placeholder="Cari Master Barang..." value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 outline-none shadow-sm focus:ring-2 focus:ring-brand/5 focus:border-brand" 
                    />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button onClick={loadData} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-brand hover:border-brand shadow-sm transition-all"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-brand text-white rounded-xl text-xs font-bold shadow-lg shadow-brand/20 uppercase tracking-widest active:scale-95 transition-all"><Plus size={18}/> Item Baru</button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 w-12 text-center"><Square size={18} className="text-slate-300"/></th>
                                <th className="px-6 py-4 w-48">Kode SKU</th>
                                <th className="px-6 py-4">Informasi Barang</th>
                                <th className="px-6 py-4 w-40 text-right">Stok Total</th>
                                <th className="px-6 py-4 w-28 text-center">Base Unit</th>
                                <th className="px-6 py-4 w-32 text-center">Status</th>
                                <th className="px-6 py-4 w-28 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {inventoryData.map(item => (
                                <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors group ${!item.isActive ? 'opacity-40 grayscale' : ''}`}>
                                    <td className="px-6 py-4 text-center"><Square size={18} className="text-slate-200 group-hover:text-slate-300 transition-colors"/></td>
                                    <td className="px-6 py-4 font-mono font-bold text-slate-500 text-xs tracking-wider uppercase">{item.code}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-extrabold text-slate-800 text-sm mb-0.5">{item.name}</div>
                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.category}</div>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-black font-mono text-base ${item.totalStock <= item.minStock ? 'text-rose-500' : 'text-emerald-600'}`}>
                                        {item.totalStock.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200 uppercase">{item.baseUnit}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${item.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                            {item.isActive ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {onViewItem && (
                                                <button onClick={() => onViewItem(item)} className="p-2 text-slate-400 hover:text-brand transition-colors"><Eye size={16}/></button>
                                            )}
                                            <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><Edit3 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
