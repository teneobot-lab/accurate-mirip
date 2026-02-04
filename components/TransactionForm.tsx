
import React, { useState, useEffect, useRef } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner, Stock } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, Save, X, CornerDownLeft, Loader2, Building2, User, Calendar, Hash, StickyNote, ChevronDown, FileSpreadsheet, FileText, Info, Package } from 'lucide-react';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';

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
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(initialData?.referenceNo || `${type === 'IN' ? 'RI' : 'DO'}.${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}.${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`);
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialData?.partnerId || '');
  const [selectedWh, setSelectedWh] = useState(initialData?.sourceWarehouseId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [lines, setLines] = useState<TransactionItem[]>(initialData?.items || []);

  const [query, setQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingUnit, setPendingUnit] = useState('');
  const [pendingQty, setPendingQty] = useState<string>('');

  const itemInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
        try {
            const [its, whs, pts, stks] = await Promise.all([
                StorageService.fetchItems().catch(() => []),
                StorageService.fetchWarehouses().catch(() => []),
                StorageService.fetchPartners().catch(() => []),
                StorageService.fetchStocks().catch(() => [])
            ]);
            setItems(its || []);
            setWarehouses(whs || []);
            setStocks(stks || []);
            setPartners(pts.filter(p => type === 'IN' ? p.type === 'SUPPLIER' : p.type === 'CUSTOMER') || []);
            if (whs.length > 0 && !initialData) setSelectedWh(whs[0].id);
        } catch (e) { console.error(e); }
    };
    load();
  }, [type, initialData]);

  useEffect(() => {
    if (!query || pendingItem) { setFilteredItems([]); setIsDropdownOpen(false); return; }
    const results = items.filter(it => it.name.toLowerCase().includes(query.toLowerCase()) || it.code.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
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

  const handleAddLine = () => {
    if (!pendingItem) return showToast("Pilih barang", "warning");
    if (!pendingQty || Number(pendingQty) <= 0) return showToast("Isi Qty", "warning");
    
    let ratio = 1;
    if (pendingUnit !== pendingItem.baseUnit) {
        const conv = pendingItem.conversions?.find(c => c.name === pendingUnit);
        if (conv) ratio = conv.operator === '/' ? 1 / conv.ratio : conv.ratio;
    }

    setLines(prev => [...prev, {
      itemId: pendingItem.id,
      qty: Number(pendingQty),
      unit: pendingUnit || pendingItem.baseUnit,
      ratio: ratio,
      name: pendingItem.name,
      code: pendingItem.code
    }]);
    
    setQuery(''); setPendingItem(null); setPendingUnit(''); setPendingQty('');
    setTimeout(() => itemInputRef.current?.focus(), 10);
  };

  const handleSubmit = async () => {
    if (lines.length === 0 || !selectedWh) return showToast("Data tidak lengkap", "warning");
    setIsSubmitting(true);
    try {
        const txData = {
            date, referenceNo: refNo, type, sourceWarehouseId: selectedWh, partnerId: selectedPartnerId,
            items: lines.map(l => ({ item_id: l.itemId, qty: l.qty, unit: l.unit, conversionRatio: l.ratio || 1 })),
            notes
        };
        if (initialData?.id) await StorageService.updateTransaction(initialData.id, txData as any);
        else await StorageService.commitTransaction({ ...txData, id: crypto.randomUUID() } as any);
        showToast("Tersimpan!", "success");
        onSuccess();
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-daintree/80 z-[100] flex items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gable w-full md:max-w-6xl h-full md:h-[95vh] flex flex-col md:rounded-2xl shadow-2xl overflow-hidden border border-spectra relative">
        
        {/* Title Bar */}
        <div className="bg-daintree px-4 py-3 flex justify-between items-center border-b border-spectra sticky top-0 z-50">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border ${type === 'IN' ? 'text-emerald-400 border-emerald-900/50 bg-emerald-900/10' : 'text-red-400 border-red-900/50 bg-red-900/10'}`}>
                   <FileText size={18} />
                </div>
                <div>
                   <h2 className="text-sm font-black text-white uppercase tracking-tight">
                      {initialData ? 'Edit' : 'Entry'} {type === 'IN' ? 'Penerimaan' : 'Pengeluaran'}
                   </h2>
                   <p className="text-[9px] text-cutty font-bold uppercase">Ref: {refNo}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400">
                <X size={20}/>
            </button>
        </div>

        {/* Header Form - Responsive Grid */}
        <div className="p-4 bg-gable border-b border-spectra overflow-y-auto max-h-[40vh] md:max-h-none shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-px bg-spectra/20 rounded-xl border border-spectra overflow-hidden">
                    <FormCell label={type === 'IN' ? 'Supplier' : 'Customer'} icon={User}>
                        <select className="form-select" value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)}>
                            <option value="">-- Pilih Partner --</option>
                            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </FormCell>
                    <FormCell label="Gudang" icon={Building2}>
                        <select className="form-select" value={selectedWh} onChange={e => setSelectedWh(e.target.value)}>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </FormCell>
                    <FormCell label="Tanggal" icon={Calendar}>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" />
                    </FormCell>
                    <FormCell label="Ref. No" icon={Hash}>
                        <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="form-input font-mono uppercase text-emerald-400" />
                    </FormCell>
                    <div className="sm:col-span-2">
                      <FormCell label="Catatan" icon={StickyNote}>
                          <input type="text" placeholder="..." value={notes} onChange={e => setNotes(e.target.value)} className="form-input" />
                      </FormCell>
                    </div>
                </div>
                <div className="md:col-span-3 flex flex-col gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 py-3 bg-daintree text-emerald-400 text-[10px] font-black uppercase rounded-xl border border-emerald-900/50 hover:bg-emerald-900/20 transition-all">
                        <FileSpreadsheet size={16}/> Import XLS
                    </button>
                    <div className="flex-1 hidden md:flex flex-col justify-center items-center bg-daintree/30 rounded-xl border border-dashed border-spectra p-2">
                        <span className="text-[10px] font-bold text-cutty uppercase">{lines.length} Baris</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Entry Row & Table */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
            {/* Quick Add Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-daintree/50 p-3 rounded-xl border border-spectra">
                <div className="sm:col-span-5 relative">
                    <input ref={itemInputRef} type="text" className="row-input" placeholder="Cari SKU/Nama..." value={query} onChange={e => { setQuery(e.target.value); if(pendingItem) setPendingItem(null); }} onFocus={() => query && setIsDropdownOpen(true)} />
                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-gable border border-spectra rounded-xl shadow-2xl z-[110] max-h-48 overflow-y-auto">
                            {filteredItems.map(it => (
                                <div key={it.id} className="p-2 hover:bg-spectra text-xs cursor-pointer border-b border-spectra/30" onMouseDown={() => selectItem(it)}>
                                    <div className="font-bold">{it.code}</div>
                                    <div className="text-[10px] opacity-60">{it.name}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="sm:col-span-3">
                    <input ref={qtyInputRef} type="number" className="row-input text-right" placeholder="0" value={pendingQty} onChange={e => setPendingQty(e.target.value)} />
                </div>
                <div className="sm:col-span-3">
                    <select className="row-input" value={pendingUnit} onChange={e => setPendingUnit(e.target.value)}>
                        {pendingItem ? (
                            <>
                                <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>
                                {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </>
                        ) : <option value="">- Unit -</option>}
                    </select>
                </div>
                <div className="sm:col-span-1">
                    <button onClick={handleAddLine} className="w-full h-10 flex items-center justify-center bg-spectra text-white rounded-lg hover:bg-white hover:text-spectra transition-all"><CornerDownLeft size={18}/></button>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto rounded-xl border border-spectra bg-daintree/20">
                <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="bg-daintree sticky top-0 z-10 text-[10px] font-black uppercase text-cutty border-b border-spectra shadow-sm">
                        <tr>
                            <th className="p-3 w-10 text-center">#</th>
                            <th className="p-3">Item</th>
                            <th className="p-3 w-28 text-right">Qty</th>
                            <th className="p-3 w-24 text-center">Unit</th>
                            <th className="p-3 w-24 text-right">Total Base</th>
                            <th className="p-3 w-12 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-spectra/20">
                        {lines.map((l, i) => (
                            <tr key={i} className="hover:bg-spectra/5 transition-colors">
                                <td className="p-3 text-center text-cutty font-mono">{i+1}</td>
                                <td className="p-3">
                                    <div className="font-bold text-slate-200">{l.name}</div>
                                    <div className="text-[9px] text-cutty font-mono">{l.code}</div>
                                </td>
                                <td className="p-3 text-right font-black text-white">{l.qty.toLocaleString()}</td>
                                <td className="p-3 text-center"><span className="px-2 py-0.5 rounded bg-daintree border border-spectra text-[10px] font-bold text-slate-400">{l.unit}</span></td>
                                <td className="p-3 text-right font-mono text-cutty">{(l.qty * (l.ratio || 1)).toLocaleString()}</td>
                                <td className="p-3 text-center">
                                    <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {lines.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-12 opacity-20"><Package size={48} className="text-spectra"/><p className="text-[10px] font-black uppercase tracking-widest mt-2">Daftar item kosong</p></div>
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-daintree border-t border-spectra flex justify-between items-center z-50">
             <div className="hidden sm:block text-[10px] text-cutty font-bold uppercase tracking-widest flex items-center gap-2">
                <Info size={14} className="text-spectra"/> Accurate Style Data Logic
             </div>
             <div className="flex gap-3 w-full sm:w-auto">
                <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-2.5 bg-gable text-slate-400 text-xs font-bold uppercase rounded-xl border border-spectra">Batal</button>
                <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 sm:flex-none px-8 py-2.5 bg-spectra hover:bg-white hover:text-daintree text-white text-xs font-black uppercase rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all">
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} <span>Simpan</span>
                </button>
             </div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={(e) => {}} />
      </div>
      <style>{`
        .form-select, .form-input, .row-input { @apply w-full h-10 bg-transparent text-white text-xs font-bold outline-none px-3 focus:bg-daintree/30 transition-all border-none; }
        .row-input { @apply h-10 bg-gable border border-spectra rounded-lg; }
      `}</style>
    </div>
  );
};

const FormCell = ({ label, icon: Icon, children }: any) => (
  <div className="bg-gable relative border-spectra h-14">
    <div className="absolute top-1 left-3 text-[8px] font-black text-cutty uppercase tracking-widest z-10 flex items-center gap-1"><Icon size={10}/> {label}</div>
    <div className="pt-4 h-full">{children}</div>
  </div>
);
