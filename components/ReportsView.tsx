import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { StorageService } from '../services/storage';
import { Transaction, Warehouse, TransactionType } from '../types';
import {
  Plus, Edit3, Trash2, RefreshCw, Search, Calendar,
  X, Info, FileSpreadsheet, ArrowDown, ArrowUp,
  CheckCircle2, Filter, ArrowUpDown, ChevronUp, ChevronDown,
  Download, Layers, AlignLeft,
} from 'lucide-react';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import ExcelJS from 'exceljs';

const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return createPortal(children, document.body);
};

interface Props {
  onEditTransaction: (tx: Transaction) => void;
  onCreateTransaction: (type: TransactionType) => void;
}

type SortKey = 'date' | 'referenceNo' | 'type' | 'partnerName';
type SortDir = 'asc' | 'desc';
type ExportMode = 'summary' | 'detail';

// ─── Definisi kolom untuk navigasi keyboard ───
const COLUMNS = [
  { key: 'referenceNo', label: 'Referensi' },
  { key: 'date',        label: 'Tanggal' },
  { key: 'type',        label: 'Tipe' },
  { key: 'partnerName', label: 'Partner' },
  { key: 'notes',       label: 'Keterangan' },
  { key: 'warehouse',   label: 'Gudang' },
  { key: 'items',       label: 'Items' },
] as const;
const COL_COUNT = COLUMNS.length;

// ─── ToolBtn ───
interface ToolBtnProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
  active?: boolean;
  customRef?: React.Ref<HTMLButtonElement>;
  loading?: boolean;
}
const ToolBtn: React.FC<ToolBtnProps> = ({
  icon: Icon, label, onClick, disabled = false,
  color = 'text-slate-300', active = false, customRef, loading = false,
}) => (
  <button
    ref={customRef}
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-slate-700/50 transition-colors disabled:opacity-30 ${
      active ? 'bg-slate-700 text-white' : 'hover:bg-slate-700/50'
    } ${color}`}
  >
    <Icon size={13} className={loading ? 'animate-spin' : ''} />
    <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
  </button>
);

// ─── Sort header dengan highlight kolom aktif ───
interface SortThProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  isFocusedCol?: boolean;
}
const SortTh: React.FC<SortThProps> = ({
  label, sortKey, currentKey, currentDir, onSort, className = '', isFocusedCol = false,
}) => {
  const active = currentKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-tight cursor-pointer select-none transition-colors ${
        isFocusedCol ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-mist-400/30'
      } ${className}`}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? (currentDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
          : <ArrowUpDown size={9} className="opacity-30" />}
        {isFocusedCol && <span className="ml-auto text-[7px] font-bold text-blue-500 bg-blue-200 px-1 rounded">←→</span>}
      </span>
    </th>
  );
};

// ─── Type badge ───
const TypeBadge: React.FC<{ type: string; selected?: boolean }> = ({ type, selected }) => {
  if (selected) return (
    <span className="px-1.5 py-0 rounded text-[8px] font-bold border bg-white/20 text-white border-white/20">{type}</span>
  );
  const cls =
    type === 'IN'       ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
    type === 'TRANSFER' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                          'bg-rose-50 text-rose-600 border-rose-100';
  return <span className={`px-1.5 py-0 rounded text-[8px] font-bold border ${cls}`}>{type}</span>;
};

// ─── FilterSelect ───
const FilterSelect: React.FC<{
  label: string; value: string;
  onChange: (v: string) => void; children: React.ReactNode;
}> = ({ label, value, onChange, children }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-1.5 bg-white border border-mist-200 rounded text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-400">
      {children}
    </select>
  </div>
);

