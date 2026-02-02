
import React, { useState, useEffect } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, Save, X, CornerDownLeft, Loader2, Building2, User, Calendar, Hash, Tag, Edit3, Info } from 'lucide-react';
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

  // Row Entry State
  const [query, setQuery] = useState('');
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingUnit, setPendingUnit] = useState('');
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

  const handleAddLine = () => {
    if (!pendingItem) return;
    
    let ratio = 1;
    if (pendingUnit !== pendingItem.baseUnit) {
        const conv = pendingItem.conversions?.find(c => c.name === pendingUnit);
        if (conv) {
            ratio = conv.operator === '/' ? 1 / conv.ratio : conv.ratio;
        }
    }

    const newLine: TransactionItem = {
      itemId: pendingItem.id,
      qty: pendingQty,
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
  };

  const handleSubmit = async () => {
    if (lines.length === 0) return showToast("Tambahkan baris barang terlebih dahulu", "warning");
    if (!selectedWh) return showToast("Pilih gudang terlebih dahulu", "warning");
    
    setIsSubmitting(true);
    try {
        const txData: any = {
            date,
            referenceNo: refNo,
            type,
            sourceWarehouseId: selectedWh,
            partnerId: selectedPartnerId,
            items: lines.map(line => ({
                ...line,
                conversionRatio: line.ratio || 1
            })),
            notes,
            createdAt: Date.now()
        };
        
        if (initialData?.id) {
            await StorageService.updateTransaction(initialData.id, txData);
            showToast("Transaksi Berhasil Diperbarui", "success");
        } else {
            await StorageService.commitTransaction({ ...txData, id: crypto.randomUUID() });
            showToast("Transaksi Berhasil Disimpan", "success");
        }
        onSuccess();
    } catch (e: any) {
        showToast(`Gagal: ${e.message}`, "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-[#f3f4f6] dark:bg-slate-900 rounded-3xl shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-white/20 animate-in zoom-in duration-300">
        
        {/* Title Bar */}
        <div className="bg-slate-900 text-white px-8 py-5 flex justify-between items-center shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 bg-blue-600/10 rounded-full blur-3xl -mr-12 -mt-12"></div>
            <div className="relative z-10 flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${type === 'IN' ? 'bg-emerald-600' : 'bg-red-600'} shadow-lg`}>
                   {initialData ? <Edit3 size={20}/> : <Plus size={20}/>}
                </div>
                <div>
                   <h2 className="font-black text-lg tracking-tight uppercase">
                      {initialData ? 'Update' : 'Entry'} {type === 'IN' ? 'Barang Masuk' : 'Barang Keluar'}
                   </h2>
                   <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Waresix Transaction Control System</p>
                </div>
            </div>
            <button onClick={onClose} className="relative z-10 hover:bg-white/10 rounded-full p-2 transition-all"><X size={24}/></button>
        </div>

        {/* Header Block */}
        <div className="p-8 grid grid-cols-2 gap-10 bg-white dark:bg-slate-900/50 border-b dark:border-slate-800 shadow-inner">
            <div className="space-y-6">
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{type === 'IN' ? 'Supplier' : 'Customer'}</label>
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border dark:border-slate-700">
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-blue-500"><User size={16}/></div>
                        <select 
                            className="flex-1 bg-transparent border-none outline-none text-xs font-bold"
                            value={selectedPartnerId}
                            onChange={e => setSelectedPartnerId(e.target.value)}
                        >
                            <option value="">-- Pilih {type === 'IN' ? 'Supplier' : 'Customer'} --</option>
                            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan / Memo</label>
                    <textarea 
                        className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-4 text-xs rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 h-24 font-medium transition-all"
                        placeholder="Catatan tambahan transaksi..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    ></textarea>
                </div>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No. Bukti</label>
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border dark:border-slate-700">
                           <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-slate-400"><Hash size={16}/></div>
                           <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="w-full bg-transparent border-none outline-none text-xs font-mono font-bold" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border dark:border-slate-700">
                           <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-emerald-500"><Calendar size={16}/></div>
                           <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-transparent border-none outline-none text-xs font-bold" />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gudang Penyimpanan</label>
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border dark:border-slate-700">
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-amber-500"><Building2 size={16}/></div>
                        <select 
                            className="flex-1 bg-transparent border-none outline-none text-xs font-bold"
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
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-950 px-8 py-6">
            <table className="w-full text-[11px] border-separate border-spacing-y-2">
                <thead className="bg-[#fcfdfe] dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-[0.2em] sticky top-0 z-10">
                    <tr>
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3">Master Item</th>
                        <th className="p-3 w-28 text-right">Kuantitas</th>
                        <th className="p-3 w-36 text-center">Satuan</th>
                        <th className="p-3 w-64">Memo Line</th>
                        <th className="p-3 w-16 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="space-y-2">
                    {lines.map((l, i) => (
                        <tr key={i} className="group bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-2xl transition-all shadow-sm">
                            <td className="p-4 text-center font-mono text-slate-300 rounded-l-2xl">{i + 1}</td>
                            <td className="p-4">
                                <div className="font-black text-slate-700 dark:text-slate-200">{l.name}</div>
                                <div className="text-[9px] text-blue-500 font-black flex items-center gap-1"><Tag size={10}/> {l.code}</div>
                            </td>
                            <td className="p-4 text-right font-mono font-black text-sm text-slate-800 dark:text-white">{l.qty.toLocaleString()}</td>
                            <td className="p-4 text-center">
                                <div className="flex flex-col items-center">
                                    <span className="bg-white dark:bg-slate-900 px-3 py-1 rounded-full border dark:border-slate-700 text-[10px] font-black text-slate-500">{l.unit}</span>
                                    {l.ratio !== 1 && <span className="text-[8px] text-blue-400 font-bold mt-1">Ratio: {l.ratio}x</span>}
                                </div>
                            </td>
                            <td className="p-4 text-slate-500 italic font-medium">{l.note || '-'}</td>
                            <td className="p-4 text-center rounded-r-2xl">
                                <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                            </td>
                        </tr>
                    ))}
                    
                    {/* Add Line Entry */}
                    <tr className="bg-slate-100 dark:bg-slate-900 border border-dashed dark:border-slate-800 rounded-2xl">
                        <td className="p-3 text-center"><Plus size={16} className="text-blue-500 mx-auto"/></td>
                        <td className="p-2">
                            <input 
                                list="item-list-entry"
                                className="w-full bg-transparent p-2 outline-none text-xs font-black placeholder:text-slate-400" 
                                placeholder="Cari Kode atau Nama Barang..."
                                value={query}
                                onChange={e => {
                                    setQuery(e.target.value);
                                    const it = items.find(x => x.name === e.target.value || x.code === e.target.value);
                                    if(it) {
                                        setPendingItem(it);
                                        setPendingUnit(it.baseUnit);
                                    }
                                }}
                            />
                            <datalist id="item-list-entry">
                                {items.map(it => <option key={it.id} value={it.name}>{it.code}</option>)}
                            </datalist>
                        </td>
                        <td className="p-2">
                            <input type="number" className="w-full bg-transparent p-2 outline-none text-right font-mono font-black text-sm" value={pendingQty} onChange={e => setPendingQty(Number(e.target.value))} />
                        </td>
                        <td className="p-2 text-center">
                            <select 
                                className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg p-1 text-[10px] font-black outline-none w-24"
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
                        <td className="p-2">
                            <input type="text" placeholder="Catatan baris..." className="w-full bg-transparent p-2 outline-none text-xs italic" value={pendingNote} onChange={e => setPendingNote(e.target.value)} />
                        </td>
                        <td className="p-2 text-center">
                            <button onClick={handleAddLine} className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 shadow-lg transition-all active:scale-90"><CornerDownLeft size={16}/></button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        {/* Footer Area */}
        <div className="p-8 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex justify-between items-center shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
             <div className="flex gap-8">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total SKU</span>
                    <span className="text-lg font-black text-slate-800 dark:text-white">{lines.length} Line</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Kuantitas</span>
                    <span className="text-lg font-black text-blue-600">{lines.reduce((acc,l)=>acc+(l.qty * (l.ratio || 1)),0).toLocaleString()} <small className="text-[10px] uppercase font-bold text-slate-400">Pcs/Base</small></span>
                </div>
             </div>
             <div className="flex gap-6 items-center">
                <button onClick={onClose} className="text-xs font-black text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-[0.2em]">Batal</button>
                <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || !selectedWh}
                    className="px-12 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-[20px] font-black text-xs shadow-2xl shadow-blue-500/30 flex items-center gap-4 transition-all active:scale-95"
                >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {initialData ? 'PERBARUI TRANSAKSI' : 'POSTING TRANSAKSI'}
                </button>
             </div>
        </div>
      </div>
    </div>
  );
};
