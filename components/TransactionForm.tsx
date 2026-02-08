
import React, { useState, useEffect, useRef } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner, Stock } from '../types';
import { StorageService } from '../services/storage';
import { useGlobalData } from '../search/SearchProvider';
import { useFuseSearch } from '../search/useFuseSearch';
import { highlightMatch } from '../search/highlightMatch';
import { Plus, Trash2, Save, X, Loader2, Building2, User, Calendar, FileText, Search, CornerDownLeft, Package, Check, FileSpreadsheet, Upload } from 'lucide-react';
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
  
  // PENDING INPUT STATE
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

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws) as any[];

            if (data.length === 0) return showToast("File Excel kosong", "warning");

            showToast(`Memproses ${data.length} baris data...`, "info");
            
            const newItemsToCreate: Item[] = [];
            const importLines: TransactionItem[] = [];

            // 1. Validasi SKU & Persiapan Master Data
            for (const row of data) {
                const sku = String(row.sku || row.SKU || '').trim().toUpperCase();
                const name = String(row.nama || row['nama barang'] || row.Name || '').trim();
                const qty = Number(row.qty || row.jumlah || row.Quantity || 0);
                const unit = String(row.satuan || row.unit || row.Unit || 'Pcs').trim();

                if (!sku || qty <= 0) continue;

                let item = masterItems.find(mi => mi.code === sku) || newItemsToCreate.find(ni => ni.code === sku);

                if (!item) {
                    // Auto-Create Item Object
                    const newItem: Item = {
                        id: crypto.randomUUID(),
                        code: sku,
                        name: name || `Auto-Created ${sku}`,
                        category: 'IMPORTED',
                        baseUnit: unit,
                        conversions: [],
                        minStock: 0,
                        isActive: true
                    };
                    newItemsToCreate.push(newItem);
                    item = newItem;
                }

                importLines.push({
                    itemId: item.id,
                    qty,
                    unit: item.baseUnit,
                    ratio: 1,
                    name: item.name,
                    code: item.code,
                    note: 'Imported via Excel'
                });
            }

            // 2. Commit New Items to DB if any
            if (newItemsToCreate.length > 0) {
                await StorageService.bulkSaveItems(newItemsToCreate);
                await refreshAll(); // Sync global state
                showToast(`${newItemsToCreate.length} SKU baru otomatis didaftarkan`, "success");
            }

            setLines([...lines, ...importLines]);
            showToast(`${importLines.length} baris barang berhasil diimpor`, "success");
            
            // Clear input
            e.target.value = '';
        } catch (err) {
            console.error(err);
            showToast("Gagal membaca file Excel. Pastikan format benar (sku, nama barang, qty, satuan)", "error");
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
          attachments: [] 
        };

        if (initialData) await StorageService.updateTransaction(initialData.id, txData as any);
        else await StorageService.commitTransaction({ ...txData, id: crypto.randomUUID() } as any);
        
        showToast("Transaksi Berhasil Disimpan", "success");
        
        if (keepOpen) {
            setLines([]);
            setNotes('');
            setRefNo(`${type === 'IN' ? 'RI' : 'DO'}.${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}.${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`);
            StorageService.fetchStocks().then(setStocks);
            inlineSearchTriggerRef.current?.focus();
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
    <div className="flex flex-col h-full bg-[#f0f4f5] dark:bg-daintree animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans">
      
      {/* HEADER ACTION BAR */}
      <div className="bg-white dark:bg-gable p-3 border-b border-slate-300 dark:border-spectra flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${type === 'IN' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'} border border-current/20`}>
                  <Package size={20}/>
              </div>
              <div>
                  <h1 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">Formulir {type === 'IN' ? 'Penerimaan' : 'Pengiriman'}</h1>
                  <span className="text-[10px] font-mono font-bold text-cutty uppercase">{refNo}</span>
              </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white dark:bg-daintree hover:bg-slate-50 dark:hover:bg-spectra text-spectra dark:text-white border border-slate-300 dark:border-spectra rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2"
              >
                  <FileSpreadsheet size={14}/> Import Excel
              </button>
              <div className="w-px h-8 bg-slate-300 dark:bg-spectra/50 mx-1 hidden sm:block"></div>
              <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase transition-all">Batal</button>
              <button 
                onClick={() => handleSave(true)} 
                disabled={isSubmitting} 
                className="px-4 py-2 bg-white dark:bg-daintree hover:bg-slate-50 dark:hover:bg-spectra text-slate-700 dark:text-white border border-slate-300 dark:border-spectra rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 disabled:opacity-50"
              >
                  <Plus size={14}/> Simpan & Baru
              </button>
              <button 
                onClick={() => handleSave(false)} 
                disabled={isSubmitting} 
                className="px-6 py-2 bg-spectra text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-spectra/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Selesai
              </button>
          </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* INFO SECTION - COMPACT */}
          <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-gable/20 border-b border-slate-200 dark:border-spectra/30 shadow-inner">
              <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Calendar size={10}/> Tanggal Transaksi</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-300 dark:border-spectra/30 rounded-lg p-2 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-spectra" />
              </div>
              <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Building2 size={10}/> Gudang / Lokasi</label>
                  <select value={selectedWh} onChange={e => setSelectedWh(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-300 dark:border-spectra/30 rounded-lg p-2 text-xs font-bold text-slate-700 dark:text-white outline-none">
                      {globalWh.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
              </div>
              <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={10}/> {type === 'IN' ? 'Pemasok / Supplier' : 'Pelanggan / Customer'}</label>
                  <select value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-300 dark:border-spectra/30 rounded-lg p-2 text-xs font-bold text-slate-700 dark:text-white outline-none">
                      <option value="">-- Pilih Partner --</option>
                      {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
              </div>
              <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><FileText size={10}/> Catatan Global</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Misal: Urgent, Promo, dll..." className="w-full bg-slate-50 dark:bg-black/20 border border-slate-300 dark:border-spectra/30 rounded-lg p-2 text-xs font-medium text-slate-700 dark:text-white outline-none" />
              </div>
          </div>

          {/* DENSE GRID SECTION */}
          <div className="flex-1 flex flex-col bg-white dark:bg-daintree overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-thin">
                  <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
                      <thead className="bg-slate-100 dark:bg-gable/40 text-[9px] font-black text-slate-500 dark:text-cutty uppercase tracking-wider sticky top-0 z-10 border-b border-slate-300 dark:border-spectra/50">
                          <tr>
                              <th className="px-2 py-2 w-8 text-center border-r border-slate-300 dark:border-spectra/20">No</th>
                              <th className="px-2 py-2 border-r border-slate-300 dark:border-spectra/20">Nama Barang & SKU</th>
                              <th className="px-2 py-2 w-24 text-right border-r border-slate-300 dark:border-spectra/20">Sisa Stok</th>
                              <th className="px-2 py-2 w-24 text-right border-r border-slate-300 dark:border-spectra/20">Kuantitas</th>
                              <th className="px-2 py-2 w-24 text-center border-r border-slate-300 dark:border-spectra/20">Satuan</th>
                              <th className="px-2 py-2 w-24 text-right border-r border-slate-300 dark:border-spectra/20">Total Base</th>
                              <th className="px-2 py-2">Catatan Baris</th>
                              <th className="px-2 py-2 w-10"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-spectra/10">
                          {lines.map((l, i) => {
                              const itemMaster = masterItems.find(it => it.id === l.itemId);
                              const curStock = getStockQty(l.itemId);
                              return (
                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group h-7">
                                    <td className="px-2 text-center text-slate-400 font-mono text-[10px] border-r border-slate-200 dark:border-spectra/20">{i + 1}</td>
                                    <td className="px-2 border-r border-slate-200 dark:border-spectra/20 overflow-hidden">
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="font-bold text-slate-700 dark:text-white text-[11px] uppercase truncate">{l.name}</span>
                                            <span className="text-[9px] font-mono text-slate-400 dark:text-cutty font-bold shrink-0">{l.code}</span>
                                        </div>
                                    </td>
                                    <td className="px-2 text-right border-r border-slate-200 dark:border-spectra/20 font-mono text-[10px] text-slate-400">
                                        {curStock.toLocaleString()}
                                    </td>
                                    <td className="px-1 border-r border-slate-200 dark:border-spectra/20">
                                        <input 
                                            type="number" 
                                            value={l.qty} 
                                            onChange={e => updateLine(i, 'qty', Number(e.target.value))}
                                            className="w-full bg-transparent border-none p-0 text-right font-black text-emerald-600 dark:text-emerald-400 outline-none text-[11px]" 
                                        />
                                    </td>
                                    <td className="px-1 border-r border-slate-200 dark:border-spectra/20">
                                        <select 
                                            value={l.unit} 
                                            onChange={e => updateLine(i, 'unit', e.target.value)}
                                            className="w-full bg-transparent border-none p-0 text-center font-bold text-slate-500 dark:text-slate-300 outline-none uppercase text-[10px] appearance-none"
                                        >
                                            <option value={itemMaster?.baseUnit}>{itemMaster?.baseUnit}</option>
                                            {itemMaster?.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-2 text-right border-r border-slate-200 dark:border-spectra/20 font-mono font-bold text-[10px] text-slate-600 dark:text-slate-300">
                                        {(l.qty * l.ratio).toLocaleString()}
                                    </td>
                                    <td className="px-1">
                                        <input 
                                            type="text" 
                                            value={l.note || ''} 
                                            onChange={e => updateLine(i, 'note', e.target.value)}
                                            placeholder="..." 
                                            className="w-full bg-transparent border-none p-0 text-slate-400 italic outline-none text-[10px]" 
                                        />
                                    </td>
                                    <td className="px-2 text-center">
                                        <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                                    </td>
                                </tr>
                              );
                          })}

                          {/* IN-LINE ENTRY ROW */}
                          <tr className="bg-white dark:bg-black/10 h-8 border-b-2 border-slate-300 dark:border-spectra/50">
                              <td className="px-2 text-center text-spectra font-black text-[10px] border-r border-slate-200 dark:border-spectra/20">NEW</td>
                              <td className="px-1 border-r border-slate-200 dark:border-spectra/20 relative">
                                  <div className="flex items-center gap-2">
                                      <Search size={10} className="text-slate-400"/>
                                      <input 
                                          ref={inlineSearchTriggerRef}
                                          type="text" 
                                          placeholder="Ketik Kode/Nama Barang [F2]..."
                                          readOnly
                                          onFocus={() => setIsSearching(true)}
                                          onClick={() => setIsSearching(true)}
                                          value={pendingItem?.name || ''}
                                          className="w-full bg-transparent border-none p-0 text-[11px] font-bold text-spectra dark:text-emerald-400 outline-none cursor-pointer uppercase placeholder:italic"
                                      />
                                  </div>
                              </td>
                              <td className="px-2 text-right border-r border-slate-200 dark:border-spectra/20 font-mono text-[10px] text-slate-400">
                                  {pendingItem ? getStockQty(pendingItem.id).toLocaleString() : '-'}
                              </td>
                              <td className="px-1 border-r border-slate-200 dark:border-spectra/20 bg-emerald-500/5">
                                  <input 
                                      ref={qtyInputRef}
                                      type="number" 
                                      disabled={!pendingItem}
                                      value={pendingQty}
                                      onChange={e => setPendingQty(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleCommitLine()}
                                      placeholder="0.00"
                                      className="w-full bg-transparent border-none p-0 text-right font-black text-emerald-600 dark:text-emerald-400 outline-none text-[11px] placeholder:text-slate-300" 
                                  />
                              </td>
                              <td className="px-2 text-center border-r border-slate-200 dark:border-spectra/20 text-[10px] font-black text-slate-400 uppercase">
                                  {pendingItem?.baseUnit || '-'}
                              </td>
                              <td className="px-2 text-right border-r border-slate-200 dark:border-spectra/20 font-mono text-[10px] text-slate-400">
                                  {pendingItem && pendingQty ? Number(pendingQty).toLocaleString() : '0'}
                              </td>
                              <td className="px-1">
                                  <input 
                                      type="text" 
                                      disabled={!pendingItem}
                                      value={pendingNote}
                                      onChange={e => setPendingNote(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleCommitLine()}
                                      placeholder="Catatan baris..." 
                                      className="w-full bg-transparent border-none p-0 text-slate-400 italic outline-none text-[10px]" 
                                  />
                              </td>
                              <td className="px-2 text-center">
                                  {pendingItem && (
                                      <button onClick={handleCommitLine} className="text-emerald-500 hover:scale-110 transition-transform"><Check size={14} strokeWidth={3}/></button>
                                  )}
                              </td>
                          </tr>
                          
                          {/* FILLER ROWS */}
                          {[...Array(Math.max(0, 15 - lines.length))].map((_, i) => (
                              <tr key={`filler-${i}`} className="h-7 opacity-20">
                                  <td className="border-r border-slate-200 dark:border-spectra/20"></td>
                                  <td className="border-r border-slate-200 dark:border-spectra/20"></td>
                                  <td className="border-r border-slate-200 dark:border-spectra/20"></td>
                                  <td className="border-r border-slate-200 dark:border-spectra/20"></td>
                                  <td className="border-r border-slate-200 dark:border-spectra/20"></td>
                                  <td className="border-r border-slate-200 dark:border-spectra/20"></td>
                                  <td></td>
                                  <td></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
          
          {/* FOOTER TOTALS */}
          <div className="p-3 bg-slate-100 dark:bg-gable border-t border-slate-300 dark:border-spectra flex justify-between items-center shadow-lg">
               <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Baris</span>
                        <span className="text-sm font-black text-slate-700 dark:text-white">{lines.length} Items</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Kuantitas</span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{lines.reduce((acc, l) => acc + (l.qty * l.ratio), 0).toLocaleString()}</span>
                    </div>
               </div>
               <div className="text-[9px] font-bold text-slate-400 uppercase italic">
                  GudangPro Enterprise Grid v2.5 • Excel Format: sku, nama barang, qty, satuan
               </div>
          </div>
      </div>

      {/* COMMAND PALETTE SEARCH */}
      {isSearching && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 px-4 bg-slate-900/60 dark:bg-daintree/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-xl bg-white dark:bg-gable rounded-2xl shadow-2xl border border-slate-300 dark:border-spectra overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-4 bg-slate-50 dark:bg-daintree flex items-center gap-4 border-b border-slate-200 dark:border-spectra">
                      <Search className="text-spectra" size={20}/>
                      <input 
                        ref={searchInputRef}
                        type="text" 
                        placeholder="Cari SKU atau Nama Barang..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setIsSearching(false);
                            if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev + 1) % (searchResults.length || 1)); }
                            if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev - 1 + (searchResults.length || 1)) % (searchResults.length || 1)); }
                            if (e.key === 'Enter' && searchResults[selectedIndex]) handleSelectItem(searchResults[selectedIndex]);
                        }}
                        className="flex-1 bg-transparent text-base font-bold text-slate-700 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                      />
                      <div className="flex items-center gap-2">
                          <kbd className="hidden sm:block px-1.5 py-0.5 text-[9px] font-black bg-slate-200 dark:bg-black/30 rounded border border-slate-300 dark:border-spectra text-slate-500">ESC</kbd>
                          <button onClick={() => setIsSearching(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-white/5 rounded-lg text-slate-400"><X size={18}/></button>
                      </div>
                  </div>
                  
                  <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
                      {searchResults.length === 0 && searchQuery ? (
                          <div className="p-10 text-center text-slate-400 text-xs italic">Barang tidak ditemukan...</div>
                      ) : (
                          <div className="divide-y divide-slate-100 dark:divide-spectra/10">
                              {(searchQuery ? searchResults : masterItems.slice(0, 5)).map((item, idx) => (
                                  <div 
                                    key={item.id} 
                                    onClick={() => handleSelectItem(item)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={`p-3 flex justify-between items-center cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-spectra/10 dark:bg-spectra/20' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                  >
                                      <div className="flex items-center gap-3">
                                          <div className={`p-1.5 rounded-lg ${idx === selectedIndex ? 'bg-spectra text-white' : 'bg-slate-100 dark:bg-daintree text-slate-400'}`}>
                                              <Package size={16}/>
                                          </div>
                                          <div>
                                              <div className="text-xs font-black text-slate-700 dark:text-white uppercase">{highlightMatch(item.name, searchQuery)}</div>
                                              <div className="text-[9px] font-mono text-spectra font-bold uppercase">{highlightMatch(item.code, searchQuery)} <span className="mx-1 text-slate-300">•</span> {item.category}</div>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                          <div className="text-right">
                                              <div className="text-[10px] font-black text-emerald-500">{getStockQty(item.id).toLocaleString()}</div>
                                              <div className="text-[8px] font-bold text-slate-400 uppercase">{item.baseUnit}</div>
                                          </div>
                                          {idx === selectedIndex && <CornerDownLeft size={14} className="text-spectra animate-in slide-in-from-right-2"/>}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  <div className="p-2 bg-slate-50 dark:bg-daintree border-t border-slate-200 dark:border-spectra flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                      <span>Gunakan Panah ↑↓ & Enter Untuk Memilih</span>
                      <span className="text-spectra">Inventory Master</span>
                  </div>
              </div>
          </div>
      )}

      <style>{`
          .scrollbar-thin::-webkit-scrollbar { width: 4px; height: 4px; }
          .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .dark .scrollbar-thin::-webkit-scrollbar-thumb { background: #335157; }
          input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
};