export const ReportsView: React.FC<Props> = ({ onEditTransaction, onCreateTransaction }) => {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // ─── Keyboard: index baris & kolom yang difokus ───
  const [focusedRowIdx, setFocusedRowIdx] = useState<number>(-1);
  const [focusedColIdx, setFocusedColIdx] = useState<number>(0);

  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ─── Refs untuk sticky header + scroll-to-row ───
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  // ─── Filters ───
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWhFrom, setFilterWhFrom] = useState('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT' | 'TRANSFER'>('ALL');
  const [isFilterDateActive] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [sortKey, setSortKey] = useState<SortKey | null>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ─── Export ───
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('detail');
  const [exportStart, setExportStart] = useState(startDate);
  const [exportEnd, setExportEnd] = useState(endDate);
  const [exportWh, setExportWh] = useState('ALL');
  const [exportType, setExportType] = useState<'ALL' | 'IN' | 'OUT' | 'TRANSFER'>('ALL');
  const [exportPartner, setExportPartner] = useState('ALL');
  const [exportSearch, setExportSearch] = useState('');

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = isFilterDateActive ? { start: startDate, end: endDate } : {};
      const [txs, whs] = await Promise.all([
        StorageService.fetchTransactions(filters),
        StorageService.fetchWarehouses(),
      ]);
      setTransactions(txs);
      setWarehouses(whs);
    } catch {
      showToast('Gagal memuat data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isFilterDateActive, startDate, endDate, showToast]);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Click-outside dropdown
  useEffect(() => {
    if (!showNewDropdown) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        newButtonRef.current && !newButtonRef.current.contains(e.target as Node)
      ) setShowNewDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewDropdown]);

  const filteredTransactions = useMemo(() => {
    const lower = searchQuery.toLowerCase().trim();
    let result = transactions.filter(tx => {
      const matchSearch = !lower ||
        tx.referenceNo.toLowerCase().includes(lower) ||
        (tx.partnerName?.toLowerCase().includes(lower)) ||
        (tx.notes?.toLowerCase().includes(lower));
      const matchWh   = filterWhFrom === 'ALL' || tx.sourceWarehouseId === filterWhFrom;
      const matchType = filterType === 'ALL' || tx.type === filterType;
      return matchSearch && matchWh && matchType;
    });
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const valA = (a as any)[sortKey] ?? '';
        const valB = (b as any)[sortKey] ?? '';
        const cmp = String(valA).localeCompare(String(valB));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [transactions, searchQuery, filterWhFrom, filterType, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Reset fokus saat filter berubah
  useEffect(() => {
    setFocusedRowIdx(-1);
    setSelectedTxId(null);
    setFocusedColIdx(0);
  }, [searchQuery, filterWhFrom, filterType, sortKey, sortDir]);

  // Scroll baris ke dalam viewport
  const scrollRowIntoView = useCallback((rowIdx: number) => {
    if (!tbodyRef.current || !scrollContainerRef.current) return;
    const rows = tbodyRef.current.querySelectorAll('tr[data-row]');
    const row = rows[rowIdx] as HTMLElement | undefined;
    if (!row) return;
    const container = scrollContainerRef.current;
    const rowTop    = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const headerH   = 28; // tinggi thead
    if (rowTop < container.scrollTop + headerH) {
      container.scrollTop = rowTop - headerH;
    } else if (rowBottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = rowBottom - container.clientHeight;
    }
  }, []);

  const handleEdit = useCallback(() => {
    const tx = transactions.find(t => t.id === selectedTxId);
    if (tx) onEditTransaction(tx);
  }, [transactions, selectedTxId, onEditTransaction]);

  // ─── Keyboard navigation ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;

      const total = filteredTransactions.length;
      if (total === 0) return;

      // ↓↑ navigasi baris
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = focusedRowIdx < total - 1 ? focusedRowIdx + 1 : 0;
        setFocusedRowIdx(next);
        setSelectedTxId(filteredTransactions[next].id);
        scrollRowIntoView(next);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = focusedRowIdx > 0 ? focusedRowIdx - 1 : total - 1;
        setFocusedRowIdx(prev);
        setSelectedTxId(filteredTransactions[prev].id);
        scrollRowIntoView(prev);
        return;
      }

      // ←→ / Tab navigasi kolom
      if (selectedTxId) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setFocusedColIdx(p => p < COL_COUNT - 1 ? p + 1 : 0);
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocusedColIdx(p => p > 0 ? p - 1 : COL_COUNT - 1);
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          setFocusedColIdx(p => e.shiftKey ? (p > 0 ? p - 1 : COL_COUNT - 1) : (p < COL_COUNT - 1 ? p + 1 : 0));
          return;
        }
        if (e.key === 'Delete') { setIsDeleteDialogOpen(true); return; }
        if (e.key === 'Enter')  { handleEdit(); return; }
        if (e.key === 'Escape') {
          setSelectedTxId(null); setFocusedRowIdx(-1); setFocusedColIdx(0);
          return;
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [filteredTransactions, focusedRowIdx, selectedTxId, handleEdit, scrollRowIntoView]);

  const uniquePartners = useMemo(() => {
    const seen = new Set<string>();
    return transactions
      .filter(tx => tx.partnerName && !seen.has(tx.partnerName) && seen.add(tx.partnerName))
      .map(tx => tx.partnerName!);
  }, [transactions]);

  const exportPreviewData = useMemo(() => {
    const lower = exportSearch.toLowerCase().trim();
    return transactions.filter(tx => {
      const matchDate    = tx.date >= exportStart && tx.date <= exportEnd;
      const matchWh      = exportWh === 'ALL' || tx.sourceWarehouseId === exportWh;
      const matchType    = exportType === 'ALL' || tx.type === exportType;
      const matchPartner = exportPartner === 'ALL' || tx.partnerName === exportPartner;
      const matchSearch  = !lower ||
        tx.referenceNo.toLowerCase().includes(lower) ||
        (tx.partnerName?.toLowerCase().includes(lower)) ||
        (tx.notes?.toLowerCase().includes(lower)) ||
        tx.items.some(it => (it as any).name?.toLowerCase().includes(lower) || (it as any).code?.toLowerCase().includes(lower));
      return matchDate && matchWh && matchType && matchPartner && matchSearch;
    });
  }, [transactions, exportStart, exportEnd, exportWh, exportType, exportPartner, exportSearch]);

  const exportPreviewRowCount = useMemo(() =>
    exportMode === 'summary'
      ? exportPreviewData.length
      : exportPreviewData.reduce((acc, tx) => acc + tx.items.length, 0),
  [exportPreviewData, exportMode]);

  const handleOpenExportModal = () => {
    setExportStart(startDate); setExportEnd(endDate);
    setExportWh(filterWhFrom); setExportType(filterType);
    setExportPartner('ALL'); setExportSearch('');
    setExportMode('detail'); setShowExportModal(true);
  };

  const handleRunExport = async () => {
    if (exportPreviewData.length === 0) { showToast('Tidak ada data untuk diekspor', 'warning'); return; }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'GudangPro System';
    wb.created = new Date();
    const whName = warehouses.find(w => w.id === exportWh)?.name;

    const C = {
      HEADER_BG: '1E3A5F', HEADER_FONT: 'FFFFFF',
      TITLE_BG: '2563EB',  TITLE_FONT: 'FFFFFF',
      META_BG: 'EFF6FF',   META_FONT: '1E40AF',
      ROW_ODD: 'F8FAFC',   ROW_EVEN: 'FFFFFF',
      IN_BG: 'F0FDF4',     IN_FONT: '166534',
      OUT_BG: 'FFF1F2',    OUT_FONT: '9F1239',
      TF_BG: 'F0F9FF',     TF_FONT: '0C4A6E',
      TOTAL_BG: 'F1F5F9',  TOTAL_FONT: '0F172A',
      BORDER: 'CBD5E1',
    };

    const border = (cell: ExcelJS.Cell, s: ExcelJS.BorderStyle = 'thin') => {
      const b = { style: s, color: { argb: 'FF' + C.BORDER } };
      cell.border = { top: b, left: b, bottom: b, right: b };
    };
    const sHead = (cell: ExcelJS.Cell) => {
      cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FF' + C.HEADER_FONT } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.HEADER_BG } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      border(cell, 'medium');
    };
    const sCell = (cell: ExcelJS.Cell, opts: { bold?: boolean; align?: ExcelJS.Alignment['horizontal']; color?: string; bg?: string; numFmt?: string }) => {
      cell.font = { name: 'Arial', size: 9, bold: opts.bold ?? false, color: { argb: 'FF' + (opts.color ?? '334155') } };
      if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + opts.bg } };
      cell.alignment = { horizontal: opts.align ?? 'left', vertical: 'middle' };
      if (opts.numFmt) cell.numFmt = opts.numFmt;
      border(cell);
    };
    const typeBg   = (t: string) => t === 'IN' ? C.IN_BG   : t === 'OUT' ? C.OUT_BG   : C.TF_BG;
    const typeFont = (t: string) => t === 'IN' ? C.IN_FONT : t === 'OUT' ? C.OUT_FONT : C.TF_FONT;
    const fmtDate  = (d: string) => { if (!d) return '-'; const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; };

    const buildHeader = (sheet: ExcelJS.Worksheet, title: string, n: number) => {
      sheet.mergeCells(1, 1, 1, n);
      const t = sheet.getCell(1, 1);
      t.value = title;
      t.font = { name: 'Arial', bold: true, size: 13, color: { argb: 'FF' + C.TITLE_FONT } };
      t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.TITLE_BG } };
      t.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 24;

      sheet.mergeCells(2, 1, 2, n);
      const m = sheet.getCell(2, 1);
      m.value = `Periode: ${fmtDate(exportStart)} – ${fmtDate(exportEnd)}  |  Gudang: ${whName ?? 'Semua'}  |  Tipe: ${exportType !== 'ALL' ? exportType : 'Semua'}  |  Partner: ${exportPartner !== 'ALL' ? exportPartner : 'Semua'}  |  Dibuat: ${new Date().toLocaleString('id-ID')}`;
      m.font = { name: 'Arial', italic: true, size: 8, color: { argb: 'FF' + C.META_FONT } };
      m.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.META_BG } };
      m.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(2).height = 16;
      sheet.getRow(3).height = 4;
    };

    if (exportMode === 'detail') {
      const sheet = wb.addWorksheet('Detail Transaksi', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
        views: [{ state: 'frozen', ySplit: 4 }],
      });
      const COLS = [
        { h: 'NO',           k: 'no',  w: 5,  a: 'center' as const },
        { h: 'NO. REFERENSI', k: 'ref', w: 20, a: 'left' as const },
        { h: 'TANGGAL',      k: 'dt',  w: 12, a: 'center' as const },
        { h: 'TIPE',         k: 'tp',  w: 10, a: 'center' as const },
        { h: 'GUDANG',       k: 'gd',  w: 18, a: 'left' as const },
        { h: 'PARTNER',      k: 'pt',  w: 22, a: 'left' as const },
        { h: 'KETERANGAN',   k: 'nt',  w: 25, a: 'left' as const },
        { h: 'KODE SKU',     k: 'sk',  w: 15, a: 'center' as const },
        { h: 'NAMA BARANG',  k: 'nm',  w: 32, a: 'left' as const },
        { h: 'QTY INPUT',    k: 'qi',  w: 11, a: 'right' as const },
        { h: 'SATUAN',       k: 'st',  w: 9,  a: 'center' as const },
        { h: 'QTY BASE',     k: 'qb',  w: 11, a: 'right' as const },
        { h: 'CATATAN ITEM', k: 'ci',  w: 22, a: 'left' as const },
      ];
      sheet.columns = COLS.map(c => ({ key: c.k, width: c.w }));
      buildHeader(sheet, 'LAPORAN DETAIL MUTASI BARANG', COLS.length);
      const hRow = sheet.getRow(4); hRow.height = 20;
      COLS.forEach((col, i) => { const cell = hRow.getCell(i + 1); cell.value = col.h; sHead(cell); });
      sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: COLS.length } };

      let rowNo = 1, excelRow = 5, totalQtyBase = 0;
      exportPreviewData.forEach(tx => {
        const gudang = warehouses.find(w => w.id === tx.sourceWarehouseId)?.name ?? '-';
        const items  = tx.items.length > 0 ? tx.items : [null];
        items.forEach((item: any, idx) => {
          const first = idx === 0;
          const bg    = first ? typeBg(tx.type) : (rowNo % 2 === 1 ? C.ROW_ODD : C.ROW_EVEN);
          const dataRow = sheet.getRow(excelRow); dataRow.height = 16;
          const vals = [
            first ? rowNo : '', first ? tx.referenceNo : '',
            first ? fmtDate(tx.date) : '', first ? tx.type : '',
            first ? gudang : '', first ? (tx.partnerName ?? '-') : '',
            first ? (tx.notes ?? '-') : '',
            item ? (item.code ?? item.sku ?? '-') : '-',
            item ? (item.name ?? '-') : '(tidak ada item)',
            item ? (Number(item.qty) || '-') : '-',
            item ? (item.unit ?? '-') : '-',
            item ? (Number(item.baseQty ?? item.qty) || '-') : '-',
            item ? (item.note ?? item.reason ?? '-') : '-',
          ];
          vals.forEach((val, ci) => {
            const cell = dataRow.getCell(ci + 1); cell.value = val as any;
            const isNum = ci === 9 || ci === 11;
            sCell(cell, {
              align: COLS[ci].a, bg,
              bold: ci === 1 && first,
              color: ci === 3 ? typeFont(tx.type) : isNum ? '0F172A' : undefined,
              numFmt: isNum ? '#,##0.##' : undefined,
            });
          });
          if (item) totalQtyBase += Number(item.baseQty ?? item.qty) || 0;
          excelRow++;
          if (first) rowNo++;
        });
      });

      const tRow = sheet.getRow(excelRow); tRow.height = 18;
      const totalQtyInput = exportPreviewData.reduce((a, tx) => a + tx.items.reduce((b, it: any) => b + (Number(it.qty) || 0), 0), 0);
      COLS.forEach((_, ci) => {
        const cell = tRow.getCell(ci + 1);
        cell.value = ci === 0 ? 'TOTAL' : ci === 9 ? totalQtyInput : ci === 11 ? totalQtyBase : '';
        cell.font  = { name: 'Arial', bold: true, size: 9, color: { argb: 'FF' + C.TOTAL_FONT } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.TOTAL_BG } };
        cell.alignment = { horizontal: ci === 0 ? 'center' : ci >= 9 ? 'right' : 'left', vertical: 'middle' };
        cell.border = { top: { style: 'medium', color: { argb: 'FF' + C.HEADER_BG } }, bottom: { style: 'medium', color: { argb: 'FF' + C.HEADER_BG } }, left: { style: 'thin', color: { argb: 'FF' + C.BORDER } }, right: { style: 'thin', color: { argb: 'FF' + C.BORDER } } };
        if (ci === 9 || ci === 11) cell.numFmt = '#,##0.##';
      });

    } else {
      const sheet = wb.addWorksheet('Ringkasan Transaksi', {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
        views: [{ state: 'frozen', ySplit: 4 }],
      });
      const COLS = [
        { h: 'NO',           k: 'no', w: 5,  a: 'center' as const },
        { h: 'NO. REFERENSI', k: 'rf', w: 20, a: 'left' as const },
        { h: 'TANGGAL',      k: 'dt', w: 12, a: 'center' as const },
        { h: 'TIPE',         k: 'tp', w: 10, a: 'center' as const },
        { h: 'GUDANG',       k: 'gd', w: 20, a: 'left' as const },
        { h: 'PARTNER',      k: 'pt', w: 24, a: 'left' as const },
        { h: 'KETERANGAN',   k: 'nt', w: 28, a: 'left' as const },
        { h: 'JML ITEM',     k: 'it', w: 10, a: 'center' as const },
      ];
      sheet.columns = COLS.map(c => ({ key: c.k, width: c.w }));
      buildHeader(sheet, 'RINGKASAN TRANSAKSI MUTASI BARANG', COLS.length);
      const hRow = sheet.getRow(4); hRow.height = 20;
      COLS.forEach((col, i) => { const cell = hRow.getCell(i + 1); cell.value = col.h; sHead(cell); });
      sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: COLS.length } };

      exportPreviewData.forEach((tx, idx) => {
        const row = sheet.getRow(5 + idx); row.height = 16;
        const gudang = warehouses.find(w => w.id === tx.sourceWarehouseId)?.name ?? '-';
        const vals = [idx + 1, tx.referenceNo, fmtDate(tx.date), tx.type, gudang, tx.partnerName ?? '-', tx.notes ?? '-', tx.items.length];
        vals.forEach((val, ci) => {
          const cell = row.getCell(ci + 1); cell.value = val as any;
          sCell(cell, { align: COLS[ci].a, bg: typeBg(tx.type), bold: ci === 1, color: ci === 3 ? typeFont(tx.type) : undefined, numFmt: ci === 7 ? '#,##0' : undefined });
        });
      });

      const tRow = sheet.getRow(5 + exportPreviewData.length); tRow.height = 18;
      const inC  = exportPreviewData.filter(t => t.type === 'IN').length;
      const outC = exportPreviewData.filter(t => t.type === 'OUT').length;
      const tfC  = exportPreviewData.filter(t => t.type === 'TRANSFER').length;
      const labels: Record<number, any> = { 0: 'TOTAL', 3: `IN:${inC} OUT:${outC} TF:${tfC}`, 7: exportPreviewData.reduce((a, tx) => a + tx.items.length, 0) };
      COLS.forEach((_, ci) => {
        const cell = tRow.getCell(ci + 1); cell.value = labels[ci] ?? '';
        cell.font  = { name: 'Arial', bold: true, size: 9, color: { argb: 'FF' + C.TOTAL_FONT } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.TOTAL_BG } };
        cell.alignment = { horizontal: ci === 0 || ci === 7 ? 'center' : 'left', vertical: 'middle' };
        cell.border = { top: { style: 'medium', color: { argb: 'FF' + C.HEADER_BG } }, bottom: { style: 'medium', color: { argb: 'FF' + C.HEADER_BG } }, left: { style: 'thin', color: { argb: 'FF' + C.BORDER } }, right: { style: 'thin', color: { argb: 'FF' + C.BORDER } } };
        if (ci === 7) cell.numFmt = '#,##0';
      });
    }

    // Info sheet
    const info = wb.addWorksheet('Info Export');
    info.columns = [{ width: 28 }, { width: 40 }];
    [
      ['GudangPro System', ''], ['', ''], ['Parameter Export', ''],
      ['Format', exportMode === 'detail' ? 'Detail per Item' : 'Ringkasan'],
      ['Periode Dari', fmtDate(exportStart)], ['Periode Sampai', fmtDate(exportEnd)],
      ['Gudang', whName ?? 'Semua Gudang'], ['Tipe', exportType !== 'ALL' ? exportType : 'Semua'],
      ['Partner', exportPartner !== 'ALL' ? exportPartner : 'Semua'], ['Pencarian', exportSearch || '-'],
      ['', ''], ['Total Transaksi', exportPreviewData.length],
      ['Total Baris Data', exportPreviewRowCount], ['Waktu Export', new Date().toLocaleString('id-ID')],
    ].forEach(([k, v], i) => {
      const row = info.getRow(i + 1);
      const c1 = row.getCell(1); const c2 = row.getCell(2);
      c1.value = k; c2.value = v as any;
      if (i === 0) { c1.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF2563EB' } }; }
      else if (i === 2) {
        c1.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        [c1, c2].forEach(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }; });
      } else {
        c1.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FF475569' } };
        c2.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };
        if (i > 2 && i % 2 === 1) [c1, c2].forEach(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }; });
      }
      row.height = i === 0 ? 22 : 16;
    });

    const parts = ['Mutasi', exportStart, exportEnd !== exportStart ? `sd_${exportEnd}` : '', whName?.replace(/\s+/g, '_') ?? '', exportType !== 'ALL' ? exportType : '', exportPartner !== 'ALL' ? exportPartner.replace(/\s+/g, '_') : ''].filter(Boolean);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${parts.join('_')}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    showToast(`Berhasil mengekspor ${exportPreviewRowCount} baris`, 'success');
    setShowExportModal(false);
  };

  const handleDelete = async () => {
    if (!selectedTxId) return;
    try {
      await StorageService.deleteTransaction(selectedTxId, false);
      showToast('Transaksi dihapus', 'success');
      setSelectedTxId(null); setFocusedRowIdx(-1); refreshData();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Gagal menghapus', 'error'); }
    finally { setIsDeleteDialogOpen(false); }
  };

  const handleHardDelete = async () => {
    if (!selectedTxId) return;
    try {
      await StorageService.deleteTransaction(selectedTxId, true);
      showToast('Transaksi dihapus paksa', 'success');
      setSelectedTxId(null); setFocusedRowIdx(-1); refreshData();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Gagal menghapus', 'error'); }
    finally { setIsDeleteDialogOpen(false); }
  };

  const activeFilterCount = [filterWhFrom !== 'ALL', filterType !== 'ALL', !!searchQuery.trim()].filter(Boolean).length;
  const isFocusedCol = (idx: number) => !!selectedTxId && focusedColIdx === idx;

  // ─── Helper class untuk cell data ───
  const cellCls = (colIdx: number, isSelected: boolean) => {
    const focused = isFocusedCol(colIdx);
    if (isSelected) return focused ? 'bg-blue-500 text-white' : '';
    return focused ? 'bg-blue-50 text-blue-700' : '';
  };

  return (
    <div className="flex flex-col h-full bg-white font-sans overflow-hidden relative">

      {/* 1. TOOLBAR */}
      <div className="sticky top-0 h-10 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-2 shrink-0 z-30 shadow-md">
        <div className="flex items-center h-full">
          <div className="relative h-full flex items-center">
            <ToolBtn icon={Plus} label="Baru" onClick={() => setShowNewDropdown(v => !v)} active={showNewDropdown} customRef={newButtonRef} color="text-emerald-400" />
            {showNewDropdown && (
              <div ref={dropdownRef} className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 shadow-xl z-[100] w-44 rounded-lg overflow-hidden py-1 animate-in fade-in slide-in-from-top-1">
                <button onClick={() => { onCreateTransaction('IN');       setShowNewDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 text-[10px] font-semibold text-emerald-400 flex items-center gap-2"><ArrowDown size={12} /> Penerimaan (IN)</button>
                <button onClick={() => { onCreateTransaction('OUT');      setShowNewDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 text-[10px] font-semibold text-rose-400 flex items-center gap-2"><ArrowUp size={12} /> Pengiriman (OUT)</button>
                <button onClick={() => { onCreateTransaction('TRANSFER'); setShowNewDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 text-[10px] font-semibold text-sky-400 flex items-center gap-2"><ArrowUpDown size={12} /> Transfer Gudang</button>
              </div>
            )}
          </div>
          <div className="hidden md:flex h-full items-center">
            <ToolBtn icon={Edit3}  label="Ubah"  onClick={handleEdit}                       disabled={!selectedTxId} color="text-blue-400" />
            <ToolBtn icon={Trash2} label="Hapus" onClick={() => setIsDeleteDialogOpen(true)} disabled={!selectedTxId} color="text-rose-400" />
          </div>
          <ToolBtn icon={RefreshCw}     label="Segarkan" onClick={refreshData}           loading={isLoading} />
          <ToolBtn icon={FileSpreadsheet} label="Excel"  onClick={handleOpenExportModal}  color="text-emerald-400" />
        </div>

        <div className="flex items-center gap-2 px-2 h-full">
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded px-2 py-1">
            <Filter size={10} className="text-slate-400" />
            <select value={filterWhFrom} onChange={e => setFilterWhFrom(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-200 outline-none cursor-pointer w-28">
              <option value="ALL">Semua Gudang</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-0.5 bg-slate-800 border border-slate-700 rounded px-1.5 py-1">
            {(['ALL','IN','OUT','TRANSFER'] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)} className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors ${filterType === t ? (t === 'ALL' ? 'bg-slate-600 text-white' : t === 'IN' ? 'bg-emerald-600 text-white' : t === 'TRANSFER' ? 'bg-sky-600 text-white' : 'bg-rose-600 text-white') : 'text-slate-400 hover:text-slate-200'}`}>{t}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded px-2 py-1 shadow-inner">
            <Calendar size={11} className="text-slate-400" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[10px] font-bold outline-none border-none bg-transparent text-slate-200 w-24 [color-scheme:dark]" />
            <span className="text-slate-500 text-[10px]">/</span>
            <input type="date" value={endDate}   onChange={e => setEndDate(e.target.value)}   className="text-[10px] font-bold outline-none border-none bg-transparent text-slate-200 w-24 [color-scheme:dark]" />
          </div>
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Cari ref, partner, ket..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-7 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold outline-none w-40 text-slate-200 focus:border-blue-500 placeholder:text-slate-500 shadow-inner transition-colors" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors"><X size={10} /></button>}
          </div>
        </div>
      </div>

      {/* ─── Keyboard hint bar ─── */}
      {selectedTxId && (
        <div className="h-6 bg-blue-600 flex items-center justify-center gap-4 text-[9px] font-semibold text-blue-100 shrink-0 z-20 px-4">
          <span>↑↓ Baris</span>
          <span className="opacity-40">·</span>
          <span>←→ / Tab Kolom</span>
          <span className="opacity-40">·</span>
          <span>↵ Edit</span>
          <span className="opacity-40">·</span>
          <span>Del Hapus</span>
          <span className="opacity-40">·</span>
          <span>Esc Batal</span>
          <span className="opacity-40 mx-2">|</span>
          <span className="bg-blue-500 px-2 py-0.5 rounded font-bold text-white">
            Baris {focusedRowIdx + 1} · {COLUMNS[focusedColIdx].label}
          </span>
        </div>
      )}

      {/* 2. DATA GRID — scroll container dengan sticky thead di dalamnya */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-white pb-16 custom-scrollbar relative">
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-white/60 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium bg-white border border-mist-200 shadow-sm px-4 py-2 rounded-full">
              <RefreshCw size={13} className="animate-spin text-blue-500" /> Memuat data...
            </div>
          </div>
        )}

        <table className="w-full border-collapse table-fixed text-left min-w-[860px]">
          {/* STICKY HEADER — sticky top-0 relatif ke scroll container */}
          <thead className="sticky top-0 z-10 shadow-[0_2px_6px_rgba(0,0,0,0.08)]">
            <tr className="h-7 bg-mist-300 border-b border-mist-400">
              <SortTh label="Referensi" sortKey="referenceNo" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="w-[15%]" isFocusedCol={isFocusedCol(0)} />
              <SortTh label="Tanggal"   sortKey="date"        currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="w-[10%]" isFocusedCol={isFocusedCol(1)} />
              <th className={`px-3 py-1 text-[9px] font-extrabold uppercase w-[8%] text-center tracking-tight ${isFocusedCol(2) ? 'bg-blue-100 text-blue-700' : 'text-slate-700'}`}>Tipe</th>
              <SortTh label="Partner"   sortKey="partnerName" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="w-[18%]" isFocusedCol={isFocusedCol(3)} />
              <th className={`px-3 py-1 text-[9px] font-extrabold uppercase w-[19%] tracking-tight ${isFocusedCol(4) ? 'bg-blue-100 text-blue-700' : 'text-slate-700'}`}>Keterangan</th>
              <th className={`px-3 py-1 text-[9px] font-extrabold uppercase w-[17%] tracking-tight ${isFocusedCol(5) ? 'bg-blue-100 text-blue-700' : 'text-slate-700'}`}>Gudang</th>
              <th className={`px-3 py-1 text-[9px] font-extrabold uppercase w-[10%] text-center tracking-tight ${isFocusedCol(6) ? 'bg-blue-100 text-blue-700' : 'text-slate-700'}`}>Items</th>
            </tr>
          </thead>

          <tbody ref={tbodyRef} className="divide-y divide-mist-50">
            {filteredTransactions.map((tx, rowIdx) => {
              const isSel = selectedTxId === tx.id;
              return (
                <tr
                  key={tx.id}
                  data-row={rowIdx}
                  onClick={() => {
                    if (isSel) { setSelectedTxId(null); setFocusedRowIdx(-1); setFocusedColIdx(0); }
                    else { setSelectedTxId(tx.id); setFocusedRowIdx(rowIdx); setFocusedColIdx(0); }
                  }}
                  onDoubleClick={() => { setSelectedTxId(tx.id); setFocusedRowIdx(rowIdx); onEditTransaction(tx); }}
                  className={`h-7 cursor-pointer transition-all group ${isSel ? 'bg-blue-600 text-white' : 'hover:bg-mist-100 text-slate-700'}`}
                >
                  <td className={`px-3 py-0.5 text-[10px] font-mono truncate transition-colors ${isSel ? 'text-white' : 'text-slate-600 group-hover:text-blue-600'} ${cellCls(0, isSel)}`}>{tx.referenceNo}</td>
                  <td className={`px-3 py-0.5 text-[10px] truncate transition-colors ${isSel ? 'text-blue-100' : 'text-slate-500'} ${cellCls(1, isSel)}`}>{tx.date}</td>
                  <td className={`px-3 py-0.5 text-center transition-colors ${cellCls(2, isSel)}`}><TypeBadge type={tx.type} selected={isSel} /></td>
                  <td className={`px-3 py-0.5 text-[10px] font-semibold truncate transition-colors ${isSel ? 'text-white' : 'text-slate-700'} ${cellCls(3, isSel)}`}>{tx.partnerName || '-'}</td>
                  <td className={`px-3 py-0.5 text-[10px] truncate transition-colors ${isSel ? 'text-blue-100' : 'text-slate-500'} ${cellCls(4, isSel)}`} title={tx.notes}>{tx.notes || '-'}</td>
                  <td className={`px-3 py-0.5 text-[9px] font-bold uppercase truncate transition-colors ${isSel ? 'text-blue-100' : 'text-slate-500'} ${cellCls(5, isSel)}`}>{warehouses.find(w => w.id === tx.sourceWarehouseId)?.name ?? '-'}</td>
                  <td className={`px-3 py-0.5 text-center text-[10px] font-bold font-mono transition-colors ${isSel ? 'text-white' : 'text-slate-400'} ${cellCls(6, isSel)}`}>{tx.items.length}</td>
                </tr>
              );
            })}

            {filteredTransactions.length === 0 && !isLoading && (
              <tr><td colSpan={7} className="py-16 text-center">
                <div className="flex flex-col items-center justify-center gap-2 text-slate-400 italic text-[10px]">
                  <Info size={16} className="opacity-30" />
                  {activeFilterCount > 0 ? 'Tidak ada transaksi yang cocok dengan filter aktif' : 'Tidak ada data transaksi ditemukan'}
                  {activeFilterCount > 0 && (
                    <button onClick={() => { setSearchQuery(''); setFilterWhFrom('ALL'); setFilterType('ALL'); }} className="mt-1 text-blue-500 hover:underline not-italic font-semibold">Reset Filter</button>
                  )}
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 3. FLOATING ACTION BAR */}
      {selectedTxId && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in zoom-in-95 fade-in duration-200">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-800/95 text-white rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.35)] border border-slate-700 ring-4 ring-black/5">
            <div className="px-4 py-1.5 text-[11px] font-bold border-r border-slate-700/50 flex items-center gap-2 text-slate-200">
              <CheckCircle2 size={14} className="text-emerald-400" /> 1 Terpilih
            </div>
            <button onClick={handleEdit} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-[11px] font-bold transition-all shadow-lg active:scale-95"><Edit3 size={14} /> Ubah</button>
            <button onClick={() => setIsDeleteDialogOpen(true)} className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 rounded-full text-[11px] font-bold transition-all shadow-lg active:scale-95"><Trash2 size={14} /> Hapus</button>
            <button onClick={() => { setSelectedTxId(null); setFocusedRowIdx(-1); setFocusedColIdx(0); }} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all ml-1"><X size={18} /></button>
          </div>
        </div>
      )}

      {/* 4. STATUS BAR */}
      <div className="h-6 bg-mist-100 border-t border-mist-300 flex items-center justify-between px-3 text-[9px] font-semibold text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Info size={10} />
            {activeFilterCount > 0
              ? <>{filteredTransactions.length} <span className="text-slate-300">dari</span> {transactions.length} Transaksi</>
              : <>{transactions.length} Transaksi</>
            }
          </span>
          {activeFilterCount > 0 && <span className="flex items-center gap-1 text-amber-500"><Filter size={9} /> {activeFilterCount} filter aktif</span>}
          {selectedTxId && <span className="text-blue-500">Baris {focusedRowIdx + 1} · Kolom: <strong>{COLUMNS[focusedColIdx].label}</strong></span>}
        </div>
        <div className="italic">GudangPro System v2.1</div>
      </div>

      {/* MODAL: DELETE */}
      <ModalPortal>
        <ConfirmDialog
          isOpen={isDeleteDialogOpen}
          title="Hapus Transaksi"
          message="Apakah Anda yakin ingin menghapus transaksi ini? Stok barang akan dikembalikan seperti semula."
          confirmText="Hapus Normal"
          hardDeleteText="Hapus Paksa (Abaikan Stok)"
          onConfirm={handleDelete}
          onHardDelete={handleHardDelete}
          onCancel={() => setIsDeleteDialogOpen(false)}
        />
      </ModalPortal>

      {/* MODAL: EXPORT EXCEL */}
      {showExportModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl border border-mist-200 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-5 py-4 border-b border-mist-200 bg-mist-50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center"><FileSpreadsheet size={14} className="text-emerald-600" /></div>
                  <div><h3 className="text-[13px] font-bold text-slate-800">Export Excel</h3><p className="text-[10px] text-slate-400 mt-0.5">Konfigurasi filter dan format ekspor</p></div>
                </div>
                <button onClick={() => setShowExportModal(false)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><X size={16} /></button>
              </div>

              <div className="p-5 space-y-5 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Format Export</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['detail','summary'] as const).map(mode => (
                      <button key={mode} onClick={() => setExportMode(mode)} className={`flex items-start gap-2.5 p-3 rounded-lg border-2 text-left transition-all ${exportMode === mode ? 'border-blue-500 bg-blue-50' : 'border-mist-200 hover:border-mist-300'}`}>
                        {mode === 'detail' ? <Layers size={16} className={exportMode === mode ? 'text-blue-600 mt-0.5 shrink-0' : 'text-slate-400 mt-0.5 shrink-0'} /> : <AlignLeft size={16} className={exportMode === mode ? 'text-blue-600 mt-0.5 shrink-0' : 'text-slate-400 mt-0.5 shrink-0'} />}
                        <div>
                          <div className={`text-[11px] font-bold ${exportMode === mode ? 'text-blue-700' : 'text-slate-600'}`}>{mode === 'detail' ? 'Detail per Item' : 'Ringkasan'}</div>
                          <div className="text-[9px] text-slate-400 mt-0.5">{mode === 'detail' ? 'Satu baris per barang. SKU, nama, qty, satuan.' : 'Satu baris per transaksi. Tanpa detail item.'}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Periode Tanggal</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[9px] text-slate-400">Dari</label><input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="w-full px-2 py-1.5 bg-white border border-mist-200 rounded text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-400" /></div>
                    <div className="space-y-1"><label className="text-[9px] text-slate-400">Sampai</label><input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="w-full px-2 py-1.5 bg-white border border-mist-200 rounded text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-400" /></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FilterSelect label="Gudang" value={exportWh} onChange={setExportWh}><option value="ALL">Semua Gudang</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</FilterSelect>
                  <FilterSelect label="Tipe" value={exportType} onChange={v => setExportType(v as any)}><option value="ALL">Semua Tipe</option><option value="IN">IN — Penerimaan</option><option value="OUT">OUT — Pengiriman</option><option value="TRANSFER">TRANSFER</option></FilterSelect>
                  <div className="col-span-2"><FilterSelect label="Partner" value={exportPartner} onChange={setExportPartner}><option value="ALL">Semua Partner</option>{uniquePartners.map(p => <option key={p} value={p}>{p}</option>)}</FilterSelect></div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Cari (Opsional)</label>
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Ref, partner, catatan, nama barang, SKU..." value={exportSearch} onChange={e => setExportSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-white border border-mist-200 rounded text-[11px] font-medium text-slate-700 outline-none focus:border-blue-400" />
                  </div>
                </div>

                <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${exportPreviewData.length === 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                  <div className="text-[11px] font-semibold text-slate-600">
                    <span className={`font-bold text-[13px] ${exportPreviewData.length === 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{exportPreviewData.length}</span> transaksi akan diekspor
                  </div>
                  <div className="text-[10px] text-slate-500">
                    <span className="font-bold text-slate-700">{exportPreviewRowCount}</span> baris di Excel
                    {exportMode === 'detail' && exportPreviewData.length > 0 && <span className="ml-1 text-slate-400">({exportPreviewData.reduce((a, tx) => a + tx.items.length, 0)} item)</span>}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 bg-mist-50 border-t border-mist-200 flex justify-between items-center shrink-0">
                <button onClick={() => { setExportStart(startDate); setExportEnd(endDate); setExportWh('ALL'); setExportType('ALL'); setExportPartner('ALL'); setExportSearch(''); }} className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">Reset Filter</button>
                <div className="flex gap-2">
                  <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors">Batal</button>
                  <button onClick={() => handleRunExport()} disabled={exportPreviewData.length === 0} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5">
                    <Download size={13} /> Export {exportPreviewRowCount} Baris
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cdcfdb; border-radius: 10px; }
      `}</style>
    </div>
  );
};
