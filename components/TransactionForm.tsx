
import React, { useState, useEffect, useRef } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner, Stock } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, Save, X, CornerDownLeft, Loader2, Info, User, Building2, Calendar, Hash, Package, Search } from 'lucide-react';
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

  // Form States
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(initialData?.referenceNo || `${type === 'IN' ? 'RI' : 'DO'}.${Date.now().toString().slice(-6)}`);
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialData?.partnerId || '');
  const [selectedWh, setSelectedWh] = useState(initialData?.sourceWarehouseId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [lines, setLines] = useState<TransactionItem[]>(initialData?.items || []);

  // Entry States
  const [query, setQuery] = useState('');
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingUnit, setPendingUnit] = useState('');
  const [pendingQty, setPendingQty] = useState<string>('');
  
  // Refs
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
        const [its, whs, pts, stks] = await Promise.all([
            StorageService.fetchItems().catch(() => []),
            StorageService.fetchWarehouses().catch(() => []),
            StorageService.fetchPartners().catch(() => []),
            StorageService.fetchStocks().catch(() => [])
        ]);
        setItems(its || []);
        setWarehouses(whs || []);
        setStocks(stks || []);
        setPartners(pts.filter(p => type === 'IN' ? p.type === 'SUPPLIER' : p.type === 'CUSTOMER'));
        if (whs.length > 0 && !initialData) setSelectedWh(whs[0].id);
    };
    load();
  }, []);

  const getStock = (itemId: string) => {
      const s = stocks.find(x => x.itemId === itemId && x.warehouseId === selectedWh);
      return s ? Number(s.qty) : 0;
  };

  const handleAddLine = () => {
      if (!pendingItem || !pendingQty) return;
      const unit = pendingUnit || pendingItem.baseUnit;
      let ratio = 1;
      if (unit !== pendingItem.baseUnit) {
          const c = pendingItem.conversions?.find(x => x.name === unit);
          if (c) ratio = c.operator === '/' ? 1 / c.ratio : c.ratio;
      }

      setLines([...lines, {
          itemId: pendingItem.id,
          name: pendingItem.name,
          code: pendingItem.code,
          qty: Number(pendingQty),
          unit,
          ratio
      }]);
      setQuery(''); setPendingItem(null); setPendingQty(''); setPendingUnit('');
      itemInputRef.current?.focus();
  };

  const handleSubmit = async () => {
      if (!selectedWh || lines.length === 0) return showToast("Lengkapi data transaksi", "warning");
      setIsSubmitting(true);
      try {
          const payload = {
              id: initialData?.id || crypto.randomUUID(),
              date, referenceNo: refNo, type, 
              sourceWarehouseId: selectedWh, partnerId: selectedPartnerId, notes,
              items: lines.map(l => ({ item_id: l.itemId, qty: l.qty, unit: l.unit, conversionRatio: l.ratio }))
          };

          if (initialData) await StorageService.updateTransaction(initialData.id, payload as any);
          else await StorageService.commitTransaction(payload as any);
          
          showToast("Transaksi Berhasil Disimpan", "success");
          onSuccess();
      } catch (e: any) {
          showToast(e.message, "error");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="fixed inset-0 bg-daintree/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm font-sans">
      <div className="bg-gable w-full max-w-5xl h-[90vh] flex flex-col border border-spectra shadow-2xl overflow-hidden rounded-sm">
        
        {/* HEADER BAR */}
        <div className={`px-4 py-2 flex justify-between items-center ${type === 'IN' ? 'bg-emerald-900/50 border-b border-emerald-800' : 'bg-red-900/50 border-b border-red-800'}`}>
            <div className="flex items-center gap-3">
                <span className={`text-xs font-black uppercase tracking-widest ${type === 'IN' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {initialData ? 'Edit Transaksi' : 'Form Transaksi'} {type === 'IN' ? 'Penerimaan' : 'Pengeluaran'}
                </span>
                <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-mono text-white">{refNo}</span>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white"><X size={16}/></button>
        </div>

        {/* COMPACT FORM HEADER (ACCURATE STYLE) */}
        <div className="bg-daintree p-3 grid grid-cols-4 gap-3 border-b border-spectra text-[10px]">
            <div className="flex flex-col gap-1">
                <label className="font-bold text-cutty uppercase">Partner</label>
                <select value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)} className="acc-input">
                    <option value="">-- PILIH --</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            <div className="flex flex-col gap-1">
                <label className="font-bold text-cutty uppercase">Gudang</label>
                <select value={selectedWh} onChange={e => setSelectedWh(e.target.value)} className="acc-input">
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
            </div>
            <div className="flex flex-col gap-1">
                <label className="font-bold text-cutty uppercase">Tanggal</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="acc-input" />
            </div>
            <div className="flex flex-col gap-1">
                <label className="font-bold text-cutty uppercase">No. Referensi</label>
                <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="acc-input font-mono uppercase text-emerald-400" />
            </div>
            <div className="col-span-4 flex flex-col gap-1">
                <label className="font-bold text-cutty uppercase">Catatan / Keterangan</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="acc-input" placeholder="Isi keterangan transaksi..." />
            </div>
        </div>

        {/* TRANSACTION GRID (DENSE) */}
        <div className="flex-1 bg-gable overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse border border-spectra/30">
                    <thead className="bg-daintree text-[9px] font-black uppercase text-cutty sticky top-0 z-10">
                        <tr>
                            <th className="p-1 border border-spectra/30 text-center w-8">#</th>
                            <th className="p-1 border border-spectra/30 w-32">Kode SKU</th>
                            <th className="p-1 border border-spectra/30">Nama Barang</th>
                            <th className="p-1 border border-spectra/30 w-24 text-right">Qty</th>
                            <th className="p-1 border border-spectra/30 w-24 text-center">Satuan</th>
                            <th className="p-1 border border-spectra/30 w-10 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="text-[11px] text-white">
                        {/* INPUT ROW */}
                        <tr className="bg-daintree/30">
                            <td className="p-1 text-center"><Plus size={12} className="mx-auto text-spectra"/></td>
                            <td colSpan={2} className="p-0 border border-spectra/30 relative">
                                <input 
                                    ref={itemInputRef}
                                    type="text" 
                                    className="w-full h-full bg-transparent px-2 py-1 outline-none text-emerald-400 font-mono placeholder:text-cutty"
                                    placeholder="Cari Item..."
                                    value={query}
                                    onChange={e => {
                                        setQuery(e.target.value);
                                        const it = items.find(i => i.code === e.target.value || i.name === e.target.value);
                                        if(it) { setPendingItem(it); setPendingUnit(it.baseUnit); qtyInputRef.current?.focus(); }
                                    }}
                                    list="item-list"
                                />
                                <datalist id="item-list">{items.map(i => <option key={i.id} value={i.code}>{i.name}</option>)}</datalist>
                            </td>
                            <td className="p-0 border border-spectra/30">
                                <input 
                                    ref={qtyInputRef}
                                    type="number" 
                                    className="w-full h-full bg-transparent px-2 py-1 outline-none text-right font-bold"
                                    placeholder="0"
                                    value={pendingQty}
                                    onChange={e => setPendingQty(e.target.value)}
                                    onKeyDown={e => { if(e.key === 'Enter') handleAddLine(); }}
                                />
                            </td>
                            <td className="p-0 border border-spectra/30">
                                <select value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="w-full h-full bg-transparent px-1 outline-none text-center">
                                    {pendingItem ? (
                                        <>
                                            <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>
                                            {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        </>
                                    ) : <option>-</option>}
                                </select>
                            </td>
                            <td className="p-1 text-center border border-spectra/30">
                                <button onClick={handleAddLine} disabled={!pendingItem} className="text-emerald-400 hover:text-white"><CornerDownLeft size={14}/></button>
                            </td>
                        </tr>
                        {/* LINES */}
                        {lines.map((line, idx) => (
                            <tr key={idx} className="hover:bg-spectra/10">
                                <td className="p-1 text-center text-cutty border border-spectra/30">{idx + 1}</td>
                                <td className="p-1 font-mono text-emerald-500 border border-spectra/30">{line.code}</td>
                                <td className="p-1 border border-spectra/30">{line.name}</td>
                                <td className="p-1 text-right font-bold border border-spectra/30">{line.qty.toLocaleString()}</td>
                                <td className="p-1 text-center border border-spectra/30">{line.unit}</td>
                                <td className="p-1 text-center border border-spectra/30">
                                    <button onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-400"><Trash2 size={12}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="p-3 border-t border-spectra bg-daintree flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-1.5 text-xs font-bold text-slate-400 hover:text-white uppercase border border-transparent">Batal</button>
                <button onClick={handleSubmit} disabled={isSubmitting} className="px-6 py-1.5 bg-spectra text-white text-xs font-bold uppercase hover:bg-white hover:text-spectra transition-colors border border-spectra flex items-center gap-2">
                    {isSubmitting ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} SIMPAN
                </button>
            </div>
        </div>
      </div>
      <style>{`
        .acc-input { @apply w-full bg-gable border border-spectra px-2 py-1 text-[11px] font-bold text-white outline-none focus:border-white rounded-none; }
      `}</style>
    </div>
  );
};
