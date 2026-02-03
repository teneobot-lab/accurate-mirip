
import React, { useState, useEffect, useRef } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, Save, X, CornerDownLeft, Loader2, Calendar, Hash, User, Building2, ChevronDown, Package } from 'lucide-react';
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

  // Form State
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(initialData?.referenceNo || `${type}.${Date.now().toString().slice(-6)}`);
  const [partnerId, setPartnerId] = useState(initialData?.partnerId || '');
  const [whId, setWhId] = useState(initialData?.sourceWarehouseId || '');
  const [lines, setLines] = useState<TransactionItem[]>(initialData?.items || []);

  // Line Entry
  const [query, setQuery] = useState('');
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingQty, setPendingQty] = useState<string>('');
  const [pendingUnit, setPendingUnit] = useState('');

  useEffect(() => {
    const load = async () => {
        const [its, whs, pts] = await Promise.all([
            StorageService.fetchItems(),
            StorageService.fetchWarehouses(),
            StorageService.fetchPartners()
        ]);
        setItems(its || []);
        setWarehouses(whs || []);
        setPartners(pts.filter(p => type === 'IN' ? p.type === 'SUPPLIER' : p.type === 'CUSTOMER'));
        if (whs.length > 0 && !initialData) setWhId(whs[0].id);
    };
    load();
  }, []);

  const handleAddLine = () => {
    if (!pendingItem || !pendingQty) return;
    const newLine: TransactionItem = {
        itemId: pendingItem.id,
        name: pendingItem.name,
        code: pendingItem.code,
        qty: Number(pendingQty),
        unit: pendingUnit || pendingItem.baseUnit,
        ratio: 1
    };
    setLines([...lines, newLine]);
    setQuery(''); setPendingItem(null); setPendingQty('');
  };

  const handleSubmit = async () => {
    if (lines.length === 0 || !whId) return showToast("Lengkapi data", "warning");
    setIsSubmitting(true);
    try {
        const payload = {
            date, referenceNo: refNo, type, sourceWarehouseId: whId, partnerId,
            items: lines.map(l => ({ item_id: l.itemId, qty: l.qty, unit: l.unit, conversionRatio: l.ratio || 1 })),
            notes: ''
        };
        if (initialData) await StorageService.updateTransaction(initialData.id, payload as any);
        else await StorageService.commitTransaction({ ...payload, id: crypto.randomUUID() } as any);
        showToast("Tersimpan", "success");
        onSuccess();
    } catch (e: any) {
        showToast(e.message, "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-acc-border">
        {/* Header Bar */}
        <div className="bg-acc-blue px-3 py-2 flex justify-between items-center">
            <h2 className="text-white text-xs font-black uppercase tracking-widest">
                {initialData ? 'Edit' : 'Entry'} {type === 'IN' ? 'Penerimaan Barang' : 'Pengeluaran Barang'}
            </h2>
            <button onClick={onClose} className="text-white/70 hover:text-white"><X size={16}/></button>
        </div>

        {/* Form Header Area (Compact) */}
        <div className="p-3 bg-acc-header grid grid-cols-4 gap-4 border-b border-acc-border">
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Partner</span>
                <select value={partnerId} onChange={e => setPartnerId(e.target.value)} className="w-full">
                    <option value="">-- PILIH --</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Gudang</span>
                <select value={whId} onChange={e => setWhId(e.target.value)} className="w-full">
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Tanggal</span>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full" />
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">No. Bukti</span>
                <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="w-full font-bold text-acc-blue uppercase" />
            </div>
        </div>

        {/* Transaction Grid */}
        <div className="flex-1 overflow-auto bg-white">
            <table className="w-full dense-table border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10">
                    <tr>
                        <th className="w-8">#</th>
                        <th>Kode & Nama Barang</th>
                        <th className="w-24 text-right">Qty</th>
                        <th className="w-24 text-center">Unit</th>
                        <th className="w-10"></th>
                    </tr>
                </thead>
                <tbody>
                    {/* Input Row */}
                    <tr className="bg-blue-50/50">
                        <td className="text-center"><Plus size={14} className="text-slate-400 mx-auto"/></td>
                        <td>
                            <input 
                                list="items-list" 
                                value={query} 
                                onChange={e => {
                                    setQuery(e.target.value);
                                    const it = items.find(i => i.name === e.target.value || i.code === e.target.value);
                                    if(it) { setPendingItem(it); setPendingUnit(it.baseUnit); }
                                }} 
                                placeholder="Cari Barang..."
                                className="w-full border-none focus:ring-0 bg-transparent"
                            />
                            <datalist id="items-list">{items.map(it => <option key={it.id} value={it.name}>{it.code}</option>)}</datalist>
                        </td>
                        <td>
                            <input type="number" value={pendingQty} onChange={e => setPendingQty(e.target.value)} placeholder="0" className="w-full border-none focus:ring-0 text-right bg-transparent font-bold" />
                        </td>
                        <td>
                            <select value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="w-full border-none focus:ring-0 bg-transparent text-center">
                                {pendingItem && (
                                    <>
                                        <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>
                                        {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </>
                                )}
                            </select>
                        </td>
                        <td className="text-center">
                            <button onClick={handleAddLine} className="p-1 bg-acc-blue text-white rounded"><CornerDownLeft size={12}/></button>
                        </td>
                    </tr>
                    {/* Item Lines */}
                    {lines.map((l, i) => (
                        <tr key={i}>
                            <td className="text-center text-slate-400">{i+1}</td>
                            <td>
                                <div className="font-bold">{l.name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{l.code}</div>
                            </td>
                            <td className="text-right font-bold">{l.qty.toLocaleString()}</td>
                            <td className="text-center text-slate-500">{l.unit}</td>
                            <td className="text-center">
                                <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-acc-header border-t border-acc-border flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 uppercase">Batal</button>
            <button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="px-6 py-1.5 bg-acc-blue text-white rounded font-black text-xs uppercase shadow hover:bg-slate-800 transition-all flex items-center gap-2"
            >
                {isSubmitting ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} SIMPAN
            </button>
        </div>
      </div>
    </div>
  );
};
