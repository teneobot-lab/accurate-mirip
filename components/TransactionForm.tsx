
import React, { useState, useEffect, useRef } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner, Stock } from '../types';
import { StorageService } from '../services/storage';
import { useGlobalData } from '../search/SearchProvider';
import { useFuseSearch } from '../search/useFuseSearch';
import { highlightMatch } from '../search/highlightMatch';
import { Plus, Trash2, Save, X, Loader2, Building2, User, Calendar, FileText, Search, CornerDownLeft, Package, Check, FileSpreadsheet, Download, Info, AlertCircle } from 'lucide-react';
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
  const { masterItems, warehouses: globalWh, partners: globalPts, refreshAll } = useGlobalData();
  
  // Track edit mode locally to allow switching to 'Create' on "Save & New"
  const [isEditMode, setIsEditMode] = useState(!!initialData);

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
  
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingQty, setPendingQty] = useState<string>('');
  const [pendingNote, setPendingNote] = useState('');

  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const inlineSearchTriggerRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setPendingItem(item);
    setIsSearching(false);
    setSearchQuery('');
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const handleCommitLine = () => {
    if (!pendingItem || !pendingQty || Number(pendingQty) <= 0) return;

    const newLine: TransactionItem = { 
        itemId: pendingItem.id, 
        qty: Number(pendingQty), 
        unit: pendingItem.baseUnit, 
        ratio: 1, 
        name: pendingItem.name, 
        code: pendingItem.code,
        note: pendingNote
    };

    setLines([...lines, newLine]);
    setPendingItem(null);
    setPendingQty('');
    setPendingNote('');
    setTimeout(() => inlineSearchTriggerRef.current?.focus(), 50);
  };

  const handleDownloadTemplate = () => {
    const templateHeaders = [
      { sku: 'KODE-BARANG-01', nama_barang: 'Contoh Produk A', qty: 10, satuan: 'Pcs', catatan: 'Urgent' },
      { sku: 'KODE-BARANG-02', nama_barang: 'Contoh Produk B', qty: 5, satuan: 'Box', catatan: '' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateHeaders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_GudangPro");
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 25 }];
    XLSX.writeFile(wb, `Template_Import_${type}.xlsx`);
    showToast("Template berhasil diunduh.", "success");
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws) as any[];
            if (data.length === 0) return showToast("File Excel tidak berisi data", "warning");
            showToast(`Memproses ${data.length} baris data...`, "info");
            const newItemsToCreate: Item[] = [];
            const importLines: TransactionItem[] = [];
            for (const row of data) {
                const sku = String(row.sku || row.SKU || row.KODE || row.kode || '').trim().toUpperCase();
                const name = String(row.nama_barang || row.nama || row.Nama || row['Nama Barang'] || '').trim();
                const qty = Number(row.qty || row.QTY || row.jumlah || row.Kuantitas || 0);
                const unit = String(row.satuan || row.unit || row.Unit || 'Pcs').trim();
                const note = String(row.catatan || row.keterangan || row.note || '').trim();
                if (!sku || isNaN(qty) || qty <= 0) continue;
                let item = masterItems.find(mi => mi.code === sku);
                if (!item) {
                    item = newItemsToCreate.find(ni => ni.code === sku);
                    if (!item) {
                        const newItem: Item = {
                            id: crypto.randomUUID(), code: sku, name: name || `SKU ${sku}`, category: 'AUTO-IMPORT',
                            baseUnit: unit, conversions: [], minStock: 0, isActive: true
                        };
                        newItemsToCreate.push(newItem); item = newItem;
                    }
                }
                importLines.push({
                    itemId: item.id, qty, unit: item.baseUnit, ratio: 1, name: item.name, code: item.code, note: note || 'Import Excel'
                });
            }
            if (newItemsToCreate.length > 0) {
                await StorageService.bulkSaveItems(newItemsToCreate);
                await refreshAll();
                showToast(`${newItemsToCreate.length} SKU baru otomatis didaftarkan`, "success");
            }
            setLines([...lines, ...importLines]);
            showToast(`${importLines.length} item berhasil diimpor`, "success");
            e.target.value = '';
        } catch (err) {
            showToast("Gagal membaca file Excel.", "error");
        }
    };
    reader.readAsBinaryString(file);
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
          date, referenceNo: refNo, type, sourceWarehouseId: selectedWh, partnerId: selectedPartnerId, 
          items: lines.map(l => ({ item_id: l.itemId, qty: l.qty, unit: l.unit, conversionRatio: l.ratio, note: l.note })), 
          notes, attachments: [] 
        };
        
        if (isEditMode && initialData) {
            await StorageService.updateTransaction(initialData.id, txData as any);
        } else {
            await StorageService.commitTransaction({ ...txData, id: crypto.randomUUID() } as any);
        }

        showToast("Transaksi Berhasil Disimpan", "success");
        if (keepOpen) {
            // Reset Form Logic
            setLines([]); 
            setNotes('');
            setSelectedPartnerId(''); // Reset Partner
            setPendingItem(null); 
            setPendingQty(''); 
            setPendingNote('');
            
            // Switch to Create Mode for subsequent saves
            setIsEditMode(false);

            setRefNo(`${type === 'IN' ? 'RI' : 'DO'}.${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}.${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`);
            StorageService.fetchStocks().then(setStocks);
            setTimeout(() => inlineSearchTriggerRef.current?.focus(), 100);
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
    <div className="flex flex-col h-full bg-[#f8fafc] animate-in fade-in duration-300">
      
      {/* HEADER ACTION BAR */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} border border-current/10`}>
                  <Package size={24}/>
              </div>
              <div>
                  <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">Formulir {type === 'IN' ? 'Penerimaan' : 'Pengiriman'}</h1>
                  <span className="text-xs font-mono font-bold text-slate-400 uppercase mt-1 inline-block">{refNo}</span>
                  {isEditMode && <span className="ml-2 text-[9px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded border border-amber-200 uppercase">Edit Mode</span>}
              </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={handleDownloadTemplate} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-2">
                  <Download size={14}/> Template
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} />
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-brand border border-brand/30 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-2">
                  <FileSpreadsheet size={14}/> Import
              </button>
              <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block"></div>
              <button onClick={() => handleSave(true)} disabled={isSubmitting} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-2 disabled:opacity-50">
                  <Plus size={14}/> Simpan & Baru
              </button>
              <button onClick={() => handleSave(false)} disabled={isSubmitting} className="px-6 py-2.5 bg-brand text-white rounded-xl text-[10px] font-bold uppercase shadow-lg shadow-brand/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Selesai
              </button>
          </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* INFO SECTION - COMPACT */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50/50 border-b border-slate-200 shadow-inner">
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Calendar size={12}/> Tanggal</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm font-semibold text-slate-900 outline-none shadow-sm" />
              </div>
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Building2 size={12}/> Gudang</label>
                  <select value={selectedWh} onChange={e => setSelectedWh(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm font-semibold text-slate-900 outline-none shadow-sm">
                      {globalWh.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
              </div>
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={12}/> {type === 'IN' ? 'Supplier' : 'Customer'}</label>
                  <select value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm font-semibold text-slate-900 outline-none shadow-sm">
                      <option value="">-- Pilih Partner --</option>
                      {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
              </div>
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><FileText size={12}/> Catatan Global</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tulis catatan di sini..." className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm font-medium text-slate-900 outline-none shadow-sm" />
              </div>
          </div>

          {/* DENSE GRID SECTION - ACCURATE STYLE */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto flex-1">
                  <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                              <th className="px-4 py-3 w-12 text-center">#</th>
                              <th className="px-4 py-3">Barang & SKU</th>
                              <th className="px-4 py-3 w-32 text-right">Stok Saat Ini</th>
                              <th className="px-4 py-3 w-32 text-right">Kuantitas</th>
                              <th className="px-4 py-3 w-28 text-center">Satuan</th>
                              <th className="px-4 py-3 w-32 text-right">Total Base</th>
                              <th className="px-4 py-3">Catatan</th>
                              <th className="px-4 py-3 w-12"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {lines.map((l, i) => {
                              const itemMaster = masterItems.find(it => it.id === l.itemId);
                              return (
                                <tr key={i} className="hover:bg-slate-50/50 transition-colors group h-10">
                                    <td className="px-4 text-center text-slate-400 font-mono text-[10px] border-r border-slate-100">{i + 1}</td>
                                    <td className="px-4 border-r border-slate-100 truncate">
                                        <span className="font-bold text-slate-900 text-xs uppercase mr-2">{l.name}</span>
                                        <span className="text-[10px] font-mono text-slate-400 font-bold">{l.code}</span>
                                    </td>
                                    <td className="px-4 text-right border-r border-slate-100 font-mono text-[11px] text-slate-400">
                                        {getStockQty(l.itemId).toLocaleString()}
                                    </td>
                                    <td className="px-1 border-r border-slate-100">
                                        <input type="number" value={l.qty} onChange={e => updateLine(i, 'qty', Number(e.target.value))} className="w-full bg-transparent border-none p-2 text-right font-black text-brand outline-none text-xs" />
                                    </td>
                                    <td className="px-1 border-r border-slate-100">
                                        <select value={l.unit} onChange={e => updateLine(i, 'unit', e.target.value)} className="w-full bg-transparent border-none p-2 text-center font-bold text-slate-600 outline-none uppercase text-[10px] appearance-none cursor-pointer">
                                            <option value={itemMaster?.baseUnit}>{itemMaster?.baseUnit}</option>
                                            {itemMaster?.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-4 text-right border-r border-slate-100 font-mono font-bold text-[11px] text-slate-700">
                                        {(l.qty * l.ratio).toLocaleString()}
                                    </td>
                                    <td className="px-2">
                                        <input type="text" value={l.note || ''} onChange={e => updateLine(i, 'note', e.target.value)} placeholder="Catatan baris..." className="w-full bg-transparent border-none p-1 text-slate-500 italic outline-none text-[11px] placeholder:text-slate-300" />
                                    </td>
                                    <td className="px-2 text-center">
                                        <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                                    </td>
                                </tr>
                              );
                          })}

                          {/* IN-LINE ENTRY ROW */}
                          <tr className="bg-slate-50/30 h-12 border-b-2 border-slate-200">
                              <td className="px-4 text-center text-brand font-black text-[10px] border-r border-slate-100">BARU</td>
                              <td className="px-2 border-r border-slate-100 relative">
                                  <div className="flex items-center gap-3">
                                      <Search size={14} className="text-slate-400"/>
                                      <input 
                                          ref={inlineSearchTriggerRef} type="text" placeholder="Klik untuk cari barang..." 
                                          readOnly onFocus={() => setIsSearching(true)} onClick={() => setIsSearching(true)}
                                          value={pendingItem?.name || ''}
                                          className="w-full bg-transparent border-none p-0 text-xs font-bold text-brand outline-none cursor-pointer uppercase placeholder:italic placeholder:text-slate-400"
                                      />
                                  </div>
                              </td>
                              <td className="px-4 text-right border-r border-slate-100 font-mono text-[11px] text-slate-400">
                                  {pendingItem ? getStockQty(pendingItem.id).toLocaleString() : '-'}
                              </td>
                              <td className="px-1 border-r border-slate-100 bg-brand/[0.03]">
                                  <input 
                                      ref={qtyInputRef} type="number" disabled={!pendingItem}
                                      value={pendingQty} onChange={e => setPendingQty(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleCommitLine()}
                                      placeholder="0"
                                      className="w-full bg-transparent border-none p-2 text-right font-black text-brand outline-none text-xs placeholder:text-slate-300" 
                                  />
                              </td>
                              <td className="px-4 text-center border-r border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                                  {pendingItem?.baseUnit || '-'}
                              </td>
                              <td className="px-4 text-right border-r border-slate-100 font-mono text-[11px] text-slate-400">
                                  {pendingItem && pendingQty ? Number(pendingQty).toLocaleString() : '0'}
                              </td>
                              <td className="px-2">
                                  <input 
                                      type="text" disabled={!pendingItem}
                                      value={pendingNote} onChange={e => setPendingNote(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleCommitLine()}
                                      placeholder="Ketik catatan..." 
                                      className="w-full bg-transparent border-none p-1 text-slate-400 italic outline-none text-[11px] placeholder:text-slate-300" 
                                  />
                              </td>
                              <td className="px-2 text-center">
                                  {pendingItem && (
                                      <button onClick={handleCommitLine} className="text-brand hover:scale-110 transition-transform"><Check size={18} strokeWidth={3}/></button>
                                  )}
                              </td>
                          </tr>
                          
                          {/* FILLER ROWS */}
                          {[...Array(Math.max(0, 10 - lines.length))].map((_, i) => (
                              <tr key={`filler-${i}`} className="h-10 opacity-10">
                                  <td className="border-r border-slate-100"></td>
                                  <td className="border-r border-slate-100"></td>
                                  <td className="border-r border-slate-100"></td>
                                  <td className="border-r border-slate-100"></td>
                                  <td className="border-r border-slate-100"></td>
                                  <td className="border-r border-slate-100"></td>
                                  <td className="border-r border-slate-100"></td>
                                  <td></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
          
          {/* FOOTER TOTALS */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
               <div className="flex items-center gap-10">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Total Baris</span>
                        <span className="text-base font-black text-slate-800">{lines.length} Barang</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Total Kuantitas</span>
                        <span className="text-base font-black text-brand">{lines.reduce((acc, l) => acc + (l.qty * l.ratio), 0).toLocaleString()} <span className="text-[10px] font-bold ml-1">BASE UNIT</span></span>
                    </div>
               </div>
               <div className="text-[10px] font-semibold text-slate-400 uppercase italic flex items-center gap-2">
                  <Info size={14} className="text-slate-300"/> Transaksi ini akan menyesuaikan stok gudang secara real-time.
               </div>
          </div>
      </div>

      {/* SEARCH OVERLAY */}
      {isSearching && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-5 bg-slate-50 flex items-center gap-4 border-b border-slate-200">
                      <Search className="text-brand" size={24}/>
                      <input 
                        ref={searchInputRef} type="text" placeholder="Ketik Kode SKU atau Nama Barang..." 
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setIsSearching(false);
                            if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev + 1) % (searchResults.length || 1)); }
                            if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev - 1 + (searchResults.length || 1)) % (searchResults.length || 1)); }
                            if (e.key === 'Enter' && searchResults[selectedIndex]) handleSelectItem(searchResults[selectedIndex]);
                        }}
                        className="flex-1 bg-transparent text-lg font-bold text-slate-900 outline-none placeholder:text-slate-300 uppercase tracking-tight"
                      />
                      <button onClick={() => setIsSearching(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400"><X size={20}/></button>
                  </div>
                  
                  <div className="max-h-[60vh] overflow-y-auto">
                      {searchResults.length === 0 && searchQuery ? (
                          <div className="p-16 text-center text-slate-400 font-medium italic">Barang tidak ditemukan...</div>
                      ) : (
                          <div className="divide-y divide-slate-100">
                              {(searchQuery ? searchResults : masterItems.slice(0, 8)).map((item, idx) => (
                                  <div 
                                    key={item.id} onClick={() => handleSelectItem(item)} onMouseEnter={() => setSelectedIndex(idx)}
                                    className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                                  >
                                      <div className="flex items-center gap-4">
                                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${idx === selectedIndex ? 'bg-brand text-white' : 'bg-slate-100 text-slate-400'}`}>
                                              <Package size={20}/>
                                          </div>
                                          <div>
                                              <div className="text-sm font-bold text-slate-900 uppercase">{highlightMatch(item.name, searchQuery)}</div>
                                              <div className="text-[10px] font-mono text-brand font-bold uppercase tracking-wider">{highlightMatch(item.code, searchQuery)} <span className="mx-2 text-slate-200">|</span> {item.category}</div>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                          <div className="text-right">
                                              <div className="text-xs font-black text-slate-800">{getStockQty(item.id).toLocaleString()}</div>
                                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.baseUnit}</div>
                                          </div>
                                          {idx === selectedIndex && <CornerDownLeft size={16} className="text-brand animate-in slide-in-from-right-2"/>}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-center text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                      Gunakan ↑↓ Navigasi & Enter Pilih
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
