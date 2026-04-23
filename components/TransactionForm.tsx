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

interface TransactionLine extends TransactionItem {
  lineId: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
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

  const [hasReset, setHasReset] = useState(false);
  const isEditMode = !!initialData && !hasReset;

  // Header State
  const [date, setDate] = useState(initialData?.date ?? new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(initialData?.referenceNo ?? generateRefNo(type));
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialData?.partnerId ?? '');
  const [selectedWh, setSelectedWh] = useState(initialData?.sourceWarehouseId ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');

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

  const masterItemMap = useMemo(
    () => new Map(masterItems.map(i => [i.id, i])),
    [masterItems]
  );

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

  // O(1) stock lookup via Map
  const stockMap = useMemo(
    () => new Map(stocks.map(s => [`${s.itemId}__${s.warehouseId}`, Number(s.qty)])),
    [stocks]
  );
  const getStockQty = useCallback(
    (itemId: string) => stockMap.get(`${itemId}__${selectedWh}`) ?? 0,
    [stockMap, selectedWh]
  );

  const getUnitOptions = useCallback((itemId: string, currentUnit: string): string[] => {
    const item = masterItemMap.get(itemId);
    if (!item) return [currentUnit];
    const all = [item.baseUnit, ...(item.conversions?.map(c => c.name) ?? [])];
    const set = new Set(all);
    if (!set.has(currentUnit)) set.add(currentUnit);
    return Array.from(set);
  }, [masterItemMap]);

  const resolveRatio = useCallback((item: Item, unit: string): number => {
    if (unit === item.baseUnit) return 1;
    return item.conversions?.find(c => c.name === unit)?.ratio ?? 1;
  }, []);

  const handleSelectItem = (item: Item) => {
    setPendingItem(item);
    setPendingUnit(item.baseUnit);
    setIsSearching(false);
    setSearchQuery('');
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

    const isDupe = lines.some(l => l.itemId === pendingItem.id);
    if (isDupe) {
      showToast(`⚠ ${pendingItem.name} sudah ada di daftar — baris baru ditambahkan`, 'warning');
    }

    if (type === 'OUT') {
      const available = getStockQty(pendingItem.id);
      const resolvedUnit = pendingUnit || pendingItem.baseUnit;
      const ratio = resolveRatio(pendingItem, resolvedUnit);
      const baseQty = qty * ratio;
      if (baseQty > available) {
        showToast(`Stok ${pendingItem.name} tidak cukup (${available.toLocaleString()} tersedia)`, 'warning');
      }
    }

    const resolvedUnit = pendingUnit || pendingItem.baseUnit;
    const resolvedRatio = resolveRatio(pendingItem, resolvedUnit);

    const newLine: TransactionLine = {
      lineId: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      itemId: pendingItem.id,
      qty,
      unit: resolvedUnit,
      ratio: resolvedRatio,
      name: pendingItem.name,
      code: pendingItem.code,
      note: pendingNote,
    };

    setLines(prev => [...prev, newLine]);
    setIsDirty(true);
    setPendingItem(null); setPendingQty(''); setPendingNote(''); setPendingUnit('');
    setTimeout(() => inlineSearchTriggerRef.current?.focus(), 50);
  }, [pendingItem, pendingQty, pendingUnit, pendingNote, lines, type, getStockQty, showToast, resolveRatio]);

  const updateLine = useCallback((lineId: string, field: keyof TransactionLine, value: any) => {
    setLines(prev =>
      prev.map(l => l.lineId === lineId ? { ...l, [field]: value } : l)
    );
    setIsDirty(true);
  }, []);

  const updateLineUnit = useCallback((lineId: string, newUnit: string) => {
    setLines(prev =>
      prev.map(l => {
        if (l.lineId !== lineId) return l;
        const item = masterItemMap.get(l.itemId);
        const newRatio = item
          ? (newUnit === item.baseUnit ? 1 : (item.conversions?.find(c => c.name === newUnit)?.ratio ?? 1))
          : 1;
        return { ...l, unit: newUnit, ratio: newRatio };
      })
    );
    setIsDirty(true);
  }, [masterItemMap]);

