
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, Save, X, CornerDownLeft, Loader2, Building2, User, Calendar, Hash, Tag, Edit3, Info, Search, Package, ArrowRight, FileText, StickyNote, ChevronDown } from 'lucide-react';
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
    <div className="fixed inset-0 bg-daintree/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="bg-gable rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden border border-spectra ring-1 ring-white/10">
        
        {/* Title Bar - Dense */}
        <div className="bg-daintree px-5 py-3 flex justify-between items-center border-b border-spectra">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border shadow-inner ${type === 'IN' ? 'bg-emerald-900/20 border-emerald-900/50 text-emerald-400' : 'bg-red-900/20 border-red-900/50 text-red-400'}`}>
                   <FileText size={18} />
                </div>
                <div>
                   <h2 className="text-lg font-black text-white leading-none uppercase tracking-tight">
                      {initialData ? 'Edit Transaksi' : 'Form Transaksi'} <span className={type === 'IN' ? 'text-emerald-500' : 'text-red-500'}>{type === 'IN' ? 'Penerimaan' : 'Pengeluaran'}</span>
                   </h2>
                   <p className="text-[10px] text-cutty font-bold uppercase tracking-widest">Ref: {refNo}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-400">
                <X size={18}/>
            </button>
        </div>

        {/* Header Form - Dense & Compact & Roundy */}
        <div className="p-4 bg-gable border-b border-spectra shadow-sm">
            <div className="grid grid-cols-12 gap-3">
                {/* Main Inputs (Left & Center) */}
                <div className="col-span-9 grid grid-cols-12 gap-3">
                    {/* Row 1 */}
                    <div className="col-span-4">
                        <label className="form-label">{type === 'IN' ? 'Supplier / Vendor' : 'Customer / Tujuan'}</label>
                        <div className="relative">
                            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                            <select className="form-input pl-9 pr-8" value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)}>
                                <option value="">-- Pilih Partner --</option>
                                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-cutty pointer-events-none"/>
                        </div>
                    </div>
                    <div className="col-span-4">
                        <label className="form-label">Gudang {type === 'IN' ? 'Penerima' : 'Asal'}</label>
                        <div className="relative">
                            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                            <select className="form-input pl-9 pr-8" value={selectedWh} onChange={e => setSelectedWh(e.target.value)}>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-cutty pointer-events-none"/>
                        </div>
                    </div>
                    <div className="col-span-4">
                        <label className="form-label">Tanggal Transaksi</label>
                        <div className="relative">
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input pl-9" />
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cutty pointer-events-none"/>
                        </div>
                    </div>

                    {/* Row 2 */}
                    <div className="col-span-4">
                         <label className="form-label">No. Referensi</label>
                         <div className="relative">
                            <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                            <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="form-input pl-9 font-mono uppercase text-emerald-400" />
                        </div>
                    </div>
                    <div className="col-span-8">
                         <label className="form-label">Catatan / Keterangan</label>
                         <div className="relative">
                            <StickyNote size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                            <input type="text" placeholder="Isi keterangan transaksi..." value={notes} onChange={e => setNotes(e.target.value)} className="form-input pl-9" />
                         </div>
                    </div>
                </div>
                
                 {/* Right Column (Summary Box - Condensed) */}
                <div className="col-span-3 pl-3 border-l border-spectra/50 flex flex-col justify-center">
                    <div className="bg-daintree rounded-xl border border-spectra p-3 flex flex-col justify-between h-full shadow-inner gap-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-cutty uppercase">
                            <span>Total Qty</span>
                            <span className="text-white font-mono">{lines.reduce((a,b) => a + Number(b.qty), 0).toLocaleString()}</span>
                        </div>
                         <div className="w-full h-px bg-spectra/30"></div>
                        <div className="flex justify-between items-center text-[10px] font-black text-white uppercase">
                            <span>Total Item</span>
                            <span className="text-emerald-500 text-lg">{lines.length} <span className="text-[9px] text-cutty">SKU</span></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Transaction Grid Table - Standardized */}
        <div className="flex-1 bg-gable p-4 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto scrollbar-thin rounded-xl border border-spectra bg-daintree/30 shadow-inner">
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-20 bg-daintree text-cutty text-[10px] font-black uppercase tracking-widest shadow-md">
                        <tr>
                            <th className="px-3 py-2 border-b border-spectra w-12 text-center">#</th>
                            <th className="px-3 py-2 border-b border-spectra">Kode & Nama Barang</th>
                            <th className="px-3 py-2 border-b border-spectra w-28 text-right">Kuantitas</th>
                            <th className="px-3 py-2 border-b border-spectra w-24 text-center">Satuan</th>
                            <th className="px-3 py-2 border-b border-spectra w-1/3">Memo Line</th>
                            <th className="px-3 py-2 border-b border-spectra w-16 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs text-slate-200">
                        {/* Entry Row - Sticky below Header */}
                        <tr className="bg-daintree/50 border-b border-spectra sticky top-[33px] z-10 shadow-sm backdrop-blur-sm">
                            <td className="p-2 border-b border-spectra text-center"><Plus size={14} className="text-spectra mx-auto"/></td>
                            <td className="p-2 border-b border-spectra relative">
                                <input 
                                    ref={itemInputRef}
                                    type="text"
                                    className="w-full bg-gable border border-spectra rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-spectra font-bold placeholder:text-cutty placeholder:font-normal uppercase text-white shadow-sm text-xs"
                                    placeholder="Cari Barang (Kode/Nama)..."
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
                                    <div ref={dropdownRef} className="absolute left-2 top-full mt-1 w-[400px] bg-gable rounded-xl shadow-2xl border border-spectra z-[100] max-h-60 overflow-y-auto">
                                        {filteredItems.map((it, idx) => (
                                            <div 
                                                key={it.id}
                                                className={`px-3 py-2 cursor-pointer border-b border-spectra/30 text-xs flex justify-between items-center ${idx === selectedIndex ? 'bg-spectra text-white' : 'hover:bg-daintree'}`}
                                                onMouseDown={(e) => { e.preventDefault(); selectItem(it); }}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                            >
                                                <div>
                                                    <div className="font-bold">{it.code}</div>
                                                    <div className={`text-[10px] ${idx === selectedIndex ? 'text-white/80' : 'text-slate-400'}`}>{it.name}</div>
                                                </div>
                                                <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg ${idx === selectedIndex ? 'bg-white/20' : 'bg-daintree text-cutty'}`}>{it.baseUnit}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </td>
                            <td className="p-2 border-b border-spectra">
                                <input 
                                    ref={qtyInputRef}
                                    type="number" 
                                    className="w-full bg-gable border border-spectra rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-spectra text-right font-mono font-bold text-white shadow-sm text-xs"
                                    value={pendingQty} 
                                    onChange={e => setPendingQty(e.target.value)} 
                                    disabled={!pendingItem}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLine(); } }}
                                />
                            </td>
                            <td className="p-2 border-b border-spectra relative">
                                 <select 
                                    className="w-full bg-gable border border-spectra rounded-lg px-1 py-1 outline-none font-bold text-center text-white text-xs shadow-sm appearance-none"
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
                            <td className="p-2 border-b border-spectra">
                                <input 
                                    type="text" 
                                    className="w-full bg-gable border border-spectra rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-spectra text-white shadow-sm text-xs"
                                    placeholder="Catatan baris..." 
                                    value={pendingNote} 
                                    onChange={e => setPendingNote(e.target.value)} 
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLine(); } }}
                                    disabled={!pendingItem} 
                                />
                            </td>
                            <td className="p-2 border-b border-spectra text-center">
                                <button onClick={handleAddLine} disabled={!pendingItem} className="p-1 bg-spectra text-white rounded-lg hover:bg-white hover:text-spectra disabled:opacity-50 transition-colors shadow-sm"><CornerDownLeft size={14}/></button>
                            </td>
                        </tr>

                        {/* Existing Lines */}
                        {lines.map((l, i) => (
                            <tr key={i} className="hover:bg-spectra/10 transition-colors group">
                                <td className="px-3 py-1.5 border-b border-spectra/10 text-center text-cutty font-mono text-[10px]">{i + 1}</td>
                                <td className="px-3 py-1.5 border-b border-spectra/10">
                                    <div className="font-bold text-slate-200">{l.name}</div>
                                    <div className="text-[10px] text-cutty font-mono">{l.code}</div>
                                </td>
                                <td className="px-3 py-1.5 border-b border-spectra/10 text-right font-black text-white">{l.qty.toLocaleString()}</td>
                                <td className="px-3 py-1.5 border-b border-spectra/10 text-center text-slate-400 font-bold text-[10px]">{l.unit}</td>
                                <td className="px-3 py-1.5 border-b border-spectra/10 italic text-slate-500">{l.note || '-'}</td>
                                <td className="px-3 py-1.5 border-b border-spectra/10 text-center">
                                    <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                                        <Trash2 size={14}/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {/* Empty State Overlay */}
                {lines.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-12 pointer-events-none opacity-20">
                        <Package size={48} className="text-spectra"/>
                        <div className="text-sm font-black uppercase text-spectra mt-2 tracking-widest">Belum ada item</div>
                    </div>
                )}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-daintree p-4 border-t border-spectra flex justify-between items-center z-20">
             <div className="text-[10px] text-cutty font-bold uppercase tracking-widest flex gap-4">
                <span className="flex items-center gap-2"><Info size={14} className="text-spectra"/> Pastikan data sudah valid</span>
             </div>
             <div className="flex gap-3">
                <button onClick={onClose} className="px-5 py-2 rounded-xl border border-spectra bg-gable hover:bg-spectra/20 text-slate-300 text-xs font-bold uppercase tracking-wide transition-colors">Batal</button>
                <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || !selectedWh}
                    className="px-6 py-2 rounded-xl bg-spectra hover:bg-white hover:text-daintree text-white text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                >
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {initialData ? 'Simpan Perubahan' : 'Simpan Transaksi'}
                </button>
             </div>
        </div>
      </div>
      <style>{`
        .form-input { 
            @apply w-full bg-daintree border border-spectra rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:ring-1 focus:ring-spectra outline-none transition-all shadow-inner placeholder:text-cutty appearance-none; 
        }
        .form-label {
            @apply block text-[10px] font-bold uppercase text-cutty mb-1 tracking-wide ml-1 truncate;
        }
      `}</style>
    </div>
  );
};
