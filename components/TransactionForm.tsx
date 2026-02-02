
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, Save, X, CornerDownLeft, Loader2, Building2, User, Calendar, Hash, Tag, Edit3, Info, Search, Package, ArrowRight, FileText } from 'lucide-react';
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
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#eff3f8] dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden border border-slate-400 dark:border-slate-700">
        
        {/* Title Bar - Dense & Functional */}
        <div className="bg-white dark:bg-slate-800 px-6 py-3 flex justify-between items-center border-b border-slate-300 dark:border-slate-700 shadow-sm z-20">
            <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg border shadow-sm ${type === 'IN' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-red-100 border-red-200 text-red-700'}`}>
                   <FileText size={20} />
                </div>
                <div>
                   <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-none uppercase tracking-tight">
                      {initialData ? 'Edit Transaksi' : 'Form Transaksi'} <span className={type === 'IN' ? 'text-emerald-600' : 'text-red-600'}>{type === 'IN' ? 'Penerimaan Barang' : 'Pengeluaran Barang'}</span>
                   </h2>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">No. Ref: {refNo}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                 <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded text-[10px] font-bold text-blue-700 uppercase tracking-widest">
                    {lines.length} Items Loaded
                 </div>
                 <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500">
                    <X size={20}/>
                 </button>
            </div>
        </div>

        {/* Header Form - Dense Grid */}
        <div className="p-5 bg-[#eff3f8] dark:bg-slate-900/50 border-b border-slate-300 dark:border-slate-700 shadow-inner overflow-y-auto max-h-48">
            <div className="grid grid-cols-12 gap-x-6 gap-y-4">
                {/* Left Column */}
                <div className="col-span-4 space-y-4">
                     <div>
                        <label className="form-label">{type === 'IN' ? 'Supplier / Vendor' : 'Customer / Tujuan'}</label>
                        <div className="relative">
                            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                            <select 
                                className="form-input pl-10"
                                value={selectedPartnerId}
                                onChange={e => setSelectedPartnerId(e.target.value)}
                            >
                                <option value="">-- Pilih Partner --</option>
                                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                     </div>
                     <div>
                        <label className="form-label">Gudang {type === 'IN' ? 'Penerima' : 'Asal'}</label>
                        <div className="relative">
                            <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                            <select 
                                className="form-input pl-10"
                                value={selectedWh}
                                onChange={e => setSelectedWh(e.target.value)}
                            >
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                     </div>
                </div>

                {/* Middle Column */}
                <div className="col-span-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Tanggal Transaksi</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" />
                        </div>
                        <div>
                            <label className="form-label">No. Referensi</label>
                            <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="form-input font-mono uppercase" />
                        </div>
                    </div>
                    <div>
                         <label className="form-label">Catatan / Keterangan</label>
                         <input type="text" placeholder="Isi keterangan transaksi..." value={notes} onChange={e => setNotes(e.target.value)} className="form-input" />
                    </div>
                </div>
                
                 {/* Right Column (Summary Box) */}
                <div className="col-span-4 pl-4 border-l border-slate-300 dark:border-slate-700">
                    <div className="h-full bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-600 p-4 flex flex-col justify-center gap-2">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                            <span>Total Qty</span>
                            <span>{lines.reduce((a,b) => a + Number(b.qty), 0).toLocaleString()} Unit</span>
                        </div>
                        <div className="w-full h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                        <div className="flex justify-between items-center text-sm font-black text-slate-800 dark:text-white uppercase">
                            <span>Total Item</span>
                            <span className="text-blue-600">{lines.length} SKU</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Transaction Grid Table */}
        <div className="flex-1 bg-white dark:bg-slate-950 overflow-hidden flex flex-col relative z-0">
            <div className="flex-1 overflow-auto scrollbar-thin">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider shadow-sm">
                        <tr>
                            <th className="px-3 py-2 border-r border-slate-300 dark:border-slate-600 w-10 text-center">#</th>
                            <th className="px-3 py-2 border-r border-slate-300 dark:border-slate-600">Kode Barang</th>
                            <th className="px-3 py-2 border-r border-slate-300 dark:border-slate-600 w-1/3">Nama Barang</th>
                            <th className="px-3 py-2 border-r border-slate-300 dark:border-slate-600 w-32 text-right">Kuantitas</th>
                            <th className="px-3 py-2 border-r border-slate-300 dark:border-slate-600 w-24 text-center">Satuan</th>
                            <th className="px-3 py-2 border-r border-slate-300 dark:border-slate-600 w-48">Memo Line</th>
                            <th className="px-3 py-2 w-16 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs text-slate-800 dark:text-slate-200">
                        {/* Entry Row */}
                        <tr className="bg-yellow-50 dark:bg-yellow-900/10 border-b border-slate-300 dark:border-slate-700">
                            <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-center"><Plus size={16} className="text-blue-600 mx-auto"/></td>
                            <td className="p-2 border-r border-slate-300 dark:border-slate-700 relative" colSpan={2}>
                                <input 
                                    ref={itemInputRef}
                                    type="text"
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-400 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold placeholder:text-slate-400 placeholder:font-normal uppercase"
                                    placeholder="CARI BARANG (Ketik Kode/Nama)..."
                                    value={query}
                                    onChange={e => {
                                        setQuery(e.target.value);
                                        if (pendingItem) setPendingItem(null);
                                    }}
                                    onKeyDown={handleItemKeyDown}
                                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                    onFocus={() => { if(query && !pendingItem) setIsDropdownOpen(true); }}
                                />
                                {/* Autocomplete Dropdown */}
                                {isDropdownOpen && (
                                    <div ref={dropdownRef} className="absolute left-2 top-full mt-1 w-[400px] bg-white dark:bg-slate-800 rounded-md shadow-xl border border-slate-400 dark:border-slate-600 z-[100] max-h-60 overflow-y-auto">
                                        {filteredItems.map((it, idx) => (
                                            <div 
                                                key={it.id}
                                                className={`px-3 py-2 cursor-pointer border-b border-slate-100 dark:border-slate-700 text-xs ${idx === selectedIndex ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                                onMouseDown={(e) => { e.preventDefault(); selectItem(it); }}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                            >
                                                <div className="font-bold">{it.code}</div>
                                                <div className={idx === selectedIndex ? 'text-blue-100' : 'text-slate-500'}>{it.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </td>
                            <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                                <input 
                                    ref={qtyInputRef}
                                    type="number" 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-400 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 text-right font-mono font-bold"
                                    value={pendingQty} 
                                    onChange={e => setPendingQty(e.target.value)} 
                                    disabled={!pendingItem}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLine(); } }}
                                />
                            </td>
                            <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                                 <select 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-400 rounded px-1 py-1.5 outline-none font-bold text-center"
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
                                </select>
                            </td>
                            <td className="p-2 border-r border-slate-300 dark:border-slate-700">
                                <input 
                                    type="text" 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-400 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Catatan baris..." 
                                    value={pendingNote} 
                                    onChange={e => setPendingNote(e.target.value)} 
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLine(); } }}
                                    disabled={!pendingItem} 
                                />
                            </td>
                            <td className="p-2 text-center">
                                <button onClick={handleAddLine} disabled={!pendingItem} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"><CornerDownLeft size={16}/></button>
                            </td>
                        </tr>

                        {/* Existing Lines */}
                        {lines.map((l, i) => (
                            <tr key={i} className="hover:bg-blue-50 dark:hover:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 group">
                                <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-center text-slate-400 font-mono">{i + 1}</td>
                                <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 font-mono text-blue-600 font-bold">{l.code}</td>
                                <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 font-medium">{l.name}</td>
                                <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-right font-bold">{l.qty.toLocaleString()}</td>
                                <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-center">{l.unit}</td>
                                <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 italic text-slate-500">{l.note}</td>
                                <td className="px-3 py-2 text-center">
                                    <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                                        <Trash2 size={16}/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Empty State Overlay if no items */}
            {lines.length === 0 && (
                <div className="absolute inset-x-0 top-20 bottom-0 flex flex-col items-center justify-center pointer-events-none opacity-10">
                    <Package size={80} className="text-slate-800"/>
                    <div className="text-4xl font-black uppercase text-slate-800 mt-4">No Items</div>
                </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100 dark:bg-slate-800 p-4 border-t border-slate-300 dark:border-slate-700 flex justify-between items-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
             <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex gap-4">
                <span className="flex items-center gap-1"><Info size={14}/> Pastikan data sudah benar sebelum simpan</span>
             </div>
             <div className="flex gap-3">
                <button onClick={onClose} className="px-6 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wide transition-colors">Batal</button>
                <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || !selectedWh}
                    className="px-8 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wide shadow-lg flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {initialData ? 'Simpan Perubahan' : 'Simpan Transaksi'}
                </button>
             </div>
        </div>
      </div>
      <style>{`
        .form-input { 
            @apply w-full bg-white dark:bg-slate-800 border border-slate-400 dark:border-slate-600 rounded-md px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all shadow-sm; 
        }
        .form-label {
            @apply block text-[10px] font-bold uppercase text-slate-500 mb-1.5 tracking-wide ml-0.5;
        }
        .scrollbar-thin::-webkit-scrollbar { width: 8px; height: 8px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: #f1f5f9; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border: 2px solid #f1f5f9; border-radius: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};
