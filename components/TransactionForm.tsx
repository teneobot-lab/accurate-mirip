
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, Save, X, CornerDownLeft, Loader2, Building2, User, Calendar, Hash, Tag, Edit3, Info, Search, Package, ArrowRight } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  type: TransactionType;
  initialData?: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransactionForm: React.FC<Props> = ({ type, initialData, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(initialData?.referenceNo || `${type === 'IN' ? 'RI' : 'DO'}.${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}.${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`);
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialData?.partnerId || '');
  const [selectedWh, setSelectedWh] = useState(initialData?.sourceWarehouseId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [lines, setLines] = useState<TransactionItem[]>(initialData?.items || []);

  // Row Entry & Autocomplete States
  const [query, setQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingUnit, setPendingUnit] = useState('');
  const [pendingQty, setPendingQty] = useState<number | string>(1);
  const [pendingNote, setPendingNote] = useState('');

  // Refs for Navigation
  const itemInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
        try {
            const [its, whs, pts] = await Promise.all([
                StorageService.fetchItems().catch(() => []),
                StorageService.fetchWarehouses().catch(() => []),
                StorageService.fetchPartners().catch(() => [])
            ]);
            setItems(its || []);
            setWarehouses(whs || []);
            setPartners(pts.filter(p => type === 'IN' ? p.type === 'SUPPLIER' : p.type === 'CUSTOMER') || []);
            if (whs && whs.length > 0 && !initialData) setSelectedWh(whs[0].id);
        } catch (e) {
            console.error("Load failed", e);
        }
    };
    load();
  }, [type, initialData]);

  // Fuzzy Search Logic
  useEffect(() => {
    if (!query || pendingItem) {
        setFilteredItems([]);
        setIsDropdownOpen(false);
        return;
    }
    const lowerQuery = query.toLowerCase();
    const results = items.filter(it => 
        it.name.toLowerCase().includes(lowerQuery) || 
        it.code.toLowerCase().includes(lowerQuery)
    ).slice(0, 10);
    setFilteredItems(results);
    setIsDropdownOpen(results.length > 0);
    setSelectedIndex(0);
  }, [query, items, pendingItem]);

  const selectItem = (item: Item) => {
    setPendingItem(item);
    setPendingUnit(item.baseUnit);
    setQuery(item.name);
    setIsDropdownOpen(false);
    setTimeout(() => qtyInputRef.current?.focus(), 10);
  };

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (isDropdownOpen) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredItems.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            selectItem(filteredItems[selectedIndex]);
        } else if (e.key === 'Escape') {
            setIsDropdownOpen(false);
        }
    }
  };

  const handleAddLine = () => {
    if (!pendingItem || !pendingQty || Number(pendingQty) <= 0) return;
    
    let ratio = 1;
    if (pendingUnit !== pendingItem.baseUnit) {
        const conv = pendingItem.conversions?.find(c => c.name === pendingUnit);
        if (conv) {
            ratio = conv.operator === '/' ? 1 / conv.ratio : conv.ratio;
        }
    }

    const newLine: TransactionItem = {
      itemId: pendingItem.id,
      qty: Number(pendingQty),
      unit: pendingUnit || pendingItem.baseUnit,
      ratio: ratio,
      note: pendingNote,
      name: pendingItem.name,
      code: pendingItem.code
    };
    
    setLines([...lines, newLine]);
    
    setQuery('');
    setPendingItem(null);
    setPendingUnit('');
    setPendingQty(1);
    setPendingNote('');
    
    setTimeout(() => itemInputRef.current?.focus(), 10);
  };

  const handleSubmit = async () => {
    if (lines.length === 0) return showToast("Tambahkan baris barang terlebih dahulu", "warning");
    if (!selectedWh) return showToast("Pilih gudang terlebih dahulu", "warning");
    
    setIsSubmitting(true);
    try {
        const txData = {
            date,
            referenceNo: refNo,
            type,
            sourceWarehouseId: selectedWh,
            partnerId: selectedPartnerId,
            items: lines.map(line => ({
                item_id: line.itemId,
                qty: line.qty,
                unit: line.unit,
                conversionRatio: line.ratio || 1,
                note: line.note
            })),
            notes
        };
        
        if (initialData?.id) {
            await StorageService.updateTransaction(initialData.id, txData as any);
            showToast("Transaksi Berhasil Diperbarui", "success");
        } else {
            await StorageService.commitTransaction({ ...txData, id: crypto.randomUUID() } as any);
            showToast("Transaksi Berhasil Disimpan", "success");
        }
        onSuccess();
    } catch (e: any) {
        const msg = e.message?.includes('409') ? "Gagal: Stok tidak mencukupi untuk salah satu item!" : `Gagal: ${e.message}`;
        showToast(msg, "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#f8fafc] dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-slate-300/50 dark:border-slate-800">
        
        {/* Title Bar - HD Look */}
        <div className="bg-white dark:bg-slate-800/80 backdrop-blur-md px-8 py-5 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-5">
                <div className={`p-3 rounded-2xl shadow-lg shadow-gray-200 dark:shadow-none ${type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                   {initialData ? <Edit3 size={24}/> : <Plus size={24}/>}
                </div>
                <div>
                   <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight uppercase tracking-tight">
                      {initialData ? 'Update' : 'Entry'} {type === 'IN' ? 'Barang Masuk' : 'Barang Keluar'}
                   </h2>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Waresix Transaction Control</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all"><X size={20} className="text-slate-500"/></button>
        </div>

        {/* Header Block - Contrast Improvements */}
        <div className="p-8 grid grid-cols-2 gap-10 bg-white dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
            <div className="space-y-6">
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{type === 'IN' ? 'Supplier' : 'Customer'}</label>
                    <div className="flex items-center gap-3">
                        <select 
                            className="accurate-input"
                            value={selectedPartnerId}
                            onChange={e => setSelectedPartnerId(e.target.value)}
                        >
                            <option value="">-- Pilih Partner --</option>
                            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Keterangan / Memo</label>
                    <textarea 
                        className="accurate-input h-24 resize-none leading-relaxed"
                        placeholder="Catatan tambahan transaksi..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    ></textarea>
                </div>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">No. Bukti</label>
                        <div className="relative">
                            <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="accurate-input pl-11 font-mono font-bold text-slate-700" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Tanggal</label>
                        <div className="relative">
                            <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"/>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="accurate-input pl-11 font-bold" />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Gudang Penyimpanan</label>
                    <div className="relative">
                        <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500"/>
                        <select 
                            className="accurate-input pl-11"
                            value={selectedWh}
                            onChange={e => setSelectedWh(e.target.value)}
                        >
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        </div>

        {/* Transaction Grid */}
        <div className="flex-1 overflow-auto bg-[#f8fafc] dark:bg-slate-950 px-8 py-6">
            <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="px-4 py-2 w-12 text-center">#</th>
                        <th className="px-4 py-2">Master Item</th>
                        <th className="px-4 py-2 w-32 text-right">Kuantitas</th>
                        <th className="px-4 py-2 w-32 text-center">Satuan</th>
                        <th className="px-4 py-2 w-64">Memo Line</th>
                        <th className="px-4 py-2 w-16 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {lines.map((l, i) => (
                        <tr key={i} className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-2xl group hover:border-blue-300 transition-colors">
                            <td className="px-4 py-3 text-center font-mono text-slate-300 rounded-l-2xl">{i + 1}</td>
                            <td className="px-4 py-3">
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{l.name}</div>
                                <div className="text-[10px] font-bold text-blue-500 mt-0.5">{l.code}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-base text-slate-800 dark:text-white">{l.qty.toLocaleString()}</td>
                            <td className="px-4 py-3 text-center">
                                <span className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400">{l.unit}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 italic text-xs">{l.note || '-'}</td>
                            <td className="px-4 py-3 text-center rounded-r-2xl">
                                <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                            </td>
                        </tr>
                    ))}
                    
                    {/* Add Line Entry Row */}
                    <tr className="bg-slate-100/50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
                        <td className="px-4 py-3 text-center"><Plus size={18} className="text-blue-500 mx-auto"/></td>
                        <td className="px-2 py-3 relative">
                            <div className="relative">
                                <input 
                                    ref={itemInputRef}
                                    type="text"
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 outline-none text-sm font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                    placeholder="Cari Barang..."
                                    value={query}
                                    onChange={e => {
                                        setQuery(e.target.value);
                                        if (pendingItem) setPendingItem(null);
                                    }}
                                    onKeyDown={handleItemKeyDown}
                                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                    onFocus={() => { if(query && !pendingItem) setIsDropdownOpen(true); }}
                                />
                                {pendingItem && (
                                    <button 
                                        onClick={() => {setPendingItem(null); setQuery(''); itemInputRef.current?.focus();}} 
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                                    ><X size={16}/></button>
                                )}
                            </div>

                            {/* Autocomplete Dropdown */}
                            {isDropdownOpen && (
                                <div ref={dropdownRef} className="absolute left-2 top-full mt-2 w-[400px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[100] overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-slate-900 p-2 border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold uppercase text-slate-400">Hasil Pencarian</div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {filteredItems.map((it, idx) => (
                                            <div 
                                                key={it.id}
                                                className={`p-3 cursor-pointer flex justify-between items-center border-b border-slate-50 dark:border-slate-700 last:border-0 ${idx === selectedIndex ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                                onMouseDown={(e) => { e.preventDefault(); selectItem(it); }}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                            >
                                                <div>
                                                    <div className="text-xs font-bold">{it.name}</div>
                                                    <div className={`text-[10px] font-mono ${idx === selectedIndex ? 'text-blue-200' : 'text-slate-400'}`}>{it.code}</div>
                                                </div>
                                                <ArrowRight size={14} className={idx === selectedIndex ? 'opacity-100' : 'opacity-0'}/>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </td>
                        <td className="px-2 py-3">
                            <input 
                                ref={qtyInputRef}
                                type="number" 
                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 outline-none text-right font-mono font-bold text-sm text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                                value={pendingQty} 
                                onChange={e => setPendingQty(e.target.value)} 
                                disabled={!pendingItem}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLine(); } }}
                            />
                        </td>
                        <td className="px-2 py-3 text-center">
                            <select 
                                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-2 py-2.5 text-xs font-bold outline-none w-24"
                                value={pendingUnit}
                                onChange={e => setPendingUnit(e.target.value)}
                                disabled={!pendingItem}
                            >
                                {pendingItem && (
                                    <>
                                        <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>
                                        {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </>
                                )}
                                {!pendingItem && <option value="">-</option>}
                            </select>
                        </td>
                        <td className="px-2 py-3">
                            <input type="text" placeholder="Catatan..." className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 outline-none text-xs" value={pendingNote} onChange={e => setPendingNote(e.target.value)} disabled={!pendingItem} />
                        </td>
                        <td className="px-4 py-3 text-center">
                            <button onClick={handleAddLine} disabled={!pendingItem} className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"><Plus size={18}/></button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        {/* Footer Area */}
        <div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-lg z-10">
             <div className="flex gap-10">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total SKU</span>
                    <span className="text-2xl font-bold text-slate-800 dark:text-white leading-none">{lines.length}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimasi Qty</span>
                    <span className="text-2xl font-bold text-blue-600 leading-none">{lines.reduce((acc,l)=>acc+(l.qty * (l.ratio || 1)),0).toLocaleString()} <small className="text-sm font-medium text-slate-400">Unit</small></span>
                </div>
             </div>
             <div className="flex gap-4">
                <button onClick={onClose} className="px-8 py-3.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 uppercase tracking-widest transition-colors">Batal</button>
                <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || !selectedWh}
                    className="px-10 py-3.5 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs shadow-xl flex items-center gap-3 transition-all active:scale-95"
                >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {initialData ? 'PERBARUI TRANSAKSI' : 'POSTING TRANSAKSI'}
                </button>
             </div>
        </div>
      </div>
      <style>{`
        .accurate-input { 
            @apply w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-5 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm text-slate-800 dark:text-white placeholder:text-slate-400; 
        }
      `}</style>
    </div>
  );
};
