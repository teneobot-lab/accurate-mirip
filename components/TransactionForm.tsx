
import React, { useState, useEffect, useRef } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner, Stock } from '../types';
import { StorageService } from '../services/storage';
import { useGlobalData } from '../search/SearchProvider';
import { useFuseSearch } from '../search/useFuseSearch';
import { highlightMatch } from '../search/highlightMatch';
import { Plus, Trash2, Save, X, Loader2, Building2, User, Calendar, Hash, Upload, Eye, FileText, Search, CornerDownLeft, Package, History } from 'lucide-react';
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
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(initialData?.referenceNo || `${type === 'IN' ? 'RI' : 'DO'}.${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}.${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`);
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialData?.partnerId || '');
  const [selectedWh, setSelectedWh] = useState(initialData?.sourceWarehouseId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [lines, setLines] = useState<TransactionItem[]>(initialData?.items || []);
  const [attachments, setAttachments] = useState<string[]>(initialData?.attachments || []);
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { search } = useFuseSearch(masterItems, { keys: ['code', 'name'], limit: 10 });
  const searchResults = search(searchQuery);

  useEffect(() => {
    StorageService.fetchStocks().then(setStocks);
    setPartners(globalPts.filter(p => (type === 'IN' ? p.type === 'SUPPLIER' : p.type === 'CUSTOMER') && p.isActive));
    if (globalWh.length > 0 && !selectedWh) setSelectedWh(globalWh[0].id);
  }, [globalPts, globalWh, type]);

  useEffect(() => {
    if (isSearching) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isSearching]);

  const getStockQty = (itemId: string) => {
      const stock = stocks.find(s => s.itemId === itemId && s.warehouseId === selectedWh);
      return stock ? Number(stock.qty) : 0;
  };

  const handleSelectItem = (item: Item) => {
    const existing = lines.find(l => l.itemId === item.id);
    if (existing) {
        showToast("Item sudah ada di daftar", "warning");
    } else {
        const newLine: TransactionItem = { 
            itemId: item.id, 
            qty: 1, 
            unit: item.baseUnit, 
            ratio: 1, 
            name: item.name, 
            code: item.code
        };
        setLines([newLine, ...lines]);
    }
    setIsSearching(false);
    setSearchQuery('');
  };

  const updateLine = (index: number, field: keyof TransactionItem, value: any) => {
    const newLines = [...lines];
    const item = masterItems.find(i => i.id === newLines[index].itemId);
    
    if (field === 'unit') {
        let ratio = 1;
        if (value !== item?.baseUnit) {
            const conv = item?.conversions?.find(c => c.name === value);
            if (conv) ratio = conv.operator === '/' ? 1 / conv.ratio : conv.ratio;
        }
        newLines[index].ratio = ratio;
    }
    
    (newLines[index] as any)[field] = value;
    setLines(newLines);
  };

  const handleSave = async (keepOpen = false) => {
    if (lines.length === 0) return showToast("Tambahkan minimal 1 barang", "warning");
    if (!selectedPartnerId) return showToast("Pilih partner transaksi", "warning");
    
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
            conversionRatio: l.ratio,
            note: l.note
          })), 
          notes, 
          attachments 
        };

        if (initialData) await StorageService.updateTransaction(initialData.id, txData as any);
        else await StorageService.commitTransaction({ ...txData, id: crypto.randomUUID() } as any);
        
        showToast("Transaksi Berhasil Disimpan", "success");
        
        if (keepOpen) {
            // Reset for new transaction
            setLines([]);
            setNotes('');
            setAttachments([]);
            setRefNo(`${type === 'IN' ? 'RI' : 'DO'}.${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}.${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`);
            StorageService.fetchStocks().then(setStocks);
        } else {
            onSuccess();
        }
    } catch (e: any) { 
        showToast(e.message, "error"); 
    } finally { 
        setIsSubmitting(false); 
    }
  };

  return (
    <div className="flex flex-col h-full bg-daintree animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* ERP HEADER ACTIONS */}
      <div className="bg-gable p-4 border-b border-spectra flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-0 z-20 shadow-xl">
          <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${type === 'IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} border border-current/20`}>
                  <FileText size={24}/>
              </div>
              <div>
                  <h1 className="text-lg font-black text-white uppercase tracking-tight">Formulir {type === 'IN' ? 'Penerimaan' : 'Pengiriman'} Barang</h1>
                  <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-cutty uppercase bg-black/40 px-2 py-0.5 rounded border border-spectra">{refNo}</span>
                      <span className="text-[10px] font-black text-slate-500">•</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{type}BOUND MUTATION</span>
                  </div>
              </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={onClose} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-xs font-black uppercase transition-all">Batal</button>
              <button 
                onClick={() => handleSave(true)} 
                disabled={isSubmitting} 
                className="px-6 py-2.5 bg-daintree hover:bg-spectra text-white border border-spectra rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 disabled:opacity-50"
              >
                  <Plus size={16}/> Simpan & Baru
              </button>
              <button 
                onClick={() => handleSave(false)} 
                disabled={isSubmitting} 
                className="px-8 py-2.5 bg-spectra hover:bg-white hover:text-spectra text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-spectra/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Selesai
              </button>
          </div>
      </div>

      <div className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto">
          
          {/* TOP INFO GRID */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gable/40 p-4 rounded-2xl border border-spectra/40 space-y-3">
                      <label className="text-[10px] font-black text-cutty uppercase tracking-widest flex items-center gap-2"><Calendar size={12}/> Tanggal & Gudang</label>
                      <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-black/20 border border-spectra/30 rounded-xl p-3 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-spectra" />
                      <select value={selectedWh} onChange={e => setSelectedWh(e.target.value)} className="w-full bg-black/20 border border-spectra/30 rounded-xl p-3 text-xs font-bold text-white outline-none">
                          {globalWh.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                  </div>
                  <div className="bg-gable/40 p-4 rounded-2xl border border-spectra/40 space-y-3">
                      <label className="text-[10px] font-black text-cutty uppercase tracking-widest flex items-center gap-2"><User size={12}/> Partner & Ref</label>
                      <select value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)} className="w-full bg-black/20 border border-spectra/30 rounded-xl p-3 text-xs font-bold text-white outline-none">
                          <option value="">-- Pilih {type === 'IN' ? 'Supplier' : 'Customer'} --</option>
                          {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Nomor Referensi..." className="w-full bg-black/20 border border-spectra/30 rounded-xl p-3 text-xs font-mono font-bold text-emerald-400 outline-none uppercase" />
                  </div>
                  <div className="bg-gable/40 p-4 rounded-2xl border border-spectra/40 space-y-3">
                      <label className="text-[10px] font-black text-cutty uppercase tracking-widest flex items-center gap-2"><FileText size={12}/> Keterangan Global</label>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan transaksi..." className="w-full bg-black/20 border border-spectra/30 rounded-xl p-3 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-spectra h-[92px] resize-none" />
                  </div>
              </div>
              
              <div className="bg-spectra/5 p-4 rounded-2xl border border-spectra/30 flex flex-col justify-center items-center text-center">
                  <div className="text-4xl font-black text-white tracking-tighter">{lines.length}</div>
                  <div className="text-[10px] font-black text-spectra uppercase tracking-widest">Total Item Baris</div>
                  <div className="mt-4 w-full h-px bg-spectra/20"></div>
                  <button onClick={() => setIsSearching(true)} className="mt-4 w-full py-3 bg-spectra text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-white hover:text-spectra transition-all shadow-lg active:scale-95 border border-spectra/50">
                      <Search size={16}/> Cari Barang [F2]
                  </button>
              </div>
          </div>

          {/* DENSE TABLE SECTION */}
          <div className="bg-gable rounded-2xl border border-spectra shadow-inner flex flex-col overflow-hidden">
              <div className="bg-daintree px-4 py-2 flex justify-between items-center border-b border-spectra">
                  <span className="text-[10px] font-black text-cutty uppercase tracking-[0.2em]">Rincian Barang / Material</span>
                  <div className="flex items-center gap-4">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Gudang Aktif: <b className="text-slate-300">{globalWh.find(w=>w.id===selectedWh)?.name || '-'}</b></span>
                  </div>
              </div>
              
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                      <thead className="bg-gable text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-spectra/50">
                          <tr>
                              <th className="px-3 py-2 w-10 text-center border-r border-spectra/20">No</th>
                              <th className="px-3 py-2 border-r border-spectra/20">Nama Barang & SKU</th>
                              <th className="px-3 py-2 w-28 text-right border-r border-spectra/20">Stok Akhir</th>
                              <th className="px-3 py-2 w-28 text-right border-r border-spectra/20">Kuantitas</th>
                              <th className="px-3 py-2 w-32 text-center border-r border-spectra/20">Satuan</th>
                              <th className="px-3 py-2 w-32 text-right border-r border-spectra/20">Total Base</th>
                              <th className="px-3 py-2">Catatan Baris</th>
                              <th className="px-3 py-2 w-12"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-spectra/20">
                          {lines.map((l, i) => {
                              const itemMaster = masterItems.find(it => it.id === l.itemId);
                              const curStock = getStockQty(l.itemId);
                              return (
                                <tr key={i} className="hover:bg-white/5 transition-colors group text-xs">
                                    <td className="px-3 py-1.5 text-center text-slate-500 font-mono border-r border-spectra/20">{i + 1}</td>
                                    <td className="px-3 py-1.5 border-r border-spectra/20">
                                        <div className="font-bold text-white uppercase truncate">{l.name}</div>
                                        <div className="text-[10px] font-mono text-cutty font-bold">{l.code}</div>
                                    </td>
                                    <td className="px-3 py-1.5 text-right border-r border-spectra/20 font-mono text-slate-500">
                                        {curStock.toLocaleString()} <span className="text-[9px] opacity-60">{itemMaster?.baseUnit}</span>
                                    </td>
                                    <td className="px-2 py-1.5 border-r border-spectra/20">
                                        <input 
                                            type="number" 
                                            value={l.qty} 
                                            onChange={e => updateLine(i, 'qty', Number(e.target.value))}
                                            className="w-full bg-black/40 border border-spectra/30 rounded px-2 py-1 text-right font-black text-emerald-400 outline-none focus:border-spectra" 
                                        />
                                    </td>
                                    <td className="px-2 py-1.5 border-r border-spectra/20">
                                        <select 
                                            value={l.unit} 
                                            onChange={e => updateLine(i, 'unit', e.target.value)}
                                            className="w-full bg-black/40 border border-spectra/30 rounded px-2 py-1 text-center font-bold text-slate-300 outline-none uppercase"
                                        >
                                            <option value={itemMaster?.baseUnit}>{itemMaster?.baseUnit}</option>
                                            {itemMaster?.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-3 py-1.5 text-right border-r border-spectra/20 font-mono font-black text-white">
                                        {(l.qty * l.ratio).toLocaleString()}
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <input 
                                            type="text" 
                                            value={l.note || ''} 
                                            onChange={e => updateLine(i, 'note', e.target.value)}
                                            placeholder="..." 
                                            className="w-full bg-transparent border-none px-2 py-1 text-slate-400 italic outline-none focus:bg-black/20 rounded" 
                                        />
                                    </td>
                                    <td className="px-3 py-1.5 text-center">
                                        <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                                    </td>
                                </tr>
                              );
                          })}
                          {lines.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-12 text-center">
                                    <div className="flex flex-col items-center gap-3 opacity-30">
                                        <Package size={48} className="text-slate-600"/>
                                        <div className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">Belum Ada Item Transaksi</div>
                                        <button onClick={() => setIsSearching(true)} className="px-6 py-2 bg-spectra text-white rounded-full text-[10px] font-black uppercase tracking-widest mt-2 hover:scale-105 transition-transform">Klik Untuk Menambahkan</button>
                                    </div>
                                </td>
                            </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>

      {/* CENTER SCREEN SEARCH OVERLAY */}
      {isSearching && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-daintree/80 backdrop-blur-md animate-in fade-in duration-200">
              <div className="w-full max-w-2xl bg-gable rounded-3xl shadow-2xl border border-spectra overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-4 bg-daintree flex items-center gap-4 border-b border-spectra">
                      <Search className="text-spectra" size={24}/>
                      <input 
                        ref={searchInputRef}
                        type="text" 
                        placeholder="Ketik SKU atau Nama Barang..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setIsSearching(false);
                            if (e.key === 'ArrowDown') setSelectedIndex(prev => (prev + 1) % searchResults.length);
                            if (e.key === 'ArrowUp') setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
                            if (e.key === 'Enter' && searchResults[selectedIndex]) handleSelectItem(searchResults[selectedIndex]);
                        }}
                        className="flex-1 bg-transparent text-lg font-bold text-white outline-none placeholder:text-slate-600"
                      />
                      <button onClick={() => setIsSearching(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-500"><X size={24}/></button>
                  </div>
                  
                  <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
                      {searchResults.length === 0 ? (
                          <div className="p-12 text-center text-slate-500 italic">Barang tidak ditemukan...</div>
                      ) : (
                          <div className="divide-y divide-spectra/20">
                              {searchResults.map((item, idx) => (
                                  <div 
                                    key={item.id} 
                                    onClick={() => handleSelectItem(item)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-spectra/20' : 'hover:bg-white/5'}`}
                                  >
                                      <div className="flex items-center gap-4">
                                          <div className={`p-2 rounded-lg ${idx === selectedIndex ? 'bg-spectra text-white' : 'bg-daintree text-slate-400'}`}>
                                              <Package size={20}/>
                                          </div>
                                          <div>
                                              <div className="text-sm font-black text-white uppercase">{highlightMatch(item.name, searchQuery)}</div>
                                              <div className="text-[10px] font-mono text-spectra font-bold uppercase">{highlightMatch(item.code, searchQuery)} <span className="mx-2 text-slate-600">•</span> {item.category}</div>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                          <div className="text-right">
                                              <div className="text-xs font-black text-emerald-400">{getStockQty(item.id).toLocaleString()}</div>
                                              <div className="text-[9px] font-bold text-slate-500 uppercase">{item.baseUnit}</div>
                                          </div>
                                          {idx === selectedIndex && <CornerDownLeft size={16} className="text-spectra animate-in slide-in-from-right-2"/>}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  <div className="p-3 bg-daintree border-t border-spectra flex justify-between items-center">
                      <div className="flex gap-4">
                          <span className="text-[9px] font-black text-slate-500 flex items-center gap-1.5"><kbd className="bg-gable px-1.5 py-0.5 rounded border border-spectra text-white">ESC</kbd> Batal</span>
                          <span className="text-[9px] font-black text-slate-500 flex items-center gap-1.5"><kbd className="bg-gable px-1.5 py-0.5 rounded border border-spectra text-white">↵</kbd> Pilih Barang</span>
                      </div>
                      <span className="text-[9px] font-black text-spectra uppercase tracking-widest">Inventory Master Data</span>
                  </div>
              </div>
          </div>
      )}

      <style>{`
          .scrollbar-thin::-webkit-scrollbar { width: 6px; }
          .scrollbar-thin::-webkit-scrollbar-thumb { background: #335157; border-radius: 10px; }
          input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
};
