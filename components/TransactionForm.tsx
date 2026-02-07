
import React, { useState, useEffect, useRef } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner, Stock } from '../types';
import { StorageService } from '../services/storage';
import { useGlobalData } from '../search/SearchProvider';
import { SmartAutocomplete } from './SmartAutocomplete';
import { highlightMatch } from '../search/highlightMatch';
import { Plus, Trash2, Save, X, Loader2, Building2, User, Calendar, Hash, Upload, Eye, FileText, Download, MessageSquare } from 'lucide-react';
import { useToast } from './Toast';

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
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
  
  const itemInputRef = useRef<any>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    StorageService.fetchStocks().then(setStocks);
    setPartners(globalPts.filter(p => (type === 'IN' ? p.type === 'SUPPLIER' : p.type === 'CUSTOMER') && p.isActive));
    if (globalWh.length > 0 && !selectedWh) setSelectedWh(globalWh[0].id);
  }, [globalPts, globalWh, type]);

  const getStockQty = (itemId: string) => {
      const stock = stocks.find(s => s.itemId === itemId && s.warehouseId === selectedWh);
      return stock ? Number(stock.qty) : 0;
  };

  const compressImage = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
              const img = new Image();
              img.src = event.target?.result as string;
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 800;
                  const scaleSize = MAX_WIDTH / img.width;
                  canvas.width = MAX_WIDTH;
                  canvas.height = img.height * scaleSize;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                  resolve(canvas.toDataURL('image/jpeg', 0.7));
              };
              img.onerror = (error) => reject(error);
          };
      });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      setIsCompressing(true);
      const newPhotos: string[] = [];
      try {
          for (let i = 0; i < e.target.files.length; i++) {
              const file = e.target.files[i];
              if (!file.type.startsWith('image/')) continue;
              const compressed = await compressImage(file);
              newPhotos.push(compressed);
          }
          setAttachments(prev => [...prev, ...newPhotos]);
          showToast(`${newPhotos.length} foto ditambahkan`, "success");
      } catch (error) {
          showToast("Gagal memproses gambar", "error");
      } finally {
          setIsCompressing(false);
          if (photoInputRef.current) photoInputRef.current.value = '';
      }
  };

  const downloadImage = (base64: string, index: number) => {
      const link = document.createElement('a');
      link.href = base64;
      link.download = `attachment-${refNo}-${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleAddLine = () => {
    if (!pendingItem || !pendingQty) return showToast("Data tidak lengkap", "warning");
    const itemMaster = masterItems.find(i => i.id === pendingItem.id);
    let ratio = 1;
    if (pendingUnit !== itemMaster?.baseUnit) {
        const conv = itemMaster?.conversions?.find(c => c.name === pendingUnit);
        if (conv) ratio = conv.operator === '/' ? 1 / conv.ratio : conv.ratio;
    }

    const newLine: TransactionItem = { 
      itemId: pendingItem.id, 
      qty: Number(pendingQty), 
      unit: pendingUnit, 
      ratio, 
      name: pendingItem.name, 
      code: pendingItem.code
    };

    setLines([newLine, ...lines]);
    setPendingItem(null); 
    setPendingQty('');
    itemInputRef.current?.clear();
    itemInputRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (lines.length === 0) return showToast("Item kosong", "warning");
    setIsSubmitting(true);
    try {
        const txData = { 
          date, 
          referenceNo: refNo, 
          type, 
          sourceWarehouseId: selectedWh, 
          partnerId: selectedPartnerId, 
          items: lines.map(l => ({ 
            item_id: l.itemId, 
            qty: l.qty, 
            unit: l.unit, 
            conversionRatio: l.ratio
          })), 
          notes, 
          attachments 
        };
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
                   <h2 className="text-base font-black text-white uppercase">{initialData ? 'Edit' : 'Input'} Transaksi {type}</h2>
                   <p className="text-[10px] font-black text-cutty tracking-widest">{refNo}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400"><X size={20}/></button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* INFORMASI UTAMA & LAMPIRAN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Kolom 1 & 2: Informasi Dasar */}
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    
                    {/* Field Keterangan - Full Width dibawah Info Dasar */}
                    <div className="md:col-span-2 space-y-3 p-4 bg-daintree/30 rounded-2xl border border-spectra/50">
                        <label className="text-[10px] font-black text-cutty uppercase tracking-widest block flex items-center gap-2"><MessageSquare size={12}/> Keterangan Transaksi</label>
                        <textarea 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)} 
                            placeholder="Tulis catatan atau keterangan transaksi di sini..." 
                            className="w-full bg-black/20 border border-spectra/30 rounded-xl p-3 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-spectra min-h-[60px] resize-none"
                        />
                    </div>
                </div>

                {/* Kolom 3: Lampiran Foto (Samping Kanan pada Desktop) */}
                <div className="lg:col-span-4 space-y-3 p-4 bg-daintree/30 rounded-2xl border border-spectra/50 flex flex-col">
                    <label className="text-[10px] font-black text-cutty uppercase tracking-widest block">Lampiran Foto</label>
                    <div className="flex-1 flex flex-col gap-3">
                         <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[150px] scrollbar-thin">
                            <button 
                                onClick={() => photoInputRef.current?.click()}
                                disabled={isCompressing}
                                className="w-16 h-16 border-2 border-dashed border-spectra/50 rounded-xl bg-gable text-cutty hover:text-white hover:bg-spectra/10 flex flex-col items-center justify-center transition-all flex-shrink-0"
                            >
                                {isCompressing ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>}
                            </button>
                            <input type="file" multiple accept="image/*" ref={photoInputRef} className="hidden" onChange={handlePhotoUpload} />
                            
                            {attachments.map((img, idx) => (
                                <div key={idx} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-spectra/50 bg-black flex-shrink-0">
                                    <img src={img} alt="Attachment" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all" />
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                        <button onClick={() => setPreviewImage(img)} className="text-white hover:text-emerald-400 transition-all"><Eye size={14}/></button>
                                        <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-white hover:text-red-400 transition-all"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            ))}
                         </div>
                         <p className="text-[9px] text-slate-500 italic mt-auto">Upload bukti fisik atau foto barang.</p>
                    </div>
                </div>
            </div>

            {/* ENTRY AREA - Ramping (Tanpa Keterangan Baris) */}
            <div className="bg-gable p-4 rounded-2xl border border-spectra shadow-inner space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-7 relative">
                         <label className="text-[10px] font-black text-cutty uppercase tracking-widest mb-1.5 block text-slate-400">Cari Produk</label>
                         <SmartAutocomplete 
                            ref={itemInputRef}
                            data={masterItems} searchKeys={['code', 'name']} placeholder="SKU / Nama..." 
                            onSelect={(it: Item) => { 
                              setPendingItem(it); 
                              setPendingUnit(it.baseUnit); 
                              setTimeout(() => qtyInputRef.current?.focus(), 10);
                            }}
                            renderItem={(it: Item, sel: boolean, q: string) => (
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
                    <div className="sm:col-span-2">
                         <label className="text-[10px] font-black text-cutty uppercase tracking-widest mb-1.5 block text-slate-400">Qty</label>
                         <input 
                            ref={qtyInputRef} 
                            type="number" 
                            placeholder="0" 
                            value={pendingQty} 
                            onChange={e => setPendingQty(e.target.value)} 
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (pendingQty) handleAddLine();
                                else showToast("Isi Qty", "warning");
                              }
                            }}
                            className="w-full h-10 bg-black/20 border border-spectra rounded-xl px-4 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-spectra [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                         />
                    </div>
                    <div className="sm:col-span-2">
                         <label className="text-[10px] font-black text-cutty uppercase tracking-widest mb-1.5 block text-slate-400">Unit</label>
                         <select value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="w-full h-10 bg-black/20 border border-spectra rounded-xl px-2 text-[10px] font-black uppercase text-white outline-none">
                            {pendingItem && [<option key="base" value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>, ...(pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>) || [])]}
                         </select>
                    </div>
                    <div className="sm:col-span-1">
                        <button onClick={handleAddLine} className="w-full h-10 bg-spectra text-white rounded-xl flex items-center justify-center hover:bg-white hover:text-spectra transition-all shadow-lg active:scale-95"><Plus size={20}/></button>
                    </div>
                </div>

                {/* ITEMS TABLE - LEBIH PADAT */}
                <div className="overflow-x-auto rounded-xl border border-spectra bg-daintree/30">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead className="bg-daintree text-[10px] font-black text-cutty uppercase tracking-widest sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Deskripsi Barang</th>
                                <th className="px-4 py-3 text-right w-32">Jumlah</th>
                                <th className="px-4 py-3 text-center w-32">Satuan</th>
                                <th className="px-4 py-3 text-right w-32">Total Base</th>
                                <th className="px-4 py-3 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-spectra/20 text-xs">
                            {lines.map((l, i) => (
                                <tr key={i} className="hover:bg-white/5 group">
                                    <td className="px-4 py-3"><div className="font-bold text-white">{l.name}</div><div className="text-[9px] font-mono text-cutty">{l.code}</div></td>
                                    <td className="px-4 py-3 text-right font-black text-white">{l.qty.toLocaleString()}</td>
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

      {/* Full Preview Modal */}
      {previewImage && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-8 backdrop-blur-md animate-in fade-in" onClick={() => setPreviewImage(null)}>
              <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
                  <img src={previewImage} alt="Full Preview" className="max-w-full max-h-[85vh] rounded-3xl shadow-2xl border border-spectra" />
                  <button onClick={() => setPreviewImage(null)} className="absolute -top-12 right-0 text-white hover:text-red-400 bg-white/10 p-2 rounded-full"><X size={24}/></button>
                  <button onClick={() => downloadImage(previewImage, attachments.indexOf(previewImage))} className="absolute -bottom-16 left-1/2 -translate-x-1/2 px-8 py-3 bg-spectra text-white rounded-full text-xs font-black uppercase flex items-center gap-2 shadow-2xl hover:bg-white hover:text-spectra transition-all border border-spectra/50 tracking-widest"><Download size={18}/> Unduh Gambar</button>
              </div>
          </div>
      )}
    </div>
  );
};