  const deleteLine = useCallback((lineId: string) => {
    setLines(prev => prev.filter(l => l.lineId !== lineId));
    setIsDirty(true);
  }, []);

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

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { sku: 'KODE001', nama_barang: 'Contoh Barang 1', qty: 10, satuan: 'Pcs', catatan: '' },
      { sku: 'KODE002', nama_barang: 'Contoh Barang 2', qty: 5,  satuan: 'Box', catatan: 'Fragile' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `Template_Import_${type}.xlsx`);
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

  const handleSave = async (keepOpen = false) => {
    if (lines.length === 0) return showToast('Tambahkan minimal 1 barang', 'warning');
    if (!selectedPartnerId)  return showToast('Pilih partner transaksi', 'warning');
    if (!selectedWh)         return showToast('Pilih gudang', 'warning');

    setIsSubmitting(true);
    try {
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
      showToast(e instanceof Error ? e.message : 'Gagal menyimpan transaksi', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  const totalBaseQty = useMemo(
    () => lines.reduce((acc, l) => acc + l.qty * (l.ratio || 1), 0),
    [lines]
  );

  const overStockCount = useMemo(
    () => type === 'OUT'
      ? lines.filter(l => (l.qty * (l.ratio || 1)) > getStockQty(l.itemId)).length
      : 0,
    [lines, type, getStockQty]
  );

  const pendingStockWarning = useMemo(() => {
    if (type !== 'OUT' || !pendingItem || !pendingQty) return null;
    const available = getStockQty(pendingItem.id);
    const qty = Number(pendingQty);
    const ratio = resolveRatio(pendingItem, pendingUnit || pendingItem.baseUnit);
    if (qty * ratio > available) return available;
    return null;
  }, [type, pendingItem, pendingQty, pendingUnit, getStockQty, resolveRatio]);

  // ─────────────────────────────────────────────
  // ACCURATE 5 STYLE CONSTANTS
  // ─────────────────────────────────────────────
  const isIN = type === 'IN';
  const accentColor = isIN ? '#1a6b3a' : '#8b1a1a';
  const accentBg    = isIN ? '#e6f4ec' : '#fdeaea';
  const titleBg     = '#1e3a6e'; // Accurate 5 navy header

  // ─────────────────────────────────────────────
  // RENDER — Accurate 5 Layout
  // ─────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full font-sans relative overflow-hidden"
      style={{ background: '#f0f0f0', fontFamily: "'Segoe UI', Tahoma, sans-serif", fontSize: 12 }}
    >

      {/* ══════════════════════════════════════════
          1. TITLE BAR  (Accurate 5 dark-navy band)
         ══════════════════════════════════════════ */}
      <div
        className="flex items-center justify-between px-3 shrink-0"
        style={{
          background: `linear-gradient(to bottom, #2a4a80, ${titleBg})`,
          height: 36,
          borderBottom: '2px solid #0f2244',
        }}
      >
        {/* Left: icon + title */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded"
            style={{
              width: 22, height: 22,
              background: isIN ? '#2ecc71' : '#e74c3c',
              boxShadow: '0 1px 3px rgba(0,0,0,.4)',
            }}
          >
            <Package size={13} color="#fff" />
          </div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>
            {isIN ? 'Penerimaan Barang (Goods Receipt)' : 'Pengiriman Barang (Delivery Order)'}
          </span>
          <span
            style={{
              background: isIN ? '#2ecc71' : '#e74c3c',
              color: '#fff', fontSize: 9, fontWeight: 700,
              padding: '1px 6px', borderRadius: 3, marginLeft: 4,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            {isIN ? 'IN' : 'OUT'}
          </span>
          {isEditMode && (
            <span style={{ background: '#f39c12', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3, letterSpacing: '0.05em' }}>
              EDIT MODE
            </span>
          )}
          {isDirty && !isEditMode && (
            <span style={{ color: '#ffd700', fontSize: 9, fontWeight: 600 }}>● Belum disimpan</span>
          )}
        </div>
        {/* Right: close */}
        <button
          onClick={handleClose}
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 3, color: '#fff', cursor: 'pointer', width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#c0392b')}
          onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        >
          <X size={13} />
        </button>
      </div>

      {/* ══════════════════════════════════════════
          2. TOOLBAR  (Accurate 5 button strip)
         ══════════════════════════════════════════ */}
      <div
        className="flex items-center gap-1 px-2 shrink-0"
        style={{
          height: 34,
          background: 'linear-gradient(to bottom, #f5f5f5, #e8e8e8)',
          borderBottom: '1px solid #b8b8b8',
        }}
      >
        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} />

        <ToolbarButton
          icon={<FileSpreadsheet size={13} />}
          label="Import Excel"
          onClick={() => fileInputRef.current?.click()}
        />
        <ToolbarButton
          icon={<Download size={13} />}
          label="Download Template"
          onClick={handleDownloadTemplate}
        />

        <ToolbarDivider />

        {/* Ref No display */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: '#fff', border: '1px solid #c8c8c8', borderRadius: 2,
            padding: '1px 8px', fontSize: 10, fontFamily: 'Consolas, monospace',
            color: '#333', height: 22,
          }}
        >
          <span style={{ color: '#888', marginRight: 2 }}>No:</span>
          <strong>{refNo}</strong>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          3. FORM HEADER  (Accurate 5 field panel)
         ══════════════════════════════════════════ */}
      <div
        className="shrink-0 px-3 py-2"
        style={{
          background: '#fafafa',
          borderBottom: '1px solid #c0c0c0',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr', gap: '0 12px' }}>
          <AccField label="Tanggal">
            <input
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setIsDirty(true); }}
              style={accInput}
            />
          </AccField>
          <AccField label="Gudang">
            <select
              value={selectedWh}
              onChange={e => { setSelectedWh(e.target.value); setIsDirty(true); }}
              style={accInput}
            >
              {globalWh.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </AccField>
          <AccField label={isIN ? 'Supplier' : 'Customer'}>
            <select
              value={selectedPartnerId}
              onChange={e => { setSelectedPartnerId(e.target.value); setIsDirty(true); }}
              style={accInput}
            >
              <option value="">-- Pilih --</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </AccField>
          <AccField label="Keterangan">
            <input
              type="text"
              value={notes}
              onChange={e => { setNotes(e.target.value); setIsDirty(true); }}
              style={accInput}
              placeholder="Catatan transaksi..."
            />
          </AccField>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          4. SPREADSHEET GRID  (Accurate 5 table)
         ══════════════════════════════════════════ */}
      <div className="flex-1 overflow-auto relative" style={{ background: '#fff' }}>
        <table
          style={{
            width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed',
            minWidth: 820, fontSize: 11,
          }}
        >
          {/* Grid Header */}
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ height: 22, background: 'linear-gradient(to bottom, #3a6ea8, #2d5a8c)', userSelect: 'none' }}>
              {[
                { label: '#',            width: 32,  align: 'center' },
                { label: 'Kode',         width: 90,  align: 'left'   },
                { label: 'Nama Barang',  width: undefined, align: 'left' },
                { label: 'Stok',         width: 80,  align: 'right'  },
                { label: 'Qty',          width: 80,  align: 'right', highlight: true },
                { label: 'Satuan',       width: 70,  align: 'center' },
                { label: 'Total Base',   width: 90,  align: 'right'  },
                { label: 'Catatan',      width: 160, align: 'left'   },
                { label: '',             width: 28,  align: 'center' },
              ].map((col, ci) => (
                <th
                  key={ci}
                  style={{
                    width: col.width, textAlign: col.align as any,
                    color: col.highlight ? '#ffd700' : '#e8eef8',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.03em',
                    padding: '0 6px',
                    borderRight: ci < 8 ? '1px solid rgba(255,255,255,0.15)' : undefined,
                    borderBottom: '2px solid #1e3a6e',
                    textTransform: 'uppercase',
                    background: col.highlight ? 'rgba(255,215,0,0.08)' : undefined,
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* ── Existing Lines ── */}
            {lines.map((l, i) => {
              const stockQty    = getStockQty(l.itemId);
              const isOverStock = type === 'OUT' && (l.qty * (l.ratio || 1)) > stockQty;
              const unitOptions = getUnitOptions(l.itemId, l.unit);
              const isEven      = i % 2 === 0;

              return (
                <tr
                  key={l.lineId}
                  style={{
                    height: 22,
                    background: isOverStock ? '#fff0f0' : isEven ? '#fff' : '#f5f8ff',
                    borderBottom: '1px solid #e0e4ec',
                  }}
                  className="group"
                >
                  {/* # */}
                  <td style={{ ...tdBase, textAlign: 'center', color: '#888', borderRight: cellBorder }}>
                    {i + 1}
                  </td>
                  {/* Kode */}
                  <td style={{ ...tdBase, fontFamily: 'Consolas, monospace', color: '#556', borderRight: cellBorder }}>
                    {l.code}
                  </td>
                  {/* Nama */}
                  <td style={{ ...tdBase, borderRight: cellBorder }}>
                    <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{l.name}</span>
                  </td>
                  {/* Stok */}
                  <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Consolas, monospace', borderRight: cellBorder, color: isOverStock ? '#c0392b' : '#555' }}>
                    {isOverStock && <AlertTriangle size={9} style={{ display: 'inline', marginRight: 2, marginBottom: 1, color: '#e74c3c' }} />}
                    {stockQty.toLocaleString()}
                  </td>
                  {/* Qty — editable */}
                  <td style={{ padding: 0, borderRight: cellBorder, background: 'rgba(255,215,0,0.04)' }}>
                    <input
                      id={`input-${i}-qty`}
                      type="number"
                      min="0"
                      value={l.qty}
                      onChange={e => updateLine(l.lineId, 'qty', Number(e.target.value))}
                      onKeyDown={e => handleGridKeyDown(e, i, 'qty')}
                      style={{
                        width: '100%', height: '100%', border: 'none', background: 'transparent',
                        textAlign: 'right', padding: '0 6px', fontSize: 11,
                        fontWeight: 700, outline: 'none',
                        color: isOverStock ? '#c0392b' : '#1a3a6e',
                        fontFamily: 'Consolas, monospace',
                      }}
                      onFocus={e => (e.currentTarget.style.background = '#fffde7')}
                      onBlur={e => (e.currentTarget.style.background = 'transparent')}
                    />
                  </td>
                  {/* Satuan */}
                  <td style={{ padding: 0, borderRight: cellBorder }}>
                    <select
                      value={l.unit}
                      onChange={e => updateLineUnit(l.lineId, e.target.value)}
                      style={{
                        width: '100%', height: '100%', border: 'none', background: 'transparent',
                        textAlign: 'center', fontSize: 10, fontWeight: 600, outline: 'none',
                        color: '#444', cursor: 'pointer', appearance: 'none',
                      }}
                    >
                      {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  {/* Total Base */}
                  <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Consolas, monospace', color: '#333', borderRight: cellBorder }}>
                    {(l.qty * (l.ratio || 1)).toLocaleString()}
                  </td>
                  {/* Catatan */}
                  <td style={{ padding: 0, borderRight: cellBorder }}>
                    <input
                      id={`input-${i}-note`}
                      type="text"
                      value={l.note || ''}
                      onChange={e => updateLine(l.lineId, 'note', e.target.value)}
                      onKeyDown={e => handleGridKeyDown(e, i, 'note')}
                      style={{
                        width: '100%', height: '100%', border: 'none', background: 'transparent',
                        padding: '0 6px', fontSize: 11, fontStyle: 'italic',
                        outline: 'none', color: '#666',
                      }}
                      placeholder="..."
                      onFocus={e => (e.currentTarget.style.background = '#f0f8ff')}
                      onBlur={e => (e.currentTarget.style.background = 'transparent')}
                    />
                  </td>
                  {/* Delete */}
                  <td style={{ textAlign: 'center', padding: 0 }}>
                    <button
                      onClick={() => deleteLine(l.lineId)}
                      style={{
                        display: 'none', background: 'none', border: 'none',
                        color: '#c0392b', cursor: 'pointer', padding: '2px 4px',
                      }}
                      className="group-hover:!flex items-center justify-center w-full h-full"
                      title="Hapus baris"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* ── New Entry Row ── */}
            <tr
              style={{
                height: 24,
                background: '#f0fff4',
                borderTop: '2px solid #27ae60',
                borderBottom: '1px solid #a3d9b5',
              }}
            >
              {/* # */}
              <td style={{ ...tdBase, textAlign: 'center', borderRight: cellBorder }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: '#27ae60', letterSpacing: '0.05em' }}>BARU</span>
              </td>
              {/* Search (spans Kode + Nama columns) */}
              <td colSpan={2} style={{ padding: 0, borderRight: cellBorder, position: 'relative' }}>
                <div style={{ position: 'relative', height: '100%' }}>
                  <Search size={11} style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', color: '#27ae60', pointerEvents: 'none' }} />
                  <input
                    ref={inlineSearchTriggerRef}
                    type="text"
                    placeholder="Cari kode / nama barang…"
                    value={pendingItem ? pendingItem.name : searchQuery}
                    onChange={e => {
                      if (pendingItem) setPendingItem(null);
                      setSearchQuery(e.target.value);
                      setSelectedIndex(0);
                      setIsSearching(true);
                    }}
                    onKeyDown={e => handleNewEntryKeyDown(e, 'search')}
                    onFocus={() => { if (searchQuery) setIsSearching(true); }}
                    style={{
                      width: '100%', height: '100%', border: 'none', background: 'transparent',
                      paddingLeft: 22, paddingRight: pendingItem ? 22 : 6,
                      fontSize: 11, outline: 'none',
                      fontWeight: pendingItem ? 700 : 400,
                      color: pendingItem ? '#1a3a6e' : '#333',
                    }}
                    autoComplete="off"
                  />
                  {pendingItem && (
                    <button
                      onClick={() => { setPendingItem(null); setSearchQuery(''); inlineSearchTriggerRef.current?.focus(); }}
                      style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </td>
              {/* Stok of pending */}
              <td style={{
                ...tdBase, textAlign: 'right', fontFamily: 'Consolas, monospace', borderRight: cellBorder,
                color: pendingStockWarning !== null ? '#c0392b' : '#888',
              }}>
                {pendingItem ? (
                  <>
                    {pendingStockWarning !== null && <AlertTriangle size={9} style={{ display: 'inline', marginRight: 2 }} />}
                    {getStockQty(pendingItem.id).toLocaleString()}
                  </>
                ) : '—'}
              </td>
              {/* Qty input */}
              <td style={{ padding: 0, borderRight: cellBorder, position: 'relative', background: 'rgba(39,174,96,0.05)' }}>
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="0"
                  placeholder="0"
                  disabled={!pendingItem}
                  value={pendingQty}
                  onChange={e => setPendingQty(e.target.value)}
                  onKeyDown={e => handleNewEntryKeyDown(e, 'qty')}
                  style={{
                    width: '100%', height: '100%', border: 'none',
                    background: 'transparent',
                    textAlign: 'right', padding: '0 6px', fontSize: 11, fontWeight: 700,
                    outline: 'none', fontFamily: 'Consolas, monospace',
                    color: pendingStockWarning !== null ? '#c0392b' : '#1a6b3a',
                  }}
                  onFocus={e => (e.currentTarget.style.background = '#fffde7')}
                  onBlur={e => (e.currentTarget.style.background = 'transparent')}
                />
                {pendingStockWarning !== null && (
                  <div style={{
                    position: 'absolute', bottom: '100%', right: 0, marginBottom: 2,
                    background: '#fff0f0', border: '1px solid #e74c3c', borderRadius: 3,
                    padding: '1px 6px', fontSize: 9, fontWeight: 700, color: '#c0392b',
                    whiteSpace: 'nowrap', zIndex: 20, display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <AlertTriangle size={8} /> Melebihi stok ({pendingStockWarning.toLocaleString()})
                  </div>
                )}
              </td>
              {/* Pending unit */}
              <td style={{ padding: 0, borderRight: cellBorder }}>
                {pendingItem ? (
                  <select
                    value={pendingUnit}
                    onChange={e => setPendingUnit(e.target.value)}
                    style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: 10, fontWeight: 700, outline: 'none', color: '#333', appearance: 'none', cursor: 'pointer' }}
                  >
                    {getUnitOptions(pendingItem.id, pendingUnit).map(u =>
                      <option key={u} value={u}>{u}</option>
                    )}
                  </select>
                ) : (
                  <span style={{ padding: '0 6px', color: '#bbb', fontSize: 10 }}>—</span>
                )}
              </td>
              {/* Total preview */}
              <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'Consolas, monospace', color: '#888', borderRight: cellBorder }}>
                {pendingItem && pendingQty ? Number(pendingQty).toLocaleString() : '—'}
              </td>
              {/* Note */}
              <td style={{ padding: 0, borderRight: cellBorder }}>
                <input
                  ref={noteInputRef}
                  type="text"
                  placeholder="Catatan baris..."
                  disabled={!pendingItem}
                  value={pendingNote}
                  onChange={e => setPendingNote(e.target.value)}
                  onKeyDown={e => handleNewEntryKeyDown(e, 'note')}
                  style={{
                    width: '100%', height: '100%', border: 'none', background: 'transparent',
                    padding: '0 6px', fontSize: 11, fontStyle: 'italic', outline: 'none', color: '#555',
                  }}
                />
              </td>
              {/* Commit */}
              <td style={{ textAlign: 'center', padding: 0 }}>
                {pendingItem && (
                  <button
                    onClick={handleCommitLine}
                    style={{
                      width: '100%', height: '100%', background: 'none', border: 'none',
                      color: '#27ae60', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="Tambah baris (Enter / ↓)"
                  >
                    <CornerDownLeft size={13} />
                  </button>
                )}
              </td>
            </tr>

            {/* Filler rows */}
            {[...Array(Math.max(0, 15 - lines.length - 1))].map((_, i) => (
              <tr key={`fill-${i}`} style={{ height: 22, borderBottom: '1px solid #eef0f5', background: i % 2 === 0 ? '#fff' : '#f5f8ff' }}>
                <td colSpan={9} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════
          5. STATUS BAR  (Accurate 5 footer strip)
         ══════════════════════════════════════════ */}
      <div
        className="shrink-0 flex justify-between items-center px-3"
        style={{
          height: 26,
          background: 'linear-gradient(to bottom, #e8e8e8, #d8d8d8)',
          borderTop: '1px solid #b0b0b0',
          fontSize: 10,
        }}
      >
        {/* Left: summary stats */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', color: '#444' }}>
          <StatusChip label="Total Baris" value={String(lines.length)} />
          <StatusChip label="Total Qty" value={`${totalBaseQty.toLocaleString()} BASE`} />
          {overStockCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#c0392b', fontWeight: 700 }}>
              <AlertTriangle size={9} /> {overStockCount} item melebihi stok
            </span>
          )}
        </div>

        {/* Right: keyboard hints */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', color: '#777' }}>
          {[
            { key: 'Cari Barang', sep: '→' },
            { key: 'Pilih',       sep: '→' },
            { key: 'Isi Qty',     sep: '→' },
            { key: 'Enter / ↓',   sep: '=' },
          ].map(({ key, sep }, i) => (
            <React.Fragment key={i}>
              <span style={{ background: '#fff', border: '1px solid #c0c0c0', borderRadius: 2, padding: '0 4px', fontSize: 9, fontWeight: 600, color: '#333' }}>{key}</span>
              <span style={{ fontSize: 9, color: '#aaa' }}>{sep}</span>
            </React.Fragment>
          ))}
          <span style={{ fontSize: 9, fontWeight: 700, color: '#27ae60' }}>Simpan</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          6. ITEM SEARCH POPUP
         ══════════════════════════════════════════ */}
      {isSearching && searchQuery && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            ref={searchModalRef}
            style={{
              pointerEvents: 'auto',
              background: '#fff',
              width: 680,
              maxHeight: 420,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
              border: '1px solid #b0b8c8',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            {/* Popup header */}
            <div style={{
              background: 'linear-gradient(to bottom, #3a6ea8, #2d5a8c)',
              padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ListFilter size={13} color="#c8d8f0" />
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
                  CARI BARANG — Item Search
                </span>
              </div>
              <span style={{ color: '#a0b8d0', fontSize: 10 }}>{searchResults.length} hasil</span>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                  <tr style={{ background: '#e8eef8', borderBottom: '2px solid #2d5a8c' }}>
                    {[
                      { label: 'Kode Item', width: 120 },
                      { label: 'Nama Barang', width: undefined },
                      { label: 'Stok', width: 90, align: 'right' },
                      { label: 'Satuan', width: 80, align: 'center' },
                    ].map((col, ci) => (
                      <th
                        key={ci}
                        style={{
                          width: col.width, textAlign: (col.align ?? 'left') as any,
                          fontSize: 10, fontWeight: 700, color: '#2d5a8c',
                          padding: '4px 8px', letterSpacing: '0.04em', textTransform: 'uppercase',
                          borderRight: ci < 3 ? '1px solid #ccd4e0' : undefined,
                        }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {searchResults.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#999', fontStyle: 'italic' }}>
                        Tidak ada data untuk "{searchQuery}"
                      </td>
                    </tr>
                  ) : (
                    searchResults.map((item, idx) => {
                      const stockQty  = getStockQty(item.id);
                      const isLow     = type === 'OUT' && stockQty === 0;
                      const isActive  = idx === selectedIndex;

                      return (
                        <tr
                          key={item.id}
                          onMouseDown={() => handleSelectItem(item)}
                          style={{
                            height: 22,
                            background: isActive ? '#2d5a8c' : idx % 2 === 0 ? '#fff' : '#f5f8ff',
                            cursor: 'pointer',
                            borderBottom: '1px solid #e8eef4',
                          }}
                        >
                          <td style={{ padding: '0 8px', fontFamily: 'Consolas, monospace', fontSize: 10, color: isActive ? '#a0c4f0' : '#556', borderRight: '1px solid #e0e8f4' }}>
                            {highlightMatch(item.code, searchQuery)}
                          </td>
                          <td style={{ padding: '0 8px', fontWeight: 600, color: isActive ? '#fff' : '#1a1a2e', borderRight: '1px solid #e0e8f4' }}>
                            {highlightMatch(item.name, searchQuery)}
                          </td>
                          <td style={{
                            padding: '0 8px', textAlign: 'right', fontFamily: 'Consolas, monospace',
                            color: isActive ? '#fff' : isLow ? '#e74c3c' : '#444',
                            fontWeight: isLow ? 700 : 400,
                            borderRight: '1px solid #e0e8f4',
                          }}>
                            {stockQty.toLocaleString()}
                            {isLow && !isActive && (
                              <span style={{ marginLeft: 4, fontSize: 8, background: '#fdeaea', color: '#e74c3c', padding: '0 4px', borderRadius: 2 }}>KOSONG</span>
                            )}
                          </td>
                          <td style={{ padding: '0 8px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: isActive ? '#c8d8f0' : '#777', textTransform: 'uppercase' }}>
                            {item.baseUnit}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Popup footer */}
            <div style={{
              background: '#f0f4f8', borderTop: '1px solid #dde4ee',
              padding: '3px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9,
            }}>
              <span style={{ color: '#666' }}>Gunakan <strong>↑↓</strong> untuk navigasi, <strong>Enter</strong> untuk pilih, <strong>Esc</strong> untuk tutup</span>
              <span style={{ fontFamily: 'Consolas, monospace', color: '#888' }}>
                {Math.min(selectedIndex + 1, searchResults.length)} / {searchResults.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          6b. FLOATING SAVE BAR — pojok bawah kanan
         ══════════════════════════════════════════ */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 28,
          zIndex: 9000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid #c0c8d8',
          borderRadius: 6,
          padding: '6px 10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {/* Indikator belum disimpan */}
        {isDirty && (
          <span style={{ fontSize: 9, color: '#e67e22', fontWeight: 600, marginRight: 4 }}>
            ● Belum disimpan
          </span>
        )}

        {/* Simpan & Baru — biru */}
        <button
          onClick={() => handleSave(true)}
          disabled={isSubmitting}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 14px', height: 30, fontSize: 11, fontWeight: 600,
            background: isSubmitting ? '#90b8e0' : 'linear-gradient(to bottom, #2980b9, #1f6fa0)',
            color: '#fff',
            border: '1px solid #1a5e8a',
            borderRadius: 4,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            opacity: isSubmitting ? 0.7 : 1,
            fontFamily: "'Segoe UI', sans-serif",
            whiteSpace: 'nowrap',
            transition: 'filter 0.1s',
          }}
          onMouseOver={e => { if (!isSubmitting) e.currentTarget.style.filter = 'brightness(1.1)'; }}
          onMouseOut={e => { e.currentTarget.style.filter = 'none'; }}
          title="Simpan lalu buka form baru (Ctrl+Shift+S)"
        >
          <Plus size={13} />
          Simpan &amp; Baru
        </button>

        {/* Simpan — hijau */}
        <button
          onClick={() => handleSave(false)}
          disabled={isSubmitting}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 18px', height: 30, fontSize: 11, fontWeight: 700,
            background: isSubmitting ? '#7dba96' : 'linear-gradient(to bottom, #27ae60, #1e8449)',
            color: '#fff',
            border: '1px solid #176638',
            borderRadius: 4,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 6px rgba(30,132,73,0.35)',
            opacity: isSubmitting ? 0.7 : 1,
            fontFamily: "'Segoe UI', sans-serif",
            whiteSpace: 'nowrap',
            transition: 'filter 0.1s',
          }}
          onMouseOver={e => { if (!isSubmitting) e.currentTarget.style.filter = 'brightness(1.1)'; }}
          onMouseOut={e => { e.currentTarget.style.filter = 'none'; }}
          title="Simpan transaksi (Ctrl+S)"
        >
          {isSubmitting
            ? <Loader2 size={13} className="animate-spin" />
            : <Save size={13} />
          }
          Simpan
        </button>
      </div>

      {/* ══════════════════════════════════════════
          7. CLOSE CONFIRMATION DIALOG
         ══════════════════════════════════════════ */}
      {showCloseConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            background: '#fff',
            borderRadius: 4,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            border: '1px solid #c0c0c0',
            width: 340,
            overflow: 'hidden',
          }}>
            {/* Dialog title bar */}
            <div style={{ background: 'linear-gradient(to bottom, #3a6ea8, #2d5a8c)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} color="#ffd700" />
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Konfirmasi Tutup</span>
            </div>
            {/* Body */}
            <div style={{ padding: '16px 16px 12px' }}>
              <p style={{ fontSize: 12, color: '#333', lineHeight: 1.5, margin: 0 }}>
                Ada perubahan yang <strong>belum disimpan</strong>. Data akan hilang jika Anda keluar sekarang.
              </p>
              <p style={{ fontSize: 11, color: '#e74c3c', marginTop: 6, marginBottom: 0 }}>
                Apakah Anda yakin ingin keluar?
              </p>
            </div>
            {/* Footer buttons */}
            <div style={{ padding: '8px 12px', background: '#f5f5f5', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <DialogButton label="Kembali" onClick={() => setShowCloseConfirm(false)} />
              <DialogButton label="Keluar tanpa simpan" onClick={onClose} danger />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Sub-components & style constants
// ─────────────────────────────────────────────

const cellBorder = '1px solid #dde4f0';
const tdBase: React.CSSProperties = { padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const accInput: React.CSSProperties = {
  width: '100%', fontSize: 11, padding: '2px 5px',
  border: '1px solid #b0b8c8', borderRadius: 2,
  background: '#fff', outline: 'none', height: 22,
  fontFamily: "'Segoe UI', sans-serif",
  color: '#1a1a2e',
};

const ToolbarButton: React.FC<{
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; primary?: boolean;
}> = ({ icon, label, onClick, disabled, primary }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', height: 24, fontSize: 11, fontWeight: primary ? 700 : 500,
      background: primary
        ? 'linear-gradient(to bottom, #3a8a5a, #2e7048)'
        : 'linear-gradient(to bottom, #fafafa, #ebebeb)',
      color: primary ? '#fff' : '#2a2a2a',
      border: primary ? '1px solid #1e6038' : '1px solid #b0b0b0',
      borderRadius: 3, cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      opacity: disabled ? 0.55 : 1,
      fontFamily: "'Segoe UI', sans-serif",
      whiteSpace: 'nowrap',
    }}
    onMouseOver={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.08)'; }}
    onMouseOut={e => { e.currentTarget.style.filter = 'none'; }}
  >
    {icon}
    {label}
  </button>
);

const ToolbarDivider = () => (
  <div style={{ width: 1, height: 20, background: '#c0c0c0', margin: '0 2px' }} />
);

const AccField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <label style={{ fontSize: 9, fontWeight: 700, color: '#6a7a90', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {label}
    </label>
    {children}
  </div>
);

const StatusChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <span style={{ color: '#666' }}>{label}:</span>
    <strong style={{ color: '#1a1a2e', fontFamily: 'Consolas, monospace' }}>{value}</strong>
  </span>
);

const DialogButton: React.FC<{ label: string; onClick: () => void; danger?: boolean }> = ({ label, onClick, danger }) => (
  <button
    onClick={onClick}
    style={{
      padding: '4px 12px', fontSize: 11, fontWeight: danger ? 700 : 500,
      background: danger
        ? 'linear-gradient(to bottom, #e74c3c, #c0392b)'
        : 'linear-gradient(to bottom, #fafafa, #e8e8e8)',
      color: danger ? '#fff' : '#333',
      border: danger ? '1px solid #a93226' : '1px solid #b0b0b0',
      borderRadius: 3, cursor: 'pointer',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      fontFamily: "'Segoe UI', sans-serif",
    }}
    onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
    onMouseOut={e => { e.currentTarget.style.filter = 'none'; }}
  >
    {label}
  </button>
);
