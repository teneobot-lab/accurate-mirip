
import React, { useState, useEffect, useRef } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, Save, X, Search, CornerDownLeft, Loader2 } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  type: TransactionType;
  initialData?: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransactionForm: React.FC<Props> = ({ type, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(`TRX-${Date.now().toString().slice(-6)}`);
  const [sourceWh, setSourceWh] = useState('');
  const [lines, setLines] = useState<TransactionItem[]>([]);

  const [query, setQuery] = useState('');
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingQty, setPendingQty] = useState<number>(1);

  useEffect(() => {
    const load = async () => {
        const [its, whs] = await Promise.all([StorageService.fetchItems(), StorageService.fetchWarehouses()]);
        setItems(its);
        setWarehouses(whs);
        if (whs.length > 0) setSourceWh(whs[0].id);
    };
    load();
  }, []);

  const handleAddLine = () => {
    if (!pendingItem) return;
    const newLine: TransactionItem = {
      itemId: pendingItem.id,
      qty: pendingQty,
      unit: pendingItem.baseUnit,
      ratio: 1
    };
    setLines([...lines, newLine]);
    setQuery('');
    setPendingItem(null);
  };

  const handleSubmit = async () => {
    if (lines.length === 0) return showToast("Tambahkan barang dulu", "warning");
    setIsSubmitting(true);
    try {
        const tx: any = {
            id: crypto.randomUUID(),
            date,
            referenceNo: refNo,
            type,
            sourceWarehouseId: sourceWh,
            items: lines,
            createdAt: Date.now()
        };
        await StorageService.commitTransaction(tx);
        showToast("Transaksi tersimpan di Database Utama", "success");
        onSuccess();
    } catch (e) {
        showToast("Gagal simpan transaksi.", "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col border border-slate-200">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800">
            <h2 className="font-bold text-lg">Transaksi Baru: {type}</h2>
            <button onClick={onClose}><X size={20}/></button>
        </div>

        <div className="p-4 grid grid-cols-3 gap-4 border-b dark:border-slate-800">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded p-2 text-sm dark:bg-slate-800" />
            <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="border rounded p-2 text-sm font-mono dark:bg-slate-800" />
            <select value={sourceWh} onChange={e => setSourceWh(e.target.value)} className="border rounded p-2 text-sm dark:bg-slate-800">
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
        </div>

        <div className="flex-1 overflow-auto p-4">
            <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                    <tr>
                        <th className="p-2 text-left">Barang</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2">Act</th>
                    </tr>
                </thead>
                <tbody>
                    {lines.map((l, i) => (
                        <tr key={i} className="border-b dark:border-slate-800">
                            <td className="p-2">{items.find(it => it.id === l.itemId)?.name}</td>
                            <td className="p-2 text-right">{l.qty}</td>
                            <td className="p-2 text-center"><button onClick={() => setLines(lines.filter((_, idx) => idx !== i))}><Trash2 size={14}/></button></td>
                        </tr>
                    ))}
                    <tr className="bg-emerald-50/30">
                        <td className="p-2">
                            <input 
                                list="item-list"
                                className="w-full p-1 border rounded text-xs dark:bg-slate-800" 
                                placeholder="Cari Kode/Nama..."
                                value={query}
                                onChange={e => {
                                    setQuery(e.target.value);
                                    const it = items.find(x => x.name === e.target.value || x.code === e.target.value);
                                    if(it) setPendingItem(it);
                                }}
                            />
                            <datalist id="item-list">
                                {items.map(it => <option key={it.id} value={it.name}>{it.code}</option>)}
                            </datalist>
                        </td>
                        <td className="p-2">
                            <input type="number" className="w-20 p-1 border rounded text-right text-xs dark:bg-slate-800" value={pendingQty} onChange={e => setPendingQty(Number(e.target.value))} />
                        </td>
                        <td className="p-2 text-center">
                            <button onClick={handleAddLine} className="p-1 bg-emerald-600 text-white rounded"><CornerDownLeft size={14}/></button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div className="p-4 border-t flex justify-end gap-3 bg-slate-50 dark:bg-slate-800">
             <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500">Batal</button>
             <button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded font-bold text-sm shadow-lg flex items-center gap-2"
             >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Simpan ke Database
             </button>
        </div>
      </div>
    </div>
  );
};
