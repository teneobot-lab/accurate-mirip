
import React, { useState, useEffect } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, Save, X, CornerDownLeft, Loader2, Building2, User, Calendar, Hash } from 'lucide-react';
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
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(`${type === 'IN' ? 'RI' : 'DO'}.${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}.${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [selectedWh, setSelectedWh] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<TransactionItem[]>([]);

  // Row Entry State
  const [query, setQuery] = useState('');
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingQty, setPendingQty] = useState<number>(1);
  const [pendingNote, setPendingNote] = useState('');

  useEffect(() => {
    const load = async () => {
        try {
            const [its, whs, pts] = await Promise.all([
                StorageService.fetchItems().catch(() => []),
                StorageService.fetchWarehouses().catch(() => []),
                StorageService.fetchPartners().catch(() => [])
            ]);
            setItems(its);
            setWarehouses(whs);
            setPartners(pts.filter(p => type === 'IN' ? p.type === 'SUPPLIER' : p.type === 'CUSTOMER'));
            if (whs.length > 0) setSelectedWh(whs[0].id);
        } catch (e) {
            console.error("Load failed", e);
        }
    };
    load();
  }, [type]);

  const handleAddLine = () => {
    if (!pendingItem) return;
    const newLine: TransactionItem = {
      itemId: pendingItem.id,
      qty: pendingQty,
      unit: pendingItem.baseUnit,
      ratio: 1,
      note: pendingNote
    };
    setLines([...lines, newLine]);
    setQuery('');
    setPendingItem(null);
    setPendingQty(1);
    setPendingNote('');
  };

  const handleSubmit = async () => {
    if (lines.length === 0) return showToast("Tambahkan baris barang terlebih dahulu", "warning");
    setIsSubmitting(true);
    try {
        const tx: Transaction = {
            id: crypto.randomUUID(),
            date,
            referenceNo: refNo,
            type,
            sourceWarehouseId: selectedWh,
            supplier: partners.find(p => p.id === selectedPartner)?.name || '',
            items: lines,
            notes,
            createdAt: Date.now()
        };
        await StorageService.commitTransaction(tx);
        showToast("Transaksi Berhasil Disimpan", "success");
        onSuccess();
    } catch (e) {
        showToast("Gagal menyimpan transaksi.", "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#f3f4f6] dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-slate-300 dark:border-slate-800">
        
        {/* Title Bar */}
        <div className="bg-blue-800 text-white px-4 py-2 flex justify-between items-center shadow-md">
            <h2 className="font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                <Building2 size={16}/> Formulir {type === 'IN' ? 'Penerimaan Barang' : 'Pengiriman Barang'}
            </h2>
            <button onClick={onClose} className="hover:bg-red-600 rounded p-1 transition-colors"><X size={18}/></button>
        </div>

        {/* Accurate Style Header Block */}
        <div className="p-6 grid grid-cols-2 gap-8 bg-white dark:bg-slate-900/50 border-b dark:border-slate-800 shadow-inner">
            {/* Left Column: Vendor/Customer */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <label className="w-24 text-[11px] font-bold text-slate-500 uppercase tracking-tighter">{type === 'IN' ? 'Pemasok' : 'Pelanggan'}</label>
                    <div className="flex-1 relative">
                        <select 
                            className="w-full border dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs rounded-md outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={selectedPartner}
                            onChange={e => setSelectedPartner(e.target.value)}
                        >
                            <option value="">-- Pilih {type === 'IN' ? 'Supplier' : 'Customer'} --</option>
                            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <label className="w-24 text-[11px] font-bold text-slate-500 uppercase tracking-tighter mt-2">Keterangan</label>
                    <textarea 
                        className="flex-1 border dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs rounded-md outline-none focus:ring-2 focus:ring-blue-500 h-20"
                        placeholder="Catatan tambahan transaksi..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    ></textarea>
                </div>
            </div>

            {/* Right Column: Date & No */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <label className="w-24 text-[11px] font-bold text-slate-500 uppercase tracking-tighter text-right">No. Bukti</label>
                    <div className="flex-1 flex gap-1">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 border border-r-0 rounded-l-md"><Hash size={14} className="text-slate-400"/></div>
                        <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="w-full border dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs rounded-r-md font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="w-24 text-[11px] font-bold text-slate-500 uppercase tracking-tighter text-right">Tanggal</label>
                    <div className="flex-1 flex gap-1">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 border border-r-0 rounded-l-md"><Calendar size={14} className="text-slate-400"/></div>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs rounded-r-md outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="w-24 text-[11px] font-bold text-slate-500 uppercase tracking-tighter text-right">Gudang</label>
                    <div className="flex-1 flex gap-1">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 border border-r-0 rounded-l-md"><Building2 size={14} className="text-slate-400"/></div>
                        <select 
                            className="w-full border dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs rounded-r-md outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                            value={selectedWh}
                            onChange={e => setSelectedWh(e.target.value)}
                        >
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        </div>

        {/* Transaction Grid (Accurate Dense Style) */}
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-950">
            <table className="w-full text-[11px] border-collapse">
                <thead className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-300 dark:border-slate-700 sticky top-0 z-10">
                    <tr>
                        <th className="p-2 border-r dark:border-slate-700 w-10 text-center">#</th>
                        <th className="p-2 border-r dark:border-slate-700">Kode Barang / Nama Barang</th>
                        <th className="p-2 border-r dark:border-slate-700 w-24 text-right">Kuantitas</th>
                        <th className="p-2 border-r dark:border-slate-700 w-20 text-center">Satuan</th>
                        <th className="p-2 border-r dark:border-slate-700 w-48">Keterangan Baris</th>
                        <th className="p-2 w-10 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                    {lines.map((l, i) => (
                        <tr key={i} className="hover:bg-blue-50 dark:hover:bg-slate-900/50 transition-colors group">
                            <td className="p-2 border-r dark:border-slate-800 text-center text-slate-400">{i + 1}</td>
                            <td className="p-2 border-r dark:border-slate-800">
                                <div className="font-bold text-blue-700 dark:text-blue-400">{items.find(it => it.id === l.itemId)?.name}</div>
                                <div className="text-[9px] text-slate-400 font-mono">{items.find(it => it.id === l.itemId)?.code}</div>
                            </td>
                            <td className="p-2 border-r dark:border-slate-800 text-right font-mono font-bold text-lg">{l.qty}</td>
                            <td className="p-2 border-r dark:border-slate-800 text-center font-bold text-slate-500">{l.unit}</td>
                            <td className="p-2 border-r dark:border-slate-800 text-slate-500 italic truncate max-w-[150px]">{l.note}</td>
                            <td className="p-2 text-center">
                                <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                            </td>
                        </tr>
                    ))}
                    
                    {/* Add Row Logic */}
                    <tr className="bg-blue-50/50 dark:bg-blue-900/10 h-12">
                        <td className="p-2 border-r dark:border-slate-800 text-center"><Plus size={14} className="text-blue-500 mx-auto"/></td>
                        <td className="p-1 border-r dark:border-slate-800">
                            <input 
                                list="item-list-entry"
                                className="w-full bg-transparent p-1 outline-none text-xs border-b border-transparent focus:border-blue-500 placeholder:text-blue-300 font-bold" 
                                placeholder="Klik untuk cari barang..."
                                value={query}
                                onChange={e => {
                                    setQuery(e.target.value);
                                    const it = items.find(x => x.name === e.target.value || x.code === e.target.value);
                                    if(it) setPendingItem(it);
                                }}
                            />
                            <datalist id="item-list-entry">
                                {items.map(it => <option key={it.id} value={it.name}>{it.code}</option>)}
                            </datalist>
                        </td>
                        <td className="p-1 border-r dark:border-slate-800">
                            <input type="number" className="w-full bg-transparent p-1 outline-none text-right font-mono font-bold text-lg" value={pendingQty} onChange={e => setPendingQty(Number(e.target.value))} />
                        </td>
                        <td className="p-1 border-r dark:border-slate-800 text-center text-slate-400 font-bold">
                            {pendingItem?.baseUnit || '-'}
                        </td>
                        <td className="p-1 border-r dark:border-slate-800">
                            <input type="text" placeholder="..." className="w-full bg-transparent p-1 outline-none italic" value={pendingNote} onChange={e => setPendingNote(e.target.value)} />
                        </td>
                        <td className="p-1 text-center">
                            <button onClick={handleAddLine} className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 shadow-md transition-all active:scale-90"><CornerDownLeft size={16}/></button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        {/* Footer Area */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900 border-t dark:border-slate-800 flex justify-between items-center shadow-inner">
             <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Total Baris: {lines.length} | Total Kuantitas: {lines.reduce((acc,l)=>acc+l.qty,0)}
             </div>
             <div className="flex gap-4">
                <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Batal</button>
                <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || !selectedWh}
                    className="px-8 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-md font-bold text-sm shadow-xl flex items-center gap-3 transition-all active:scale-95"
                >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    SIMPAN (F10)
                </button>
             </div>
        </div>
      </div>
    </div>
  );
};
