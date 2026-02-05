
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem, Partner, Stock } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, Save, X, CornerDownLeft, Loader2, Building2, User, Calendar, Hash, StickyNote, ChevronDown, Upload, FileSpreadsheet, Image as ImageIcon, Eye, Download, Package, FileText } from 'lucide-react';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';

// --- CUSTOM HOOK FOR PERFORMANCE ---
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

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
  
  // Attachments State (Only for IN)
  const [attachments, setAttachments] = useState<string[]>(initialData?.attachments || []);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Row Entry & Autocomplete States
  const [query, setQuery] = useState('');
  // DEBOUNCE: Delay filtering logic by 300ms
  const debouncedQuery = useDebounce(query, 300);
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingUnit, setPendingUnit] = useState('');
  const [pendingQty, setPendingQty] = useState<string>('');

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
            
            const filteredPartners = pts.filter(p => 
                (type === 'IN' ? p.type === 'SUPPLIER' : p.type === 'CUSTOMER') && 
                (p.isActive === true || p.id === initialData?.partnerId)
            );
            setPartners(filteredPartners || []);

            if (whs && whs.length > 0 && !initialData) setSelectedWh(whs[0].id);
        } catch (e) {
            console.error("Load failed", e);
        }
    };
    load();
  }, [type, initialData]);

  // OPTIMIZED: Fuzzy Search Logic using useMemo and Debounced Query
  const filteredItems = useMemo(() => {
    if (!debouncedQuery || pendingItem) return [];
    
    const lowerQuery = debouncedQuery.toLowerCase();
    // Pre-filter active items generally usually done once, but inside useMemo is fine
    // as it only runs when debouncedQuery changes.
    return items
        .filter(it => 
            it.isActive && 
            (it.name.toLowerCase().includes(lowerQuery) || it.code.toLowerCase().includes(lowerQuery))
        )
        .slice(0, 15); // Limit to 15 items for rendering performance
  }, [debouncedQuery, items, pendingItem]);

  // Handle Dropdown Open State based on filtered results
  useEffect(() => {
      if (filteredItems.length > 0 && !pendingItem) {
          setIsDropdownOpen(true);
          setSelectedIndex(0);
      } else {
          setIsDropdownOpen(false);
      }
  }, [filteredItems, pendingItem]);

  const getStockQty = (itemId: string) => {
      if (!selectedWh) return 0;
      const stock = stocks.find(s => s.itemId === itemId && s.warehouseId === selectedWh);
      return stock ? Number(stock.qty) : 0;
  };

  const selectItem = (item: Item) => {
    setPendingItem(item);
    setPendingUnit(item.baseUnit);
    setQuery(item.name); // Set visual input
    setIsDropdownOpen(false);
    setTimeout(() => qtyInputRef.current?.focus(), 50); // Small delay to ensure render cycle completes
  };

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (isDropdownOpen && filteredItems.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredItems.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
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
    
    setLines(prev => [...prev, newLine]);
    
    // Reset for next input
    setQuery('');
    setPendingItem(null);
    setPendingUnit('');
    setPendingQty('');
    
    setTimeout(() => itemInputRef.current?.focus(), 50);
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
          showToast(`${newPhotos.length} foto berhasil diupload`, "success");
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
                  const code = String(row.SKU || row.Code || row.Kode || '').trim();
                  const name = String(row.Nama || row.Name || row.Barang || '').trim();
                  const qty = Number(row.Qty || row.Jumlah || 0);
                  const unit = String(row.Satuan || row.Unit || 'Pcs').trim();

                  if (!code || !name || qty <= 0) continue;

                  let item = items.find(i => i.code === code);
                  
                  if (!item) {
                      const newItem: Item = {
                          id: crypto.randomUUID(), code, name, category: 'Uncategorized', baseUnit: unit, conversions: [], minStock: 0, isActive: true
                      };
                      await StorageService.saveItem(newItem);
                      createdItems.push(newItem);
                      item = newItem;
                  }

                  newLines.push({
                      itemId: item.id, qty, unit, ratio: 1, name: item.name, code: item.code
                  });
              }

              if (createdItems.length > 0) {
                  const updatedItems = await StorageService.fetchItems();
                  setItems(updatedItems);
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
            const confirmed = window.confirm(`STOK MINUS DETECTED:\n\n${lowStockItems.join('\n')}\n\nLanjutkan?`);
            if (!confirmed) return;
        }
    }
    
    setIsSubmitting(true);
    try {
        const txData = {
            date, referenceNo: refNo, type, sourceWarehouseId: selectedWh, partnerId: selectedPartnerId,
            items: lines.map(line => ({
                item_id: line.itemId, qty: line.qty, unit: line.unit, conversionRatio: line.ratio || 1, note: ''
            })),
            notes, attachments
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
        showToast(`Gagal: ${e.message}`, "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-daintree/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="bg-gable rounded-xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden border border-spectra ring-1 ring-white/10">
        
        {/* Title Bar */}
        <div className="bg-daintree px-4 py-2 flex justify-between items-center border-b border-spectra">
            <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg border shadow-inner ${type === 'IN' ? 'bg-emerald-900/20 border-emerald-900/50 text-emerald-400' : 'bg-red-900/20 border-red-900/50 text-red-400'}`}>
                   <FileText size={16} />
                </div>
                <div>
                   <h2 className="text-base font-black text-white leading-none uppercase tracking-tight">
                      {initialData ? 'Edit' : 'Input'} <span className={type === 'IN' ? 'text-emerald-500' : 'text-red-500'}>{type === 'IN' ? 'Penerimaan' : 'Pengeluaran'}</span>
                   </h2>
                   <p className="text-[10px] text-cutty font-bold uppercase tracking-widest">{refNo}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400">
                <X size={18}/>
            </button>
        </div>

        {/* Header Form - Condensed */}
        <div className="p-3 bg-gable border-b border-spectra shadow-sm">
            <div className="grid grid-cols-12 gap-3">
                <div className="col-span-10">
                    <div className="rounded-lg border border-spectra overflow-hidden shadow-sm bg-daintree/10">
                        <table className="w-full text-left text-xs border-collapse">
                            <tbody>
                                <tr>
                                    <td className="w-24 bg-daintree px-2 py-1.5 text-[10px] font-bold text-cutty uppercase tracking-wider border-r border-b border-spectra">Partner</td>
                                    <td className="p-0.5 border-r border-b border-spectra bg-gable relative">
                                        <div className="relative h-full">
                                            <User size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                                            <select className="w-full bg-black/20 text-white text-xs font-bold outline-none pl-7 pr-4 py-1 appearance-none focus:bg-daintree/50 border border-spectra/20 rounded" value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)}>
                                                <option value="">-- Pilih Partner --</option>
                                                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                    </td>
                                    <td className="w-24 bg-daintree px-2 py-1.5 text-[10px] font-bold text-cutty uppercase tracking-wider border-r border-b border-spectra">Gudang</td>
                                    <td className="p-0.5 border-b border-spectra bg-gable relative">
                                        <div className="relative h-full">
                                            <Building2 size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                                            <select className="w-full bg-black/20 text-white text-xs font-bold outline-none pl-7 pr-4 py-1 appearance-none focus:bg-daintree/50 border border-spectra/20 rounded" value={selectedWh} onChange={e => setSelectedWh(e.target.value)}>
                                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                            </select>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="bg-daintree px-2 py-1.5 text-[10px] font-bold text-cutty uppercase tracking-wider border-r border-b border-spectra">Tanggal</td>
                                    <td className="p-0.5 border-r border-b border-spectra bg-gable relative">
                                        <div className="relative h-full">
                                            <Calendar size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-black/20 text-white text-xs font-bold outline-none pl-7 py-1 focus:bg-daintree/50 border border-spectra/20 rounded" />
                                        </div>
                                    </td>
                                    <td className="bg-daintree px-2 py-1.5 text-[10px] font-bold text-cutty uppercase tracking-wider border-r border-b border-spectra">Ref No.</td>
                                    <td className="p-0.5 border-b border-spectra bg-gable relative">
                                        <div className="relative h-full">
                                            <Hash size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                                            <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="w-full bg-black/20 font-mono text-emerald-400 text-xs font-bold outline-none pl-7 py-1 uppercase focus:bg-daintree/50 border border-spectra/20 rounded" />
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="bg-daintree px-2 py-1.5 text-[10px] font-bold text-cutty uppercase tracking-wider border-r border-spectra">Memo</td>
                                    <td colSpan={3} className="p-0.5 bg-gable relative">
                                        <div className="relative h-full">
                                            <StickyNote size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-cutty pointer-events-none z-10"/>
                                            <input type="text" placeholder="Keterangan..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-black/20 text-white text-xs font-bold outline-none pl-7 py-1 focus:bg-daintree/50 border border-spectra/20 rounded" />
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div className="col-span-2 pl-2 border-l border-spectra/50 flex flex-col justify-center">
                     <div className="bg-daintree rounded-lg border border-spectra p-2 flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-cutty uppercase">
                            <span>Lines</span>
                            <span className="text-white font-mono">{lines.length}</span>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportExcel} />
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isImporting}
                            className="w-full py-1 bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 rounded text-[9px] font-black uppercase flex items-center justify-center gap-1 hover:bg-emerald-900/40"
                        >
                            {isImporting ? <Loader2 size={10} className="animate-spin"/> : <FileSpreadsheet size={10}/>} Import
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Transaction Grid Table - Dense */}
        <div className="flex-1 bg-gable p-3 overflow-hidden flex flex-col gap-3">
            <div className="flex-1 overflow-auto scrollbar-thin rounded-lg border border-spectra bg-daintree/30 shadow-inner">
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-20 bg-daintree text-cutty text-[10px] font-black uppercase tracking-widest shadow-md">
                        <tr>
                            <th className="px-2 py-1.5 border-b border-spectra w-8 text-center">#</th>
                            <th className="px-2 py-1.5 border-b border-spectra">Item Description</th>
                            <th className="px-2 py-1.5 border-b border-spectra w-24 text-right">Qty</th>
                            <th className="px-2 py-1.5 border-b border-spectra w-20 text-center">Unit</th>
                            <th className="px-2 py-1.5 border-b border-spectra w-28 text-right">Total Base</th>
                            <th className="px-2 py-1.5 border-b border-spectra w-8 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="text-xs text-slate-200">
                        {/* Entry Row */}
                        <tr className="bg-daintree/50 border-b border-spectra sticky top-[28px] z-10 shadow-sm backdrop-blur-sm">
                            <td className="p-1 border-b border-spectra text-center"><Plus size={12} className="text-spectra mx-auto"/></td>
                            <td className="p-1 border-b border-spectra relative">
                                <input 
                                    ref={itemInputRef}
                                    type="text"
                                    className="w-full bg-gable border border-spectra rounded px-2 py-1 outline-none focus:ring-1 focus:ring-spectra font-bold placeholder:text-cutty placeholder:font-normal uppercase text-white text-xs h-7"
                                    placeholder="SCAN / TYPE SKU..."
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
                                    <div ref={dropdownRef} className="absolute left-1 top-full mt-1 w-[400px] bg-gable rounded-lg shadow-2xl border border-spectra z-[100] max-h-48 overflow-y-auto">
                                        {filteredItems.map((it, idx) => {
                                            const stockQty = getStockQty(it.id);
                                            return (
                                                <div 
                                                    key={it.id}
                                                    className={`px-3 py-1.5 cursor-pointer border-b border-spectra/30 text-xs flex justify-between items-center ${idx === selectedIndex ? 'bg-spectra text-white' : 'hover:bg-daintree'}`}
                                                    onMouseDown={(e) => { e.preventDefault(); selectItem(it); }}
                                                    onMouseEnter={() => setSelectedIndex(idx)}
                                                >
                                                    <div>
                                                        <div className="font-bold">{it.code}</div>
                                                        <div className={`text-[10px] ${idx === selectedIndex ? 'text-white/80' : 'text-slate-400'}`}>{it.name}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`text-[9px] font-bold ${stockQty < 0 ? 'text-red-400' : 'text-emerald-400'}`}>Qty: {stockQty}</div>
                                                        <div className={`text-[9px] font-bold px-1 py-0.5 rounded ${idx === selectedIndex ? 'bg-white/20' : 'bg-daintree text-cutty'}`}>{it.baseUnit}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </td>
                            <td className="p-1 border-b border-spectra">
                                <input 
                                    ref={qtyInputRef}
                                    type="number" 
                                    className="w-full bg-gable border border-spectra rounded px-2 py-1 outline-none focus:ring-1 focus:ring-spectra text-right font-mono font-bold text-white text-xs h-7"
                                    placeholder="0"
                                    value={pendingQty} 
                                    onChange={e => setPendingQty(e.target.value)} 
                                    disabled={!pendingItem}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLine(); } }}
                                />
                            </td>
                            <td className="p-1 border-b border-spectra">
                                 <select 
                                    className="w-full bg-gable border border-spectra rounded px-1 py-1 outline-none font-bold text-center text-white text-xs h-7"
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
                            <td className="p-1 border-b border-spectra text-right font-mono text-slate-500 text-[10px]">-</td>
                            <td className="p-1 border-b border-spectra text-center">
                                <button onClick={handleAddLine} disabled={!pendingItem} className="p-1 bg-spectra text-white rounded hover:bg-white hover:text-spectra transition-colors h-7 w-7 flex items-center justify-center"><CornerDownLeft size={12}/></button>
                            </td>
                        </tr>

                        {lines.map((l, i) => {
                            const itemMaster = items.find(it => it.id === l.itemId);
                            return (
                                <tr key={i} className="hover:bg-spectra/5 transition-colors group">
                                    <td className="px-2 py-1 border-b border-spectra/10 text-center text-cutty font-mono text-[10px]">{i + 1}</td>
                                    <td className="px-2 py-1 border-b border-spectra/10">
                                        <div className="font-bold text-slate-200">{l.name}</div>
                                        <div className="text-[9px] text-cutty font-mono">{l.code}</div>
                                    </td>
                                    <td className="px-2 py-1 border-b border-spectra/10">
                                        <input 
                                            type="number"
                                            value={l.qty}
                                            onChange={e => updateLine(i, 'qty', e.target.value)}
                                            className="w-full bg-transparent border-b border-transparent focus:border-spectra outline-none text-right font-bold text-white text-xs py-0.5"
                                        />
                                    </td>
                                    <td className="px-2 py-1 border-b border-spectra/10 text-center">
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
                                    <td className="px-2 py-1 border-b border-spectra/10 text-right font-mono text-cutty text-[10px]">
                                        {(l.qty * (l.ratio || 1)).toLocaleString()}
                                    </td>
                                    <td className="px-2 py-1 border-b border-spectra/10 text-center">
                                        <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                
                {lines.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 pointer-events-none opacity-20">
                        <Package size={32} className="text-spectra"/>
                        <div className="text-xs font-black uppercase text-spectra mt-1 tracking-widest">No Items</div>
                    </div>
                )}
            </div>

            {type === 'IN' && (
                <div className="bg-daintree border border-spectra rounded-lg p-3 flex gap-3 overflow-x-auto h-24 items-center shadow-inner">
                     <button 
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isCompressing}
                        className="flex-shrink-0 w-20 h-full border border-dashed border-spectra rounded bg-gable text-cutty hover:text-white hover:bg-spectra/10 flex flex-col items-center justify-center gap-1 transition-colors"
                    >
                        {isCompressing ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>} 
                        <span className="text-[9px] font-bold">Add Photo</span>
                    </button>
                    <input type="file" multiple accept="image/*" ref={photoInputRef} className="hidden" onChange={handlePhotoUpload} />
                    
                    {attachments.map((img, idx) => (
                        <div key={idx} className="relative group w-20 h-full rounded overflow-hidden border border-spectra bg-black flex-shrink-0">
                            <img src={img} alt="Attachment" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setPreviewImage(img)} className="text-white hover:text-emerald-400"><Eye size={14}/></button>
                                <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-white hover:text-red-400"><Trash2 size={14}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="bg-daintree p-3 border-t border-spectra flex justify-end gap-3 z-20">
            <button onClick={onClose} className="px-4 py-1.5 rounded-lg border border-spectra bg-gable hover:bg-spectra/20 text-slate-300 text-xs font-bold uppercase transition-colors">Batal</button>
            <button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !selectedWh}
                className="px-6 py-1.5 rounded-lg bg-spectra hover:bg-white hover:text-daintree text-white text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
            >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Simpan
            </button>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-8 backdrop-blur-md animate-in fade-in" onClick={() => setPreviewImage(null)}>
              <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
                  <img src={previewImage} alt="Full Preview" className="max-w-full max-h-[80vh] rounded shadow-2xl border border-spectra" />
                  <button onClick={() => setPreviewImage(null)} className="absolute -top-10 right-0 text-white hover:text-red-400"><X size={24}/></button>
                  <button onClick={() => downloadImage(previewImage, attachments.indexOf(previewImage))} className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-4 py-2 bg-spectra text-white rounded-full text-xs font-bold flex items-center gap-2 shadow-lg hover:bg-white hover:text-spectra"><Download size={14}/> Save</button>
              </div>
          </div>
      )}
      <style>{`
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        option { background-color: #193338; }
      `}</style>
    </div>
  );
};
