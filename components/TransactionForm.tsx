import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Item, Transaction, TransactionType, TransactionItem, Partner, Stock } from '../types';
import { StorageService } from '../services/storage';
import { useGlobalData } from '../search/SearchProvider';
import { useFuseSearch } from '../search/useFuseSearch';
import { highlightMatch } from '../search/highlightMatch';
import {
  Plus, Trash2, Save, X, Loader2, Package,
  Search, CornerDownLeft, FileSpreadsheet, ListFilter,
  AlertTriangle, Download,
} from 'lucide-react';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Props {
  type: TransactionType;
  initialData?: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

// FIX #1: Extended line with stable lineId for keying
interface TransactionLine extends TransactionItem {
  lineId: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

// FIX #8: Centralised, deterministic refNo generator (no Math.random collision)
const generateRefNo = (txType: TransactionType): string => {
  const prefix = txType === 'IN' ? 'RI' : 'DO';
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const unique = Date.now().toString().slice(-6);
  return `${prefix}.${ym}.${unique}`;
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export const TransactionForm: React.FC<Props> = ({ type, initialData, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const { masterItems, warehouses: globalWh, partners: globalPts, refreshAll } = useGlobalData();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FIX #7: isEditMode derived — only true if initialData present AND we haven't reset
  const [hasReset, setHasReset] = useState(false);
  const isEditMode = !!initialData && !hasReset;

  // Header State
  const [date, setDate] = useState(initialData?.date ?? new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(initialData?.referenceNo ?? generateRefNo(type));
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialData?.partnerId ?? '');
  const [selectedWh, setSelectedWh] = useState(initialData?.sourceWarehouseId ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');

  // FIX #1: Seed lines with stable lineIds
  const [lines, setLines] = useState<TransactionLine[]>(
    () => (initialData?.items ?? []).map((l, i) => ({
      ...l,
      lineId: (l as any).lineId ?? `init_${i}_${l.itemId}`,
    }))
  );

  // New Entry State
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingQty, setPendingQty] = useState<string>('');
  const [pendingUnit, setPendingUnit] = useState<string>('');
  const [pendingNote, setPendingNote] = useState('');

  // Search State
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Unsaved changes guard
  const [isDirty, setIsDirty] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Refs
  const inlineSearchTriggerRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchModalRef = useRef<HTMLDivElement>(null);

  // Active items for search
  const activeMasterItems = useMemo(
    () => masterItems.filter(i => i.isActive),
    [masterItems]
  );
  const { search } = useFuseSearch(activeMasterItems, { keys: ['code', 'name'], limit: 50 });
  const searchResults = search(searchQuery);

  // FIX #5: stable useEffect — selectedWh in deps avoided by using functional setter
  useEffect(() => {
    StorageService.fetchStocks().then(setStocks).catch(() => {});
    setPartners(
      globalPts.filter(p =>
        (type === 'IN' ? p.type === 'SUPPLIER' : p.type === 'CUSTOMER') && p.isActive
      )
    );
    if (globalWh.length > 0) {
      setSelectedWh(prev => prev || globalWh[0].id);
    }
  }, [globalPts, globalWh, type]);

  // Close search modal on click-outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        searchModalRef.current && !searchModalRef.current.contains(e.target as Node) &&
        inlineSearchTriggerRef.current && !inlineSearchTriggerRef.current.contains(e.target as Node)
      ) {
        setIsSearching(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // FIX #9: O(1) stock lookup via Map — avoid N*find() per render
  const stockMap = useMemo(
    () => new Map(stocks.map(s => [`${s.itemId}__${s.warehouseId}`, Number(s.qty)])),
    [stocks]
  );
  const getStockQty = useCallback(
    (itemId: string) => stockMap.get(`${itemId}__${selectedWh}`) ?? 0,
    [stockMap, selectedWh]
  );

  // FIX #4: Build all unit options for a line correctly (base + conversions, no filter bug)
  const getUnitOptions = useCallback((itemId: string, currentUnit: string): string[] => {
    const item = masterItems.find(it => it.id === itemId);
    if (!item) return [currentUnit];
    const all = [item.baseUnit, ...(item.conversions?.map(c => c.name) ?? [])];
    // Deduplicate while preserving order; keep currentUnit even if not in master
    const set = new Set(all);
    if (!set.has(currentUnit)) set.add(currentUnit);
    return Array.from(set);
  }, [masterItems]);

  const handleSelectItem = (item: Item) => {
    setPendingItem(item);
    setPendingUnit(item.baseUnit);
    setIsSearching(false);
    setSearchQuery('');
    // FIX #10: reset selectedIndex on every new selection
    setSelectedIndex(0);
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const handleCommitLine = useCallback(() => {
    if (!pendingItem) return;
    const qty = Number(pendingQty);
    if (!pendingQty || qty <= 0) {
      qtyInputRef.current?.focus();
      return;
    }

    // IMPROVEMENT: duplicate item warning — allow but notify
    const isDupe = lines.some(l => l.itemId === pendingItem.id);
    if (isDupe) {
      showToast(`⚠ ${pendingItem.name} sudah ada di daftar — baris baru ditambahkan`, 'warning');
    }

    // IMPROVEMENT: OUT stock warning
    if (type === 'OUT') {
      const available = getStockQty(pendingItem.id);
      if (qty > available) {
        showToast(`Stok ${pendingItem.name} tidak cukup (${available.toLocaleString()} tersedia)`, 'warning');
      }
    }

    const newLine: TransactionLine = {
      lineId: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      itemId: pendingItem.id,
      qty,
      unit: pendingUnit || pendingItem.baseUnit,
      ratio: 1,
      name: pendingItem.name,
      code: pendingItem.code,
      note: pendingNote,
    };

    setLines(prev => [...prev, newLine]);
    setIsDirty(true);
    setPendingItem(null); setPendingQty(''); setPendingNote(''); setPendingUnit('');
    setTimeout(() => inlineSearchTriggerRef.current?.focus(), 50);
  }, [pendingItem, pendingQty, pendingUnit, pendingNote, lines, type, getStockQty, showToast]);

  // FIX #3: immutable updateLine
  const updateLine = useCallback((lineId: string, field: keyof TransactionLine, value: any) => {
    setLines(prev =>
      prev.map(l => l.lineId === lineId ? { ...l, [field]: value } : l)
    );
    setIsDirty(true);
  }, []);

  // FIX #12: delete by lineId
  const deleteLine = useCallback((lineId: string) => {
    setLines(prev => prev.filter(l => l.lineId !== lineId));
    setIsDirty(true);
  }, []);

  // ── Navigation ──
  const handleGridKeyDown = (e: React.KeyboardEvent, rowIndex: number, field: string) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex > 0) document.getElementById(`input-${rowIndex - 1}-${field}`)?.focus();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex < lines.length - 1) {
        document.getElementById(`input-${rowIndex + 1}-${field}`)?.focus();
      } else {
        if (field === 'qty') qtyInputRef.current?.focus();
        else if (field === 'note') noteInputRef.current?.focus();
        else inlineSearchTriggerRef.current?.focus();
      }
    }
    if (e.key === 'Enter' && field === 'note') {
      e.preventDefault();
      inlineSearchTriggerRef.current?.focus();
    }
  };

  const handleNewEntryKeyDown = (e: React.KeyboardEvent, field: 'search' | 'qty' | 'note') => {
    if (e.key === 'ArrowUp') {
      if (field === 'search' && isSearching) {
        e.preventDefault();
        // FIX #11: no wrap-around — clamp at 0
        setSelectedIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (lines.length > 0) {
        e.preventDefault();
        const mappedField = field === 'search' ? 'note' : field;
        document.getElementById(`input-${lines.length - 1}-${mappedField}`)?.focus();
      }
    }
    if (e.key === 'ArrowDown') {
      if (field === 'search' && isSearching) {
        e.preventDefault();
        // FIX #11: no wrap-around — clamp at last
        setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
        return;
      }
      if (field === 'qty' || field === 'note') {
        e.preventDefault();
        handleCommitLine();
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'search' && isSearching) {
        if (searchResults[selectedIndex]) handleSelectItem(searchResults[selectedIndex]);
      } else if (field === 'qty' || field === 'note') {
        handleCommitLine();
      }
    }
    if (e.key === 'Escape') setIsSearching(false);
  };

  // ── Excel Template Download ──
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { sku: 'KODE001', nama_barang: 'Contoh Barang 1', qty: 10, satuan: 'Pcs', catatan: '' },
      { sku: 'KODE002', nama_barang: 'Contoh Barang 2', qty: 5,  satuan: 'Box', catatan: 'Fragile' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `Template_Import_${type}.xlsx`);
  };

  // ── Excel Import ──
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
        if (data.length === 0) return showToast('File Excel tidak berisi data', 'warning');

        const newItemsToCreate: Item[] = [];
        const importLines: TransactionLine[] = [];
        let skippedCount = 0;

        for (const row of data) {
          const sku  = String(row.sku || row.SKU || row.KODE || row.kode || '').trim().toUpperCase();
          const name = String(row.nama_barang || row.nama || row.Nama || row['Nama Barang'] || '').trim();
          const qty  = Number(row.qty || row.QTY || row.jumlah || row.Kuantitas || 0);
          const unit = String(row.satuan || row.unit || row.Unit || 'Pcs').trim();
          const note = String(row.catatan || row.keterangan || row.note || '').trim();

          if (!sku || isNaN(qty) || qty <= 0) { skippedCount++; continue; }

          let item = masterItems.find(mi => mi.code === sku)
            ?? newItemsToCreate.find(ni => ni.code === sku);

          if (!item) {
            item = {
              id: crypto.randomUUID(), code: sku, name: name || `SKU ${sku}`,
              category: 'AUTO-IMPORT', baseUnit: unit, conversions: [], minStock: 0, isActive: true,
            };
            newItemsToCreate.push(item);
          }

          // FIX #14: validate unit against item conversions
          const validUnits = [item.baseUnit, ...(item.conversions?.map(c => c.name) ?? [])];
          const resolvedUnit = validUnits.includes(unit) ? unit : item.baseUnit;
          const ratio = resolvedUnit === item.baseUnit
            ? 1
            : (item.conversions?.find(c => c.name === resolvedUnit)?.ratio ?? 1);

          importLines.push({
            lineId: `import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            itemId: item.id, qty, unit: resolvedUnit, ratio,
            name: item.name, code: item.code,
            note: note || 'Import Excel',
          });
        }

        if (newItemsToCreate.length > 0) {
          await StorageService.bulkSaveItems(newItemsToCreate);
          await refreshAll();
        }

        setLines(prev => [...prev, ...importLines]);
        setIsDirty(true);

        const msg = skippedCount > 0
          ? `${importLines.length} item diimpor, ${skippedCount} baris dilewati (SKU/qty kosong)`
          : `${importLines.length} item berhasil diimpor`;
        showToast(msg, skippedCount > 0 ? 'warning' : 'success');
        e.target.value = '';
      } catch {
        showToast('Gagal membaca file Excel.', 'error');
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // ── Save ──
  const handleSave = async (keepOpen = false) => {
    if (lines.length === 0) return showToast('Tambahkan minimal 1 barang', 'warning');
    if (!selectedPartnerId)  return showToast('Pilih partner transaksi', 'warning');
    if (!selectedWh)         return showToast('Pilih gudang', 'warning');

    setIsSubmitting(true);
    try {
      // FIX #13: include partnerName in payload
      const partnerName = partners.find(p => p.id === selectedPartnerId)?.name ?? '';
      const txData = {
        date, referenceNo: refNo, type,
        sourceWarehouseId: selectedWh,
        partnerId: selectedPartnerId,
        partnerName,
        items: lines.map(l => ({
          item_id: l.itemId, qty: l.qty, unit: l.unit, conversionRatio: l.ratio, note: l.note,
        })),
        notes, attachments: [],
      };

      if (isEditMode && initialData) {
        await StorageService.updateTransaction(initialData.id, txData as any);
      } else {
        await StorageService.commitTransaction({ ...txData, id: crypto.randomUUID() } as any);
      }

      showToast('Transaksi Berhasil Disimpan', 'success');

      if (keepOpen) {
        // FIX #8: use centralised generateRefNo
        setLines([]);
        setNotes('');
        setSelectedPartnerId('');
        setPendingItem(null); setPendingQty(''); setPendingNote(''); setPendingUnit(''); setSearchQuery('');
        setHasReset(true);
        setIsDirty(false);
        setRefNo(generateRefNo(type));
        StorageService.fetchStocks().then(setStocks).catch(() => {});
        setTimeout(() => inlineSearchTriggerRef.current?.focus(), 100);
      } else {
        onSuccess();
      }
    } catch (e) {
      // FIX #2: safe error typing
      showToast(e instanceof Error ? e.message : 'Gagal menyimpan transaksi', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close with dirty-check
  const handleClose = () => {
    if (isDirty && lines.length > 0) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  // ── Derived ──
  const totalBaseQty = useMemo(
    () => lines.reduce((acc, l) => acc + l.qty * (l.ratio || 1), 0),
    [lines]
  );

  // Stock warning for pending item in OUT mode
  const pendingStockWarning = useMemo(() => {
    if (type !== 'OUT' || !pendingItem || !pendingQty) return null;
    const available = getStockQty(pendingItem.id);
    const qty = Number(pendingQty);
    if (qty > available) return available;
    return null;
  }, [type, pendingItem, pendingQty, getStockQty]);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#f8fafc] animate-in fade-in duration-300 font-sans relative">

      {/* 1. HEADER ACTION BAR */}
      <div className="bg-white px-4 py-2 border-b border-mist-300 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <Package size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 uppercase tracking-tight">
              {type === 'IN' ? 'Penerimaan Barang' : 'Pengiriman Barang'}
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-medium text-slate-500 bg-mist-100 px-1.5 rounded">{refNo}</span>
              {isEditMode && <span className="text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 rounded uppercase">Edit Mode</span>}
              {isDirty && !isEditMode && <span className="text-[9px] font-bold bg-blue-50 text-blue-500 px-1.5 rounded">● Belum disimpan</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} />
          {/* Template download button — FIX #6 */}
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 bg-white hover:bg-mist-50 text-slate-500 border border-mist-300 rounded text-xs font-bold transition-all flex items-center gap-1.5"
            title="Unduh template Excel"
          >
            <Download size={14} /> Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-white hover:bg-mist-50 text-slate-600 border border-mist-300 rounded text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <FileSpreadsheet size={14} /> Import
          </button>
          <div className="w-px h-6 bg-mist-300 mx-1" />
          <button
            onClick={() => handleSave(true)}
            disabled={isSubmitting}
            className="px-3 py-1.5 bg-white hover:bg-mist-50 text-slate-700 border border-mist-300 rounded text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus size={14} /> Simpan & Baru
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-brand hover:bg-brand/90 text-white rounded text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
          </button>
          <button onClick={handleClose} className="p-1.5 hover:bg-mist-100 rounded text-slate-400">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* 2. FORM HEADER */}
        <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-4 gap-3 bg-mist-50 border-b border-mist-200 text-xs shrink-0">
          <div className="space-y-0.5">
            <label className="font-bold text-slate-500 uppercase text-[10px]">Tanggal</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white border border-mist-300 rounded p-1.5 font-medium outline-none focus:border-brand" />
          </div>
          <div className="space-y-0.5">
            <label className="font-bold text-slate-500 uppercase text-[10px]">Gudang</label>
            <select value={selectedWh} onChange={e => setSelectedWh(e.target.value)} className="w-full bg-white border border-mist-300 rounded p-1.5 font-medium outline-none focus:border-brand">
              {globalWh.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="space-y-0.5">
            <label className="font-bold text-slate-500 uppercase text-[10px]">{type === 'IN' ? 'Supplier' : 'Customer'}</label>
            <select value={selectedPartnerId} onChange={e => setSelectedPartnerId(e.target.value)} className="w-full bg-white border border-mist-300 rounded p-1.5 font-medium outline-none focus:border-brand">
              <option value="">-- Pilih --</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-0.5">
            <label className="font-bold text-slate-500 uppercase text-[10px]">Catatan Global</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-white border border-mist-300 rounded p-1.5 font-medium outline-none focus:border-brand" placeholder="Keterangan..." />
          </div>
        </div>

        {/* 3. SPREADSHEET GRID */}
        <div className="flex-1 bg-white overflow-auto relative">
          <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
            <thead className="bg-mist-300 text-[10px] font-bold text-slate-700 sticky top-0 z-10 border-b border-mist-300 shadow-sm h-7">
              <tr>
                <th className="px-2 w-8 text-center">#</th>
                <th className="px-2">Nama Barang / SKU</th>
                <th className="px-2 w-20 text-right">Stok</th>
                <th className="px-2 w-20 text-right bg-brand/5 text-brand">Kuantitas</th>
                <th className="px-2 w-20 text-center">Satuan</th>
                <th className="px-2 w-24 text-right">Total Base</th>
                <th className="px-2 w-48">Catatan Baris</th>
                <th className="px-2 w-8 text-center">Act</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist-50 text-[11px]">
              {/* FIX #1: key by lineId */}
              {lines.map((l, i) => {
                const stockQty = getStockQty(l.itemId);
                const isOverStock = type === 'OUT' && l.qty > stockQty;
                const unitOptions = getUnitOptions(l.itemId, l.unit); // FIX #4

                return (
                  <tr key={l.lineId} className={`h-7 group ${isOverStock ? 'bg-rose-50/40' : 'hover:bg-mist-50'}`}>
                    <td className="px-2 text-center text-slate-400">{i + 1}</td>
                    <td className="px-2 truncate">
                      <span className="font-semibold text-slate-700">{l.name}</span>
                      <span className="ml-2 text-[10px] text-slate-400 font-mono">{l.code}</span>
                    </td>
                    {/* IMPROVEMENT: red stock cell if over */}
                    <td className={`px-2 text-right font-mono ${isOverStock ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                      {isOverStock && <AlertTriangle size={9} className="inline mr-1 mb-0.5 text-rose-400" />}
                      {stockQty.toLocaleString()}
                    </td>
                    <td className="p-0">
                      <input
                        id={`input-${i}-qty`}
                        type="number"
                        value={l.qty}
                        onChange={e => updateLine(l.lineId, 'qty', Number(e.target.value))}
                        onKeyDown={e => handleGridKeyDown(e, i, 'qty')}
                        className={`w-full h-full bg-transparent text-right px-2 font-bold outline-none focus:bg-blue-50 ${isOverStock ? 'text-rose-600' : 'text-slate-800'}`}
                      />
                    </td>
                    {/* FIX #4: all unit options rendered correctly */}
                    <td className="p-0">
                      <select
                        value={l.unit}
                        onChange={e => updateLine(l.lineId, 'unit', e.target.value)}
                        className="w-full h-full bg-transparent text-center px-1 outline-none appearance-none focus:bg-blue-50 cursor-pointer text-[10px]"
                      >
                        {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-2 text-right font-mono text-slate-600">
                      {(l.qty * (l.ratio || 1)).toLocaleString()}
                    </td>
                    <td className="p-0">
                      <input
                        id={`input-${i}-note`}
                        type="text"
                        value={l.note || ''}
                        onChange={e => updateLine(l.lineId, 'note', e.target.value)}
                        onKeyDown={e => handleGridKeyDown(e, i, 'note')}
                        className="w-full h-full bg-transparent px-2 text-slate-600 italic outline-none focus:bg-blue-50 truncate"
                        placeholder="..."
                      />
                    </td>
                    <td className="px-0 text-center">
                      {/* FIX #12: delete by lineId */}
                      <button
                        onClick={() => deleteLine(l.lineId)}
                        className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* NEW ENTRY ROW */}
              <tr className="bg-emerald-50/30 h-8 border-b border-mist-200">
                <td className="px-2 text-center font-bold text-[9px] text-emerald-600">BARU</td>
                <td className="p-0 relative">
                  <div className="relative w-full h-full">
                    <input
                      ref={inlineSearchTriggerRef}
                      type="text"
                      placeholder="Ketik nama / kode barang..."
                      value={pendingItem ? pendingItem.name : searchQuery}
                      onChange={e => {
                        if (pendingItem) setPendingItem(null);
                        setSearchQuery(e.target.value);
                        // FIX #10: reset selectedIndex on query change
                        setSelectedIndex(0);
                        setIsSearching(true);
                      }}
                      onKeyDown={e => handleNewEntryKeyDown(e, 'search')}
                      onFocus={() => { if (searchQuery) setIsSearching(true); }}
                      className={`w-full h-full px-2 text-[11px] outline-none bg-transparent placeholder:text-slate-400 ${pendingItem ? 'font-bold text-slate-800' : 'font-normal'}`}
                      autoComplete="off"
                    />
                    {pendingItem && (
                      <button
                        onClick={() => { setPendingItem(null); setSearchQuery(''); inlineSearchTriggerRef.current?.focus(); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </td>
                {/* Stock of pending item */}
                <td className={`px-2 text-right font-mono text-[11px] ${pendingStockWarning !== null ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                  {pendingItem ? (
                    <>
                      {pendingStockWarning !== null && <AlertTriangle size={9} className="inline mr-0.5 mb-0.5" />}
                      {getStockQty(pendingItem.id).toLocaleString()}
                    </>
                  ) : '-'}
                </td>
                <td className="p-0 relative">
                  <input
                    ref={qtyInputRef}
                    type="number"
                    placeholder="0"
                    disabled={!pendingItem}
                    value={pendingQty}
                    onChange={e => setPendingQty(e.target.value)}
                    onKeyDown={e => handleNewEntryKeyDown(e, 'qty')}
                    className={`w-full h-full bg-white text-right px-2 font-bold outline-none focus:ring-1 focus:ring-inset focus:ring-brand/30 disabled:bg-mist-50 disabled:text-slate-300 ${pendingStockWarning !== null ? 'text-rose-600' : 'text-brand'}`}
                  />
                  {/* IMPROVEMENT: real-time stock warning tooltip */}
                  {pendingStockWarning !== null && (
                    <div className="absolute right-0 -top-5 text-[8px] font-bold text-rose-500 bg-white px-1.5 border border-rose-200 shadow-sm rounded z-10 whitespace-nowrap flex items-center gap-0.5">
                      <AlertTriangle size={8} /> Melebihi stok ({pendingStockWarning.toLocaleString()})
                    </div>
                  )}
                </td>
                {/* Pending unit selector */}
                <td className="p-0">
                  {pendingItem ? (
                    <select
                      value={pendingUnit}
                      onChange={e => setPendingUnit(e.target.value)}
                      className="w-full h-full bg-transparent text-center px-1 outline-none appearance-none focus:bg-blue-50 cursor-pointer text-[10px] font-bold text-slate-600"
                    >
                      {getUnitOptions(pendingItem.id, pendingUnit).map(u =>
                        <option key={u} value={u}>{u}</option>
                      )}
                    </select>
                  ) : (
                    <span className="px-2 text-slate-300 text-[10px]">-</span>
                  )}
                </td>
                <td className="px-2 text-right font-mono text-slate-300 text-[11px]">
                  {pendingItem && pendingQty ? Number(pendingQty).toLocaleString() : '-'}
                </td>
                <td className="p-0">
                  <input
                    ref={noteInputRef}
                    type="text"
                    placeholder="Catatan..."
                    disabled={!pendingItem}
                    value={pendingNote}
                    onChange={e => setPendingNote(e.target.value)}
                    onKeyDown={e => handleNewEntryKeyDown(e, 'note')}
                    className="w-full h-full bg-white px-2 italic text-slate-600 outline-none focus:ring-1 focus:ring-inset focus:ring-brand/30 disabled:bg-mist-50 truncate"
                  />
                </td>
                <td className="text-center p-0">
                  {pendingItem && (
                    <button
                      onClick={handleCommitLine}
                      className="w-full h-full flex items-center justify-center text-emerald-500 hover:bg-emerald-50"
                      title="Simpan Baris (Enter / Arrow Down)"
                    >
                      <CornerDownLeft size={14} />
                    </button>
                  )}
                </td>
              </tr>

              {/* FILLER rows */}
              {[...Array(Math.max(0, 15 - lines.length - 1))].map((_, i) => (
                <tr key={`fill-${i}`} className="h-7"><td colSpan={8} /></tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. FOOTER */}
        <div className="px-4 py-2 bg-mist-50 border-t border-mist-300 flex justify-between items-center text-xs shrink-0">
          <div className="flex gap-6 text-slate-500 font-medium">
            <span>Total Baris: <strong className="text-slate-800">{lines.length}</strong></span>
            <span>
              Total Qty: <strong className="text-slate-800">{totalBaseQty.toLocaleString()}</strong>
              <span className="text-[10px] ml-1">BASE</span>
            </span>
            {/* IMPROVEMENT: over-stock count badge */}
            {type === 'OUT' && lines.filter(l => l.qty > getStockQty(l.itemId)).length > 0 && (
              <span className="flex items-center gap-1 text-rose-600 font-bold">
                <AlertTriangle size={10} />
                {lines.filter(l => l.qty > getStockQty(l.itemId)).length} item melebihi stok
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-mist-300"><Search size={10} /> Cari Barang</span>
            <span>→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-mist-300">Pilih</span>
            <span>→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-mist-300">Isi Qty</span>
            <span>→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-mist-300 font-bold">Enter / ↓</span>
            <span>=</span>
            <span className="text-emerald-600 font-bold">Simpan</span>
          </div>
        </div>

        {/* 5. AUTOCOMPLETE MODAL */}
        {isSearching && searchQuery && (
          <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
            <div
              ref={searchModalRef}
              className="pointer-events-auto bg-white w-[650px] max-h-[400px] flex flex-col shadow-2xl border border-mist-300 rounded-lg overflow-hidden animate-in fade-in zoom-in-95"
            >
              <div className="bg-gradient-to-r from-mist-100 to-mist-200 px-3 py-2 border-b border-mist-300 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ListFilter size={14} className="text-slate-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Cari Barang / Item Search</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium">{searchResults.length} hasil</div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead className="bg-mist-50 sticky top-0 z-10">
                    <tr className="border-b border-mist-300 text-[10px] font-bold text-slate-600 uppercase">
                      <th className="px-3 py-1.5 w-32 border-r border-mist-300">Kode Item</th>
                      <th className="px-3 py-1.5 border-r border-mist-300">Nama Barang</th>
                      <th className="px-3 py-1.5 w-24 text-right border-r border-mist-300">Stok</th>
                      <th className="px-3 py-1.5 w-20 text-center">Satuan</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px]">
                    {searchResults.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                          Data tidak ditemukan untuk "{searchQuery}"
                        </td>
                      </tr>
                    ) : (
                      searchResults.map((item, idx) => {
                        const stockQty = getStockQty(item.id);
                        const isLowStock = type === 'OUT' && stockQty === 0;
                        return (
                          <tr
                            key={item.id}
                            onMouseDown={() => handleSelectItem(item)}
                            className={`cursor-pointer border-b border-mist-100 last:border-0 transition-colors ${
                              idx === selectedIndex ? 'bg-blue-600 text-white' : 'hover:bg-mist-50 text-slate-700'
                            }`}
                          >
                            <td className={`px-3 py-1.5 font-mono ${idx === selectedIndex ? 'text-blue-100' : 'text-slate-500'}`}>
                              {highlightMatch(item.code, searchQuery)}
                            </td>
                            <td className="px-3 py-1.5 font-bold truncate">
                              {highlightMatch(item.name, searchQuery)}
                            </td>
                            {/* IMPROVEMENT: zero-stock highlight in search modal */}
                            <td className={`px-3 py-1.5 text-right font-mono ${
                              idx === selectedIndex ? 'text-white' : isLowStock ? 'text-rose-400 font-bold' : 'text-slate-600'
                            }`}>
                              {stockQty.toLocaleString()}
                              {isLowStock && idx !== selectedIndex && (
                                <span className="ml-1 text-[8px] bg-rose-100 text-rose-600 px-1 rounded">KOSONG</span>
                              )}
                            </td>
                            <td className={`px-3 py-1.5 text-center font-bold text-[9px] uppercase ${idx === selectedIndex ? 'text-blue-200' : 'text-slate-400'}`}>
                              {item.baseUnit}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-mist-50 px-3 py-1.5 border-t border-mist-200 text-[9px] text-slate-400 flex justify-between items-center">
                <span>Gunakan <strong>↑ ↓</strong> untuk navigasi, <strong>Enter</strong> untuk memilih, <strong>Esc</strong> untuk tutup.</span>
                <span className="font-mono">{Math.min(selectedIndex + 1, searchResults.length)} / {searchResults.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CLOSE CONFIRMATION — unsaved changes guard */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/20 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-mist-200 p-6 w-80 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Tutup tanpa menyimpan?</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Ada <strong>{lines.length} baris</strong> yang belum disimpan. Data akan hilang jika Anda keluar sekarang.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-mist-100 rounded transition-colors"
              >
                Kembali
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600 rounded transition-colors"
              >
                Keluar tanpa simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
