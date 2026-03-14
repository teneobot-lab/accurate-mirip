import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StorageService } from '../services/storage';
import { Item, RejectBatch, RejectItem, Stock } from '../types';
import {
  Trash2, Plus, CornerDownLeft, Loader2, History, MapPin, Search,
  X, Eye, Save, Database, Edit3, Copy, FileSpreadsheet,
  ChevronRight, Filter, AlertCircle, PackageX
} from 'lucide-react';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import ExcelJS from 'exceljs';
import { Decimal } from 'decimal.js';
import { highlightMatch } from '../search/highlightMatch';

// ─────────────────────────────────────────────
// useDebounce hook
// ─────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ─────────────────────────────────────────────
// Extended RejectItem — FIX #6: store raw input explicitly
// ─────────────────────────────────────────────
interface RejectItemExtended extends RejectItem {
  inputQty: number;
  inputUnit: string;
  lineId: string; // FIX #10: stable unique key instead of array index
}

// ─────────────────────────────────────────────
// Outlet input with local state — FIX #7 & #8
// ─────────────────────────────────────────────
interface OutletManagerProps {
  outlets: string[];
  onAdd: (name: string) => void;
  onDelete: (name: string) => void;
  outletToDelete: string | null;
  setOutletToDelete: (v: string | null) => void;
  onConfirmDelete: () => void;
}
const OutletManager: React.FC<OutletManagerProps> = ({
  outlets, onAdd, onDelete, outletToDelete, setOutletToDelete, onConfirmDelete,
}) => {
  const [newOutletName, setNewOutletName] = useState('');

  const handleAdd = () => {
    const trimmed = newOutletName.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewOutletName('');
  };

  return (
    <div className="p-6 max-w-md mx-auto h-full overflow-auto">
      <div className="bg-white border border-mist-300 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-3 bg-mist-50 border-b border-mist-300 flex items-center gap-3">
          <MapPin size={16} className="text-slate-400" />
          <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Master Outlet</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* FIX #7: "TAMBAH" button wired to handler */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nama outlet baru..."
              value={newOutletName}
              onChange={e => setNewOutletName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              className="flex-1 px-3 py-1.5 border border-mist-300 rounded text-[11px] font-semibold outline-none focus:border-blue-400"
            />
            <button
              onClick={handleAdd}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-[11px] font-bold shadow-sm hover:bg-blue-700 transition-colors"
            >
              TAMBAH
            </button>
          </div>
          <div className="space-y-1 divide-y divide-mist-100 border-t border-mist-100">
            {outlets.length === 0 && (
              <p className="py-4 text-center text-[10px] text-slate-400 italic">Belum ada outlet</p>
            )}
            {outlets.map(o => (
              <div key={o} className="py-2 flex justify-between items-center group">
                <span className="text-[11px] font-semibold text-slate-700 uppercase">{o}</span>
                {/* FIX #8: delete button wired to handler */}
                <button
                  onClick={() => setOutletToDelete(o)}
                  className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 rounded p-1 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!outletToDelete}
        title="Hapus Outlet"
        message={`Hapus outlet "${outletToDelete}"? Riwayat reject outlet ini tidak akan terhapus.`}
        onConfirm={onConfirmDelete}
        onCancel={() => setOutletToDelete(null)}
      />
    </div>
  );
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export const RejectView: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY' | 'MASTER_ITEMS' | 'MASTER'>('NEW');
  const [rejectMasterItems, setRejectMasterItems] = useState<Item[]>([]);
  const [outlets, setOutlets] = useState<string[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Master Item States
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState<Partial<Item>>({ code: '', name: '', baseUnit: 'Pcs', conversions: [] });
  const [masterSearch, setMasterSearch] = useState('');
  const debouncedMasterSearch = useDebounce(masterSearch, 300);

  // Entry States
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  // FIX #9: two separate states — inputOutlet for NEW tab, filterOutlet for HISTORY/EXPORT
  const [inputOutlet, setInputOutlet] = useState('');
  const [filterOutlet, setFilterOutlet] = useState('ALL');

  const [rejectLines, setRejectLines] = useState<RejectItemExtended[]>([]);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingUnit, setPendingUnit] = useState('');
  const [pendingQty, setPendingQty] = useState<string>('');
  const [pendingReason, setPendingReason] = useState('');

  const itemInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const reasonInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // History & Export States
  const [batches, setBatches] = useState<RejectBatch[]>([]);
  const [viewingBatch, setViewingBatch] = useState<RejectBatch | null>(null);
  const [historySearch, setHistorySearch] = useState(''); // IMPROVEMENT: history search

  // Delete States
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [masterItemToDelete, setMasterItemToDelete] = useState<string | null>(null);
  const [outletToDelete, setOutletToDelete] = useState<string | null>(null);

  // FIX #11: renamed setter to setExportEnd
  const [exportStart, setExportStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [exportEnd, setExportEnd] = useState(new Date().toISOString().split('T')[0]);

  // ─── FIX #1: useCallback so loadData is stable ───
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // FIX #3: remove individual .catch() so errors surface properly
      const [rmits, ols, bts, stks] = await Promise.all([
        StorageService.fetchRejectMasterItems(),
        StorageService.fetchRejectOutlets(),
        StorageService.fetchRejectBatches(),
        StorageService.fetchStocks(),
      ]);
      setRejectMasterItems(rmits);
      setOutlets(ols);
      setBatches(bts);
      setStocks(stks);
      // FIX #9: only set inputOutlet, not filterOutlet
      setInputOutlet(prev => (ols.length > 0 && !prev) ? ols[0] : prev);
    } catch (e) {
      showToast('Gagal memuat data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Click-outside for item dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        itemInputRef.current && !itemInputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Dropdown position tracking — FIX #12 ───
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  useEffect(() => {
    if (!isDropdownOpen || !itemInputRef.current) return;
    const updatePos = () => {
      const rect = itemInputRef.current!.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 320) });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [isDropdownOpen]);

  const conversionResult = useMemo(() => {
    if (!pendingItem || !pendingQty || isNaN(Number(pendingQty))) return null;
    try {
      const qty = new Decimal(pendingQty);
      if (qty.lte(0)) return null;
      let ratio = new Decimal(1);
      if (pendingUnit !== pendingItem.baseUnit) {
        const conv = pendingItem.conversions?.find(c => c.name === pendingUnit);
        if (conv) {
          const convRatio = new Decimal(conv.ratio);
          ratio = conv.operator === '/' ? new Decimal(1).dividedBy(convRatio) : convRatio;
        } else {
          return { error: 'Unit Invalid' };
        }
      }
      const baseQty = qty.times(ratio).toNumber();
      return { baseQty, unit: pendingItem.baseUnit };
    } catch { return { error: 'Error' }; }
  }, [pendingItem, pendingQty, pendingUnit]);

  const filteredItems = useMemo(() => {
    if (!query || pendingItem) return [];
    const lower = query.toLowerCase();
    return rejectMasterItems.filter(it =>
      (it.isActive !== false) &&
      (it.code.toLowerCase().includes(lower) || it.name.toLowerCase().includes(lower))
    ).slice(0, 10);
  }, [query, rejectMasterItems, pendingItem]);

  const filteredMasterItems = useMemo(() => {
    if (!debouncedMasterSearch) return rejectMasterItems;
    const lower = debouncedMasterSearch.toLowerCase();
    return rejectMasterItems.filter(it =>
      it.code.toLowerCase().includes(lower) || it.name.toLowerCase().includes(lower)
    );
  }, [debouncedMasterSearch, rejectMasterItems]);

  // IMPROVEMENT: filtered + searched history
  const filteredBatches = useMemo(() => {
    const lower = historySearch.toLowerCase().trim();
    return batches.filter(b => {
      const matchOutlet = filterOutlet === 'ALL' || b.outlet === filterOutlet;
      const matchDate = b.date >= exportStart && b.date <= exportEnd;
      const matchSearch = !lower ||
        b.id.toLowerCase().includes(lower) ||
        b.outlet.toLowerCase().includes(lower) ||
        b.items.some(it => it.name.toLowerCase().includes(lower));
      return matchOutlet && matchDate && matchSearch;
    });
  }, [batches, filterOutlet, exportStart, exportEnd, historySearch]);

  const selectItem = (item: Item) => {
    setPendingItem(item);
    setQuery(item.name);
    const savedUnit = localStorage.getItem(`reject_unit_pref_${item.id}`);
    setPendingUnit(savedUnit || item.baseUnit);
    setIsDropdownOpen(false);
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const handleAddLine = () => {
    if (!pendingItem || !conversionResult || 'error' in conversionResult) return;
    if (conversionResult.baseQty <= 0) return showToast('Qty harus > 0', 'warning');

    // FIX #6: store inputQty and inputUnit as explicit fields, not encoded in reason
    const newLine: RejectItemExtended = {
      lineId: `line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      itemId: pendingItem.id,
      sku: pendingItem.code,
      name: pendingItem.name,
      qty: conversionResult.baseQty,
      unit: pendingItem.baseUnit,
      baseQty: conversionResult.baseQty,
      inputQty: Number(pendingQty),
      inputUnit: pendingUnit,
      reason: pendingReason || '',
    };

    localStorage.setItem(`reject_unit_pref_${pendingItem.id}`, pendingUnit);
    setRejectLines(prev => [...prev, newLine]);
    setQuery(''); setPendingItem(null); setPendingQty(''); setPendingReason(''); setPendingUnit('');
    setTimeout(() => itemInputRef.current?.focus(), 50);
  };

  const handleSaveBatch = async () => {
    if (!inputOutlet) return showToast('Pilih outlet', 'warning');
    if (rejectLines.length === 0) return showToast('Item kosong', 'warning');
    try {
      await StorageService.saveRejectBatch({
        id: editingBatchId || `REJ-${Date.now().toString().slice(-6)}`,
        date,
        outlet: inputOutlet,
        createdAt: Date.now(),
        items: rejectLines,
      });
      showToast(editingBatchId ? 'Data Reject Diperbarui' : 'Data Reject Tersimpan', 'success');
      setRejectLines([]);
      setEditingBatchId(null);
      loadData();
      setActiveTab('HISTORY');
    } catch { showToast('Gagal simpan', 'error'); }
  };

  const handleEditBatch = (batch: RejectBatch) => {
    setEditingBatchId(batch.id);
    setDate(batch.date);
    setInputOutlet(batch.outlet); // FIX #9: set inputOutlet, not filterOutlet
    // Backfill lineId for existing batches that may not have it
    setRejectLines((batch.items as RejectItemExtended[]).map((it, i) => ({
      ...it,
      lineId: it.lineId || `legacy_${i}_${it.itemId}`,
      inputQty: it.inputQty ?? it.qty,
      inputUnit: it.inputUnit ?? it.unit,
    })));
    setActiveTab('NEW');
  };

  // IMPROVEMENT: duplicate SKU check
  const handleSaveMasterItem = async () => {
    if (!itemForm.code || !itemForm.name || !itemForm.baseUnit) {
      return showToast('Kode, Nama, dan Satuan Dasar wajib diisi', 'warning');
    }
    // FIX: duplicate check
    const isDuplicate = rejectMasterItems.some(it =>
      it.code.toLowerCase() === itemForm.code!.toLowerCase() && it.id !== editingItem?.id
    );
    if (isDuplicate) return showToast(`SKU "${itemForm.code}" sudah ada`, 'warning');

    try {
      const payload = { ...itemForm, id: editingItem?.id || undefined } as Item;
      await StorageService.saveRejectMasterItem(payload);
      showToast(editingItem ? 'Data barang diperbarui' : 'Barang baru ditambahkan', 'success');
      setShowItemModal(false);
      loadData();
    } catch (error) {
      // FIX #2: safe error typing
      showToast(error instanceof Error ? error.message : 'Gagal menyimpan data', 'error');
    }
  };

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    try {
      await StorageService.deleteRejectBatch(batchToDelete);
      showToast('Riwayat reject dihapus', 'success');
      loadData();
    } catch {
      showToast('Gagal menghapus riwayat', 'error');
    } finally {
      setBatchToDelete(null);
    }
  };

  const handleDeleteMasterItem = async () => {
    if (!masterItemToDelete) return;
    try {
      await StorageService.deleteRejectMasterItem(masterItemToDelete);
      showToast('Master item dihapus', 'success');
      loadData();
    } catch {
      showToast('Gagal menghapus master item', 'error');
    } finally {
      setMasterItemToDelete(null);
    }
  };

  // FIX #8: outlet delete handler
  const handleDeleteOutlet = async () => {
    if (!outletToDelete) return;
    try {
      await StorageService.deleteRejectOutlet(outletToDelete);
      showToast('Outlet dihapus', 'success');
      if (inputOutlet === outletToDelete) setInputOutlet('');
      if (filterOutlet === outletToDelete) setFilterOutlet('ALL');
      loadData();
    } catch {
      showToast('Gagal menghapus outlet', 'error');
    } finally {
      setOutletToDelete(null);
    }
  };

  // Copy uses inputQty/inputUnit — the exact qty the user typed (not converted base qty)
  const handleCopyToClipboard = (batch: RejectBatch) => {
    if (!batch.items?.length) return;
    const d = new Date(batch.date);
    const formattedDate = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`;
    let text = `Data Reject ${batch.outlet} ${formattedDate}\n`;
    batch.items.forEach(it => {
      const ext = it as RejectItemExtended;
      // Always use inputQty/inputUnit (the qty user actually typed), never base qty
      const displayQty  = ext.inputQty  != null ? ext.inputQty  : it.qty;
      const displayUnit = ext.inputUnit != null ? ext.inputUnit : it.unit;
      const qtyStr = `${displayQty} ${displayUnit.toLowerCase()}`;
      const reason = it.reason?.trim().toLowerCase() || '';
      const line = `- ${it.name.toLowerCase()} ${qtyStr}${reason ? ` ${reason}` : ''}`;
      text += `${line}\n`;
    });
    navigator.clipboard.writeText(text.trim())
      .then(() => showToast('Disalin ke clipboard', 'success'))
      .catch(() => showToast('Gagal menyalin', 'error'));
  };

  const handleExportMatrix = async () => {
    if (filteredBatches.length === 0) return showToast('Tidak ada data untuk periode ini', 'warning');
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Matrix Reject');

      const dateList: string[] = [];
      let curr = new Date(exportStart);
      const end = new Date(exportEnd);
      while (curr <= end) {
        dateList.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }

      // Build itemMap — filter non-aktif items, use baseQty always
      const itemMap = new Map<string, any>();
      filteredBatches.forEach(batch => {
        batch.items.forEach(it => {
          // Filter non-aktif: skip if master item exists and isActive === false
          const masterItem = rejectMasterItems.find(mi => mi.id === it.itemId);
          if (masterItem && masterItem.isActive === false) return;

          if (!itemMap.has(it.itemId)) {
            itemMap.set(it.itemId, { code: it.sku, name: it.name, unit: it.unit, dateValues: new Map() });
          }
          const data = itemMap.get(it.itemId)!;
          const currentVal = data.dateValues.get(batch.date) || new Decimal(0);
          // Always use baseQty for matrix export
          data.dateValues.set(batch.date, currentVal.plus(new Decimal(it.baseQty ?? it.qty)));
        });
      });

      const titleRow = sheet.addRow(['LAPORAN REJECT MINGGUAN']);
      titleRow.font = { bold: true, size: 12, name: 'Calibri' };
      titleRow.alignment = { horizontal: 'center' };
      sheet.mergeCells(1, 1, 1, 5 + dateList.length);

      const headers = ['NO', 'KODE', 'NAMA BARANG', 'SATUAN',
        ...dateList.map(d => { const dt = d.split('-'); return `${dt[2]}/${dt[1]}`; }),
        'TOTAL'];
      const headerRow = sheet.addRow(headers);
      sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } };
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };
        cell.font = { bold: true, size: 10, name: 'Calibri' };
        cell.border = { bottom: { style: 'medium' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Sort A-Z by item name before writing rows
      let rowCounter = 1;
      const itemsArray = Array.from(itemMap.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));

      itemsArray.forEach((item, index) => {
        const rowData: any[] = [rowCounter++, item.code, item.name, item.unit];
        let total = new Decimal(0);
        dateList.forEach(d => {
          const qty = item.dateValues.get(d) || new Decimal(0);
          rowData.push(qty.equals(0) ? null : qty.toNumber());
          total = total.plus(qty);
        });
        rowData.push(total.toNumber() || null);
        const row = sheet.addRow(rowData);
        const isLastRow = index === itemsArray.length - 1;
        row.eachCell((cell, colNumber) => {
          if (isLastRow) cell.border = { bottom: { style: 'medium' } };
          cell.font = { name: 'Calibri', size: 10 };
          if (colNumber === 1) cell.alignment = { horizontal: 'center' };
          if (colNumber > 4) {
            cell.alignment = { horizontal: 'right' };
            cell.numFmt = '#,##0.0';
            if (colNumber === rowData.length) {
              cell.font = { bold: true, name: 'Calibri', size: 10 };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
            }
          }
        });
      });

      sheet.columns.forEach((col, idx) => {
        col.width = idx === 0 ? 5 : idx === 1 ? 15 : idx === 2 ? 35 : idx === 3 ? 10 : 8;
      });

      const monthNames = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'];
      const formatD = (dStr: string) => {
        const d = new Date(dStr);
        return `${String(d.getDate()).padStart(2, '0')} ${monthNames[d.getMonth()]}`;
      };
      const startF = formatD(exportStart);
      const endF = formatD(exportEnd);
      const yearF = new Date(exportEnd).getFullYear();
      let outletName = 'SEMUA OUTLET';
      if (filterOutlet && filterOutlet !== 'ALL') outletName = filterOutlet.toUpperCase();
      const fileName = `Laporan Reject Mingguan ${outletName} ${startF} - ${endF} ${yearF}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      // FIX #4: add correct MIME type
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      // FIX #5: revoke URL to prevent memory leak
      window.URL.revokeObjectURL(url);
      showToast('Laporan Berhasil Diekspor', 'success');
    } catch (e) {
      console.error(e);
      showToast('Gagal Export', 'error');
    }
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
      {/* COMPACT TOOLBAR */}
      <div className="h-10 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-2 shrink-0 shadow-md">
        <div className="flex items-center h-full">
          {[
            { id: 'NEW',          label: 'Input',   icon: Plus },
            { id: 'HISTORY',      label: 'Riwayat', icon: History },
            { id: 'MASTER_ITEMS', label: 'Katalog', icon: Database },
            { id: 'MASTER',       label: 'Outlet',  icon: MapPin },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 h-full border-r border-slate-700/50 transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-[inset_0_-3px_0_rgba(255,255,255,0.25)] font-bold'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <tab.icon size={13} />
              <span className="text-[11px] font-semibold uppercase tracking-tight">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pr-2 h-full">
          {/* FIX #9: filterOutlet for HISTORY/EXPORT tabs only */}
          {(activeTab === 'HISTORY') && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded border border-slate-700 shadow-inner">
              <Filter size={10} className="text-slate-400" />
              <select
                value={filterOutlet}
                onChange={e => setFilterOutlet(e.target.value)}
                className="bg-transparent text-[10px] font-bold text-slate-200 outline-none cursor-pointer"
              >
                <option value="ALL">SEMUA OUTLET</option>
                {outlets.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
              </select>
            </div>
          )}

          {activeTab === 'NEW' && (
            <>
              {/* FIX #9: inputOutlet for NEW tab only */}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded border border-slate-700 shadow-inner">
                <MapPin size={10} className="text-slate-400" />
                <select
                  value={inputOutlet}
                  onChange={e => setInputOutlet(e.target.value)}
                  className="bg-transparent text-[10px] font-bold text-slate-200 outline-none cursor-pointer"
                >
                  <option value="">— Pilih Outlet —</option>
                  {outlets.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                </select>
              </div>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] font-semibold text-slate-200 outline-none focus:border-blue-500 shadow-inner [color-scheme:dark]"
              />
              {editingBatchId && (
                <button
                  onClick={() => { setEditingBatchId(null); setRejectLines([]); }}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <X size={13} /> Batal Edit
                </button>
              )}
              <button
                onClick={handleSaveBatch}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Save size={13} /> {editingBatchId ? 'Update' : 'Simpan'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-hidden relative">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-slate-400 gap-2 text-xs font-medium">
            <Loader2 className="animate-spin" size={16} /> Memuat data...
          </div>
        ) : activeTab === 'NEW' ? (
          // ──────────────── TAB: INPUT NEW ────────────────
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="bg-mist-300 sticky top-0 z-10 border-b border-mist-300 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                  <tr className="h-8">
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-10 text-center">#</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase">Barang & SKU</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-28 text-right">Qty Input</th>
                    <th className="px-3 text-[10px] font-bold text-rose-700 uppercase w-24 text-right bg-rose-50">Qty Base</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-20 text-center">Satuan</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase">Catatan / Alasan</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mist-100">
                  {/* FIX #10: use lineId as key instead of array index */}
                  {rejectLines.map((line, idx) => (
                    <tr key={line.lineId} className="h-7 hover:bg-mist-50 group transition-colors">
                      <td className="px-3 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="px-3 truncate">
                        <span className="font-semibold text-slate-700 text-[11px]">{line.name}</span>
                        <span className="ml-2 text-[10px] text-slate-400 font-mono italic">{line.sku}</span>
                      </td>
                      {/* IMPROVEMENT: show original input qty */}
                      <td className="px-3 text-right font-mono text-[11px] text-slate-500">
                        {line.inputQty} <span className="text-[9px] uppercase">{line.inputUnit}</span>
                      </td>
                      <td className="px-3 text-right font-mono font-bold text-rose-600 text-[11px]">
                        {line.qty.toLocaleString()}
                      </td>
                      <td className="px-3 text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{line.unit}</span>
                      </td>
                      <td className="px-3 text-slate-500 italic text-[11px] truncate">{line.reason}</td>
                      <td className="px-3 text-center">
                        <button
                          onClick={() => setRejectLines(prev => prev.filter(l => l.lineId !== line.lineId))}
                          className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* INLINE ENTRY ROW */}
                  <tr className="h-9 bg-emerald-50 border-t-2 border-emerald-300">
                    <td className="px-3 py-1 text-center"><Plus size={13} className="text-emerald-600 mx-auto" /></td>
                    <td className="p-0 relative">
                      <input
                        ref={itemInputRef}
                        type="text"
                        placeholder="Cari barang..."
                        value={query}
                        onChange={e => {
                          setQuery(e.target.value);
                          if (pendingItem) setPendingItem(null);
                          setIsDropdownOpen(true);
                          setSelectedIndex(0);
                        }}
                        onFocus={() => { if (query) setIsDropdownOpen(true); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && filteredItems[selectedIndex]) selectItem(filteredItems[selectedIndex]);
                          if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(p => Math.min(p + 1, filteredItems.length - 1)); }
                          if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(p => Math.max(p - 1, 0)); }
                          if (e.key === 'Escape') setIsDropdownOpen(false);
                        }}
                        className="w-full h-full bg-transparent px-3 text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                        autoComplete="off"
                      />
                      {/* FIX #12: dropdown uses tracked position, not inline getBoundingClientRect */}
                      {isDropdownOpen && query && filteredItems.length > 0 && dropdownPos && (
                        <div
                          ref={dropdownRef}
                          className="fixed bg-white border border-mist-300 shadow-2xl rounded-lg z-[999] overflow-hidden animate-in fade-in slide-in-from-top-1"
                          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
                        >
                          {filteredItems.map((it, idx) => (
                            <div
                              key={it.id}
                              onMouseDown={() => selectItem(it)}
                              onMouseEnter={() => setSelectedIndex(idx)}
                              className={`px-3 py-2 cursor-pointer text-[11px] flex justify-between items-center border-b border-mist-50 last:border-0 ${
                                idx === selectedIndex ? 'bg-blue-600 text-white' : 'hover:bg-mist-50 text-slate-700'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className={`font-semibold truncate ${idx === selectedIndex ? 'text-white' : 'text-slate-700'}`}>
                                  {highlightMatch(it.name, query)}
                                </div>
                                <div className={`text-[10px] font-mono mt-0.5 ${idx === selectedIndex ? 'text-blue-100' : 'text-slate-400'}`}>
                                  {highlightMatch(it.code, query)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${idx === selectedIndex ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                  {it.baseUnit}
                                </span>
                                {idx === selectedIndex && <ChevronRight size={12} className="text-blue-200" />}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    {/* Input qty display column (blank in entry row) */}
                    <td className="p-0" />
                    <td className="p-0 relative">
                      <input
                        ref={qtyInputRef}
                        type="number"
                        placeholder="0"
                        value={pendingQty}
                        onChange={e => setPendingQty(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && reasonInputRef.current?.focus()}
                        disabled={!pendingItem}
                        className="w-full h-full bg-transparent px-3 text-right text-[11px] font-semibold text-emerald-700 outline-none focus:bg-white/50 disabled:bg-transparent disabled:text-slate-300"
                      />
                      {/* FIX #14: format baseQty display */}
                      {conversionResult && !('error' in conversionResult) && (
                        <div className="absolute right-0.5 -top-2.5 text-[8px] font-bold text-emerald-600 bg-white px-1 border border-emerald-100 shadow-sm rounded z-10">
                          = {conversionResult.baseQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </div>
                      )}
                      {conversionResult && 'error' in conversionResult && (
                        <div className="absolute right-0.5 -top-2.5 text-[8px] font-bold text-rose-500 bg-white px-1 border border-rose-100 shadow-sm rounded z-10 flex items-center gap-0.5">
                          <AlertCircle size={8} /> {conversionResult.error}
                        </div>
                      )}
                    </td>
                    <td className="p-0">
                      <select
                        value={pendingUnit}
                        onChange={e => setPendingUnit(e.target.value)}
                        disabled={!pendingItem}
                        className="w-full h-full bg-transparent px-1 text-center text-[10px] font-semibold text-slate-600 outline-none appearance-none cursor-pointer disabled:opacity-30"
                      >
                        {pendingItem ? (
                          <>
                            <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>
                            {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </>
                        ) : <option>-</option>}
                      </select>
                    </td>
                    <td className="p-0">
                      <input
                        ref={reasonInputRef}
                        type="text"
                        placeholder="Tulis alasan..."
                        value={pendingReason}
                        onChange={e => setPendingReason(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddLine()}
                        disabled={!pendingItem}
                        className="w-full h-full bg-transparent px-3 text-[11px] outline-none italic text-slate-500 focus:bg-white/50 disabled:bg-transparent"
                      />
                    </td>
                    <td className="p-0 text-center">
                      <button
                        onClick={handleAddLine}
                        disabled={!pendingItem}
                        className="w-full h-full flex items-center justify-center text-emerald-600 hover:bg-emerald-100 disabled:opacity-30 transition-colors"
                      >
                        <CornerDownLeft size={14} />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>

              {rejectLines.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
                  <PackageX size={32} />
                  <span className="text-xs font-medium">Cari dan tambahkan barang reject di baris bawah</span>
                </div>
              )}
            </div>
          </div>

        ) : activeTab === 'HISTORY' ? (
          // ──────────────── TAB: HISTORY ────────────────
          <div className="h-full flex flex-col">
            <div className="h-9 px-3 border-b border-mist-300 bg-mist-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Periode:</span>
                <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="bg-transparent text-[11px] font-semibold text-slate-600 outline-none w-28" />
                <span className="text-slate-300">-</span>
                {/* FIX #11: use setExportEnd */}
                <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="bg-transparent text-[11px] font-semibold text-slate-600 outline-none w-28" />
                {/* IMPROVEMENT: history search */}
                <div className="relative ml-2">
                  <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari batch/outlet/barang..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="pl-7 pr-7 py-1 bg-white border border-mist-300 rounded text-[10px] font-semibold w-48 outline-none focus:border-blue-400"
                  />
                  {historySearch && (
                    <button onClick={() => setHistorySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={9} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{filteredBatches.length} batch</span>
                <button
                  onClick={handleExportMatrix}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <FileSpreadsheet size={12} /> EXPORT MATRIX
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse table-fixed text-left">
                <thead className="bg-mist-300 sticky top-0 z-10 border-b border-mist-300 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                  <tr className="h-8">
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-32">ID Batch</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-24">Tanggal</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase">Outlet</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-20 text-center">Items</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-24 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mist-100">
                  {filteredBatches.map(b => (
                    <tr key={b.id} className="h-7 hover:bg-blue-50 group transition-colors cursor-pointer">
                      <td className="px-3 text-[11px] font-mono text-blue-600 font-semibold">{b.id}</td>
                      <td className="px-3 text-[11px] text-slate-600 font-medium">{b.date}</td>
                      <td className="px-3 text-[11px] font-bold text-slate-700 uppercase">
                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">{b.outlet}</span>
                      </td>
                      <td className="px-3 text-center text-[11px] font-semibold text-slate-500">{b.items.length}</td>
                      <td className="px-3 text-center">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => setViewingBatch(b)} className="p-1 text-blue-500 hover:bg-blue-100 rounded" title="Lihat Detail"><Eye size={12} /></button>
                          <button onClick={() => handleEditBatch(b)} className="p-1 text-amber-500 hover:bg-amber-100 rounded" title="Edit"><Edit3 size={12} /></button>
                          <button onClick={() => handleCopyToClipboard(b)} className="p-1 text-slate-500 hover:bg-slate-100 rounded" title="Copy Teks"><Copy size={12} /></button>
                          <button onClick={() => setBatchToDelete(b.id)} className="p-1 text-rose-500 hover:bg-rose-100 rounded" title="Hapus"><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredBatches.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-16">
                        <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                          <History size={28} />
                          <span className="text-xs font-medium text-slate-400">
                            {historySearch ? 'Tidak ada batch yang cocok' : 'Tidak ada riwayat pada periode ini'}
                          </span>
                          {historySearch && (
                            <button onClick={() => setHistorySearch('')} className="text-[10px] text-blue-500 hover:underline">
                              Reset pencarian
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        ) : activeTab === 'MASTER_ITEMS' ? (
          // ──────────────── TAB: MASTER ITEMS ────────────────
          <div className="h-full flex flex-col">
            <div className="h-9 px-3 border-b border-mist-300 bg-mist-50 flex items-center justify-between shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="text"
                  placeholder="Cari master barang..."
                  value={masterSearch}
                  onChange={e => setMasterSearch(e.target.value)}
                  className="pl-7 pr-3 py-1 bg-white border border-mist-300 rounded text-[10px] font-semibold w-48 outline-none focus:border-blue-400"
                />
              </div>
              <button
                onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', baseUnit: 'Pcs', conversions: [] }); setShowItemModal(true); }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700 shadow-sm transition-colors"
              >
                + BARANG BARU
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse table-fixed text-left">
                <thead className="bg-mist-300 sticky top-0 z-10 border-b border-mist-300 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                  <tr className="h-8">
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-32">Kode SKU</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase">Nama Produk</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-20 text-center">Unit</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-32">Multi-Unit</th>
                    {/* IMPROVEMENT: Status column */}
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-20 text-center">Status</th>
                    <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-20 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mist-100">
                  {filteredMasterItems.map(item => (
                    <tr key={item.id} className={`h-7 hover:bg-mist-50 group transition-colors ${item.isActive === false ? 'bg-slate-50' : ''}`}>
                      <td className="px-3 text-[11px] font-mono text-slate-500">{item.code}</td>
                      <td className="px-3 text-[11px] font-semibold truncate">
                        <span className={item.isActive === false ? 'text-slate-400 line-through' : 'text-slate-700'}>{item.name}</span>
                      </td>
                      <td className="px-3 text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.baseUnit}</span>
                      </td>
                      <td className="px-3 text-[10px] text-slate-400 truncate italic">
                        {item.conversions?.length ? item.conversions.map(c => c.name).join(', ') : '-'}
                      </td>
                      {/* FIX #13: show active/inactive status */}
                      <td className="px-3 text-center">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          item.isActive === false
                            ? 'bg-slate-50 text-slate-400 border-slate-200'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        }`}>
                          {item.isActive === false ? 'NONAKTIF' : 'AKTIF'}
                        </span>
                      </td>
                      <td className="px-3 text-center">
                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingItem(item); setItemForm({ ...item, conversions: item.conversions ? [...item.conversions] : [] }); setShowItemModal(true); }}
                            className="p-1 text-amber-500 hover:bg-amber-100 rounded" title="Edit"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => setMasterItemToDelete(item.id)}
                            className="p-1 text-rose-400 hover:bg-rose-100 rounded" title="Hapus"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredMasterItems.length === 0 && (
                    <tr><td colSpan={6} className="py-12 text-center text-[10px] text-slate-400 italic">Tidak ada barang ditemukan</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        ) : (
          // ──────────────── TAB: MASTER OUTLET ────────────────
          // FIX #7 & #8: OutletManager component with wired handlers
          <OutletManager
            outlets={outlets}
            onAdd={async (name) => {
              try {
                await StorageService.saveRejectOutlet(name);
                loadData();
              } catch { showToast('Gagal menambah outlet', 'error'); }
            }}
            onDelete={setOutletToDelete}
            outletToDelete={outletToDelete}
            setOutletToDelete={setOutletToDelete}
            onConfirmDelete={handleDeleteOutlet}
          />
        )}
      </div>

      {/* MODAL: MASTER ITEM */}
      {showItemModal && (
        <div className="fixed inset-0 bg-slate-900/10 z-[1000] flex items-center justify-center p-4 backdrop-blur-[1px] animate-in fade-in">
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl border border-mist-300 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 border-b border-mist-200 flex justify-between items-center bg-mist-50">
              <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">
                {editingItem ? 'Edit Barang' : 'Barang Baru'}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Kode SKU</label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 border border-mist-200 rounded text-[11px] font-mono font-semibold uppercase outline-none focus:border-blue-400"
                    value={itemForm.code}
                    onChange={e => setItemForm({ ...itemForm, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Unit Dasar</label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 border border-mist-200 rounded text-[11px] font-semibold uppercase text-center outline-none focus:border-blue-400"
                    value={itemForm.baseUnit}
                    onChange={e => setItemForm({ ...itemForm, baseUnit: e.target.value.toUpperCase() })}
                  />
                </div>
                {/* IMPROVEMENT: isActive toggle in form */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
                  <select
                    className="w-full px-2 py-1.5 border border-mist-200 rounded text-[11px] font-semibold outline-none focus:border-blue-400 bg-white"
                    value={itemForm.isActive === false ? 'false' : 'true'}
                    onChange={e => setItemForm({ ...itemForm, isActive: e.target.value === 'true' })}
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nama Lengkap Barang</label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 border border-mist-200 rounded text-[11px] font-medium text-slate-700 outline-none focus:border-blue-400"
                    value={itemForm.name}
                    onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-mist-100">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Konversi Multi-Unit</h4>
                  <button
                    onClick={() => setItemForm({ ...itemForm, conversions: [...(itemForm.conversions || []), { name: '', ratio: 1, operator: '*' }] })}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    + Tambah Unit
                  </button>
                </div>
                <div className="space-y-2">
                  {(itemForm.conversions || []).map((c, i) => (
                    <div key={i} className="flex gap-2 items-center bg-mist-50 p-2 rounded border border-mist-100">
                      <input
                        type="text" placeholder="BOX"
                        className="w-16 px-1.5 py-1 border border-mist-200 rounded text-[10px] uppercase font-semibold outline-none focus:bg-white"
                        value={c.name}
                        onChange={e => {
                          const next = [...(itemForm.conversions || [])];
                          next[i] = { ...next[i], name: e.target.value.toUpperCase() };
                          setItemForm({ ...itemForm, conversions: next });
                        }}
                      />
                      <select
                        className="px-1.5 py-1 border border-mist-200 rounded text-[10px] font-semibold outline-none bg-white"
                        value={c.operator}
                        onChange={e => {
                          const next = [...(itemForm.conversions || [])];
                          next[i] = { ...next[i], operator: e.target.value as any };
                          setItemForm({ ...itemForm, conversions: next });
                        }}
                      >
                        <option value="*">x</option>
                        <option value="/">/</option>
                      </select>
                      <input
                        type="number" placeholder="Rasio"
                        className="w-16 px-1.5 py-1 border border-mist-200 rounded text-[10px] font-mono font-semibold outline-none text-right focus:bg-white"
                        value={c.ratio}
                        onChange={e => {
                          const next = [...(itemForm.conversions || [])];
                          next[i] = { ...next[i], ratio: Number(e.target.value) };
                          setItemForm({ ...itemForm, conversions: next });
                        }}
                      />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">{itemForm.baseUnit}</span>
                      <button
                        onClick={() => setItemForm({ ...itemForm, conversions: itemForm.conversions?.filter((_, idx) => idx !== i) })}
                        className="ml-auto text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 bg-mist-50 border-t border-mist-200 flex justify-end gap-2">
              <button onClick={() => setShowItemModal(false)} className="px-4 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-mist-200 rounded transition-colors">Batal</button>
              <button onClick={handleSaveMasterItem} className="px-6 py-1.5 bg-blue-600 text-white rounded text-[11px] font-bold shadow-sm hover:bg-blue-700 transition-all active:scale-95">SIMPAN</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL RIWAYAT */}
      {viewingBatch && (
        <div className="fixed inset-0 bg-slate-900/10 z-[1100] flex items-center justify-center p-4 backdrop-blur-[1px] animate-in fade-in">
          <div className="bg-white rounded-lg w-full max-w-xl border border-mist-200 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-4 py-3 bg-mist-50 border-b border-mist-200 flex justify-between items-center">
              <div>
                <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Detail Batch Reject</h3>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  {viewingBatch.id} · {viewingBatch.outlet} · {viewingBatch.date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyToClipboard(viewingBatch)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 border border-blue-500 rounded text-[10px] font-bold text-white hover:bg-blue-700 transition-colors"
                >
                  <Copy size={12} /> COPY TEKS
                </button>
                <button onClick={() => setViewingBatch(null)} className="text-slate-400 hover:text-rose-500"><X size={18} /></button>
              </div>
            </div>
            <div className="overflow-auto custom-scrollbar">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="bg-mist-50 border-b border-mist-200 sticky top-0 uppercase tracking-tighter">
                  <tr className="h-7">
                    <th className="px-3 text-[10px] font-bold text-slate-400 w-10 text-center">#</th>
                    <th className="px-3 text-[10px] font-bold text-slate-400">Nama Barang</th>
                    <th className="px-3 text-[10px] font-bold text-slate-400 w-24 text-right">Input</th>
                    <th className="px-3 text-[10px] font-bold text-slate-400 w-20 text-right">Qty Base</th>
                    <th className="px-3 text-[10px] font-bold text-slate-400 w-16 text-center">Unit</th>
                    <th className="px-3 text-[10px] font-bold text-slate-400">Alasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mist-100">
                  {viewingBatch.items.map((it, i) => {
                    const ext = it as RejectItemExtended;
                    return (
                      <tr key={i} className="hover:bg-mist-50 h-7 transition-colors">
                        <td className="px-3 text-center text-slate-400 font-mono text-[10px]">{i + 1}</td>
                        <td className="px-3">
                          <div className="font-semibold text-slate-700 truncate max-w-[200px]">{it.name}</div>
                          <div className="text-[9px] text-slate-400 font-mono uppercase">{it.sku}</div>
                        </td>
                        {/* IMPROVEMENT: show original input in detail modal */}
                        <td className="text-right px-3 text-[10px] text-slate-500 font-mono">
                          {ext.inputQty != null ? `${ext.inputQty} ${ext.inputUnit}` : '-'}
                        </td>
                        <td className="text-right px-3 font-mono font-semibold text-rose-600">{it.qty.toLocaleString()}</td>
                        <td className="text-center px-3 font-semibold text-[10px] uppercase text-slate-400">{it.unit}</td>
                        <td className="px-3 text-slate-500 italic text-[10px] truncate">{it.reason || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!batchToDelete}
        title="Hapus Riwayat Reject"
        message="Apakah Anda yakin ingin menghapus riwayat reject ini?"
        onConfirm={handleDeleteBatch}
        onCancel={() => setBatchToDelete(null)}
      />
      <ConfirmDialog
        isOpen={!!masterItemToDelete}
        title="Hapus Master Item"
        message="Apakah Anda yakin ingin menghapus master item ini?"
        onConfirm={handleDeleteMasterItem}
        onCancel={() => setMasterItemToDelete(null)}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cdcfdb; border-radius: 10px; }
      `}</style>
    </div>
  );
};
