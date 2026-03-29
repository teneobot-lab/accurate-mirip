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

// ─────────────────────────────────────────────
// Accurate 5 Design Tokens
// ─────────────────────────────────────────────
const A5 = {
  navyDark:    '#1e3a6e',
  navyMid:     '#2d5a8c',
  navyLight:   '#3a6ea8',
  toolbarBg:   'linear-gradient(to bottom, #f5f5f5, #e8e8e8)',
  toolbarBdr:  '#b8b8b8',
  headerBg:    'linear-gradient(to bottom, #3a6ea8, #2d5a8c)',
  rowOdd:      '#ffffff',
  rowEven:     '#f5f8ff',
  rowSel:      '#2d5a8c',
  rowSelTxt:   '#ffffff',
  rowHover:    '#dde8f8',
  cellBdr:     '1px solid #dde4f0',
  statusBg:    'linear-gradient(to bottom, #e8e8e8, #d8d8d8)',
  font:        "'Segoe UI', Tahoma, sans-serif",
  inputStyle: {
    height: 22, fontSize: 11, padding: '1px 5px',
    border: '1px solid #b0b8c8', borderRadius: 2,
    background: '#fff', outline: 'none',
    fontFamily: "'Segoe UI', sans-serif",
    color: '#1a1a2e',
  } as React.CSSProperties,
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/** Accurate 5 style toolbar button */
const TBtn: React.FC<{
  icon: React.ElementType; label?: string; onClick: () => void;
  disabled?: boolean; primary?: boolean; danger?: boolean;
  loading?: boolean; active?: boolean;
  title?: string;
}> = ({ icon: Icon, label, onClick, disabled, primary, danger, loading, active, title }) => {
  const base: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: label ? '2px 8px' : '2px 6px',
    height: 24, minWidth: label ? undefined : 24,
    fontSize: 11, fontWeight: primary ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    border: '1px solid',
    borderRadius: 3,
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    fontFamily: A5.font,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    transition: 'filter 0.1s',
    background: primary
      ? 'linear-gradient(to bottom, #3a8a5a, #2e7048)'
      : danger
        ? 'linear-gradient(to bottom, #e74c3c, #c0392b)'
        : active
          ? 'linear-gradient(to bottom, #d0ddf0, #bdd0ec)'
          : 'linear-gradient(to bottom, #fafafa, #ebebeb)',
    borderColor: primary ? '#1e6038' : danger ? '#a93226' : active ? '#6a94cc' : '#b0b0b0',
    color: primary || danger ? '#fff' : active ? '#1e3a6e' : '#2a2a2a',
  };
  return (
    <button
      style={base}
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseOver={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.08)'; }}
      onMouseOut={e => { e.currentTarget.style.filter = 'none'; }}
    >
      <Icon size={13} className={loading ? 'animate-spin' : ''} />
      {label && <span>{label}</span>}
    </button>
  );
};

const TDivider = () => (
  <div style={{ width: 1, height: 20, background: '#c0c0c0', margin: '0 3px', flexShrink: 0 }} />
);

