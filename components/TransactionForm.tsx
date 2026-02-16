
import React, { useState, useEffect, useRef } from 'react';
import { Item, Transaction, TransactionType, TransactionItem, Partner, Stock } from '../types';
import { StorageService } from '../services/storage';
import { useGlobalData } from '../search/SearchProvider';
import { useFuseSearch } from '../search/useFuseSearch';
import { highlightMatch } from '../search/highlightMatch';
import { Plus, Trash2, Save, X, Loader2, Building2, User, Calendar, FileText, Search, CornerDownLeft, Package, Check, FileSpreadsheet, Download, Info, ListFilter } from 'lucide-react';
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
  
  const [isEditMode, setIsEditMode] = useState(!!initialData);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Header State
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(initialData?.referenceNo || `${type === 'IN' ? 'RI' : 'DO'}.${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}.${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`);
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialData?.partnerId || '');
  const [selectedWh, setSelectedWh] = useState(initialData?.sourceWarehouseId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  
  // Lines State
  const [lines, setLines] = useState<TransactionItem[]>(initialData?.items || []);
  
  // New Entry State
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingQty, setPendingQty] = useState<string>('');
  const [pendingNote, setPendingNote] = useState('');
  
  // Search State
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Refs for Navigation
  const inlineSearchTriggerRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchModalRef = useRef<HTMLDivElement>(null);

  // FILTER: Only show active items in search
  const activeMasterItems = masterItems.filter(i => i.isActive);
  const { search } = useFuseSearch(activeMasterItems, { keys: ['code', 'name'], limit: 50 }); // Limit increased for table view
  const searchResults = search(searchQuery);

  useEffect(() => {
    StorageService.fetchStocks().then(setStocks);
    setPartners(globalPts.filter(p => (type === 'IN' ? p.type === 'SUPPLIER' : p.type === 'CUSTOMER') && p.isActive));
    if (globalWh.length > 0 && !selectedWh) setSelectedWh(globalWh[0].id);
  }, [globalPts, globalWh, type]);

  // Click Outside to close search modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        // Close if click is outside modal AND outside the trigger input
        if (searchModalRef.current && !searchModalRef.current.contains(event.target as Node) && 
            inlineSearchTriggerRef.current && !inlineSearchTriggerRef.current.contains(event.target as Node)) {
            setIsSearching(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStockQty = (itemId: string) => {
      const stock = stocks.find(s => s.itemId === itemId && s.warehouseId === selectedWh);
      return stock ? Number(stock.qty) : 0;
  };

  const handleSelectItem = (item: Item) => {
    setPendingItem(item);
    setIsSearching(false);
    setSearchQuery(''); 
    setSelectedIndex(0);
    // Focus Qty after select
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const handleCommitLine = () => {
    if (!pendingItem) return;
    if (!pendingQty || Number(pendingQty) <= 0) {
        qtyInputRef.current?.focus();
        return;
    }

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
    
    // Reset New Entry
    setPendingItem(null);
    setPendingQty('');
    setPendingNote('');
    
    // Focus back to Item Search for next entry
    setTimeout(() => {
        inlineSearchTriggerRef.current?.focus();
    }, 50);
  };

  // --- NAVIGATION LOGIC ---
  const handleGridKeyDown = (e: React.KeyboardEvent, rowIndex: number, field: string) => {
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (rowIndex > 0) {
            const el = document.getElementById(`input-${rowIndex - 1}-${field}`);
            el?.focus();
        }
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (rowIndex < lines.length - 1) {
            const el = document.getElementById(`input-${rowIndex + 1}-${field}`);
            el?.focus();
        } else {
            if (field === 'qty') qtyInputRef.current?.focus();
            else if (field === 'note') noteInputRef.current?.focus();
            else inlineSearchTriggerRef.current?.focus();
        }
    }
    if (e.key === 'Enter' && field === 'note') {
        e.preventDefault();
        if (rowIndex < lines.length - 1) {
            const el = document.getElementById(`input-${rowIndex + 1}-qty`);
            el?.focus();
        } else {
            inlineSearchTriggerRef.current?.focus();
        }
    }
  };

  const handleNewEntryKeyDown = (e: React.KeyboardEvent, field: 'search' | 'qty' | 'note') => {
      // Arrow Up from New Entry
      if (e.key === 'ArrowUp') {
          // If searching, navigate list
          if (field === 'search' && isSearching) {
             e.preventDefault(); 
             setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
             // Auto scroll into view logic for table could go here
             return;
          }

          if (lines.length > 0) {
              e.preventDefault();
              const mappedField = field === 'search' ? 'note' : field; 
              const el = document.getElementById(`input-${lines.length - 1}-${mappedField}`);
              el?.focus();
          }
      }

      // Arrow Down
      if (e.key === 'ArrowDown') {
         // If searching, navigate list
         if (field === 'search' && isSearching) {
            e.preventDefault(); 
            setSelectedIndex(prev => (prev + 1) % searchResults.length);
            return;
         }
         // Commit if in qty/note
         if (field === 'qty' || field === 'note') {
             e.preventDefault();
             handleCommitLine();
         }
      }
      
      // Enter
      if (e.key === 'Enter') {
          e.preventDefault();
          if (field === 'search' && isSearching) {
              if (searchResults[selectedIndex]) handleSelectItem(searchResults[selectedIndex]);
          } else if (field === 'qty' || field === 'note') {
              handleCommitLine();
          }
      }

      // Escape to close search
      if (e.key === 'Escape' && isSearching) {
          setIsSearching(false);
      }
  };

  const handleDownloadTemplate = () => { /* ... kept same ... */ };
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => { /* ... kept same ... */ 
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
            setLines([]); 
            setNotes('');
            setSelectedPartnerId(''); 
            setPendingItem(null); setPendingQty(''); setPendingNote(''); setSearchQuery('');
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
    <div className="flex flex-col h-full bg-[#f8fafc] animate-in fade-in duration-300 font-sans relative">
      
      {/* 1. COMPACT HEADER ACTION BAR */}
      <div className="bg-white px-4 py-2 border-b border-slate-200 flex justify-between items-center shadow-sm shrink-0">
          <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  <Package size={18}/>
              </div>
              <div>
                  <h1 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{type === 'IN' ? 'Penerimaan Barang' : 'Pengiriman Barang'}</h1>
                  <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-1.5 rounded">{refNo}</span>
                      {isEditMode && <span className="text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 rounded uppercase">Edit Mode</span>}
                  </div>
              </div>
          </div>
          <div className="flex gap-2">
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} />
              <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 rounded text-xs font-bold transition-all flex items-center gap-1.5">
                  <FileSpreadsheet size={14}/> Import
              </button>
              <div className="w-px h-6 bg-slate-300 mx-1"></div>
              <button onClick={() => handleSave(true)} disabled={isSubmitting} className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50">
                  <Plus size={14}/> Simpan & Baru
              </button>
              <button onClick={() => handleSave(false)} disabled={isSubmitting} className="px-4 py-1.5 bg-brand hover:bg-brand/90 text-white rounded text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
              </button>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded text-slate-400"><X size={18}/></button>
          </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* 2. COMPACT FORM HEADER */}
          <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 border-b border-slate-200 text-xs shrink-0">
              <div className="space-y-0.5">
                  <label className="font-bold text-slate-500 uppercase text-[10px]">Tanggal</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded p-1.5 font-medium outline-none focus:border-brand" />
              </div>
              <div className="space-y-0.5">
                  <label className="font-bold text-slate-500 uppercase text-[10px]">Gudang</label>
                  <select value={selectedWh} onChange={e => setSelectedWh(e.target.value)} className="w-full bg-white border border-slate-300 rounded p-1.5 font-medium outline-none focus:border-brand">
                      {globalWh.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
              </div>
              <div className="space-y-0.5">
                  <label className="font-bold text-slate-500 uppercase text-[10px]">{type === 'IN' ? 'Supplier' : 'Customer'}</label>
                  <select value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)} className="w-full bg-white border border-slate-300 rounded p-1.5 font-medium outline-none focus:border-brand">
                      <option value="">-- Pilih --</option>
                      {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
              </div>
              <div className="space-y-0.5">
                  <label className="font-bold text-slate-500 uppercase text-[10px]">Catatan Global</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-white border border-slate-300 rounded p-1.5 font-medium outline-none focus:border-brand" placeholder="Keterangan..." />
              </div>
          </div>

          {/* 3. DENSE SPREADSHEET GRID */}
          <div className="flex-1 bg-white overflow-auto relative">
              <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 sticky top-0 z-10 border-b border-slate-300 h-8">
                      <tr>
                          <th className="px-2 w-8 text-center border-r border-slate-200">#</th>
                          <th className="px-2 border-r border-slate-200">Nama Barang / SKU</th>
                          <th className="px-2 w-20 text-right border-r border-slate-200">Stok</th>
                          <th className="px-2 w-20 text-right border-r border-slate-200 bg-brand/5 text-brand">Kuantitas</th>
                          <th className="px-2 w-20 text-center border-r border-slate-200">Satuan</th>
                          <th className="px-2 w-24 text-right border-r border-slate-200">Total Base</th>
                          <th className="px-2 w-48 border-r border-slate-200">Catatan Baris</th>
                          <th className="px-2 w-8 text-center">Act</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                      {lines.map((l, i) => (
                        <tr key={i} className="hover:bg-slate-50 h-8">
                            <td className="px-2 text-center text-slate-400 border-r border-slate-100">{i + 1}</td>
                            <td className="px-2 border-r border-slate-100 truncate">
                                <span className="font-semibold text-slate-700">{l.name}</span>
                                <span className="ml-2 text-[10px] text-slate-400 font-mono">{l.code}</span>
                            </td>
                            <td className="px-2 text-right border-r border-slate-100 font-mono text-slate-500">
                                {getStockQty(l.itemId).toLocaleString()}
                            </td>
                            <td className="p-0 border-r border-slate-100">
                                <input 
                                    id={`input-${i}-qty`}
                                    type="number" 
                                    value={l.qty} 
                                    onChange={e => updateLine(i, 'qty', Number(e.target.value))} 
                                    onKeyDown={e => handleGridKeyDown(e, i, 'qty')}
                                    className="w-full h-full bg-transparent text-right px-2 font-bold text-slate-800 outline-none focus:bg-blue-50" 
                                />
                            </td>
                            <td className="p-0 border-r border-slate-100">
                                <select 
                                    value={l.unit} 
                                    onChange={e => updateLine(i, 'unit', e.target.value)} 
                                    className="w-full h-full bg-transparent text-center px-1 outline-none appearance-none focus:bg-blue-50 cursor-pointer"
                                >
                                    <option value={l.unit}>{l.unit}</option>
                                    {masterItems.find(it => it.id === l.itemId)?.conversions?.map(c => 
                                        c.name !== l.unit && <option key={c.name} value={c.name}>{c.name}</option>
                                    )}
                                </select>
                            </td>
                            <td className="px-2 text-right border-r border-slate-100 font-mono text-slate-600">
                                {(l.qty * (l.ratio || 1)).toLocaleString()}
                            </td>
                            <td className="p-0 border-r border-slate-100">
                                <input 
                                    id={`input-${i}-note`}
                                    type="text" 
                                    value={l.note || ''} 
                                    onChange={e => updateLine(i, 'note', e.target.value)} 
                                    onKeyDown={e => handleGridKeyDown(e, i, 'note')}
                                    className="w-full h-full bg-transparent px-2 text-slate-600 italic outline-none focus:bg-blue-50" 
                                    placeholder="..." 
                                />
                            </td>
                            <td className="px-0 text-center">
                                <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 size={12}/></button>
                            </td>
                        </tr>
                      ))}

                      {/* --- NEW ENTRY ROW (ALWAYS ACTIVE) --- */}
                      <tr className="bg-emerald-50/30 h-9 border-b-2 border-slate-200">
                          <td className="px-2 text-center font-bold text-[9px] text-emerald-600 border-r border-slate-200">BARU</td>
                          <td className="p-0 border-r border-slate-200 relative">
                              <div className="relative w-full h-full">
                                  <input 
                                      ref={inlineSearchTriggerRef}
                                      type="text" 
                                      placeholder="Ketik nama / kode barang..." 
                                      value={pendingItem ? pendingItem.name : searchQuery}
                                      onChange={e => {
                                          if(pendingItem) setPendingItem(null); 
                                          setSearchQuery(e.target.value);
                                          setIsSearching(true);
                                      }}
                                      onKeyDown={e => handleNewEntryKeyDown(e, 'search')}
                                      onFocus={() => {
                                          if (searchQuery) setIsSearching(true);
                                      }}
                                      className={`w-full h-full px-2 text-xs outline-none bg-transparent placeholder:text-slate-400 ${pendingItem ? 'font-bold text-slate-800' : 'font-normal'}`}
                                      autoComplete="off"
                                  />
                                  {pendingItem && <button onClick={() => { setPendingItem(null); setSearchQuery(''); inlineSearchTriggerRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"><X size={12}/></button>}
                              </div>
                          </td>
                          <td className="px-2 text-right border-r border-slate-200 font-mono text-slate-400">
                              {pendingItem ? getStockQty(pendingItem.id).toLocaleString() : '-'}
                          </td>
                          <td className="p-0 border-r border-slate-200">
                              <input 
                                  ref={qtyInputRef}
                                  type="number" 
                                  placeholder="0"
                                  disabled={!pendingItem}
                                  value={pendingQty}
                                  onChange={e => setPendingQty(e.target.value)}
                                  onKeyDown={e => handleNewEntryKeyDown(e, 'qty')}
                                  className="w-full h-full bg-white text-right px-2 font-bold text-brand outline-none focus:ring-2 focus:ring-inset focus:ring-brand/30 disabled:bg-slate-50 disabled:text-slate-300" 
                              />
                          </td>
                          <td className="px-2 text-center border-r border-slate-200 font-bold text-slate-500">
                              {pendingItem?.baseUnit || '-'}
                          </td>
                          <td className="px-2 text-right border-r border-slate-200 font-mono text-slate-300">
                              {pendingItem && pendingQty ? Number(pendingQty).toLocaleString() : '-'}
                          </td>
                          <td className="p-0 border-r border-slate-200">
                              <input 
                                  ref={noteInputRef}
                                  type="text" 
                                  placeholder="Catatan baris..." 
                                  disabled={!pendingItem}
                                  value={pendingNote}
                                  onChange={e => setPendingNote(e.target.value)}
                                  onKeyDown={e => handleNewEntryKeyDown(e, 'note')}
                                  className="w-full h-full bg-white px-2 italic text-slate-600 outline-none focus:ring-2 focus:ring-inset focus:ring-brand/30 disabled:bg-slate-50" 
                              />
                          </td>
                          <td className="text-center p-0">
                               {pendingItem && (
                                   <button onClick={handleCommitLine} className="w-full h-full flex items-center justify-center text-emerald-500 hover:bg-emerald-50" title="Simpan Baris (Arrow Down)"><CornerDownLeft size={14}/></button>
                               )}
                          </td>
                      </tr>
                      
                      {/* FILLER */}
                      {[...Array(Math.max(0, 10 - lines.length))].map((_, i) => (
                          <tr key={`fill-${i}`} className="h-8"><td colSpan={8} className="border-r border-slate-100"></td></tr>
                      ))}
                  </tbody>
              </table>
          </div>
          
          {/* 4. FOOTER INFO */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs shrink-0">
               <div className="flex gap-6 text-slate-500 font-medium">
                   <span>Total Baris: <strong className="text-slate-800">{lines.length}</strong></span>
                   <span>Total Qty: <strong className="text-slate-800">{lines.reduce((acc, l) => acc + (l.qty * (l.ratio||1)), 0).toLocaleString()}</strong> <span className="text-[10px]">BASE</span></span>
               </div>
               <div className="flex items-center gap-2 text-[10px] text-slate-400">
                   <span className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-slate-200"><Search size={10}/> Cari Barang</span>
                   <span>→</span>
                   <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">Pilih</span>
                   <span>→</span>
                   <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">Isi Qty</span>
                   <span>→</span>
                   <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold">Arrow Down / Enter</span>
                   <span>=</span>
                   <span className="text-emerald-600 font-bold">Simpan</span>
               </div>
          </div>

          {/* 5. CENTERED ACCURATE-STYLE AUTOCOMPLETE MODAL */}
          {isSearching && searchQuery && (
            <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
                 {/* No backdrop blur/dim, just center placement */}
                 <div ref={searchModalRef} className="pointer-events-auto bg-white w-[650px] max-h-[400px] flex flex-col shadow-2xl border border-slate-400 rounded-lg overflow-hidden animate-in fade-in zoom-in-95">
                     {/* Header */}
                     <div className="bg-gradient-to-r from-slate-100 to-slate-200 px-3 py-2 border-b border-slate-300 flex justify-between items-center">
                         <div className="flex items-center gap-2">
                             <ListFilter size={14} className="text-slate-600"/>
                             <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Cari Barang / Item Search</span>
                         </div>
                         <div className="text-[10px] text-slate-500 font-medium">Menampilkan {searchResults.length} hasil</div>
                     </div>
                     
                     {/* Table Content */}
                     <div className="flex-1 overflow-auto bg-white">
                         <table className="w-full text-left border-collapse table-fixed">
                             <thead className="bg-slate-100 sticky top-0 z-10">
                                 <tr className="border-b border-slate-300 text-[10px] font-bold text-slate-600 uppercase">
                                     <th className="px-3 py-1.5 w-32 border-r border-slate-300">Kode Item</th>
                                     <th className="px-3 py-1.5 border-r border-slate-300">Nama Barang</th>
                                     <th className="px-3 py-1.5 w-24 text-right border-r border-slate-300">Stok</th>
                                     <th className="px-3 py-1.5 w-20 text-center">Satuan</th>
                                 </tr>
                             </thead>
                             <tbody className="text-[11px]">
                                {searchResults.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400 italic">Data tidak ditemukan untuk "{searchQuery}"</td>
                                    </tr>
                                ) : (
                                    searchResults.map((item, idx) => (
                                     <tr 
                                        key={item.id} 
                                        onMouseDown={() => handleSelectItem(item)} // MouseDown to trigger before blur
                                        className={`cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${idx === selectedIndex ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                                     >
                                         <td className={`px-3 py-1.5 border-r border-transparent font-mono ${idx===selectedIndex?'text-blue-100':'text-slate-500'}`}>
                                             {highlightMatch(item.code, searchQuery)}
                                         </td>
                                         <td className="px-3 py-1.5 border-r border-transparent font-bold truncate">
                                             {highlightMatch(item.name, searchQuery)}
                                         </td>
                                         <td className={`px-3 py-1.5 border-r border-transparent text-right font-mono ${idx===selectedIndex?'text-white':'text-slate-600'}`}>
                                             {getStockQty(item.id).toLocaleString()}
                                         </td>
                                         <td className={`px-3 py-1.5 text-center font-bold text-[9px] uppercase ${idx===selectedIndex?'text-blue-200':'text-slate-400'}`}>
                                             {item.baseUnit}
                                         </td>
                                     </tr>
                                    ))
                                )}
                             </tbody>
                         </table>
                     </div>
                     
                     {/* Footer Hint */}
                     <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-200 text-[9px] text-slate-400 flex justify-between items-center">
                         <span>Gunakan <strong>↑ ↓</strong> untuk navigasi, <strong>Enter</strong> untuk memilih.</span>
                         <span className="font-mono">{selectedIndex + 1} / {searchResults.length}</span>
                     </div>
                 </div>
            </div>
          )}
      </div>
    </div>
  );
};
