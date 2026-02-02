
import React, { useState, useEffect, useRef } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner } from '../types';
import { StorageService } from '../services/storage';
// Added Edit3 to the imports from lucide-react to fix the "Cannot find name 'Edit3'" error on line 98.
import { Plus, Trash2, Save, X, CornerDownLeft, Loader2, Building2, User, Calendar, Hash, Tag, Info, Search, Package, ArrowRight, Edit3 } from 'lucide-react';
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

  // Row Entry States
  const [query, setQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingQty, setPendingQty] = useState<number>(1);
  const [pendingUnit, setPendingUnit] = useState('');

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
        } catch (e) {}
    };
    load();
  }, [type, initialData]);

  useEffect(() => {
    if (!query || pendingItem) { setFilteredItems([]); setIsDropdownOpen(false); return; }
    const res = items.filter(it => it.name.toLowerCase().includes(query.toLowerCase()) || it.code.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
    setFilteredItems(res);
    setIsDropdownOpen(res.length > 0);
  }, [query, items, pendingItem]);

  const handleAddLine = () => {
    if (!pendingItem) return;
    const newLine: TransactionItem = {
      itemId: pendingItem.id,
      qty: pendingQty,
      unit: pendingUnit || pendingItem.baseUnit,
      ratio: 1,
      name: pendingItem.name,
      code: pendingItem.code
    };
    setLines([...lines, newLine]);
    setQuery(''); setPendingItem(null); setPendingQty(1);
  };

  const handleSubmit = async () => {
    if (lines.length === 0) return showToast("Tambahkan baris barang!", "warning");
    setIsSubmitting(true);
    try {
        const txData = { date, referenceNo: refNo, type, sourceWarehouseId: selectedWh, partnerId: selectedPartnerId, items: lines.map(l => ({ item_id: l.itemId, qty: l.qty, unit: l.unit, conversionRatio: 1 })), notes };
        if (initialData?.id) await StorageService.updateTransaction(initialData.id, txData as any);
        else await StorageService.commitTransaction({ ...txData, id: crypto.randomUUID() } as any);
        showToast("Transaksi Berhasil Diposting", "success");
        onSuccess();
    } catch (e: any) {
        showToast(e.message, "error");
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 modal-backdrop animate-in fade-in duration-300">
      <div className="bg-slate-50 dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 px-10 py-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${type === 'IN' ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-red-600 text-white shadow-red-200'}`}>
                   {initialData ? <Edit3 size={24}/> : <Plus size={24}/>}
                </div>
                <div>
                   <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight uppercase tracking-tight">
                      {initialData ? 'Koreksi' : 'Entry'} Transaksi {type === 'IN' ? 'Masuk' : 'Keluar'}
                   </h2>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Transaction Control Panel</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-xl transition-all"><X size={24} className="text-slate-400"/></button>
        </div>

        {/* Form Body */}
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Form Section */}
            <div className="p-10 grid grid-cols-3 gap-10 bg-white dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{type === 'IN' ? 'Supplier' : 'Pelanggan'}</label>
                        <select className="accurate-input font-semibold" value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)}>
                            <option value="">-- Pilih Partner --</option>
                            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Gudang Penyimpanan</label>
                        <select className="accurate-input font-semibold text-blue-600" value={selectedWh} onChange={e => setSelectedWh(e.target.value)}>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nomor Referensi</label>
                        <div className="relative">
                            <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input className="accurate-input pl-11 font-mono font-bold text-slate-700" value={refNo} onChange={e => setRefNo(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Tanggal Transaksi</label>
                        <div className="relative">
                            <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" />
                            <input type="date" className="accurate-input pl-11 font-bold" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Catatan / Memo</label>
                    <textarea className="accurate-input h-[116px] resize-none py-3 text-xs leading-relaxed" placeholder="Tulis catatan di sini..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
            </div>

            {/* Table Entry Section */}
            <div className="flex-1 overflow-auto px-10 py-8 bg-slate-50 dark:bg-slate-900">
                <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">
                        <tr>
                            <th className="px-4 py-2 w-12 text-center">#</th>
                            <th className="px-4 py-2">Master Item</th>
                            <th className="px-4 py-2 w-32 text-right">Kuantitas</th>
                            <th className="px-4 py-2 w-32 text-center">Satuan</th>
                            <th className="px-4 py-2 w-20 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, i) => (
                            <tr key={i} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                                <td className="px-4 py-4 text-center font-mono text-xs text-slate-300 rounded-l-2xl">{i + 1}</td>
                                <td className="px-4 py-4">
                                    <div className="font-bold text-slate-800 dark:text-slate-200">{l.name}</div>
                                    <div className="text-[10px] font-mono text-blue-500 uppercase">{l.code}</div>
                                </td>
                                <td className="px-4 py-4 text-right font-mono font-bold text-slate-700 dark:text-white text-base">{l.qty.toLocaleString()}</td>
                                <td className="px-4 py-4 text-center"><span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-black uppercase text-slate-500">{l.unit}</span></td>
                                <td className="px-4 py-4 text-center rounded-r-2xl">
                                    <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                                </td>
                            </tr>
                        ))}
                        
                        {/* Inline Entry Row */}
                        <tr className="bg-blue-50/50 dark:bg-blue-900/10 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-2xl">
                            <td className="px-4 py-4 text-center"><Plus size={18} className="text-blue-500 mx-auto"/></td>
                            <td className="px-4 py-4 relative">
                                <input className="w-full bg-transparent border-none outline-none text-sm font-bold placeholder:text-slate-400" placeholder="Ketik kode atau nama..." value={query} onChange={e => {setQuery(e.target.value); setPendingItem(null);}} />
                                {isDropdownOpen && (
                                    <div className="absolute left-0 top-full mt-2 w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 py-2 overflow-hidden">
                                        {filteredItems.map(it => (
                                            <button key={it.id} onClick={() => {setPendingItem(it); setQuery(it.name); setPendingUnit(it.baseUnit); setIsDropdownOpen(false);}} className="w-full text-left px-5 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 flex justify-between items-center transition-colors">
                                                <div>
                                                    <div className="text-xs font-bold">{it.name}</div>
                                                    <div className="text-[10px] font-mono text-slate-400 uppercase">{it.code}</div>
                                                </div>
                                                <div className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded uppercase">{it.baseUnit}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </td>
                            <td className="px-4 py-4">
                                <input type="number" className="w-full bg-transparent border-none outline-none text-right font-mono font-bold text-base text-blue-600" value={pendingQty} onChange={e => setPendingQty(Number(e.target.value))} />
                            </td>
                            <td className="px-4 py-4 text-center font-bold text-xs text-slate-400 uppercase">{pendingUnit || '-'}</td>
                            <td className="px-4 py-4 text-center">
                                <button onClick={handleAddLine} disabled={!pendingItem} className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg disabled:opacity-30 active:scale-90 transition-all"><Plus size={18}/></button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-10 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
             <div className="flex gap-12">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Items</span>
                    <span className="text-2xl font-bold text-slate-800 dark:text-white leading-none">{lines.length} <small className="text-xs font-normal text-slate-400 uppercase">Lines</small></span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Kuantitas</span>
                    <span className="text-2xl font-bold text-blue-600 leading-none">{lines.reduce((acc,l)=>acc+l.qty, 0).toLocaleString()} <small className="text-xs font-normal text-slate-400 uppercase">Unit</small></span>
                </div>
             </div>
             <div className="flex gap-4">
                <button onClick={onClose} className="px-8 py-3 text-xs font-bold text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-widest">Batal</button>
                <button onClick={handleSubmit} disabled={isSubmitting} className="px-14 py-3.5 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50">
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {initialData ? 'PERBARUI TRANSAKSI' : 'POSTING TRANSAKSI'}
                </button>
             </div>
        </div>
      </div>
      <style>{`
        .accurate-input { @apply w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-5 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-white shadow-sm; }
      `}</style>
    </div>
  );
};