/** Accurate 5 type badge */
const TypeBadge: React.FC<{ type: string; selected?: boolean }> = ({ type, selected }) => {
  if (selected) {
    return (
      <span style={{ padding: '0 5px', borderRadius: 2, fontSize: 9, fontWeight: 800, background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>
        {type}
      </span>
    );
  }
  const styles: Record<string, React.CSSProperties> = {
    IN:       { background: '#e6f4ec', color: '#1a6b3a', border: '1px solid #a3d9b5' },
    OUT:      { background: '#fdeaea', color: '#8b1a1a', border: '1px solid #f5b0b0' },
    TRANSFER: { background: '#e6f0fa', color: '#1a3a6e', border: '1px solid #a0c0e8' },
  };
  return (
    <span style={{ padding: '0 6px', borderRadius: 2, fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', ...(styles[type] ?? {}) }}>
      {type}
    </span>
  );
};

/** Sortable column header */
const SortTh: React.FC<{
  label: string; sortKey: SortKey;
  currentKey: SortKey | null; currentDir: SortDir;
  onSort: (k: SortKey) => void;
  width?: string | number; align?: 'left' | 'center' | 'right';
  focused?: boolean;
}> = ({ label, sortKey, currentKey, currentDir, onSort, width, align = 'left', focused }) => {
  const active = currentKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        width, textAlign: align, padding: '0 7px',
        cursor: 'pointer', userSelect: 'none',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: focused ? '#ffd700' : '#e8eef8',
        borderRight: '1px solid rgba(255,255,255,0.15)',
        background: focused ? 'rgba(255,215,0,0.1)' : undefined,
        whiteSpace: 'nowrap',
      }}
      onMouseOver={e => { if (!focused) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseOut={e => { if (!focused) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {label}
        {active
          ? (currentDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
          : <ArrowUpDown size={9} style={{ opacity: 0.4 }} />}
      </span>
    </th>
  );
};

/** Plain (non-sortable) column header */
const PlainTh: React.FC<{ label: string; width?: string | number; align?: 'left' | 'center' | 'right'; focused?: boolean }> = ({
  label, width, align = 'left', focused,
}) => (
  <th style={{
    width, textAlign: align, padding: '0 7px',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: focused ? '#ffd700' : '#e8eef8',
    borderRight: '1px solid rgba(255,255,255,0.15)',
    background: focused ? 'rgba(255,215,0,0.1)' : undefined,
    whiteSpace: 'nowrap',
  }}>
    {label}
  </th>
);

/** Accurate 5 style form field */
const AccField: React.FC<{ label: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ label, children, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, ...style }}>
    <label style={{ fontSize: 9, fontWeight: 700, color: '#6a7a90', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {label}
    </label>
    {children}
  </div>
);

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export const ReportsView: React.FC<Props> = ({ onEditTransaction, onCreateTransaction }) => {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [focusedRowIdx, setFocusedRowIdx] = useState<number>(-1);
  const [focusedColIdx, setFocusedColIdx] = useState<number>(0);

  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  // Filters
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

  // Export
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

  useEffect(() => {
    setFocusedRowIdx(-1);
    setSelectedTxId(null);
    setFocusedColIdx(0);
  }, [searchQuery, filterWhFrom, filterType, sortKey, sortDir]);

  const scrollRowIntoView = useCallback((rowIdx: number) => {
    if (!tbodyRef.current || !scrollContainerRef.current) return;
    const rows = tbodyRef.current.querySelectorAll('tr[data-row]');
    const row = rows[rowIdx] as HTMLElement | undefined;
    if (!row) return;
    const container = scrollContainerRef.current;
    const rowTop    = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const headerH   = 22;
    if (rowTop < container.scrollTop + headerH) container.scrollTop = rowTop - headerH;
    else if (rowBottom > container.scrollTop + container.clientHeight) container.scrollTop = rowBottom - container.clientHeight;
  }, []);

  const handleEdit = useCallback(() => {
    const tx = transactions.find(t => t.id === selectedTxId);
    if (tx) onEditTransaction(tx);
  }, [transactions, selectedTxId, onEditTransaction]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
      const total = filteredTransactions.length;
      if (total === 0) return;
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
      if (selectedTxId) {
        if (e.key === 'ArrowRight') { e.preventDefault(); setFocusedColIdx(p => p < COL_COUNT - 1 ? p + 1 : 0); return; }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); setFocusedColIdx(p => p > 0 ? p - 1 : COL_COUNT - 1); return; }
        if (e.key === 'Tab')        { e.preventDefault(); setFocusedColIdx(p => e.shiftKey ? (p > 0 ? p - 1 : COL_COUNT - 1) : (p < COL_COUNT - 1 ? p + 1 : 0)); return; }
        if (e.key === 'Delete')     { setIsDeleteDialogOpen(true); return; }
        if (e.key === 'Enter')      { handleEdit(); return; }
        if (e.key === 'Escape')     { setSelectedTxId(null); setFocusedRowIdx(-1); setFocusedColIdx(0); return; }
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
      t.value = title; t.font = { name: 'Arial', bold: true, size: 13, color: { argb: 'FF' + C.TITLE_FONT } };
      t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.TITLE_BG } };
      t.alignment = { horizontal: 'center', vertical: 'middle' }; sheet.getRow(1).height = 24;
      sheet.mergeCells(2, 1, 2, n);
      const m = sheet.getCell(2, 1);
      m.value = `Periode: ${fmtDate(exportStart)} – ${fmtDate(exportEnd)}  |  Gudang: ${whName ?? 'Semua'}  |  Tipe: ${exportType !== 'ALL' ? exportType : 'Semua'}  |  Partner: ${exportPartner !== 'ALL' ? exportPartner : 'Semua'}  |  Dibuat: ${new Date().toLocaleString('id-ID')}`;
      m.font = { name: 'Arial', italic: true, size: 8, color: { argb: 'FF' + C.META_FONT } };
      m.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.META_BG } };
      m.alignment = { horizontal: 'center', vertical: 'middle' }; sheet.getRow(2).height = 16; sheet.getRow(3).height = 4;
    };
    if (exportMode === 'detail') {
      const sheet = wb.addWorksheet('Detail Transaksi', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 }, views: [{ state: 'frozen', ySplit: 4 }] });
      const COLS = [
        { h: 'NO', k: 'no', w: 5, a: 'center' as const },
        { h: 'NO. REFERENSI', k: 'ref', w: 20, a: 'left' as const },
        { h: 'TANGGAL', k: 'dt', w: 12, a: 'center' as const },
        { h: 'TIPE', k: 'tp', w: 10, a: 'center' as const },
        { h: 'GUDANG', k: 'gd', w: 18, a: 'left' as const },
        { h: 'PARTNER', k: 'pt', w: 22, a: 'left' as const },
        { h: 'KETERANGAN', k: 'nt', w: 26, a: 'left' as const },
        { h: 'SKU', k: 'sk', w: 14, a: 'left' as const },
        { h: 'NAMA BARANG', k: 'nm', w: 30, a: 'left' as const },
        { h: 'QTY', k: 'qt', w: 10, a: 'right' as const },
        { h: 'SATUAN', k: 'st', w: 10, a: 'center' as const },
        { h: 'BASE QTY', k: 'bq', w: 12, a: 'right' as const },
        { h: 'CATATAN', k: 'ct', w: 20, a: 'left' as const },
      ];
      sheet.columns = COLS.map(c => ({ key: c.k, width: c.w }));
      buildHeader(sheet, 'DETAIL TRANSAKSI MUTASI BARANG', COLS.length);
      const hRow = sheet.getRow(4); hRow.height = 20;
      COLS.forEach((col, i) => { const cell = hRow.getCell(i + 1); cell.value = col.h; sHead(cell); });
      sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: COLS.length } };
      let excelRow = 5; let rowNo = 1; let totalQtyBase = 0;
      exportPreviewData.forEach(tx => {
        const gudang = warehouses.find(w => w.id === tx.sourceWarehouseId)?.name ?? '-';
        const itemList = tx.items.length > 0 ? tx.items : [null];
        itemList.forEach((item: any, idx) => {
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
            sCell(cell, { align: COLS[ci].a, bg, bold: ci === 1 && first, color: ci === 3 ? typeFont(tx.type) : isNum ? '0F172A' : undefined, numFmt: isNum ? '#,##0.##' : undefined });
          });
          if (item) totalQtyBase += Number(item.baseQty ?? item.qty) || 0;
          excelRow++; if (first) rowNo++;
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
      const sheet = wb.addWorksheet('Ringkasan Transaksi', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 }, views: [{ state: 'frozen', ySplit: 4 }] });
      const COLS = [
        { h: 'NO', k: 'no', w: 5, a: 'center' as const },
        { h: 'NO. REFERENSI', k: 'rf', w: 20, a: 'left' as const },
        { h: 'TANGGAL', k: 'dt', w: 12, a: 'center' as const },
        { h: 'TIPE', k: 'tp', w: 10, a: 'center' as const },
        { h: 'GUDANG', k: 'gd', w: 20, a: 'left' as const },
        { h: 'PARTNER', k: 'pt', w: 24, a: 'left' as const },
        { h: 'KETERANGAN', k: 'nt', w: 28, a: 'left' as const },
        { h: 'JML ITEM', k: 'it', w: 10, a: 'center' as const },
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
        vals.forEach((val, ci) => { const cell = row.getCell(ci + 1); cell.value = val as any; sCell(cell, { align: COLS[ci].a, bg: typeBg(tx.type), bold: ci === 1, color: ci === 3 ? typeFont(tx.type) : undefined, numFmt: ci === 7 ? '#,##0' : undefined }); });
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
    const info = wb.addWorksheet('Info Export');
    info.columns = [{ width: 28 }, { width: 40 }];
    ([
      ['GudangPro System', ''], ['', ''], ['Parameter Export', ''],
      ['Format', exportMode === 'detail' ? 'Detail per Item' : 'Ringkasan'],
      ['Periode Dari', fmtDate(exportStart)], ['Periode Sampai', fmtDate(exportEnd)],
      ['Gudang', whName ?? 'Semua Gudang'], ['Tipe', exportType !== 'ALL' ? exportType : 'Semua'],
      ['Partner', exportPartner !== 'ALL' ? exportPartner : 'Semua'], ['Pencarian', exportSearch || '-'],
      ['', ''], ['Total Transaksi', exportPreviewData.length],
      ['Total Baris Data', exportPreviewRowCount], ['Waktu Export', new Date().toLocaleString('id-ID')],
    ] as [string, any][]).forEach(([k, v], i) => {
      const row = info.getRow(i + 1);
      const c1 = row.getCell(1); const c2 = row.getCell(2);
      c1.value = k; c2.value = v;
      if (i === 0) { c1.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF2563EB' } }; }
      else if (i === 2) { c1.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }; [c1, c2].forEach(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }; }); }
      else { c1.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FF475569' } }; c2.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } }; if (i > 2 && i % 2 === 1) [c1, c2].forEach(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }; }); }
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

  // ─────────────────────────────────────────────
  // RENDER — Accurate 5 Layout
  // ─────────────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: '#f0f0f0', fontFamily: A5.font, fontSize: 12, overflow: 'hidden',
        position: 'relative',
      }}
    >

      {/* ══════════════════════════════════════════
          1. TITLE BAR
         ══════════════════════════════════════════ */}
      <div style={{
        background: `linear-gradient(to bottom, #2a4a80, ${A5.navyDark})`,
        height: 32, display: 'flex', alignItems: 'center', padding: '0 10px',
        borderBottom: '2px solid #0f2244', flexShrink: 0,
      }}>
        <FileSpreadsheet size={14} color="#a0c4f0" style={{ marginRight: 7 }} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>
          Laporan Mutasi Barang
        </span>
        <span style={{
          marginLeft: 10, background: '#3a6ea8', color: '#e8eef8',
          fontSize: 9, fontWeight: 600, padding: '1px 7px', borderRadius: 3,
          letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.2)',
        }}>
          GudangPro System v2.1
        </span>
      </div>

      {/* ══════════════════════════════════════════
          2. TOOLBAR
         ══════════════════════════════════════════ */}
      <div style={{
        height: 34, background: A5.toolbarBg, borderBottom: `1px solid ${A5.toolbarBdr}`,
        display: 'flex', alignItems: 'center', gap: 3, padding: '0 8px', flexShrink: 0,
      }}>
        {/* New dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            ref={newButtonRef as any}
            onClick={() => setShowNewDropdown(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, height: 24, padding: '2px 8px',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: showNewDropdown
                ? 'linear-gradient(to bottom, #d0ddf0, #bdd0ec)'
                : 'linear-gradient(to bottom, #3a8a5a, #2e7048)',
              color: showNewDropdown ? A5.navyDark : '#fff',
              border: `1px solid ${showNewDropdown ? '#6a94cc' : '#1e6038'}`,
              borderRadius: 3, boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              fontFamily: A5.font,
            }}
          >
            <Plus size={13} /> Baru <ChevronDown size={10} style={{ marginLeft: 1 }} />
          </button>
          {showNewDropdown && (
            <div
              ref={dropdownRef}
              style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 2,
                background: '#fff', border: '1px solid #b8b8b8',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100,
                borderRadius: 3, overflow: 'hidden', minWidth: 180,
              }}
            >
              {([
                { type: 'IN'       as TransactionType, label: 'Penerimaan (IN)',    icon: ArrowDown,   color: '#1a6b3a' },
                { type: 'OUT'      as TransactionType, label: 'Pengiriman (OUT)',   icon: ArrowUp,     color: '#8b1a1a' },
                { type: 'TRANSFER' as TransactionType, label: 'Transfer Gudang',    icon: ArrowUpDown, color: '#1a3a6e' },
              ]).map(({ type, label, icon: Icon, color }) => (
                <button
                  key={type}
                  onClick={() => { onCreateTransaction(type); setShowNewDropdown(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '6px 12px', background: 'none', border: 'none',
                    fontSize: 11, fontWeight: 600, color, cursor: 'pointer',
                    textAlign: 'left', fontFamily: A5.font,
                    borderBottom: '1px solid #f0f0f0',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = '#f0f4f8')}
                  onMouseOut={e => (e.currentTarget.style.background = 'none')}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <TDivider />

        <TBtn icon={Edit3}  label="Ubah"  onClick={handleEdit}                        disabled={!selectedTxId} />
        <TBtn icon={Trash2} label="Hapus" onClick={() => setIsDeleteDialogOpen(true)} disabled={!selectedTxId} danger />

        <TDivider />

        <TBtn icon={RefreshCw}      label="Segarkan"      onClick={refreshData}         loading={isLoading} />
        <TBtn icon={FileSpreadsheet} label="Export Excel" onClick={handleOpenExportModal} />
      </div>

      {/* ══════════════════════════════════════════
          3. FILTER BAR  (Accurate 5 panel filter)
         ══════════════════════════════════════════ */}
      <div style={{
        background: '#fafafa', borderBottom: '1px solid #c0c0c0',
        padding: '5px 10px', display: 'flex', alignItems: 'flex-end', gap: 10, flexShrink: 0,
      }}>
        {/* Date range */}
        <AccField label="Periode">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={11} color="#6a7a90" style={{ flexShrink: 0 }} />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={A5.inputStyle} />
            <span style={{ fontSize: 10, color: '#999' }}>s/d</span>
            <input type="date" value={endDate}   onChange={e => setEndDate(e.target.value)}   style={A5.inputStyle} />
          </div>
        </AccField>

        {/* Warehouse filter */}
        <AccField label="Gudang" style={{ minWidth: 130 }}>
          <select
            value={filterWhFrom}
            onChange={e => setFilterWhFrom(e.target.value)}
            style={{ ...A5.inputStyle, width: '100%' }}
          >
            <option value="ALL">Semua Gudang</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </AccField>

        {/* Type filter — toggle buttons Accurate 5 style */}
        <AccField label="Tipe Transaksi">
          <div style={{ display: 'flex', gap: 2, height: 22 }}>
            {(['ALL', 'IN', 'OUT', 'TRANSFER'] as const).map(t => {
              const active = filterType === t;
              const colors: Record<string, { bg: string; border: string; color: string }> = {
                ALL:      { bg: active ? '#3a6ea8' : '#f0f0f0', border: active ? '#1e3a6e' : '#b0b0b0', color: active ? '#fff' : '#444' },
                IN:       { bg: active ? '#1a6b3a' : '#f0f0f0', border: active ? '#0e4422' : '#b0b0b0', color: active ? '#fff' : '#444' },
                OUT:      { bg: active ? '#8b1a1a' : '#f0f0f0', border: active ? '#5c0f0f' : '#b0b0b0', color: active ? '#fff' : '#444' },
                TRANSFER: { bg: active ? '#1a3a6e' : '#f0f0f0', border: active ? '#0e2244' : '#b0b0b0', color: active ? '#fff' : '#444' },
              };
              const c = colors[t];
              return (
                <button key={t} onClick={() => setFilterType(t)} style={{
                  padding: '0 8px', height: '100%', fontSize: 10, fontWeight: 700,
                  background: c.bg, border: `1px solid ${c.border}`, color: c.color,
                  borderRadius: 2, cursor: 'pointer', fontFamily: A5.font,
                  letterSpacing: '0.04em',
                }}>
                  {t === 'ALL' ? 'Semua' : t}
                </button>
              );
            })}
          </div>
        </AccField>

        {/* Search */}
        <AccField label="Cari" style={{ flex: 1, maxWidth: 240 }}>
          <div style={{ position: 'relative' }}>
            <Search size={11} style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Ref, partner, keterangan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ ...A5.inputStyle, width: '100%', paddingLeft: 22, paddingRight: searchQuery ? 22 : 6 }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                <X size={11} />
              </button>
            )}
          </div>
        </AccField>

        {/* Active filter badge */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700,
              color: '#8b4a00', background: '#fff8e6', border: '1px solid #f0c860',
              padding: '2px 7px', borderRadius: 3,
            }}>
              <Filter size={9} /> {activeFilterCount} filter aktif
            </span>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          4. KEYBOARD HINT BAR (when row selected)
         ══════════════════════════════════════════ */}
      {selectedTxId && (
        <div style={{
          height: 22, background: 'linear-gradient(to bottom, #3a6ea8, #2d5a8c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          fontSize: 9, color: '#c8d8f0', flexShrink: 0,
        }}>
          {[['↑↓', 'Baris'], ['←→', 'Kolom'], ['↵', 'Edit'], ['Del', 'Hapus'], ['Esc', 'Batal']].map(([key, desc]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <kbd style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 2, padding: '0 4px', fontSize: 9, fontWeight: 700, color: '#fff' }}>{key}</kbd>
              <span style={{ color: '#9ab8d8' }}>{desc}</span>
            </span>
          ))}
          <span style={{ marginLeft: 8, background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)', color: '#ffd700', padding: '1px 8px', borderRadius: 3, fontSize: 9, fontWeight: 700 }}>
            Baris {focusedRowIdx + 1} · {COLUMNS[focusedColIdx].label}
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════
          5. DATA GRID
         ══════════════════════════════════════════ */}
      <div
        ref={scrollContainerRef}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: '#fff', position: 'relative' }}
      >
        {/* Loading overlay */}
        {isLoading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'rgba(255,255,255,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#fff', border: '1px solid #d0d8e8',
              borderRadius: 4, padding: '8px 16px', fontSize: 11,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
              <RefreshCw size={13} className="animate-spin" color={A5.navyMid} />
              <span style={{ color: '#555' }}>Memuat data...</span>
            </div>
          </div>
        )}

        <table style={{
          width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed',
          minWidth: 860, fontSize: 11,
        }}>
          {/* Sticky header */}
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ height: 22, background: A5.headerBg, borderBottom: `2px solid ${A5.navyDark}` }}>
              <SortTh label="Referensi"  sortKey="referenceNo" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} width="16%"  focused={isFocusedCol(0)} />
              <SortTh label="Tanggal"    sortKey="date"        currentKey={sortKey} currentDir={sortDir} onSort={handleSort} width="10%"  focused={isFocusedCol(1)} />
              <PlainTh label="Tipe"  width="8%"  align="center" focused={isFocusedCol(2)} />
              <SortTh label="Partner"    sortKey="partnerName" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} width="18%"  focused={isFocusedCol(3)} />
              <PlainTh label="Keterangan" width="20%" focused={isFocusedCol(4)} />
              <PlainTh label="Gudang"     width="18%" focused={isFocusedCol(5)} />
              <PlainTh label="Items" width="10%" align="center" focused={isFocusedCol(6)} />
            </tr>
          </thead>

          <tbody ref={tbodyRef}>
            {filteredTransactions.map((tx, rowIdx) => {
              const isSel  = selectedTxId === tx.id;
              const isEven = rowIdx % 2 === 0;
              const whName = warehouses.find(w => w.id === tx.sourceWarehouseId)?.name ?? '-';

              // Cell background helpers
              const bg = isSel ? A5.rowSel : isEven ? A5.rowOdd : A5.rowEven;
              const cellFocusBg = (colIdx: number) =>
                isSel
                  ? (isFocusedCol(colIdx) ? '#1a4a7a' : A5.rowSel)
                  : (isFocusedCol(colIdx) ? '#d8e8f8' : bg);

              return (
                <tr
                  key={tx.id}
                  data-row={rowIdx}
                  onClick={() => {
                    if (isSel) { setSelectedTxId(null); setFocusedRowIdx(-1); setFocusedColIdx(0); }
                    else { setSelectedTxId(tx.id); setFocusedRowIdx(rowIdx); setFocusedColIdx(0); }
                  }}
                  onDoubleClick={() => { setSelectedTxId(tx.id); setFocusedRowIdx(rowIdx); onEditTransaction(tx); }}
                  style={{
                    height: 22, cursor: 'pointer',
                    borderBottom: `1px solid ${isSel ? '#1a3a6e' : '#e0e8f0'}`,
                    background: bg,
                    transition: 'background 0.05s',
                  }}
                  onMouseOver={e => { if (!isSel) e.currentTarget.style.background = A5.rowHover; }}
                  onMouseOut={e => { if (!isSel) e.currentTarget.style.background = bg; }}
                >
                  {/* Referensi */}
                  <td style={{
                    padding: '0 7px', fontFamily: 'Consolas, monospace', fontSize: 10,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    borderRight: A5.cellBdr, background: cellFocusBg(0),
                    color: isSel ? '#c8dcf8' : '#1a3a6e', fontWeight: isSel ? 400 : 600,
                  }}>
                    {tx.referenceNo}
                  </td>
                  {/* Tanggal */}
                  <td style={{
                    padding: '0 7px', fontFamily: 'Consolas, monospace', fontSize: 10,
                    borderRight: A5.cellBdr, background: cellFocusBg(1),
                    color: isSel ? '#a0c0e8' : '#555',
                  }}>
                    {tx.date}
                  </td>
                  {/* Tipe */}
                  <td style={{
                    textAlign: 'center', borderRight: A5.cellBdr, background: cellFocusBg(2),
                  }}>
                    <TypeBadge type={tx.type} selected={isSel} />
                  </td>
                  {/* Partner */}
                  <td style={{
                    padding: '0 7px', fontSize: 11, fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    borderRight: A5.cellBdr, background: cellFocusBg(3),
                    color: isSel ? '#fff' : '#1a1a2e',
                  }}>
                    {tx.partnerName || '-'}
                  </td>
                  {/* Keterangan */}
                  <td style={{
                    padding: '0 7px', fontSize: 10, fontStyle: 'italic',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    borderRight: A5.cellBdr, background: cellFocusBg(4),
                    color: isSel ? '#a0c0e8' : '#666',
                  }} title={tx.notes}>
                    {tx.notes || '-'}
                  </td>
                  {/* Gudang */}
                  <td style={{
                    padding: '0 7px', fontSize: 10, fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    borderRight: A5.cellBdr, background: cellFocusBg(5),
                    color: isSel ? '#a0c0e8' : '#444',
                    textTransform: 'uppercase', letterSpacing: '0.02em',
                  }}>
                    {whName}
                  </td>
                  {/* Items count */}
                  <td style={{
                    textAlign: 'center', fontFamily: 'Consolas, monospace', fontWeight: 700,
                    background: cellFocusBg(6),
                    color: isSel ? '#fff' : '#3a6ea8',
                    fontSize: 11,
                  }}>
                    {tx.items.length}
                  </td>
                </tr>
              );
            })}

            {/* Empty state */}
            {filteredTransactions.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} style={{ padding: '40px 0', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#aaa' }}>
                    <Info size={20} style={{ opacity: 0.3 }} />
                    <span style={{ fontSize: 12, fontStyle: 'italic' }}>
                      {activeFilterCount > 0 ? 'Tidak ada transaksi yang cocok dengan filter aktif' : 'Tidak ada data transaksi ditemukan'}
                    </span>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => { setSearchQuery(''); setFilterWhFrom('ALL'); setFilterType('ALL'); }}
                        style={{ fontSize: 11, color: A5.navyMid, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                      >
                        Reset Filter
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════
          6. STATUS BAR
         ══════════════════════════════════════════ */}
      <div style={{
        height: 24, background: A5.statusBg, borderTop: `1px solid ${A5.toolbarBdr}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 10px', fontSize: 10, color: '#555', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Info size={10} color={A5.navyMid} />
            {activeFilterCount > 0 ? (
              <>{filteredTransactions.length} <span style={{ color: '#888', margin: '0 2px' }}>dari</span> {transactions.length} Transaksi</>
            ) : (
              <><strong style={{ color: A5.navyDark }}>{transactions.length}</strong> Transaksi</>
            )}
          </span>
          {activeFilterCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#8b4a00', fontWeight: 600 }}>
              <Filter size={9} /> {activeFilterCount} filter aktif
            </span>
          )}
          {selectedTxId && (
            <span style={{ color: A5.navyMid, fontWeight: 600 }}>
              Baris {focusedRowIdx + 1} · Kolom: <strong>{COLUMNS[focusedColIdx].label}</strong>
            </span>
          )}
        </div>
        <div style={{ color: '#888', fontStyle: 'italic', fontSize: 9 }}>GudangPro System v2.1</div>
      </div>

      {/* ══════════════════════════════════════════
          MODAL: DELETE CONFIRM
         ══════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════
          MODAL: EXPORT EXCEL  (Accurate 5 dialog)
         ══════════════════════════════════════════ */}
      {showExportModal && (
        <ModalPortal>
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: '#fff', width: 520, maxHeight: '90vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              border: '1px solid #b0b8c8', borderRadius: 4, overflow: 'hidden',
              fontFamily: A5.font,
            }}>
              {/* Dialog title bar */}
              <div style={{
                background: `linear-gradient(to bottom, ${A5.navyLight}, ${A5.navyMid})`,
                padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 22, height: 22, background: '#27ae60', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileSpreadsheet size={13} color="#fff" />
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Export Excel</div>
                    <div style={{ color: '#a0c0e0', fontSize: 9 }}>Konfigurasi filter dan format ekspor</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, color: '#fff', cursor: 'pointer', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseOver={e => (e.currentTarget.style.background = '#c0392b')}
                  onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                >
                  <X size={13} />
                </button>
              </div>

              {/* Dialog body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Format selector */}
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#6a7a90', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Format Export</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {(['detail', 'summary'] as const).map(mode => {
                      const active = exportMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => setExportMode(mode)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px',
                            background: active ? '#eef4ff' : '#fafafa',
                            border: `2px solid ${active ? A5.navyLight : '#d0d8e8'}`,
                            borderRadius: 4, cursor: 'pointer', textAlign: 'left', fontFamily: A5.font,
                          }}
                        >
                          {mode === 'detail'
                            ? <Layers size={15} color={active ? A5.navyLight : '#aaa'} style={{ marginTop: 1, flexShrink: 0 }} />
                            : <AlignLeft size={15} color={active ? A5.navyLight : '#aaa'} style={{ marginTop: 1, flexShrink: 0 }} />}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: active ? A5.navyDark : '#555' }}>
                              {mode === 'detail' ? 'Detail per Item' : 'Ringkasan'}
                            </div>
                            <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>
                              {mode === 'detail' ? 'Satu baris per barang. SKU, nama, qty, satuan.' : 'Satu baris per transaksi. Tanpa detail item.'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Period */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <AccField label="Dari">
                    <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} style={{ ...A5.inputStyle, width: '100%' }} />
                  </AccField>
                  <AccField label="Sampai">
                    <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} style={{ ...A5.inputStyle, width: '100%' }} />
                  </AccField>
                </div>

                {/* Filters */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <AccField label="Gudang">
                    <select value={exportWh} onChange={e => setExportWh(e.target.value)} style={{ ...A5.inputStyle, width: '100%' }}>
                      <option value="ALL">Semua Gudang</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </AccField>
                  <AccField label="Tipe">
                    <select value={exportType} onChange={e => setExportType(e.target.value as any)} style={{ ...A5.inputStyle, width: '100%' }}>
                      <option value="ALL">Semua Tipe</option>
                      <option value="IN">IN — Penerimaan</option>
                      <option value="OUT">OUT — Pengiriman</option>
                      <option value="TRANSFER">TRANSFER</option>
                    </select>
                  </AccField>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <AccField label="Partner">
                      <select value={exportPartner} onChange={e => setExportPartner(e.target.value)} style={{ ...A5.inputStyle, width: '100%' }}>
                        <option value="ALL">Semua Partner</option>
                        {uniquePartners.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </AccField>
                  </div>
                </div>

                {/* Search */}
                <AccField label="Pencarian (Opsional)">
                  <div style={{ position: 'relative' }}>
                    <Search size={11} style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      placeholder="Ref, partner, catatan, nama barang, SKU..."
                      value={exportSearch}
                      onChange={e => setExportSearch(e.target.value)}
                      style={{ ...A5.inputStyle, width: '100%', paddingLeft: 22 }}
                    />
                  </div>
                </AccField>

                {/* Preview count */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 4,
                  background: exportPreviewData.length === 0 ? '#fff0f0' : '#f0fff4',
                  border: `1px solid ${exportPreviewData.length === 0 ? '#f5b0b0' : '#a3d9b5'}`,
                }}>
                  <span style={{ fontSize: 11, color: '#555' }}>
                    <strong style={{ fontSize: 14, color: exportPreviewData.length === 0 ? '#c0392b' : '#1a6b3a' }}>
                      {exportPreviewData.length}
                    </strong> transaksi akan diekspor
                  </span>
                  <span style={{ fontSize: 10, color: '#666' }}>
                    <strong style={{ color: '#333' }}>{exportPreviewRowCount}</strong> baris di Excel
                    {exportMode === 'detail' && exportPreviewData.length > 0 && (
                      <span style={{ marginLeft: 4, color: '#999' }}>({exportPreviewData.reduce((a, tx) => a + tx.items.length, 0)} item)</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Dialog footer */}
              <div style={{
                padding: '8px 12px', background: '#f5f5f5', borderTop: '1px solid #e0e0e0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <button
                  onClick={() => { setExportStart(startDate); setExportEnd(endDate); setExportWh('ALL'); setExportType('ALL'); setExportPartner('ALL'); setExportSearch(''); }}
                  style={{ fontSize: 10, color: '#888', background: 'none', border: 'none', cursor: 'pointer', fontFamily: A5.font }}
                >
                  Reset Filter
                </button>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setShowExportModal(false)}
                    style={{
                      padding: '4px 12px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      background: 'linear-gradient(to bottom, #fafafa, #ebebeb)',
                      border: '1px solid #b0b0b0', borderRadius: 3, color: '#333', fontFamily: A5.font,
                    }}
                    onMouseOver={e => (e.currentTarget.style.filter = 'brightness(0.95)')}
                    onMouseOut={e => (e.currentTarget.style.filter = 'none')}
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleRunExport}
                    disabled={exportPreviewData.length === 0}
                    style={{
                      padding: '4px 14px', fontSize: 11, fontWeight: 700, cursor: exportPreviewData.length === 0 ? 'not-allowed' : 'pointer',
                      background: 'linear-gradient(to bottom, #3a8a5a, #2e7048)',
                      border: '1px solid #1e6038', borderRadius: 3, color: '#fff',
                      display: 'flex', alignItems: 'center', gap: 5,
                      opacity: exportPreviewData.length === 0 ? 0.5 : 1,
                      fontFamily: A5.font, boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }}
                    onMouseOver={e => { if (exportPreviewData.length > 0) e.currentTarget.style.filter = 'brightness(1.08)'; }}
                    onMouseOut={e => (e.currentTarget.style.filter = 'none')}
                  >
                    <Download size={13} /> Export {exportPreviewRowCount} Baris
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      <style>{`
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f0f0f0; }
        ::-webkit-scrollbar-thumb { background: #b8c8d8; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #3a6ea8; }
      `}</style>
    </div>
  );
};
