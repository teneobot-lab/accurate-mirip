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
import * as XLSX from 'xlsx';

// ─── FIX: ModalPortal — render modal langsung ke document.body
// Mengatasi modal yang terjebak di overflow/transform parent
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

// ─── Sort header ───
interface SortThProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}
const SortTh: React.FC<SortThProps> = ({ label, sortKey, currentKey, currentDir, onSort, className = '' }) => {
  const active = currentKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-3 py-1 text-[9px] font-extrabold text-slate-700 uppercase tracking-tight cursor-pointer select-none hover:bg-mist-400/30 transition-colors ${className}`}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? (currentDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
          : <ArrowUpDown size={9} className="opacity-30" />}
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

// ─── Reusable label+select ───
const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}> = ({ label, value, onChange, children }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-1.5 bg-white border border-mist-200 rounded text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-400"
    >
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

  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ─── Main filters ───
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWhFrom, setFilterWhFrom] = useState('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT' | 'TRANSFER'>('ALL');
  const [isFilterDateActive, setIsFilterDateActive] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [sortKey, setSortKey] = useState<SortKey | null>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ─── Export modal state ───
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('detail');
  const [exportStart, setExportStart] = useState(startDate);
  const [exportEnd, setExportEnd] = useState(endDate);
  const [exportWh, setExportWh] = useState('ALL');
  const [exportType, setExportType] = useState<'ALL' | 'IN' | 'OUT' | 'TRANSFER'>('ALL');
  const [exportPartner, setExportPartner] = useState('ALL');
  const [exportSearch, setExportSearch] = useState('');

  // ─── refreshData ───
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
    } catch (error) {
      showToast('Gagal memuat data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isFilterDateActive, startDate, endDate, showToast]);

  useEffect(() => { refreshData(); }, [refreshData]);

  // ─── Click-outside dropdown ───
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

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedTxId) return;
      if (e.key === 'Delete') setIsDeleteDialogOpen(true);
      if (e.key === 'Enter') handleEdit();
      if (e.key === 'Escape') setSelectedTxId(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedTxId]);

  // ─── Filtered transactions for main table ───
  const filteredTransactions = useMemo(() => {
    const lower = searchQuery.toLowerCase().trim();
    let result = transactions.filter(tx => {
      const matchSearch = !lower ||
        tx.referenceNo.toLowerCase().includes(lower) ||
        (tx.partnerName?.toLowerCase().includes(lower)) ||
        (tx.notes?.toLowerCase().includes(lower));
      const matchWhFrom = filterWhFrom === 'ALL' || tx.sourceWarehouseId === filterWhFrom;
      const matchType = filterType === 'ALL' || tx.type === filterType;
      return matchSearch && matchWhFrom && matchType;
    });
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const valA: string = (a as any)[sortKey] ?? '';
        const valB: string = (b as any)[sortKey] ?? '';
        const cmp = valA.localeCompare(valB);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [transactions, searchQuery, filterWhFrom, filterType, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ─── Unique partner list dari data transaksi ───
  const uniquePartners = useMemo(() => {
    const seen = new Set<string>();
    return transactions
      .filter(tx => tx.partnerName && !seen.has(tx.partnerName) && seen.add(tx.partnerName))
      .map(tx => tx.partnerName!);
  }, [transactions]);

  // ─── Data hasil filter export modal ───
  const exportPreviewData = useMemo(() => {
    const lower = exportSearch.toLowerCase().trim();
    return transactions.filter(tx => {
      const matchDate = tx.date >= exportStart && tx.date <= exportEnd;
      const matchWh = exportWh === 'ALL' || tx.sourceWarehouseId === exportWh;
      const matchType = exportType === 'ALL' || tx.type === exportType;
      const matchPartner = exportPartner === 'ALL' || tx.partnerName === exportPartner;
      const matchSearch = !lower ||
        tx.referenceNo.toLowerCase().includes(lower) ||
        (tx.partnerName?.toLowerCase().includes(lower)) ||
        (tx.notes?.toLowerCase().includes(lower)) ||
        tx.items.some(it => (it as any).name?.toLowerCase().includes(lower) || (it as any).code?.toLowerCase().includes(lower));
      return matchDate && matchWh && matchType && matchPartner && matchSearch;
    });
  }, [transactions, exportStart, exportEnd, exportWh, exportType, exportPartner, exportSearch]);

  const exportPreviewRowCount = useMemo(() => {
    if (exportMode === 'summary') return exportPreviewData.length;
    return exportPreviewData.reduce((acc, tx) => acc + tx.items.length, 0);
  }, [exportPreviewData, exportMode]);

  // ─── Handle open export modal (sync filters dari main) ───
  const handleOpenExportModal = () => {
    setExportStart(startDate);
    setExportEnd(endDate);
    setExportWh(filterWhFrom);
    setExportType(filterType);
    setExportPartner('ALL');
    setExportSearch('');
    setExportMode('detail');
    setShowExportModal(true);
  };

  // ─── Export Excel ───
  const handleRunExport = () => {
    if (exportPreviewData.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'warning');
      return;
    }

    const wb = XLSX.utils.book_new();
    const whName = warehouses.find(w => w.id === exportWh)?.name;

    if (exportMode === 'summary') {
      // Satu baris per transaksi
      const rows = exportPreviewData.map((tx, i) => ({
        'No': i + 1,
        'No. Referensi': tx.referenceNo,
        'Tanggal': tx.date,
        'Tipe': tx.type,
        'Gudang': warehouses.find(w => w.id === tx.sourceWarehouseId)?.name ?? '-',
        'Partner': tx.partnerName ?? '-',
        'Keterangan': tx.notes ?? '-',
        'Jumlah Item': tx.items.length,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 5 }, { wch: 18 }, { wch: 12 }, { wch: 8 },
        { wch: 18 }, { wch: 20 }, { wch: 25 }, { wch: 10 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Ringkasan');
    } else {
      // Satu baris per item transaksi
      const rows: object[] = [];
      let rowNo = 1;
      exportPreviewData.forEach(tx => {
        const gudang = warehouses.find(w => w.id === tx.sourceWarehouseId)?.name ?? '-';
        if (tx.items.length === 0) {
          rows.push({
            'No': rowNo++,
            'No. Referensi': tx.referenceNo,
            'Tanggal': tx.date,
            'Tipe': tx.type,
            'Gudang': gudang,
            'Partner': tx.partnerName ?? '-',
            'Keterangan': tx.notes ?? '-',
            'Kode SKU': '-',
            'Nama Barang': '(tidak ada item)',
            'Qty Input': '-',
            'Satuan': '-',
            'Qty Base': '-',
            'Catatan Item': '-',
          });
        } else {
          tx.items.forEach((item: any, idx) => {
            rows.push({
              'No': rowNo++,
              'No. Referensi': idx === 0 ? tx.referenceNo : '',
              'Tanggal': idx === 0 ? tx.date : '',
              'Tipe': idx === 0 ? tx.type : '',
              'Gudang': idx === 0 ? gudang : '',
              'Partner': idx === 0 ? (tx.partnerName ?? '-') : '',
              'Keterangan': idx === 0 ? (tx.notes ?? '-') : '',
              'Kode SKU': item.code ?? item.sku ?? '-',
              'Nama Barang': item.name ?? '-',
              'Qty Input': item.qty ?? '-',
              'Satuan': item.unit ?? '-',
              'Qty Base': item.baseQty ?? item.qty ?? '-',
              'Catatan Item': item.note ?? item.reason ?? '-',
            });
          });
        }
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 5 }, { wch: 18 }, { wch: 12 }, { wch: 8 },
        { wch: 18 }, { wch: 20 }, { wch: 25 },
        { wch: 14 }, { wch: 30 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Detail Transaksi');
    }

    // Buat nama file dari filter aktif
    const parts = [
      'Mutasi',
      exportStart,
      exportEnd !== exportStart ? `sd_${exportEnd}` : '',
      whName ?? '',
      exportType !== 'ALL' ? exportType : '',
      exportPartner !== 'ALL' ? exportPartner.replace(/\s+/g, '_') : '',
    ].filter(Boolean);
    XLSX.writeFile(wb, `${parts.join('_')}.xlsx`);
    showToast(`Berhasil mengekspor ${exportPreviewRowCount} baris`, 'success');
    setShowExportModal(false);
  };

  const handleDelete = async () => {
    if (!selectedTxId) return;
    try {
      await StorageService.deleteTransaction(selectedTxId, false);
      showToast('Transaksi dihapus', 'success');
      setSelectedTxId(null);
      refreshData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Gagal menghapus transaksi', 'error');
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const handleHardDelete = async () => {
    if (!selectedTxId) return;
    try {
      await StorageService.deleteTransaction(selectedTxId, true);
      showToast('Transaksi dihapus paksa', 'success');
      setSelectedTxId(null);
      refreshData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Gagal menghapus transaksi', 'error');
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const handleEdit = useCallback(() => {
    const tx = transactions.find(t => t.id === selectedTxId);
    if (tx) onEditTransaction(tx);
  }, [transactions, selectedTxId, onEditTransaction]);

  const activeFilterCount = [
    filterWhFrom !== 'ALL',
    filterType !== 'ALL',
    !!searchQuery.trim(),
  ].filter(Boolean).length;

  const totalCount = transactions.length;
  const filteredCount = filteredTransactions.length;

  return (
    <div className="flex flex-col h-full bg-white font-sans overflow-hidden relative">

      {/* 1. STICKY ACTION TOOLBAR */}
      <div className="sticky top-0 h-10 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-2 shrink-0 z-30 shadow-md">
        <div className="flex items-center h-full">
          {/* New Transaction dropdown */}
          <div className="relative h-full flex items-center">
            <ToolBtn
              icon={Plus} label="Baru"
              onClick={() => setShowNewDropdown(v => !v)}
              active={showNewDropdown}
              customRef={newButtonRef}
              color="text-emerald-400"
            />
            {showNewDropdown && (
              <div ref={dropdownRef}
                className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 shadow-xl z-[100] w-44 rounded-lg overflow-hidden py-1 animate-in fade-in slide-in-from-top-1">
                <button onClick={() => { onCreateTransaction('IN'); setShowNewDropdown(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700 text-[10px] font-semibold text-emerald-400 flex items-center gap-2 transition-colors">
                  <ArrowDown size={12} /> Penerimaan (IN)
                </button>
                <button onClick={() => { onCreateTransaction('OUT'); setShowNewDropdown(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700 text-[10px] font-semibold text-rose-400 flex items-center gap-2 transition-colors">
                  <ArrowUp size={12} /> Pengiriman (OUT)
                </button>
                <button onClick={() => { onCreateTransaction('TRANSFER'); setShowNewDropdown(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700 text-[10px] font-semibold text-sky-400 flex items-center gap-2 transition-colors">
                  <ArrowUpDown size={12} /> Transfer Gudang
                </button>
              </div>
            )}
          </div>

          <div className="hidden md:flex h-full items-center">
            <ToolBtn icon={Edit3} label="Ubah" onClick={handleEdit} disabled={!selectedTxId} color="text-blue-400" />
            <ToolBtn icon={Trash2} label="Hapus" onClick={() => setIsDeleteDialogOpen(true)} disabled={!selectedTxId} color="text-rose-400" />
          </div>
          <ToolBtn icon={RefreshCw} label="Segarkan" onClick={refreshData} loading={isLoading} />
          {/* FIX: Excel button sekarang buka modal export advance */}
          <ToolBtn icon={FileSpreadsheet} label="Excel" onClick={handleOpenExportModal} color="text-emerald-400" />
        </div>

        {/* Right side: filters */}
        <div className="flex items-center gap-2 px-2 h-full">
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded px-2 py-1">
            <Filter size={10} className="text-slate-400" />
            <select value={filterWhFrom} onChange={e => setFilterWhFrom(e.target.value)}
              className="bg-transparent text-[10px] font-bold text-slate-200 outline-none cursor-pointer w-28">
              <option value="ALL">Semua Gudang</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-0.5 bg-slate-800 border border-slate-700 rounded px-1.5 py-1">
            {(['ALL', 'IN', 'OUT', 'TRANSFER'] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors ${
                  filterType === t
                    ? t === 'ALL'      ? 'bg-slate-600 text-white'
                    : t === 'IN'       ? 'bg-emerald-600 text-white'
                    : t === 'TRANSFER' ? 'bg-sky-600 text-white'
                                       : 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}>
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded px-2 py-1 shadow-inner">
            <Calendar size={11} className="text-slate-400" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="text-[10px] font-bold outline-none border-none bg-transparent text-slate-200 w-24 [color-scheme:dark]" />
            <span className="text-slate-500 text-[10px]">/</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="text-[10px] font-bold outline-none border-none bg-transparent text-slate-200 w-24 [color-scheme:dark]" />
          </div>

          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text"
              placeholder="Cari ref, partner, ket..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-7 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold outline-none w-40 text-slate-200 focus:border-blue-500 placeholder:text-slate-500 shadow-inner transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors">
                <X size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. DATA GRID */}
      <div className="flex-1 overflow-auto bg-white pb-16 scroll-smooth custom-scrollbar">
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-white/60 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium bg-white border border-mist-200 shadow-sm px-4 py-2 rounded-full">
              <RefreshCw size={13} className="animate-spin text-blue-500" /> Memuat data...
            </div>
          </div>
        )}
        <table className="w-full border-collapse table-fixed text-left min-w-[860px]">
          <thead className="bg-mist-300 sticky top-0 z-10 shadow-[0_2px_4px_rgba(0,0,0,0.05)] border-b border-mist-400">
            <tr className="h-7">
              <SortTh label="Referensi"  sortKey="referenceNo" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="w-[15%]" />
              <SortTh label="Tanggal"    sortKey="date"        currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="w-[10%]" />
              <th className="px-3 py-1 text-[9px] font-extrabold text-slate-700 uppercase w-[8%] text-center tracking-tight">Tipe</th>
              <SortTh label="Partner"    sortKey="partnerName" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="w-[18%]" />
              <th className="px-3 py-1 text-[9px] font-extrabold text-slate-700 uppercase w-[19%] tracking-tight">Keterangan</th>
              <th className="px-3 py-1 text-[9px] font-extrabold text-slate-700 uppercase w-[17%] tracking-tight">Gudang</th>
              <th className="px-3 py-1 text-[9px] font-extrabold text-slate-700 uppercase w-[10%] text-center tracking-tight">Items</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist-50">
            {filteredTransactions.map(tx => {
              const isSelected = selectedTxId === tx.id;
              return (
                <tr key={tx.id}
                  onClick={() => setSelectedTxId(isSelected ? null : tx.id)}
                  onDoubleClick={() => { setSelectedTxId(tx.id); onEditTransaction(tx); }}
                  className={`h-7 cursor-pointer transition-all group ${
                    isSelected ? 'bg-blue-600 text-white shadow-inner' : 'hover:bg-mist-100 text-slate-700'
                  }`}>
                  <td className={`px-3 py-0.5 text-[10px] font-mono truncate ${isSelected ? 'text-white' : 'text-slate-600 group-hover:text-blue-600'}`}>{tx.referenceNo}</td>
                  <td className={`px-3 py-0.5 text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>{tx.date}</td>
                  <td className="px-3 py-0.5 text-center"><TypeBadge type={tx.type} selected={isSelected} /></td>
                  <td className={`px-3 py-0.5 text-[10px] font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-700'}`}>{tx.partnerName || '-'}</td>
                  <td className={`px-3 py-0.5 text-[10px] font-medium truncate ${isSelected ? 'text-blue-100' : 'text-slate-500'}`} title={tx.notes}>{tx.notes || '-'}</td>
                  <td className={`px-3 py-0.5 text-[9px] font-bold uppercase truncate ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                    {warehouses.find(w => w.id === tx.sourceWarehouseId)?.name ?? '-'}
                  </td>
                  <td className={`px-3 py-0.5 text-center text-[10px] font-bold font-mono ${isSelected ? 'text-white' : 'text-slate-400'}`}>{tx.items.length}</td>
                </tr>
              );
            })}
            {filteredTransactions.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400 italic text-[10px]">
                    <Info size={16} className="opacity-30" />
                    {activeFilterCount > 0 ? 'Tidak ada transaksi yang cocok dengan filter aktif' : 'Tidak ada data transaksi ditemukan'}
                    {activeFilterCount > 0 && (
                      <button onClick={() => { setSearchQuery(''); setFilterWhFrom('ALL'); setFilterType('ALL'); }}
                        className="mt-1 text-blue-500 hover:underline not-italic font-semibold">
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

      {/* 3. FLOATING ACTION BAR */}
      {selectedTxId && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in zoom-in-95 fade-in duration-200">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-800/95 text-white rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.35)] border border-slate-700 ring-4 ring-black/5">
            <div className="px-4 py-1.5 text-[11px] font-bold border-r border-slate-700/50 flex items-center gap-2 text-slate-200">
              <CheckCircle2 size={14} className="text-emerald-400" />
              1 Terpilih
              <span className="text-slate-500 font-mono text-[9px]">↵ Ubah · Del Hapus · Esc Batal</span>
            </div>
            <button onClick={handleEdit}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-[11px] font-bold transition-all shadow-lg active:scale-95">
              <Edit3 size={14} /> Ubah
            </button>
            <button onClick={() => setIsDeleteDialogOpen(true)}
              className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 rounded-full text-[11px] font-bold transition-all shadow-lg active:scale-95">
              <Trash2 size={14} /> Hapus
            </button>
            <button onClick={() => setSelectedTxId(null)}
              className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all ml-1">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* 4. STATUS BAR */}
      <div className="h-6 bg-mist-100 border-t border-mist-300 flex items-center justify-between px-3 text-[9px] font-semibold text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Info size={10} />
            {activeFilterCount > 0
              ? <>{filteredCount} <span className="text-slate-300">dari</span> {totalCount} Transaksi</>
              : <>{totalCount} Transaksi</>
            }
          </span>
          {activeFilterCount > 0 && (
            <span className="flex items-center gap-1 text-amber-500">
              <Filter size={9} /> {activeFilterCount} filter aktif
            </span>
          )}
        </div>
        <div className="italic">GudangPro System v2.1</div>
      </div>

      {/* ─── MODAL: DELETE CONFIRMATION ───
          FIX: ModalPortal → render ke document.body, bebas dari parent overflow
      */}
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

      {/* ─── MODAL: EXPORT EXCEL ADVANCE ───
          FIX: ModalPortal + detail per item + filter lengkap
      */}
      {showExportModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl border border-mist-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-5 py-4 border-b border-mist-200 bg-mist-50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <FileSpreadsheet size={14} className="text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-slate-800">Export Excel</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Konfigurasi filter dan format ekspor</p>
                  </div>
                </div>
                <button onClick={() => setShowExportModal(false)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5 overflow-y-auto">

                {/* Mode export */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Format Export</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setExportMode('detail')}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border-2 text-left transition-all ${
                        exportMode === 'detail' ? 'border-blue-500 bg-blue-50' : 'border-mist-200 hover:border-mist-300'
                      }`}
                    >
                      <Layers size={16} className={exportMode === 'detail' ? 'text-blue-600 mt-0.5 shrink-0' : 'text-slate-400 mt-0.5 shrink-0'} />
                      <div>
                        <div className={`text-[11px] font-bold ${exportMode === 'detail' ? 'text-blue-700' : 'text-slate-600'}`}>Detail per Item</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">Satu baris per barang dalam transaksi. Berisi SKU, nama, qty, satuan.</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setExportMode('summary')}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border-2 text-left transition-all ${
                        exportMode === 'summary' ? 'border-blue-500 bg-blue-50' : 'border-mist-200 hover:border-mist-300'
                      }`}
                    >
                      <AlignLeft size={16} className={exportMode === 'summary' ? 'text-blue-600 mt-0.5 shrink-0' : 'text-slate-400 mt-0.5 shrink-0'} />
                      <div>
                        <div className={`text-[11px] font-bold ${exportMode === 'summary' ? 'text-blue-700' : 'text-slate-600'}`}>Ringkasan</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">Satu baris per transaksi. Hanya header tanpa detail item.</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Filter tanggal */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Periode Tanggal</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400">Dari</label>
                      <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-mist-200 rounded text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-400" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400">Sampai</label>
                      <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-mist-200 rounded text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-400" />
                    </div>
                  </div>
                </div>

                {/* Filter advance */}
                <div className="grid grid-cols-2 gap-3">
                  <FilterSelect label="Gudang" value={exportWh} onChange={setExportWh}>
                    <option value="ALL">Semua Gudang</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </FilterSelect>

                  <FilterSelect label="Tipe Transaksi" value={exportType} onChange={v => setExportType(v as any)}>
                    <option value="ALL">Semua Tipe</option>
                    <option value="IN">IN — Penerimaan</option>
                    <option value="OUT">OUT — Pengiriman</option>
                    <option value="TRANSFER">TRANSFER</option>
                  </FilterSelect>

                  <div className="col-span-2">
                    <FilterSelect label="Partner (Supplier / Customer)" value={exportPartner} onChange={setExportPartner}>
                      <option value="ALL">Semua Partner</option>
                      {uniquePartners.map(p => <option key={p} value={p}>{p}</option>)}
                    </FilterSelect>
                  </div>
                </div>

                {/* Search tambahan */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Cari (Opsional)</label>
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Ref, partner, catatan, nama barang, SKU..."
                      value={exportSearch} onChange={e => setExportSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-mist-200 rounded text-[11px] font-medium text-slate-700 outline-none focus:border-blue-400" />
                  </div>
                </div>

                {/* Preview count */}
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
                  exportPreviewData.length === 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
                }`}>
                  <div className="text-[11px] font-semibold text-slate-600">
                    <span className={`font-bold text-[13px] ${exportPreviewData.length === 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {exportPreviewData.length}
                    </span>
                    {' '}transaksi akan diekspor
                  </div>
                  <div className="text-[10px] text-slate-500">
                    <span className="font-bold text-slate-700">{exportPreviewRowCount}</span> baris di Excel
                    {exportMode === 'detail' && exportPreviewData.length > 0 && (
                      <span className="ml-1 text-slate-400">({exportPreviewData.reduce((a, tx) => a + tx.items.length, 0)} item)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 bg-mist-50 border-t border-mist-200 flex justify-between items-center shrink-0">
                <button onClick={() => {
                  setExportStart(startDate); setExportEnd(endDate);
                  setExportWh('ALL'); setExportType('ALL');
                  setExportPartner('ALL'); setExportSearch('');
                }} className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                  Reset Filter
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setShowExportModal(false)}
                    className="px-4 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors">
                    Batal
                  </button>
                  <button onClick={handleRunExport}
                    disabled={exportPreviewData.length === 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5">
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
