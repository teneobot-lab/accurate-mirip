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
    <div className="fixed inset-0 z-50 bg-mist-50 flex flex-col font-sans animate-in slide-in-from-bottom-2 duration-300">

      {/* 1. TOP HEADER BAR */}
      <div className="h-12 border-b border-mist-300 flex justify-between items-center px-4 bg-white shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-mist-100 rounded-lg text-slate-500 transition-colors border border-transparent hover:border-mist-300"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="h-6 w-px bg-mist-300 mx-1" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
              {item.code}
            </span>
            <h1 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{item.name}</h1>
            {/* IMPROVEMENT: Negative balance warning badge in header */}
            {hasNegativeBalance && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} />
                Saldo Negatif
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Warehouse Filter */}
          <div className="flex items-center bg-mist-50 border border-mist-300 rounded-md p-0.5">
            <div className="px-2 border-r border-mist-300">
              <Filter size={12} className="text-slate-400" />
            </div>
            <select
              value={whFilter}
              onChange={e => setWhFilter(e.target.value)}
              className="bg-transparent text-[11px] font-bold text-slate-600 outline-none px-2 py-1 cursor-pointer w-32"
            >
              <option value="ALL">Semua Gudang</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-1 bg-white border border-mist-300 rounded-md px-2 py-1 shadow-sm">
            <Calendar size={12} className="text-slate-400 mr-1" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-[11px] font-bold text-slate-700 outline-none w-24 bg-transparent"
            />
            <span className="text-slate-300 text-[10px] mx-1">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-[11px] font-bold text-slate-700 outline-none w-24 bg-transparent"
            />
          </div>

          <div className="h-6 w-px bg-mist-300 mx-1" />

          <button
            onClick={loadData}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="Refresh Data"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExportExcel}
            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
            title="Export Excel"
          >
            <FileSpreadsheet size={16} />
          </button>
          <button
            onClick={() => window.print()}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors no-print"
            title="Print"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* 2. SUMMARY DASHBOARD */}
      <div className="bg-mist-50 border-b border-mist-300 py-3 px-6 flex items-center gap-8 shrink-0 shadow-[0_2px_4px_rgba(0,0,0,0.02)] z-10">
        <StatWidget
          label="Saldo Awal"
          value={openingBalance}
          colorClass="text-slate-500"
        />
        <div className="h-8 w-px bg-mist-300" />
        <StatWidget
          label="Total Masuk"
          value={summary.totalIn}
          colorClass="text-emerald-600"
          icon={<TrendingUp size={10} className="text-emerald-400" />}
        />
        <div className="h-8 w-px bg-mist-300" />
        <StatWidget
          label="Total Keluar"
          value={summary.totalOut}
          colorClass="text-rose-600"
          icon={<TrendingDown size={10} className="text-rose-400" />}
        />
        <div className="flex-1" />
        <div className={`bg-white border px-4 py-2 rounded-lg shadow-sm flex flex-col items-end min-w-[150px] ${
          summary.closing < 0 ? 'border-red-300 bg-red-50' : 'border-mist-300'
        }`}>
          <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">Saldo Akhir</span>
          <span className={`text-xl font-mono font-black tracking-tight ${
            summary.closing < 0 ? 'text-red-600' : 'text-slate-800'
          }`}>
            {summary.closing.toLocaleString()}{' '}
            <span className="text-xs font-bold text-slate-400">{item.baseUnit}</span>
          </span>
        </div>
      </div>

      {/* 3. LEDGER TABLE */}
      {/* IMPROVEMENT: Loading overlay on table refresh */}
      <div className="flex-1 overflow-auto bg-white relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 z-30 flex items-center justify-center backdrop-blur-[1px]">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium bg-white border border-mist-200 shadow-sm px-4 py-2 rounded-full">
              <RefreshCw size={13} className="animate-spin text-blue-500" />
              Memuat data...
            </div>
          </div>
        )}
        <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
          <thead className="bg-mist-300 sticky top-0 z-10 shadow-sm border-b border-mist-300">
            <tr className="h-9">
              <th className="px-3 w-28 text-[10px] font-extrabold text-slate-700 uppercase border-r border-mist-400/30">Tanggal</th>
              <th className="px-3 w-36 text-[10px] font-extrabold text-slate-700 uppercase border-r border-mist-400/30">No. Referensi</th>
              <th className="px-3 w-40 text-[10px] font-extrabold text-slate-700 uppercase border-r border-mist-400/30">Gudang</th>
              <th className="px-3 w-24 text-[10px] font-extrabold text-slate-700 uppercase text-center border-r border-mist-400/30">Tipe</th>
              <th className="px-3 text-[10px] font-extrabold text-slate-700 uppercase border-r border-mist-400/30">Keterangan / Partner</th>
              <th className="px-3 w-28 text-[10px] font-extrabold uppercase text-right border-r border-mist-400/30 bg-emerald-100/20 text-emerald-800">Masuk</th>
              <th className="px-3 w-28 text-[10px] font-extrabold uppercase text-right border-r border-mist-400/30 bg-rose-100/20 text-rose-800">Keluar</th>
              <th className="px-3 w-28 text-[10px] font-extrabold text-slate-700 uppercase text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist-100">
            {/* Opening Balance Row */}
            <tr className="bg-mist-50/50 h-8 hover:bg-mist-100">
              <td className="px-3 font-mono text-[10px] text-slate-400 font-bold">{startDate}</td>
              <td className="px-3 text-[10px] text-slate-400 italic">OPENING_BAL</td>
              <td className="px-3" />
              <td className="px-3" />
              <td className="px-3 text-[11px] font-bold text-slate-500 italic uppercase">Saldo Awal Periode</td>
              <td className="px-3 bg-emerald-50/10 border-l border-mist-100" />
              <td className="px-3 bg-rose-50/10 border-l border-mist-100" />
              <td className="px-3 text-right font-mono font-bold text-[11px] text-slate-600 bg-mist-50 border-l border-mist-200">
                {openingBalance.toLocaleString()}
              </td>
            </tr>

            {/* Transaction Rows */}
            {ledgerRows.map((row) => (
              <tr
                key={row.id}
                className={`h-8 group transition-colors cursor-default border-b border-mist-100 ${
                  row.balance < 0
                    ? 'bg-red-50/40 hover:bg-red-50/80'  // IMPROVEMENT: negative balance row highlight
                    : 'hover:bg-blue-50/30'
                }`}
              >
                <td className="px-3 text-[11px] text-slate-600 font-medium whitespace-nowrap">{row.date}</td>
                <td className="px-3">
                  <button
                    onClick={() => setEditingTx(row.originalTx)}
                    className="text-[10px] font-mono text-blue-600 hover:underline hover:text-blue-800 truncate block w-full text-left font-medium"
                  >
                    {row.ref}
                  </button>
                </td>
                <td className="px-3 text-[10px] text-slate-500 uppercase truncate" title={row.whName}>
                  {row.whName}
                </td>
                <td className="px-3 text-center">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                    row.type === 'IN' || row.type === 'ADJUSTMENT'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : row.type === 'TRANSFER'
                      ? 'bg-sky-50 text-sky-600 border-sky-100'  // IMPROVEMENT: distinct TRANSFER badge
                      : 'bg-rose-50 text-rose-600 border-rose-100'
                  }`}>
                    {row.type}
                  </span>
                </td>
                {/* IMPROVEMENT: note tooltip uses title attr, no position hack */}
                <td className="px-3 text-[11px] text-slate-700" title={`${row.partner} - ${row.note}`}>
                  <div className="truncate w-full max-w-sm">
                    <span className="font-bold text-slate-800">{row.partner !== '-' ? row.partner : ''}</span>
                    <span className="text-slate-500 ml-1">{row.note}</span>
                  </div>
                </td>

                {/* IN Column */}
                <td className="px-3 text-right bg-emerald-50/10 border-l border-mist-100 font-mono text-[11px]">
                  {row.inQty > 0
                    ? <span className="font-bold text-emerald-600">+{row.inQty.toLocaleString()}</span>
                    : <span className="text-slate-200">-</span>
                  }
                </td>

                {/* OUT Column */}
                <td className="px-3 text-right bg-rose-50/10 border-l border-mist-100 font-mono text-[11px]">
                  {row.outQty > 0
                    ? <span className="font-bold text-rose-600">-{row.outQty.toLocaleString()}</span>
                    : <span className="text-slate-200">-</span>
                  }
                </td>

                {/* Balance Column — IMPROVEMENT: negative balance styling */}
                <td className={`px-3 text-right font-mono text-[11px] font-bold border-l border-mist-200 ${
                  row.balance < 0
                    ? 'text-red-600 bg-red-50/40'
                    : 'text-slate-800 bg-mist-50/30'
                }`}>
                  {row.balance < 0 && (
                    <AlertTriangle size={9} className="inline mr-1 text-red-400 mb-0.5" />
                  )}
                  {row.balance.toLocaleString()}
                </td>
              </tr>
            ))}

            {ledgerRows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-24 text-center text-slate-400 italic text-xs">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Info size={24} className="opacity-20" />
                    <span>Tidak ada transaksi pada periode ini</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-mist-200 sticky bottom-0 z-10 shadow-[0_-1px_0_rgba(0,0,0,0.05)] border-t border-mist-300">
            <tr className="h-9">
              <td colSpan={5} className="px-3 text-right text-[11px] font-extrabold text-slate-700 uppercase border-r border-mist-400/30">
                Total Periode
              </td>
              <td className="px-3 text-right font-mono text-[11px] font-bold text-emerald-700 bg-emerald-100/30 border-r border-mist-400/30">
                {summary.totalIn.toLocaleString()}
              </td>
              <td className="px-3 text-right font-mono text-[11px] font-bold text-rose-700 bg-rose-100/30 border-r border-mist-400/30">
                {summary.totalOut.toLocaleString()}
              </td>
              <td className={`px-3 text-right font-mono text-[12px] font-black ${
                summary.closing < 0 ? 'text-red-600' : 'text-slate-800'
              }`}>
                {summary.closing.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* PRINT CSS */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          body { background: white; -webkit-print-color-adjust: exact; }
          .fixed { position: relative !important; inset: auto !important; height: auto !important; }
          .overflow-auto { overflow: visible !important; }
          table { width: 100% !important; min-width: 0 !important; }
          th, td { font-size: 8pt !important; padding: 2px !important; }
          button, .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};
