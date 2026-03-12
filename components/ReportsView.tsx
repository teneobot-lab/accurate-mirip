import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Warehouse, TransactionType } from '../types';
import {
  Plus, Edit3, Trash2, RefreshCw, Search, Calendar,
  X, Info, FileSpreadsheet, ArrowDown, ArrowUp,
  CheckCircle2, Filter, ArrowUpDown, ChevronUp, ChevronDown,
} from 'lucide-react';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import * as XLSX from 'xlsx';

interface Props {
  onEditTransaction: (tx: Transaction) => void;
  onCreateTransaction: (type: TransactionType) => void;
}

type SortKey = 'date' | 'referenceNo' | 'type' | 'partnerName';
type SortDir = 'asc' | 'desc';

// ─── FIX #4: ToolBtn moved OUTSIDE component to prevent remount on every render ───
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

// ─── Sort header button ───
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
          : <ArrowUpDown size={9} className="opacity-30" />
        }
      </span>
    </th>
  );
};

// ─── Type badge (standalone to avoid duplication) ───
const TypeBadge: React.FC<{ type: string; selected?: boolean }> = ({ type, selected }) => {
  if (selected) return (
    <span className="px-1.5 py-0 rounded text-[8px] font-bold border bg-white/20 text-white border-white/20">
      {type}
    </span>
  );
  const cls =
    type === 'IN'         ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
    type === 'TRANSFER'   ? 'bg-sky-50 text-sky-600 border-sky-100' :
                            'bg-rose-50 text-rose-600 border-rose-100';
  return (
    <span className={`px-1.5 py-0 rounded text-[8px] font-bold border ${cls}`}>
      {type}
    </span>
  );
};

