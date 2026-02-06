
import React, { useState, useEffect, useRef } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner, Stock } from '../types';
import { StorageService } from '../services/storage';
import { useGlobalData } from '../search/SearchProvider';
import { SmartAutocomplete } from './SmartAutocomplete';
import { highlightMatch } from '../search/highlightMatch';
import { Plus, Trash2, Save, X, CornerDownLeft, Loader2, Building2, User, Calendar, Hash, StickyNote, FileSpreadsheet, Upload, Eye, FileText, Download } from 'lucide-react';
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
  const { masterItems, warehouses: globalWh, partners: globalPts } = useGlobalData();
  
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
  const [attachments, setAttachments] = useState<string[]>(initialData?.attachments || []);
  
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingUnit, setPendingUnit] = useState('');
  const [pendingQty, setPendingQty] = useState<string>('');
  const qtyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    StorageService.fetchStocks().then(setStocks);
    setPartners(globalPts.filter(p => (type === 'IN' ? p.type === 'SUPPLIER' : p.type === 'CUSTOMER') && p.isActive));
    if (globalWh.length > 0 && !selectedWh) setSelectedWh(globalWh[0].id);
  }, []);

  const getStockQty = (itemId: string) => {
      const stock = stocks.find(s => s.itemId === itemId && s.warehouseId === selectedWh);
      return stock ? Number(stock.qty) : 0;
  };

  const handleAddLine = () => {
    if (!pendingItem || !pendingQty) return showToast("Data tidak lengkap", "warning");
    const itemMaster = masterItems.find(i => i.id === pendingItem.id);
    let ratio = 1;
    if (pendingUnit !== itemMaster?.baseUnit) {
        const conv = itemMaster?.conversions?.find(c => c.name === pendingUnit);
        if (conv) ratio = conv.operator === '/' ? 1 / conv.ratio : conv.ratio;
    }

    setLines([{ itemId: pendingItem.id, qty: Number(pendingQty), unit: pendingUnit, ratio, name: pendingItem.name, code: pendingItem.code }, ...lines]);
    setPendingItem(null); setPendingQty('');
  };

  const handleSubmit = async () => {
    if (lines.length === 0) return showToast("Item kosong", "warning");
    setIsSubmitting(true);
    try {
        const txData = { date, referenceNo: refNo, type, sourceWarehouseId: selectedWh, partnerId: selectedPartnerId, items: lines.map(l => ({ item_id: l.itemId, qty: l.qty, unit: l.unit, conversionRatio: l.ratio, note: '' })), notes, attachments };
        if (initialData) await StorageService.updateTransaction(initialData.id, txData as any);
        else await StorageService.commitTransaction({ ...txData, id: crypto.randomUUID() } as any);
        showToast("Tersimpan!", "success"); onSuccess();
    } catch (e: any) { showToast(e.message, "error"); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-daintree/90 z-50 flex items-center justify-center p-0 sm:p-4 backdrop-blur-md">
      <div className="bg-gable w-full h-full sm:h-[95vh] sm:max-w-6xl flex flex-col sm:rounded-3xl border border-spectra overflow-hidden shadow-2xl">
        
        {/* Header - Fixed */}
        <div className="bg-daintree p-4 flex justify-between items-center border-b border-spectra shrink-0">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${type === 'IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}><FileText size={20}/></div>
                <div>
                   <h2 className="text-base font-black text-white uppercase">{initialData ? 'Edit' : 'Input'} Transaksi</h2>
                   <p className="text-[10px] font-black text-cutty tracking-widest">{refNo}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400"><X size={20}/></button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Master Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3 p-4 bg-daintree/30 rounded-2xl border border-spectra/50">
                    <label className="text-[10px] font-black text-cutty uppercase tracking-widest block">Informasi Utama</label>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-spectra/30">
                            <Calendar size={14} className="ml-3 text-spectra"/>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-transparent p-2 text-xs font-bold text-white outline-none" />
                        </div>
                        <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-spectra/30">
                            <Building2 size={14} className="ml-3 text-spectra"/>
                            <select value={selectedWh} onChange={e => setSelectedWh(e.target.value)} className="w-full bg-transparent p-2 text-xs font-bold text-white outline-none appearance-none">
                                {globalWh.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="space-y-3 p-4 bg-daintree/30 rounded-2xl border border-spectra/50">
                    <label className="text-[10px] font-black text-cutty uppercase tracking-widest block">Partner & Referensi</label>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-spectra/30">
                            <User size={14} className="ml-3 text-spectra"/>
                            <select value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)} className="w-full bg-transparent p-2 text-xs font-bold text-white outline-none appearance-none">
                                <option value="">-- Pilih {type === 'IN' ? 'Supplier' : 'Customer'} --</option>
                                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-spectra/30">
                            <Hash size={14} className="ml-3 text-spectra"/>
                            <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Ref No" className="w-full bg-transparent p-2 text-xs font-mono font-bold text-emerald-400 outline-none uppercase" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ENTRY AREA */}
            <div className="bg-gable p-4 rounded-2xl border border-spectra shadow-inner space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-6 relative">
                         <label className="text-[10px] font-black text-cutty uppercase tracking-widest mb-1.5 block">Cari Produk</label>
                         <SmartAutocomplete 
                            data={masterItems} searchKeys={['code', 'name']} placeholder="SKU / Nama..." onSelect={it => { setPendingItem(it); setPendingUnit(it.baseUnit); }}
                            renderItem={(it, sel, q) => (
                                <div className="flex justify-between items-center w-full">
                                    <div className="min-w-0 pr-4">
                                        <div className="font-black text-xs text-white uppercase">{highlightMatch(it.code, q)}</div>
                                        <div className="text-[10px] text-slate-400 truncate">{highlightMatch(it.name, q)}</div>
                                    </div>
                                    <div className={`text-[9px] font-black px-2 py-0.5 rounded border ${getStockQty(it.id) <= 0 ? 'bg-red-900/20 text-red-500 border-red-900' : 'bg-emerald-900/20 text-emerald-500 border-emerald-900'}`}>{getStockQty(it.id)} {it.baseUnit}</div>
                                </div>
                            )}
                         />
                    </div>
                    <div className="sm:col-span-3">
                         <label className="text-[10px] font-black text-cutty uppercase tracking-widest mb-1.5 block">Qty</label>
                         <input ref={qtyInputRef} type="number" placeholder="0" value={pendingQty} onChange={e => setPendingQty(e.target.value)} className="w-full h-10 bg-black/20 border border-spectra rounded-xl px-4 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-spectra" />
                    </div>
                    <div className="sm:col-span-2">
                         <label className="text-[10px] font-black text-cutty uppercase tracking-widest mb-1.5 block">Unit</label>
                         <select value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="w-full h-10 bg-black/20 border border-spectra rounded-xl px-2 text-[10px] font-black uppercase text-white outline-none">
                            {pendingItem && [<option key="base" value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>, ...(pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>) || [])]}
                         </select>
                    </div>
                    <div className="sm:col-span-1">
                        <button onClick={handleAddLine} className="w-full h-10 bg-spectra text-white rounded-xl flex items-center justify-center hover:bg-white hover:text-spectra transition-all shadow-lg active:scale-95"><Plus size={20}/></button>
                    </div>
                </div>

                {/* ITEMS TABLE - HORIZONTAL SCROLL ON MOBILE */}
                <div className="overflow-x-auto rounded-xl border border-spectra bg-daintree/30">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead className="bg-daintree text-[10px] font-black text-cutty uppercase tracking-widest sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Deskripsi Barang</th>
                                <th className="px-4 py-3 text-right w-24">Jumlah</th>
                                <th className="px-4 py-3 text-center w-24">Satuan</th>
                                <th className="px-4 py-3 text-right w-24">Total Base</th>
                                <th className="px-4 py-3 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-spectra/20 text-xs">
                            {lines.map((l, i) => (
                                <tr key={i} className="hover:bg-white/5 group">
                                    <td className="px-4 py-3"><div className="font-bold text-white">{l.name}</div><div className="text-[9px] font-mono text-cutty">{l.code}</div></td>
                                    <td className="px-4 py-3 text-right font-black text-white">{l.qty}</td>
                                    <td className="px-4 py-3 text-center uppercase font-bold text-slate-500">{l.unit}</td>
                                    <td className="px-4 py-3 text-right font-mono text-cutty">{(l.qty * l.ratio).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-center"><button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button></td>
                                </tr>
                            ))}
                            {lines.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-[10px] font-black text-slate-700 uppercase tracking-widest">Belum ada item ditambahkan</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-daintree border-t border-spectra flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <span>Total Items: <span className="text-white">{lines.length}</span></span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">Transaction Mode: <span className={type === 'IN' ? 'text-emerald-500' : 'text-red-500'}>{type}</span></span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-black uppercase transition-all">Batal</button>
                <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 sm:flex-none px-10 py-2.5 bg-spectra hover:bg-white hover:text-spectra text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-spectra/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Simpan Transaksi
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
