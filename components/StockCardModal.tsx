import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Item, Warehouse, Transaction } from '../types';
import { StorageService } from '../services/storage';
import {
  ArrowLeft, RefreshCw, FileSpreadsheet, Printer,
  Calendar, Filter, Info, AlertTriangle
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
  whId: string;
  partner: string;
  note: string;
  inQty: number;
  outQty: number;
  balance: number;
  unit: string;
  originalTx: Transaction;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_LABEL: Record<string, string> = {
  IN: 'Penerimaan', OUT: 'Pengiriman', TRANSFER: 'Pindah Barang', ADJUSTMENT: 'Penyesuaian',
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export const StockCardView: React.FC<Props> = ({ item, onBack }) => {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [whFilter, setWhFilter] = useState('ALL');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedTx, fetchedWh] = await Promise.all([
        StorageService.fetchTransactions(),
        StorageService.fetchWarehouses(),
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
    const itemTxs = transactions
      .filter(tx => {
        const hasItem = tx.items.some(line => line.itemId === item.id);
        if (!hasItem) return false;
        if (whFilter === 'ALL') return true;
        return tx.sourceWarehouseId === whFilter || (tx as any).destinationWarehouseId === whFilter;
      })
      .sort((a, b) => {
        const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
        return diff !== 0 ? diff : a.createdAt - b.createdAt;
      });

    let opening = 0;
    itemTxs.filter(tx => tx.date < startDate).forEach(tx => {
      const line = tx.items.find(l => l.itemId === item.id);
      if (!line) return;
      const q = line.qty * (line.ratio || 1);
      if (tx.type === 'TRANSFER') {
        if (whFilter === 'ALL' || tx.sourceWarehouseId === whFilter) opening -= q;
        if (whFilter !== 'ALL' && (tx as any).destinationWarehouseId === whFilter) opening += q;
      } else if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
        opening += q;
      } else if (tx.type === 'OUT') {
        opening -= q;
      }
    });

    const periodTxs = itemTxs.filter(tx => tx.date >= startDate && tx.date <= endDate);
    let runningBalance = opening;
    let totalIn = 0, totalOut = 0;

    const rows: StockLedgerRow[] = periodTxs.map(tx => {
      const line = tx.items.find(l => l.itemId === item.id);
      if (!line) return null;
      const q = line.qty * (line.ratio || 1);
      let inQty = 0, outQty = 0;

      if (tx.type === 'TRANSFER') {
        const isOut = whFilter === 'ALL' || tx.sourceWarehouseId === whFilter;
        const isIn  = whFilter !== 'ALL' && (tx as any).destinationWarehouseId === whFilter;
        if (isOut && !isIn)  { outQty = q; totalOut += q; runningBalance -= q; }
        else if (isIn && !isOut) { inQty = q; totalIn += q; runningBalance += q; }
      } else if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
        inQty = q; totalIn += q; runningBalance += q;
      } else if (tx.type === 'OUT') {
        outQty = q; totalOut += q; runningBalance -= q;
      }

      return {
        id: tx.id,
        date: tx.date,
        ref: tx.referenceNo,
        type: tx.type,
        whName: warehouses.find(w => w.id === tx.sourceWarehouseId)?.name ?? '-',
        whId: tx.sourceWarehouseId,
        partner: tx.partnerName || '-',
        note: tx.notes || line.note || '',
        inQty, outQty,
        balance: runningBalance,
        unit: item.baseUnit,
        originalTx: tx,
      } satisfies StockLedgerRow;
    }).filter((r): r is StockLedgerRow => r !== null);

    return { ledgerRows: rows, summary: { totalIn, totalOut, closing: runningBalance }, openingBalance: opening };
  }, [transactions, item, startDate, endDate, warehouses, whFilter]);

  // ─── Group by Warehouse (Accurate style) ───
  const groupedByWh = useMemo(() => {
    if (whFilter !== 'ALL') {
      return [{ whId: whFilter, whName: warehouses.find(w => w.id === whFilter)?.name ?? whFilter, rows: ledgerRows }];
    }
    const map = new Map<string, { whId: string; whName: string; rows: StockLedgerRow[] }>();
    ledgerRows.forEach(row => {
      if (!map.has(row.whId)) map.set(row.whId, { whId: row.whId, whName: row.whName, rows: [] });
      map.get(row.whId)!.rows.push(row);
    });
    return Array.from(map.values());
  }, [ledgerRows, whFilter, warehouses]);

  // ─── EXPORT EXCEL ───
  const handleExportExcel = async () => {
    if (ledgerRows.length === 0 && openingBalance === 0)
      return showToast('Tidak ada data untuk diekspor', 'warning');
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Kartu Stok');
      ['A','B','C','D','E','F','G'].forEach((col, i) => {
        ws.getColumn(col).width = [11,24,16,40,12,12,14][i];
      });

      // Title
      const t1 = ws.addRow([`MUTASI PER BARANG PER GUDANG`]);
      t1.font = { bold: true, size: 12, color: { argb: 'FFB91C1C' } };
      const t2 = ws.addRow([`Dari ${startDate} ke ${endDate}`]);
      t2.font = { italic: true, size: 9 };
      ws.addRow([`Barang: [${item.code}] ${item.name}   Satuan: ${item.baseUnit}`]).font = { size: 9 };
      ws.addRow([]);

      groupedByWh.forEach(group => {
        // Item + WH sub-header (like Accurate)
        const sub = ws.addRow([`${item.code}    ${item.name}`]);
        sub.font = { bold: true, size: 9 };
        const wh = ws.addRow([`    ${group.whName}`]);
        wh.font = { bold: true, size: 9, color: { argb: 'FF334155' } };

        // Column headers
        const hdr = ws.addRow(['Tanggal', 'No. Sumber', 'Tipe', 'Keterangan', 'Kts. Masuk', 'Kts. Keluar', 'Saldo']);
        hdr.eachCell(c => {
          c.font = { bold: true, size: 8 };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
          c.border = { bottom: { style: 'thin' } };
          c.alignment = { horizontal: 'center' };
        });

        // Opening
        const opening = ws.addRow([startDate, '', '', 'Saldo Awal', null, null, openingBalance]);
        opening.font = { italic: true, size: 8, color: { argb: 'FF64748B' } };
        opening.getCell(7).numFmt = '#,##0.00';
        opening.getCell(7).alignment = { horizontal: 'right' };

        // Rows
        let whIn = 0, whOut = 0;
        group.rows.forEach(row => {
          const r = ws.addRow([
            row.date, row.ref,
            TYPE_LABEL[row.type] || row.type,
            `${row.partner !== '-' ? row.partner + ' - ' : ''}${row.note}`,
            row.inQty || null, row.outQty || null, row.balance,
          ]);
          r.font = { size: 8 };
          [5,6,7].forEach(ci => {
            r.getCell(ci).numFmt = '#,##0.00';
            r.getCell(ci).alignment = { horizontal: 'right' };
          });
          r.getCell(7).font = { bold: true, size: 8, color: { argb: row.balance < 0 ? 'FFDC2626' : 'FF000000' } };
          whIn += row.inQty; whOut += row.outQty;
        });

        // Group total
        const tot = ws.addRow(['', '', '', '', whIn, whOut, summary.closing]);
        tot.font = { bold: true, size: 8 };
        [5,6,7].forEach(ci => {
          tot.getCell(ci).numFmt = '#,##0.00';
          tot.getCell(ci).alignment = { horizontal: 'right' };
          tot.getCell(ci).border = { top: { style: 'double' }, bottom: { style: 'double' } };
        });
        ws.addRow([]);
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `MutasiBarang_${item.code}_${startDate}_${endDate}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    } catch { showToast('Gagal export excel', 'error'); }
  };

  const handleEditSuccess = () => { setEditingTx(null); loadData(); };

  if (editingTx) {
    return (
      <div className="fixed inset-0 z-[100] bg-white">
        <TransactionForm type={editingTx.type} initialData={editingTx}
          onClose={() => setEditingTx(null)} onSuccess={handleEditSuccess} />
      </div>
    );
  }

  const hasNeg = ledgerRows.some(r => r.balance < 0);
  const filterWhName = whFilter !== 'ALL' ? (warehouses.find(w => w.id === whFilter)?.name ?? whFilter) : 'Semua Gudang';

  // ─────────────────────────────────────────────
  // RENDER — Accurate-style layout
  // ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col font-sans" style={{ background: '#f1f5f9' }}>

      {/* ── TOOLBAR — screen only ── */}
      <div className="no-print h-11 bg-white border-b border-slate-200 flex items-center justify-between px-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack}
            className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:bg-slate-100 rounded text-[11px] font-semibold">
            <ArrowLeft size={14} /> Kembali
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <span className="text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded font-mono font-bold">{item.code}</span>
          <span className="text-[12px] font-bold text-slate-800 truncate">{item.name}</span>
          {hasNeg && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              <AlertTriangle size={9} /> Saldo Negatif
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Filter gudang */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <Filter size={10} className="text-slate-400" />
            <select value={whFilter} onChange={e => setWhFilter(e.target.value)}
              className="bg-transparent text-[10px] font-semibold text-slate-600 outline-none cursor-pointer">
              <option value="ALL">Semua Gudang</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {/* Filter periode */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <Calendar size={10} className="text-slate-400" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="text-[10px] font-semibold text-slate-700 outline-none w-22 bg-transparent" />
            <span className="text-slate-300 text-[9px]">—</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="text-[10px] font-semibold text-slate-700 outline-none w-22 bg-transparent" />
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <button onClick={loadData} disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-semibold">
            <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={handleExportExcel}
            className="flex items-center gap-1 px-2 py-1 text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded text-[10px] font-semibold">
            <FileSpreadsheet size={11} /> Export
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1 px-2 py-1 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-semibold">
            <Printer size={11} /> Print
          </button>
        </div>
      </div>

      {/* ── DOCUMENT AREA — scrollable, A4-like ── */}
      <div className="flex-1 overflow-auto py-4 px-4 flex justify-center">
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-[11px] mt-20">
            <RefreshCw size={14} className="animate-spin" /> Memuat data...
          </div>
        ) : (
          <div className="bg-white shadow-md w-full max-w-[794px] min-h-[1123px] px-8 py-6 print-page">

            {/* ── DOCUMENT HEADER (Accurate style) ── */}
            <div className="text-center mb-3 print-header">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">GUDANGPRO INVENTORY</div>
              <div className="text-[15px] font-bold text-red-700 mt-0.5">Mutasi per Barang per Gudang</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Dari {startDate} ke {endDate}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">
                Filter berdasarkan: No. Barang, Nama Gudang &nbsp;|&nbsp; {filterWhName}
              </div>
            </div>

            {/* ── LEDGER TABLE — Accurate style ── */}
            {groupedByWh.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-2">
                <Info size={28} />
                <span className="text-[11px]">Tidak ada transaksi pada periode ini</span>
              </div>
            ) : (
              groupedByWh.map(group => {
                // Per-group running totals
                let grpIn = 0, grpOut = 0;
                group.rows.forEach(r => { grpIn += r.inQty; grpOut += r.outQty; });

                return (
                  <div key={group.whId} className="mb-4">
                    {/* Item + WH sub-header (Accurate style) */}
                    <div className="flex items-baseline gap-3 mb-0.5">
                      <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">
                        {item.code}
                      </span>
                      <span className="text-[10px] font-bold text-slate-700 uppercase">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1 pl-0.5">
                      {group.whName}
                    </div>

                    <table className="w-full border-collapse" style={{ fontSize: '9pt' }}>
                      {/* Column headers */}
                      <thead>
                        <tr style={{ borderBottom: '1.5pt solid #475569', borderTop: '1.5pt solid #475569' }}>
                          <th className="py-0.5 pr-2 text-left font-bold text-[8pt] text-slate-700 w-[70px]">Tanggal</th>
                          <th className="py-0.5 pr-2 text-left font-bold text-[8pt] text-slate-700 w-[110px]">No. Sumber</th>
                          <th className="py-0.5 pr-2 text-left font-bold text-[8pt] text-slate-700 w-[90px]">Tipe</th>
                          <th className="py-0.5 pr-2 text-left font-bold text-[8pt] text-slate-700">Keterangan</th>
                          <th className="py-0.5 pr-2 text-right font-bold text-[8pt] text-slate-700 w-[70px]">Kts. Masuk</th>
                          <th className="py-0.5 pr-2 text-right font-bold text-[8pt] text-slate-700 w-[70px]">Kts. Keluar</th>
                          <th className="py-0.5 text-right font-bold text-[8pt] text-slate-700 w-[72px]">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Opening balance row */}
                        <tr style={{ borderBottom: '0.5pt solid #e2e8f0' }}>
                          <td className="py-[1px] pr-2 text-[8pt] text-slate-500 font-mono">{startDate}</td>
                          <td className="py-[1px] pr-2 text-[8pt] text-slate-400 italic" colSpan={3}>Saldo Awal</td>
                          <td className="py-[1px] pr-2 text-right text-[8pt] text-slate-400" />
                          <td className="py-[1px] pr-2 text-right text-[8pt] text-slate-400" />
                          <td className="py-[1px] text-right text-[8pt] font-bold text-slate-700">{fmt(openingBalance)}</td>
                        </tr>

                        {/* Transaction rows */}
                        {group.rows.map((row, idx) => (
                          <tr key={row.id}
                            style={{
                              borderBottom: '0.5pt solid #f1f5f9',
                              backgroundColor: row.balance < 0 ? '#fff1f2' : idx % 2 === 1 ? '#f8fafc' : '#ffffff'
                            }}>
                            <td className="py-[1px] pr-2 text-[8pt] text-slate-600 font-mono whitespace-nowrap">{row.date}</td>
                            <td className="py-[1px] pr-2 text-[8pt] font-mono">
                              <button
                                onClick={() => setEditingTx(row.originalTx)}
                                className="text-blue-600 hover:underline text-left w-full truncate block no-print-link"
                                title={row.ref}
                              >
                                {row.ref}
                              </button>
                              <span className="print-only hidden text-slate-700">{row.ref}</span>
                            </td>
                            <td className="py-[1px] pr-2 text-[8pt] text-slate-600">
                              {TYPE_LABEL[row.type] || row.type}
                            </td>
                            <td className="py-[1px] pr-2 text-[8pt] text-slate-700 truncate max-w-[160px]"
                              title={`${row.partner !== '-' ? row.partner + ' — ' : ''}${row.note}`}>
                              {row.partner !== '-' && (
                                <span className="font-semibold">{row.partner} </span>
                              )}
                              <span className="text-slate-500">{row.note}</span>
                            </td>
                            <td className="py-[1px] pr-2 text-right text-[8pt] text-slate-700">
                              {row.inQty > 0 ? fmt(row.inQty) : ''}
                            </td>
                            <td className="py-[1px] pr-2 text-right text-[8pt] text-slate-700">
                              {row.outQty > 0 ? fmt(row.outQty) : ''}
                            </td>
                            <td className={`py-[1px] text-right text-[8pt] font-bold ${row.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                              {row.balance < 0 && <AlertTriangle size={7} className="inline mr-0.5 mb-0.5 text-red-400" />}
                              {fmt(row.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      {/* Group total — Accurate style double border */}
                      <tfoot>
                        <tr style={{ borderTop: '1.5pt double #475569' }}>
                          <td colSpan={4} />
                          <td className="py-0.5 pr-2 text-right text-[8pt] font-bold text-slate-800">{fmt(grpIn)}</td>
                          <td className="py-0.5 pr-2 text-right text-[8pt] font-bold text-slate-800">{fmt(grpOut)}</td>
                          <td className={`py-0.5 text-right text-[8pt] font-black ${summary.closing < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            {fmt(summary.closing)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })
            )}

            {/* ── SUMMARY FOOTER ── */}
            {ledgerRows.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-300 flex justify-between items-start text-[9pt]">
                <div className="text-slate-500 space-y-0.5">
                  <div>Total Transaksi: <span className="font-bold text-slate-700">{ledgerRows.length}</span></div>
                  <div>Periode: <span className="font-semibold text-slate-700">{startDate} s/d {endDate}</span></div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="text-slate-500">Saldo Awal: <span className="font-bold text-slate-700">{fmt(openingBalance)}</span></div>
                  <div className="text-slate-500">Total Masuk: <span className="font-bold text-emerald-700">+{fmt(summary.totalIn)}</span></div>
                  <div className="text-slate-500">Total Keluar: <span className="font-bold text-rose-700">-{fmt(summary.totalOut)}</span></div>
                  <div className="text-[10pt] font-black mt-1">
                    Saldo Akhir: <span className={summary.closing < 0 ? 'text-red-600' : 'text-slate-900'}>{fmt(summary.closing)} {item.baseUnit}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── PRINT CSS — A4 Portrait, Accurate-style ── */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: white !important; }

          /* Sembunyikan toolbar */
          .no-print { display: none !important; }

          /* Document area: hapus scroll/centering */
          .flex-1.overflow-auto { overflow: visible !important; padding: 0 !important; display: block !important; }

          /* Page card: hapus shadow/padding screen */
          .print-page {
            box-shadow: none !important;
            padding: 0 !important;
            min-height: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }

          /* Button: sembunyikan di print, tampilkan teks ref-nya */
          button { display: none !important; }
          .print-only { display: inline !important; }

          /* Tabel dense */
          table { width: 100% !important; border-collapse: collapse !important; font-size: 8pt !important; }
          th, td { padding: 1pt 3pt !important; font-size: 8pt !important; line-height: 1.15 !important; }

          /* Jangan potong group di tengah halaman */
          .mb-4 { page-break-inside: avoid; margin-bottom: 6mm !important; }
        }
      `}</style>
    </div>
  );
};