export const ReportsView: React.FC<Props> = ({ onEditTransaction, onCreateTransaction }) => {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  // ─── FIX #8: dropdown ref for click-outside detection ───
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterWhFrom, setFilterWhFrom] = useState('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT' | 'TRANSFER'>('ALL'); // IMPROVEMENT: type filter
  const [isFilterDateActive, setIsFilterDateActive] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // IMPROVEMENT: column sorting
  const [sortKey, setSortKey] = useState<SortKey | null>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ─── FIX #2 + #5: useCallback so refreshData is stable and safe as useEffect dep ───
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      // ─── FIX #3: Remove individual .catch() so outer catch actually works ───
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

  // ─── FIX #1: isFilterDateActive now included via refreshData dep ───
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ─── FIX #8: Close dropdown on click outside ───
  useEffect(() => {
    if (!showNewDropdown) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        newButtonRef.current && !newButtonRef.current.contains(e.target as Node)
      ) {
        setShowNewDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewDropdown]);

  // IMPROVEMENT: keyboard shortcuts (Delete / Enter)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedTxId) return;
      if (e.key === 'Delete') setIsDeleteDialogOpen(true);
      if (e.key === 'Enter') handleEdit();
      if (e.key === 'Escape') setSelectedTxId(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedTxId]); // handleEdit stable via useCallback below

  const filteredTransactions = useMemo(() => {
    const lower = searchQuery.toLowerCase().trim();
    let result = transactions.filter(tx => {
      const matchSearch = !lower ||
        tx.referenceNo.toLowerCase().includes(lower) ||
        (tx.partnerName?.toLowerCase().includes(lower)) ||
        (tx.notes?.toLowerCase().includes(lower)); // IMPROVEMENT: search notes too
      const matchWhFrom = filterWhFrom === 'ALL' || tx.sourceWarehouseId === filterWhFrom;
      const matchType = filterType === 'ALL' || tx.type === filterType; // IMPROVEMENT: type filter
      return matchSearch && matchWhFrom && matchType;
    });

    // IMPROVEMENT: client-side sorting
    if (sortKey) {
      result = [...result].sort((a, b) => {
        let valA: string = a[sortKey] ?? '';
        let valB: string = b[sortKey] ?? '';
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

  // ─── FIX #6: safe error typing ───
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

  // ─── FIX #5: filename reflects active filters ───
  const handleExportExcel = () => {
    const whName = warehouses.find(w => w.id === filterWhFrom)?.name;
    const ws = XLSX.utils.json_to_sheet(
      filteredTransactions.map(tx => ({
        'No. Referensi': tx.referenceNo,
        'Tanggal': tx.date,
        'Tipe': tx.type,
        'Gudang': warehouses.find(w => w.id === tx.sourceWarehouseId)?.name ?? '-',
        'Partner': tx.partnerName ?? '-',
        'Keterangan': tx.notes ?? '-',
        'Jumlah Item': tx.items.length,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mutasi');
    const suffix = [
      startDate,
      endDate !== startDate ? `_${endDate}` : '',
      whName ? `_${whName}` : '',
      filterType !== 'ALL' ? `_${filterType}` : '',
    ].join('');
    XLSX.writeFile(wb, `Mutasi_${suffix}.xlsx`);
  };

  // Active filter count for badge
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
              icon={Plus}
              label="Baru"
              onClick={() => setShowNewDropdown(v => !v)}
              active={showNewDropdown}
              customRef={newButtonRef}
              color="text-emerald-400"
            />
            {showNewDropdown && (
              // ─── FIX #8: ref on dropdown for click-outside ───
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 shadow-xl z-[100] w-44 rounded-lg overflow-hidden py-1 animate-in fade-in slide-in-from-top-1"
              >
                <button
                  onClick={() => { onCreateTransaction('IN'); setShowNewDropdown(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700 text-[10px] font-semibold text-emerald-400 flex items-center gap-2 transition-colors"
                >
                  <ArrowDown size={12} /> Penerimaan (IN)
                </button>
                <button
                  onClick={() => { onCreateTransaction('OUT'); setShowNewDropdown(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700 text-[10px] font-semibold text-rose-400 flex items-center gap-2 transition-colors"
                >
                  <ArrowUp size={12} /> Pengiriman (OUT)
                </button>
                <button
                  onClick={() => { onCreateTransaction('TRANSFER'); setShowNewDropdown(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700 text-[10px] font-semibold text-sky-400 flex items-center gap-2 transition-colors"
                >
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
          <ToolBtn icon={FileSpreadsheet} label="Excel" onClick={handleExportExcel} color="text-emerald-400" />
        </div>

        {/* Right side: filters */}
        <div className="flex items-center gap-2 px-2 h-full">
          {/* Warehouse filter */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded px-2 py-1">
            <Filter size={10} className="text-slate-400" />
            <select
              value={filterWhFrom}
              onChange={e => setFilterWhFrom(e.target.value)}
              className="bg-transparent text-[10px] font-bold text-slate-200 outline-none cursor-pointer w-28"
            >
              <option value="ALL">Semua Gudang</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Type filter — IMPROVEMENT */}
          <div className="flex items-center gap-0.5 bg-slate-800 border border-slate-700 rounded px-1.5 py-1">
            {(['ALL', 'IN', 'OUT', 'TRANSFER'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors ${
                  filterType === t
                    ? t === 'ALL'      ? 'bg-slate-600 text-white'
                    : t === 'IN'       ? 'bg-emerald-600 text-white'
                    : t === 'TRANSFER' ? 'bg-sky-600 text-white'
                                       : 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded px-2 py-1 shadow-inner">
            <Calendar size={11} className="text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-[10px] font-bold outline-none border-none bg-transparent text-slate-200 w-24 [color-scheme:dark]"
            />
            <span className="text-slate-500 text-[10px]">/</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-[10px] font-bold outline-none border-none bg-transparent text-slate-200 w-24 [color-scheme:dark]"
            />
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari ref, partner, ket..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-7 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold outline-none w-40 text-slate-200 focus:border-blue-500 placeholder:text-slate-500 shadow-inner transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. DATA GRID AREA */}
      <div className="flex-1 overflow-auto bg-white pb-16 scroll-smooth custom-scrollbar">
        {/* IMPROVEMENT: Loading overlay while refreshing */}
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium bg-white border border-mist-200 shadow-sm px-4 py-2 rounded-full">
              <RefreshCw size={13} className="animate-spin text-blue-500" />
              Memuat data...
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
                <tr
                  key={tx.id}
                  onClick={() => setSelectedTxId(isSelected ? null : tx.id)}
                  onDoubleClick={() => { setSelectedTxId(tx.id); onEditTransaction(tx); }} // IMPROVEMENT: double-click to edit
                  className={`h-7 cursor-pointer transition-all group ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-inner'
                      : 'hover:bg-mist-100 text-slate-700'
                  }`}
                >
                  <td className={`px-3 py-0.5 text-[10px] font-mono truncate ${isSelected ? 'text-white' : 'text-slate-600 group-hover:text-blue-600'}`}>
                    {tx.referenceNo}
                  </td>
                  <td className={`px-3 py-0.5 text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                    {tx.date}
                  </td>
                  <td className="px-3 py-0.5 text-center">
                    {/* ─── FIX #10: TRANSFER gets its own badge color ─── */}
                    <TypeBadge type={tx.type} selected={isSelected} />
                  </td>
                  <td className={`px-3 py-0.5 text-[10px] font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                    {tx.partnerName || '-'}
                  </td>
                  <td className={`px-3 py-0.5 text-[10px] font-medium truncate ${isSelected ? 'text-blue-100' : 'text-slate-500'}`} title={tx.notes}>
                    {tx.notes || '-'}
                  </td>
                  <td className={`px-3 py-0.5 text-[9px] font-bold uppercase truncate ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                    {warehouses.find(w => w.id === tx.sourceWarehouseId)?.name ?? '-'}
                  </td>
                  <td className={`px-3 py-0.5 text-center text-[10px] font-bold font-mono ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                    {tx.items.length}
                  </td>
                </tr>
              );
            })}

            {/* ─── FIX #7: empty state uses inner div for flex, not td directly ─── */}
            {filteredTransactions.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400 italic text-[10px]">
                    <Info size={16} className="opacity-30" />
                    {activeFilterCount > 0
                      ? `Tidak ada transaksi yang cocok dengan filter aktif`
                      : 'Tidak ada data transaksi ditemukan'
                    }
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => { setSearchQuery(''); setFilterWhFrom('ALL'); setFilterType('ALL'); }}
                        className="mt-1 text-blue-500 hover:underline not-italic font-semibold"
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

      {/* 3. FLOATING ACTION BAR — FIX #11: fixed bottom, not center-screen */}
      {selectedTxId && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in zoom-in-95 fade-in duration-200">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-800/95 text-white rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl border border-slate-700 ring-4 ring-black/5">
            <div className="px-4 py-1.5 text-[11px] font-bold border-r border-slate-700/50 flex items-center gap-2 text-slate-200">
              <CheckCircle2 size={14} className="text-emerald-400" />
              1 Terpilih
              <span className="text-slate-500 font-mono text-[9px]">↵ Ubah · Del Hapus · Esc Batal</span>
            </div>
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-[11px] font-bold transition-all shadow-lg active:scale-95"
            >
              <Edit3 size={14} /> Ubah
            </button>
            <button
              onClick={() => setIsDeleteDialogOpen(true)}
              className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 rounded-full text-[11px] font-bold transition-all shadow-lg active:scale-95"
            >
              <Trash2 size={14} /> Hapus
            </button>
            <button
              onClick={() => setSelectedTxId(null)}
              className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* 4. STATUS BAR — IMPROVEMENT: show filtered vs total count */}
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
              <Filter size={9} />
              {activeFilterCount} filter aktif
            </span>
          )}
        </div>
        <div className="italic">GudangPro System v2.1</div>
      </div>

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

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cdcfdb; border-radius: 10px; }
      `}</style>
    </div>
  );
};
