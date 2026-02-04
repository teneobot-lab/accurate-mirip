
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner, Stock } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, Save, X, CornerDownLeft, Loader2, Building2, User, Calendar, Hash, Tag, Edit3, Info, Search, Package, ArrowRight, FileText, StickyNote, ChevronDown, Upload, FileSpreadsheet, AlertTriangle } from 'lucide-react';
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
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(initialData?.referenceNo || `${type === 'IN' ? 'RI' : 'DO'}.${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}.${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`);
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialData?.partnerId || '');
  const [selectedWh, setSelectedWh] = useState(initialData?.sourceWarehouseId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [lines, setLines] = useState<TransactionItem[]>(initialData?.items || []);

  // Row Entry & Autocomplete States
  const [query, setQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingUnit, setPendingUnit] = useState('');
  const [pendingQty, setPendingQty] = useState<string>(''); // Default empty string to remove 0/1

  // Refs for Navigation
  const itemInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
        try {
            const [its, whs, pts, stks] = await Promise.all([
                StorageService.fetchItems().catch(() => []),
                StorageService.fetchWarehouses().catch(() => []),
                StorageService.fetchPartners().catch(() => []),
                StorageService.fetchStocks().catch(() => [])
            ]);
            setItems(its || []);
            setWarehouses(whs || []);
            setStocks(stks || []);
            
            // Filter Partners: Must match Type AND be Active
            const filteredPartners = pts.filter(p => 
                (type === 'IN' ? p.type === 'SUPPLIER' : p.type === 'CUSTOMER') && 
                (p.isActive === true || p.id === initialData?.partnerId) // Allow currently selected if inactive
            );
            setPartners(filteredPartners || []);

            if (whs && whs.length > 0 && !initialData) setSelectedWh(whs[0].id);
        } catch (e) {
            console.error("Load failed", e);
        }
    };
    load();
  }, [type, initialData]);

  // Fuzzy Search Logic (Filtered by Active)
  useEffect(() => {
    if (!query || pendingItem) {
        setFilteredItems([]);
        setIsDropdownOpen(false);
        return;
    }
    const lowerQuery = query.toLowerCase();
    
    // Only show Active Items in search results
    const activeItems = items.filter(it => it.isActive === true);

    const results = activeItems.filter(it => 
        it.name.toLowerCase().includes(lowerQuery) || 
        it.code.toLowerCase().includes(lowerQuery)
    ).slice(0, 10); // Limit results
    setFilteredItems(results);
    setIsDropdownOpen(results.length > 0);
    setSelectedIndex(0);
  }, [query, items, pendingItem]);

  const getStockQty = (itemId: string) => {
      if (!selectedWh) return 0;
      const stock = stocks.find(s => s.itemId === itemId && s.warehouseId === selectedWh);
      return stock ? Number(stock.qty) : 0;
  };

  const selectItem = (item: Item) => {
    setPendingItem(item);
    setPendingUnit(item.baseUnit);
    setQuery(item.name);
    setIsDropdownOpen(false);
    // Focus move to Qty
    setTimeout(() => qtyInputRef.current?.focus(), 10);
  };

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (isDropdownOpen) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredItems.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredItems[selectedIndex]) selectItem(filteredItems[selectedIndex]);
        } else if (e.key === 'Escape') {
            setIsDropdownOpen(false);
        }
    } else if (e.key === 'Enter' && pendingItem) {
         e.preventDefault();
         qtyInputRef.current?.focus();
    }
  };

  const handleAddLine = () => {
    if (!pendingItem) return showToast("Pilih barang terlebih dahulu", "warning");
    if (!pendingQty || Number(pendingQty) <= 0) return showToast("Masukkan jumlah valid", "warning");
    
    let ratio = 1;
    if (pendingUnit !== pendingItem.baseUnit) {
        const conv = pendingItem.conversions?.find(c => c.name === pendingUnit);
        if (conv) {
            ratio = conv.operator === '/' ? 1 / conv.ratio : conv.ratio;
        }
    }

    const newLine: TransactionItem = {
      itemId: pendingItem.id,
      qty: Number(pendingQty),
      unit: pendingUnit || pendingItem.baseUnit,
      ratio: ratio,
      name: pendingItem.name,
      code: pendingItem.code
    };
    
    setLines(prev => [...prev, newLine]); // Append to bottom
    
    // Reset for next input
    setQuery('');
    setPendingItem(null);
    setPendingUnit('');
    setPendingQty('');
    
    setTimeout(() => itemInputRef.current?.focus(), 10);
  };

  // Inline Editing
  const updateLine = (index: number, field: keyof TransactionItem, value: any) => {
      const newLines = [...lines];
      const line = newLines[index];
      const itemMaster = items.find(i => i.id === line.itemId);

      if (field === 'unit' && itemMaster) {
         let newRatio = 1;
         if (value !== itemMaster.baseUnit) {
             const conv = itemMaster.conversions?.find(c => c.name === value);
             if (conv) newRatio = conv.operator === '/' ? 1 / conv.ratio : conv.ratio;
         }
         line.unit = value;
         line.ratio = newRatio;
      } else if (field === 'qty') {
          line.qty = Number(value);
      }

      setLines(newLines);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsImporting(true);
      const reader = new FileReader();
      
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const ws = wb.Sheets[wb.SheetNames[0]];
              const data: any[] = XLSX.utils.sheet_to_json(ws);

              const newLines: TransactionItem[] = [];
              const createdItems: Item[] = [];

              for (const row of data) {
                  // Format Excel: SKU | Nama | Qty | Satuan
                  const code = String(row.SKU || row.Code || row.Kode || '').trim();
                  const name = String(row.Nama || row.Name || row.Barang || '').trim();
                  const qty = Number(row.Qty || row.Jumlah || 0);
                  const unit = String(row.Satuan || row.Unit || 'Pcs').trim();

                  if (!code || !name || qty <= 0) continue;

                  let item = items.find(i => i.code === code);
                  
                  // Auto-create SKU Logic
                  if (!item) {
                      const newItem: Item = {
                          id: crypto.randomUUID(),
                          code,
                          name,
                          category: 'Uncategorized',
                          baseUnit: unit,
                          conversions: [],
                          minStock: 0,
                          isActive: true
                      };
                      // Save to DB immediately
                      await StorageService.saveItem(newItem);
                      createdItems.push(newItem);
                      item = newItem;
                  }

                  newLines.push({
                      itemId: item.id,
                      qty,
                      unit,
                      ratio: 1, // Default ratio for imported items unless we do complex matching
                      name: item.name,
                      code: item.code
                  });
              }

              // Refresh items state if we created new ones
              if (createdItems.length > 0) {
                  const updatedItems = await StorageService.fetchItems();
                  setItems(updatedItems);
                  showToast(`${createdItems.length} SKU baru otomatis dibuat`, "info");
              }

              setLines(prev => [...prev, ...newLines]);
              showToast(`${newLines.length} baris berhasil diimport`, "success");

          } catch (err) {
              showToast("Gagal membaca file excel", "error");
          } finally {
              setIsImporting(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsBinaryString(file);
  };

  const handleSubmit = async () => {
    if (lines.length === 0) return showToast("Tambahkan baris barang terlebih dahulu", "warning");
    if (!selectedWh) return showToast("Pilih gudang terlebih dahulu", "warning");
    
    // VALIDASI STOK MINUS (Toast/Confirm Logic)
    if (type === 'OUT') {
        const lowStockItems = [];
        for (const line of lines) {
            const currentStock = getStockQty(line.itemId);
            const reqQty = line.qty * (line.ratio || 1);
            if (currentStock - reqQty < 0) {
                lowStockItems.push(`${line.name} (Sisa: ${currentStock}, Minta: ${reqQty})`);
            }
        }

        if (lowStockItems.length > 0) {
            const confirmed = window.confirm(
                `PERINGATAN: Stok berikut akan menjadi MINUS:\n\n${lowStockItems.join('\n')}\n\nLanjutkan transaksi? (Klik OK untuk VALID)`
            );
            if (!confirmed) return;
        }
    }
    
    setIsSubmitting(true);
    try {
        const txData = {
            date,
            referenceNo: refNo,
            type,
            sourceWarehouseId: selectedWh,
            partnerId: selectedPartnerId,
            items: lines.map(line => ({
                item_id: line.itemId,
                qty: line.qty,
                unit: line.unit,
                conversionRatio: line.ratio || 1,
                note: '' // Removed per request
            })),
            notes
        };
        
        if (initialData?.id) {
            await StorageService.updateTransaction(initialData.id, txData as any);
            showToast("Transaksi Berhasil Diperbarui", "success");
        } else {
            await StorageService.commitTransaction({ ...txData, id: crypto.randomUUID() } as any);
            showToast("Transaksi Berhasil Disimpan", "success");
        }
        onSuccess();
    } catch (e: any) {
        const msg = e.message?.includes('409') ? "Gagal: Stok tidak mencukupi (Backend Rejected)" : `Gagal: ${e.message}`;
        showToast(msg, "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-daintree/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="bg-gable rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden border border-spectra ring-1 ring-white/10">
        
        {/* Title Bar */}
        <div className="bg-daintree px-5 py-3 flex justify-between items-center border-b border-spectra">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border shadow-inner ${type === 'IN' ? 'bg-emerald-900/20 border-emerald-900/50 text-emerald-400' : 'bg-red-900/20 border-red-900/50 text-red-400'}`}>
                   <FileText size={18} />
                </div>
                <div>
                   <h2 className="text-lg font-black text-white leading-none uppercase tracking-tight">
                      {initialData ? 'Edit Transaksi' : 'Form Transaksi'} <span className={type === 'IN' ? 'text-emerald-500' : 'text-red-500'}>{type === 'IN' ? 'Penerimaan' : 'Pengeluaran'}</span>
                   </h2>
                   <p className="text-[10px] text-cutty font-bold uppercase tracking-widest">Ref: {refNo}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-400">
                <X size={18}/>
            </button>
        </div>

        {/* Header Form */}
        <div className="p-4 bg-gable border-b border-spectra shadow-sm">
            <div className="grid grid-cols-12 gap-4">
                <div className="col-span-9">
                    <div className="rounded-xl border border-spectra overflow-hidden shadow-sm bg-daintree/10">
                        <table className="w-full text-left text-xs border-collapse">
                            <tbody>
                                <tr>
                                    <td className="w-32 bg-daintree px-3 py-2.5 text-[10px] font-bold text-cutty uppercase tracking-wider border-r border-b border-spectra">
                                        {type === 'IN' ? 'Supplier / Vendor' : 'Customer'}
                                    </td>
                                    <td className="p-1 border-r border-b border-spectra bg-gable relative">
                                        <div className="relative h-full">
                                            <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                                            <select className="w-full bg-transparent text-white text-xs font-bold outline-none pl-8 pr-8 py-1.5 appearance-none focus:bg-daintree/50 transition-colors rounded-lg border-none" value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)}>
                                                <option value="">-- Pilih Partner (Active Only) --</option>
                                                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cutty pointer-events-none"/>
                                        </div>
                                    </td>
                                    <td className="w-32 bg-daintree px-3 py-2.5 text-[10px] font-bold text-cutty uppercase tracking-wider border-r border-b border-spectra">
                                        Gudang {type === 'IN' ? 'Tujuan' : 'Asal'}
                                    </td>
                                    <td className="p-1 border-b border-spectra bg-gable relative">
                                        <div className="relative h-full">
                                            <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                                            <select className="w-full bg-transparent text-white text-xs font-bold outline-none pl-8 pr-8 py-1.5 appearance-none focus:bg-daintree/50 transition-colors rounded-lg border-none" value={selectedWh} onChange={e => setSelectedWh(e.target.value)}>
                                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cutty pointer-events-none"/>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="bg-daintree px-3 py-2.5 text-[10px] font-bold text-cutty uppercase tracking-wider border-r border-b border-spectra">
                                        Tanggal
                                    </td>
                                    <td className="p-1 border-r border-b border-spectra bg-gable relative">
                                        <div className="relative h-full">
                                            <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-transparent text-white text-xs font-bold outline-none pl-8 py-1.5 focus:bg-daintree/50 transition-colors rounded-lg border-none" />
                                        </div>
                                    </td>
                                    <td className="bg-daintree px-3 py-2.5 text-[10px] font-bold text-cutty uppercase tracking-wider border-r border-b border-spectra">
                                        No. Referensi
                                    </td>
                                    <td className="p-1 border-b border-spectra bg-gable relative">
                                        <div className="relative h-full">
                                            <Hash size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                                            <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="w-full bg-transparent font-mono text-emerald-400 text-xs font-bold outline-none pl-8 py-1.5 uppercase focus:bg-daintree/50 transition-colors rounded-lg border-none" />
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="bg-daintree px-3 py-2.5 text-[10px] font-bold text-cutty uppercase tracking-wider border-r border-spectra">
                                        Catatan
                                    </td>
                                    <td colSpan={3} className="p-1 bg-gable relative">
                                        <div className="relative h-full">
                                            <StickyNote size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                                            <input type="text" placeholder="Keterangan transaksi..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-transparent text-white text-xs font-bold outline-none pl-8 py-1.5 focus:bg-daintree/50 transition-colors rounded-lg border-none" />
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                 {/* Right Column */}
                <div className="col-span-3 pl-3 border-l border-spectra/50 flex flex-col justify-center">
                    <div className="bg-daintree rounded-xl border border-spectra p-3 flex flex-col justify-between h-full shadow-inner gap-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-cutty uppercase">
                            <span>Total Lines</span>
                            <span className="text-white font-mono">{lines.length}</span>
                        </div>
                         <div className="w-full h-px bg-spectra/30"></div>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportExcel} />
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isImporting}
                            className="w-full py-2 bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-900/40 transition-all active:scale-95"
                        >
                            {isImporting ? <Loader2 size={14} className="animate-spin"/> : <FileSpreadsheet size={14}/>} Import Excel
                        </button>
                        <div className="text-[9px] text-cutty text-center italic">Format: SKU, Nama, Qty, Satuan</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Transaction Grid Table */}
        <div className="flex-1 bg-gable p-4 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto scrollbar-thin rounded-xl border border-spectra bg-daintree/30 shadow-inner">
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-20 bg-daintree text-cutty text-[10px] font-black uppercase tracking-widest shadow-md">
                        <tr>
                            <th className="px-3 py-2 border-b border-spectra w-10 text-center">#</th>
                            <th className="px-3 py-2 border-b border-spectra">Kode & Nama Barang</th>
                            <th className="px-3 py-2 border-b border-spectra w-32 text-right">Kuantitas</th>
                            <th className="px-3 py-2 border-b border-spectra w-32 text-center">Satuan</th>
                            <th className="px-3 py-2 border-b border-spectra w-40 text-right">Total Dasar</th>
                            <th className="px-3 py-2 border-b border-spectra w-10 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="text-xs text-slate-200">
                        {/* Entry Row */}
                        <tr className="bg-daintree/50 border-b border-spectra sticky top-[33px] z-10 shadow-sm backdrop-blur-sm group">
                            <td className="p-2 border-b border-spectra text-center"><Plus size={14} className="text-spectra mx-auto"/></td>
                            <td className="p-2 border-b border-spectra relative">
                                <input 
                                    ref={itemInputRef}
                                    type="text"
                                    className="w-full bg-gable border border-spectra rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-spectra font-bold placeholder:text-cutty placeholder:font-normal uppercase text-white shadow-sm text-xs"
                                    placeholder="Cari Barang Aktif..."
                                    value={query}
                                    onChange={e => {
                                        setQuery(e.target.value);
                                        if (pendingItem) setPendingItem(null);
                                    }}
                                    onKeyDown={handleItemKeyDown}
                                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                    onFocus={() => { if(query && !pendingItem) setIsDropdownOpen(true); }}
                                />
                                {isDropdownOpen && (
                                    <div ref={dropdownRef} className="absolute left-2 top-full mt-1 w-[500px] bg-gable rounded-xl shadow-2xl border border-spectra z-[100] max-h-60 overflow-y-auto">
                                        {filteredItems.map((it, idx) => {
                                            const stockQty = getStockQty(it.id);
                                            return (
                                                <div 
                                                    key={it.id}
                                                    className={`px-3 py-2 cursor-pointer border-b border-spectra/30 text-xs flex justify-between items-center ${idx === selectedIndex ? 'bg-spectra text-white' : 'hover:bg-daintree'}`}
                                                    onMouseDown={(e) => { e.preventDefault(); selectItem(it); }}
                                                    onMouseEnter={() => setSelectedIndex(idx)}
                                                >
                                                    <div>
                                                        <div className="font-bold">{it.code}</div>
                                                        <div className={`text-[10px] ${idx === selectedIndex ? 'text-white/80' : 'text-slate-400'}`}>{it.name}</div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`text-[9px] font-bold ${stockQty < 0 ? 'text-red-400' : 'text-emerald-400'}`}>Stok: {stockQty}</div>
                                                        <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg ${idx === selectedIndex ? 'bg-white/20' : 'bg-daintree text-cutty'}`}>{it.baseUnit}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </td>
                            <td className="p-2 border-b border-spectra">
                                <input 
                                    ref={qtyInputRef}
                                    type="number" 
                                    className="w-full bg-gable border border-spectra rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-spectra text-right font-mono font-bold text-white shadow-sm text-xs appearance-none"
                                    placeholder="0"
                                    value={pendingQty} 
                                    onChange={e => setPendingQty(e.target.value)} 
                                    disabled={!pendingItem}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLine(); } }}
                                />
                            </td>
                            <td className="p-2 border-b border-spectra relative">
                                 <select 
                                    className="w-full bg-gable border border-spectra rounded-lg px-1 py-1.5 outline-none font-bold text-center text-white text-xs shadow-sm appearance-none cursor-pointer"
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
                                </select>
                            </td>
                            <td className="p-2 border-b border-spectra text-right font-mono text-slate-500 text-[10px]">
                                -
                            </td>
                            <td className="p-2 border-b border-spectra text-center">
                                <button onClick={handleAddLine} disabled={!pendingItem} className="p-1.5 bg-spectra text-white rounded-lg hover:bg-white hover:text-spectra disabled:opacity-50 transition-colors shadow-sm"><CornerDownLeft size={14}/></button>
                            </td>
                        </tr>

                        {/* Existing Lines - Inline Editing */}
                        {lines.map((l, i) => {
                            const itemMaster = items.find(it => it.id === l.itemId);
                            return (
                                <tr key={i} className="hover:bg-spectra/5 transition-colors group">
                                    <td className="px-3 py-1.5 border-b border-spectra/10 text-center text-cutty font-mono text-[10px]">{i + 1}</td>
                                    <td className="px-3 py-1.5 border-b border-spectra/10">
                                        <div className="font-bold text-slate-200">{l.name}</div>
                                        <div className="text-[10px] text-cutty font-mono">{l.code}</div>
                                    </td>
                                    <td className="px-3 py-1.5 border-b border-spectra/10">
                                        <input 
                                            type="number"
                                            value={l.qty}
                                            onChange={e => updateLine(i, 'qty', e.target.value)}
                                            className="w-full bg-transparent border-b border-transparent focus:border-spectra outline-none text-right font-black text-white text-xs py-1 appearance-none"
                                        />
                                    </td>
                                    <td className="px-3 py-1.5 border-b border-spectra/10 text-center">
                                        {itemMaster ? (
                                            <select 
                                                value={l.unit} 
                                                onChange={e => updateLine(i, 'unit', e.target.value)}
                                                className="bg-transparent text-slate-300 font-bold text-[10px] outline-none cursor-pointer appearance-none text-center w-full"
                                            >
                                                <option value={itemMaster.baseUnit}>{itemMaster.baseUnit}</option>
                                                {itemMaster.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                            </select>
                                        ) : <span className="text-[10px]">{l.unit}</span>}
                                    </td>
                                    <td className="px-3 py-1.5 border-b border-spectra/10 text-right font-mono text-cutty text-[11px]">
                                        {(l.qty * (l.ratio || 1)).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-1.5 border-b border-spectra/10 text-center">
                                        <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 size={14}/>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                
                {/* Empty State Overlay */}
                {lines.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-12 pointer-events-none opacity-20">
                        <Package size={48} className="text-spectra"/>
                        <div className="text-sm font-black uppercase text-spectra mt-2 tracking-widest">Belum ada item</div>
                    </div>
                )}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-daintree p-4 border-t border-spectra flex justify-between items-center z-20">
             <div className="text-[10px] text-cutty font-bold uppercase tracking-widest flex gap-4">
                <span className="flex items-center gap-2"><Info size={14} className="text-spectra"/> Pastikan data sudah valid</span>
             </div>
             <div className="flex gap-3">
                <button onClick={onClose} className="px-5 py-2 rounded-xl border border-spectra bg-gable hover:bg-spectra/20 text-slate-300 text-xs font-bold uppercase tracking-wide transition-colors">Batal</button>
                <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || !selectedWh}
                    className="px-6 py-2 rounded-xl bg-spectra hover:bg-white hover:text-daintree text-white text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                >
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {initialData ? 'Simpan Perubahan' : 'Simpan Transaksi'}
                </button>
             </div>
        </div>
      </div>
      <style>{`
        /* Remove Spinner */
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
        }
        /* Dropdown options background */
        option { background-color: #193338 !important; }
      `}</style>
    </div>
  );
};
