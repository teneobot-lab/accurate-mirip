import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Item, Warehouse, Transaction } from '../types';
import { StorageService } from '../services/storage';
import {
  ArrowLeft, RefreshCw, FileSpreadsheet, Printer,
  Calendar, Filter, Info, TrendingUp, TrendingDown,
  AlertTriangle
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { useToast } from './Toast';
import { TransactionForm } from './TransactionForm';

interface Props {
  item: Item;
  onBack: () => void;
}

interface StockLedgerRow {
  id: string;
  date: string;
  ref: string;
  type: string;
  whName: string;
  partner: string;
  note: string;
  inQty: number;
  outQty: number;
  balance: number;
  unit: string;
  originalTx: Transaction;
}

// ─── FIX #2: StatWidget moved OUTSIDE component to avoid remount on every render ───
interface StatWidgetProps {
  label: string;
  value: number;
  colorClass: string;
  icon?: React.ReactNode;
}
const StatWidget: React.FC<StatWidgetProps> = ({ label, value, colorClass, icon }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
      {icon}
      {label}
    </span>
    <span className={`text-base font-mono font-bold ${colorClass}`}>
      {value.toLocaleString()}
    </span>
  </div>
);

export const StockCardView: React.FC<Props> = ({ item, onBack }) => {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Default Filter: First day of current month to today
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [whFilter, setWhFilter] = useState('ALL');

  // ─── FIX #5: useCallback so loadData is stable and safe as useEffect dep ───
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedTx, fetchedWh] = await Promise.all([
        StorageService.fetchTransactions(),
        StorageService.fetchWarehouses()
      ]);
      setTransactions(fetchedTx);
      setWarehouses(fetchedWh);
    } catch {
      showToast('Gagal memuat data kartu stok', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData, item.id]);

  // ─── CORE LEDGER LOGIC ───
  const { ledgerRows, summary, openingBalance } = useMemo(() => {
    // 1. Pre-Filter & Sort Transactions
    const itemTxs = transactions
      .filter(tx => {
        const hasItem = tx.items.some(line => line.itemId === item.id);
        if (!hasItem) return false;

        // ─── FIX #1: TRANSFER should match EITHER source OR destination warehouse ───
        if (whFilter === 'ALL') return true;
        return tx.sourceWarehouseId === whFilter || tx.destinationWarehouseId === whFilter;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.createdAt - b.createdAt;
      });

    // 2. Calculate Opening Balance (Transactions BEFORE startDate)
    let opening = 0;
    itemTxs
      .filter(tx => tx.date < startDate)
      .forEach(tx => {
        const line = tx.items.find(l => l.itemId === item.id);
        if (!line) return;
        const qtyBase = line.qty * (line.ratio || 1);

        // ─── FIX #4: TRANSFER direction aware per warehouse ───
        if (tx.type === 'TRANSFER') {
          if (whFilter === 'ALL' || tx.sourceWarehouseId === whFilter) opening -= qtyBase;
          if (whFilter !== 'ALL' && tx.destinationWarehouseId === whFilter) opening += qtyBase;
        } else if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
          opening += qtyBase;
        } else if (tx.type === 'OUT') {
          opening -= qtyBase;
        }
      });

    // 3. Calculate Ledger Rows (Transactions WITHIN Period)
    const periodTxs = itemTxs.filter(tx => tx.date >= startDate && tx.date <= endDate);

    let runningBalance = opening;
    let totalIn = 0;
    let totalOut = 0;

    // ─── FIX #3: filter out rows where line is not found ───
    const rows: StockLedgerRow[] = periodTxs
      .map(tx => {
        const line = tx.items.find(l => l.itemId === item.id);
        if (!line) return null;

        const qtyBase = line.qty * (line.ratio || 1);
        let inQty = 0;
        let outQty = 0;

        if (tx.type === 'TRANSFER') {
          // ─── FIX #4: TRANSFER direction aware per warehouse ───
          const isOut = whFilter === 'ALL' || tx.sourceWarehouseId === whFilter;
          const isIn = whFilter !== 'ALL' && tx.destinationWarehouseId === whFilter;

          if (isOut && !isIn) {
            outQty = qtyBase;
            totalOut += qtyBase;
            runningBalance -= qtyBase;
          } else if (isIn && !isOut) {
            inQty = qtyBase;
            totalIn += qtyBase;
            runningBalance += qtyBase;
          }
          // if both match (shouldn't happen normally), skip to avoid double-count
        } else if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
          inQty = qtyBase;
          totalIn += qtyBase;
          runningBalance += qtyBase;
        } else if (tx.type === 'OUT') {
          outQty = qtyBase;
          totalOut += qtyBase;
          runningBalance -= qtyBase;
        }

        const whName = warehouses.find(w => w.id === tx.sourceWarehouseId)?.name ?? 'Unknown';

        return {
          id: tx.id,
          date: tx.date,
          ref: tx.referenceNo,
          type: tx.type,
          whName,
          partner: tx.partnerName || '-',
          note: tx.notes || line.note || '',
          inQty,
          outQty,
          balance: runningBalance,
          unit: item.baseUnit,
          originalTx: tx,
        } satisfies StockLedgerRow;
      })
      .filter((r): r is StockLedgerRow => r !== null);

    return {
      ledgerRows: rows,
      summary: { totalIn, totalOut, closing: runningBalance },
      openingBalance: opening,
    };
  }, [transactions, item, startDate, endDate, warehouses, whFilter]);

  // ─── EXPORT EXCEL ───
  const handleExportExcel = async () => {
    if (ledgerRows.length === 0 && openingBalance === 0) {
      return showToast('Tidak ada data untuk diekspor', 'warning');
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Kartu Stok');

      sheet.getColumn('A').width = 12;
      sheet.getColumn('B').width = 20;
      sheet.getColumn('C').width = 15;
      sheet.getColumn('D').width = 20;
      sheet.getColumn('E').width = 40;
      sheet.getColumn('F').width = 14;
      sheet.getColumn('G').width = 14;
      sheet.getColumn('H').width = 16;

      // Title Block
      sheet.addRow(['KARTU STOK BARANG']);
      sheet.addRow(['Item:', `[${item.code}] ${item.name}`]);
      sheet.addRow(['Satuan Dasar:', item.baseUnit]);
      sheet.addRow(['Periode:', `${startDate} s/d ${endDate}`]);
      if (whFilter !== 'ALL') {
        const whName = warehouses.find(w => w.id === whFilter)?.name ?? whFilter;
        sheet.addRow(['Gudang:', whName]);
      }
      sheet.addRow([]);

      // Table Header
      const headerRow = sheet.addRow(['TANGGAL', 'NO. REF', 'TIPE', 'GUDANG', 'KETERANGAN', 'MASUK', 'KELUAR', 'SALDO']);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FF000000' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCDCFDB' } };
        cell.border = { bottom: { style: 'thin' } };
        cell.alignment = { horizontal: 'center' };
      });

      // ─── FIX #6: Opening Balance row with consistent number format ───
      const openRow = sheet.addRow([startDate, '', 'OPENING', '', 'Saldo Awal Periode', null, null, openingBalance]);
      openRow.font = { italic: true, color: { argb: 'FF64748B' } };
      openRow.getCell(8).font = { bold: true };
      openRow.getCell(8).numFmt = '#,##0.00';
      openRow.getCell(8).alignment = { horizontal: 'right' };

      // Data Rows
      ledgerRows.forEach(row => {
        const r = sheet.addRow([
          row.date,
          row.ref,
          row.type,
          row.whName,
          `${row.partner !== '-' ? row.partner + ' - ' : ''}${row.note}`,
          row.inQty || null,
          row.outQty || null,
          row.balance,
        ]);
        [6, 7, 8].forEach(idx => {
          r.getCell(idx).numFmt = '#,##0.00';
          r.getCell(idx).alignment = { horizontal: 'right' };
        });
        r.getCell(8).font = { bold: true };
        // Highlight negative balance
        if (row.balance < 0) {
          r.getCell(8).font = { bold: true, color: { argb: 'FFDC2626' } };
        }
      });

      // Footer Totals
      const footerRow = sheet.addRow(['', '', '', '', 'TOTAL PERIODE', summary.totalIn, summary.totalOut, summary.closing]);
      footerRow.font = { bold: true };
      footerRow.getCell(5).alignment = { horizontal: 'right' };
      footerRow.eachCell((cell, colNumber) => {
        if (colNumber >= 5) {
          cell.border = { top: { style: 'double' } };
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right' };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `StockCard_${item.code}_${startDate}_${endDate}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url); // cleanup memory leak
    } catch {
      showToast('Gagal export excel', 'error');
    }
  };

  const handleEditSuccess = () => {
    setEditingTx(null);
    loadData();
  };

  if (editingTx) {
    return (
      <div className="fixed inset-0 z-[100] bg-white">
        <TransactionForm
          type={editingTx.type}
          initialData={editingTx}
          onClose={() => setEditingTx(null)}
          onSuccess={handleEditSuccess}
        />
      </div>
    );
  }

  const hasNegativeBalance = ledgerRows.some(r => r.balance < 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col font-sans animate-in slide-in-from-bottom-2 duration-300">

      {/* ── HEADER BAR ── */}
      <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.06)] z-20 gap-4">

        {/* LEFT: back + item identity */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors shrink-0 text-[12px] font-semibold"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Kembali</span>
          </button>

          <div className="h-5 w-px bg-slate-200 shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 text-[10px] bg-slate-800 text-white px-2 py-0.5 rounded-md font-mono font-bold tracking-wider">
              {item.code}
            </span>
            <h1 className="text-[13px] font-bold text-slate-800 truncate">{item.name}</h1>
            <span className="shrink-0 text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
              {item.baseUnit}
            </span>
            {hasNegativeBalance && (
              <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} />
                Saldo Negatif
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: filters + actions — grouped clearly */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Filter Gudang */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Filter size={11} className="text-slate-400 shrink-0" />
            <select
              value={whFilter}
              onChange={e => setWhFilter(e.target.value)}
              className="bg-transparent text-[11px] font-semibold text-slate-600 outline-none cursor-pointer max-w-[120px]"
            >
              <option value="ALL">Semua Gudang</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Filter Periode */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Calendar size={11} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-[11px] font-semibold text-slate-700 outline-none w-24 bg-transparent"
            />
            <span className="text-slate-300 text-[10px]">—</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-[11px] font-semibold text-slate-700 outline-none w-24 bg-transparent"
            />
          </div>

          <div className="h-5 w-px bg-slate-200" />

          {/* Action buttons — labeled for clarity */}
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors text-[11px] font-semibold"
            title="Refresh Data"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden lg:inline">Refresh</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors text-[11px] font-semibold"
            title="Export Excel"
          >
            <FileSpreadsheet size={13} />
            <span className="hidden lg:inline">Export</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors text-[11px] font-semibold no-print"
            title="Print"
          >
            <Printer size={13} />
            <span className="hidden lg:inline">Print</span>
          </button>
        </div>
      </div>

      {/* ── SUMMARY BAR ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-0 shrink-0 z-10">
        {/* Stat items dengan divider */}
        <div className="flex items-center gap-6 flex-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Awal</span>
            <span className="text-[15px] font-mono font-bold text-slate-500">{openingBalance.toLocaleString()}</span>
          </div>
          <div className="h-8 w-px bg-slate-100" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp size={10} className="text-emerald-400" /> Total Masuk
            </span>
            <span className="text-[15px] font-mono font-bold text-emerald-600">+{summary.totalIn.toLocaleString()}</span>
          </div>
          <div className="h-8 w-px bg-slate-100" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <TrendingDown size={10} className="text-rose-400" /> Total Keluar
            </span>
            <span className="text-[15px] font-mono font-bold text-rose-600">-{summary.totalOut.toLocaleString()}</span>
          </div>
          <div className="h-8 w-px bg-slate-100" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{ledgerRows.length} transaksi</span>
            <span className="text-[11px] font-semibold text-slate-400">{startDate} — {endDate}</span>
          </div>
        </div>

        {/* Saldo Akhir — prominent di kanan */}
        <div className={`flex items-center gap-3 px-5 py-2 rounded-xl border-2 ${
          summary.closing < 0
            ? 'border-red-200 bg-red-50'
            : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex flex-col items-end">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${
              summary.closing < 0 ? 'text-red-500' : 'text-slate-400'
            }`}>Saldo Akhir</span>
            <div className="flex items-baseline gap-1.5">
              {summary.closing < 0 && <AlertTriangle size={12} className="text-red-500 mb-0.5" />}
              <span className={`text-2xl font-mono font-black tracking-tight leading-none ${
                summary.closing < 0 ? 'text-red-600' : 'text-slate-800'
              }`}>
                {summary.closing.toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-slate-400">{item.baseUnit}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. LEDGER TABLE — Dense, ~40+ baris visible */}
      <div className="flex-1 overflow-auto bg-white relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 z-30 flex items-center justify-center backdrop-blur-[1px]">
            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium bg-white border border-slate-200 shadow-sm px-4 py-1.5 rounded-full">
              <RefreshCw size={12} className="animate-spin text-blue-500" />
              Memuat data...
            </div>
          </div>
        )}
        <table className="w-full text-left border-collapse table-fixed" style={{ fontSize: '11px' }}>
          <thead className="sticky top-0 z-10" style={{ backgroundColor: '#1e293b' }}>
            <tr style={{ height: '24px' }}>
              <th className="px-2 w-24 text-[9px] font-bold text-white uppercase border-r border-slate-600 tracking-tight">Tanggal</th>
              <th className="px-2 w-32 text-[9px] font-bold text-white uppercase border-r border-slate-600 tracking-tight">No. Ref</th>
              <th className="px-2 w-28 text-[9px] font-bold text-white uppercase border-r border-slate-600 tracking-tight">Gudang</th>
              <th className="px-2 w-14 text-[9px] font-bold text-white uppercase text-center border-r border-slate-600 tracking-tight">Tipe</th>
              <th className="px-2 text-[9px] font-bold text-white uppercase border-r border-slate-600 tracking-tight">Partner / Keterangan</th>
              <th className="px-2 w-24 text-[9px] font-bold uppercase text-right border-r border-slate-600 tracking-tight" style={{ color: '#6ee7b7' }}>Masuk</th>
              <th className="px-2 w-24 text-[9px] font-bold uppercase text-right border-r border-slate-600 tracking-tight" style={{ color: '#fca5a5' }}>Keluar</th>
              <th className="px-2 w-24 text-[9px] font-bold text-white uppercase text-right tracking-tight">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {/* Opening Balance Row */}
            <tr style={{ height: '20px', backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <td className="px-2 font-mono text-[9px] text-slate-500 font-semibold">{startDate}</td>
              <td className="px-2 text-[9px] text-slate-400 italic font-mono">SALDO AWAL</td>
              <td className="px-2" />
              <td className="px-2" />
              <td className="px-2 text-[9px] font-semibold text-slate-600 italic uppercase">Saldo Awal Periode</td>
              <td className="px-2" />
              <td className="px-2" />
              <td className="px-2 text-right font-mono font-bold text-[10px] text-slate-700">
                {openingBalance.toLocaleString()}
              </td>
            </tr>

            {/* Transaction Rows — ultra dense untuk 40+ baris */}
            {ledgerRows.map((row, idx) => (
              <tr
                key={row.id}
                style={{
                  height: '20px',
                  backgroundColor: row.balance < 0
                    ? '#fff1f2'
                    : idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                  borderBottom: '1px solid #f1f5f9'
                }}
                className="group hover:bg-blue-50 transition-colors cursor-default"
              >
                <td className="px-2 text-[9px] text-slate-600 font-mono whitespace-nowrap">{row.date}</td>
                <td className="px-2">
                  <button
                    onClick={() => setEditingTx(row.originalTx)}
                    className="text-[9px] font-mono text-blue-600 hover:underline truncate block w-full text-left"
                    title={row.ref}
                  >
                    {row.ref}
                  </button>
                </td>
                <td className="px-2 text-[9px] text-slate-500 uppercase truncate" title={row.whName}>
                  {row.whName}
                </td>
                <td className="px-2 text-center">
                  <span className={`text-[8px] font-bold px-1 rounded leading-none py-0.5 ${
                    row.type === 'IN' || row.type === 'ADJUSTMENT'
                      ? 'bg-emerald-100 text-emerald-700'
                      : row.type === 'TRANSFER'
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}>
                    {row.type}
                  </span>
                </td>
                <td className="px-2 text-[9px] text-slate-700 truncate" title={`${row.partner} — ${row.note}`}>
                  {row.partner !== '-' && <span className="font-semibold text-slate-800">{row.partner}</span>}
                  {row.partner !== '-' && row.note && <span className="text-slate-300 mx-1">·</span>}
                  <span className="text-slate-500">{row.note}</span>
                </td>
                <td className="px-2 text-right font-mono text-[9px]">
                  {row.inQty > 0
                    ? <span className="font-bold text-emerald-700">{row.inQty.toLocaleString()}</span>
                    : <span className="text-slate-200">·</span>
                  }
                </td>
                <td className="px-2 text-right font-mono text-[9px]">
                  {row.outQty > 0
                    ? <span className="font-bold text-rose-700">{row.outQty.toLocaleString()}</span>
                    : <span className="text-slate-200">·</span>
                  }
                </td>
                <td className={`px-2 text-right font-mono text-[9px] font-bold ${
                  row.balance < 0 ? 'text-red-600' : 'text-slate-800'
                }`}>
                  {row.balance < 0 && <AlertTriangle size={8} className="inline mr-0.5 text-red-400 mb-0.5" />}
                  {row.balance.toLocaleString()}
                </td>
              </tr>
            ))}

            {ledgerRows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-400 italic text-[11px]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Info size={20} className="opacity-20" />
                    <span>Tidak ada transaksi pada periode ini</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0 z-10" style={{ backgroundColor: '#e2e8f0', borderTop: '2px solid #94a3b8' }}>
            <tr style={{ height: '22px' }}>
              <td colSpan={5} className="px-2 text-right text-[9px] font-extrabold text-slate-700 uppercase tracking-tight border-r border-slate-300">
                TOTAL PERIODE
              </td>
              <td className="px-2 text-right font-mono text-[10px] font-bold text-emerald-700 border-r border-slate-300">
                {summary.totalIn.toLocaleString()}
              </td>
              <td className="px-2 text-right font-mono text-[10px] font-bold text-rose-700 border-r border-slate-300">
                {summary.totalOut.toLocaleString()}
              </td>
              <td className={`px-2 text-right font-mono text-[11px] font-black ${
                summary.closing < 0 ? 'text-red-600' : 'text-slate-800'
              }`}>
                {summary.closing.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* PRINT CSS — A4 Landscape, dense 40+ baris per halaman */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm 10mm; }

          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          body { background: white !important; font-family: Arial, sans-serif !important; }

          /* Sembunyikan tombol dan elemen UI */
          .no-print, button { display: none !important; }

          /* Lepas fixed positioning */
          .fixed {
            position: static !important;
            inset: auto !important;
            height: auto !important;
            overflow: visible !important;
            z-index: auto !important;
          }
          .overflow-auto { overflow: visible !important; }

          /* Header & summary bar tetap tampil tapi compact */
          .shrink-0 { break-inside: avoid; }

          /* TABEL — ultra dense */
          table {
            width: 100% !important;
            min-width: 0 !important;
            border-collapse: collapse !important;
            font-size: 7pt !important;
            font-family: Arial, sans-serif !important;
          }
          thead tr { height: 14pt !important; }
          tbody tr { height: 12pt !important; }
          tfoot tr { height: 14pt !important; }

          th, td {
            padding: 1pt 3pt !important;
            font-size: 7pt !important;
            line-height: 1 !important;
            vertical-align: middle !important;
          }

          /* Header warna gelap */
          thead { background-color: #1e293b !important; }
          thead th { color: #ffffff !important; }

          /* Zebra stripe di print */
          tbody tr:nth-child(even) { background-color: #f8fafc !important; }
          tbody tr:nth-child(odd)  { background-color: #ffffff !important; }

          /* Footer */
          tfoot { background-color: #e2e8f0 !important; border-top: 1.5pt solid #64748b !important; }

          /* Jangan potong baris di tengah halaman */
          tbody tr { page-break-inside: avoid; }
          tfoot    { page-break-inside: avoid; }
        }
      \`}</style>
    </div>
  );
};
