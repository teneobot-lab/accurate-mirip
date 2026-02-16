
import React, { useMemo, useState, useEffect } from 'react';
import { Item, Warehouse, Transaction } from '../types';
import { StorageService } from '../services/storage';
import { ArrowLeft, RefreshCw, FileSpreadsheet, Printer, Calendar, Search, ArrowDownLeft, ArrowUpRight, Hash, Package, Info, ChevronRight, X, Edit3 } from 'lucide-react';
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
    originalTx: Transaction; // Keep ref to full object
}

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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedTx, fetchedWh] = await Promise.all([
        StorageService.fetchTransactions(),
        StorageService.fetchWarehouses()
      ]);
      setTransactions(fetchedTx);
      setWarehouses(fetchedWh);
    } catch (error) {
      showToast("Gagal memuat data kartu stok", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [item.id]);

  const { ledgerRows, summary, openingBalance } = useMemo(() => {
    const itemTxs = transactions.filter(tx => 
        tx.items.some(line => line.itemId === item.id)
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.createdAt - b.createdAt);

    let opening = 0;
    const beforePeriodTxs = itemTxs.filter(tx => tx.date < startDate);
    beforePeriodTxs.forEach(tx => {
        const line = tx.items.find(l => l.itemId === item.id);
        if (!line) return;
        const qtyBase = line.qty * (line.ratio || 1);
        if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') opening += qtyBase;
        else if (tx.type === 'OUT' || tx.type === 'TRANSFER') opening -= qtyBase;
    });

    const periodTxs = itemTxs.filter(tx => tx.date >= startDate && tx.date <= endDate);
    let runningBalance = opening;
    let totalIn = 0;
    let totalOut = 0;

    const rows: StockLedgerRow[] = periodTxs.map(tx => {
        const line = tx.items.find(l => l.itemId === item.id);
        if (!line) return {} as StockLedgerRow;

        const qtyBase = line.qty * (line.ratio || 1);
        let inQty = 0;
        let outQty = 0;

        if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
            inQty = qtyBase;
            totalIn += qtyBase;
            runningBalance += qtyBase;
        } else {
            outQty = qtyBase;
            totalOut += qtyBase;
            runningBalance -= qtyBase;
        }

        const whName = warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || 'Unknown';

        return {
            id: tx.id,
            date: tx.date,
            ref: tx.referenceNo,
            type: tx.type,
            whName: whName,
            partner: tx.partnerName || '-',
            note: tx.notes || line.note || '',
            inQty,
            outQty,
            balance: runningBalance,
            unit: item.baseUnit,
            originalTx: tx
        };
    });

    return {
        ledgerRows: rows,
        summary: { totalIn, totalOut, closing: runningBalance },
        openingBalance: opening
    };
  }, [transactions, item, startDate, endDate, warehouses]);

  const handleExportExcel = async () => {
    if (ledgerRows.length === 0 && openingBalance === 0) return showToast("Tidak ada data untuk diekspor", "warning");
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Kartu Stok');
        sheet.mergeCells('A1:G1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = 'KARTU STOK BARANG (STOCK CARD)';
        titleCell.font = { name: 'Arial', size: 12, bold: true };
        titleCell.alignment = { horizontal: 'center' };

        const headerRow = sheet.addRow(['TANGGAL', 'NO. BUKTI', 'TIPE', 'PARTNER/KETERANGAN', 'MASUK', 'KELUAR', 'SALDO']);
        headerRow.font = { bold: true };
        
        sheet.addRow([startDate, '-', 'OPENING', 'SALDO AWAL', null, null, openingBalance]);
        ledgerRows.forEach(row => {
            sheet.addRow([row.date, row.ref, row.type, row.partner, row.inQty || null, row.outQty || null, row.balance]);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `StockCard_${item.code}.xlsx`;
        anchor.click();
        showToast("Laporan Excel Berhasil Diunduh", "success");
    } catch (e) { showToast("Gagal export", "error"); }
  };

  const handlePrint = () => {
      window.print();
  };

  const handleEditTransaction = (tx: Transaction) => {
      setEditingTx(tx);
  };

  const handleEditSuccess = () => {
      setEditingTx(null);
      loadData(); // Reload to reflect changes
  };

  // --- EDIT MODE OVERLAY ---
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-800/95 backdrop-blur-sm overflow-y-auto flex justify-center py-8 animate-in fade-in duration-300">
        
        {/* ACTION FLOATING BAR */}
        <div className="fixed top-4 right-4 flex flex-col gap-2 z-[60] print:hidden">
            <button onClick={onBack} className="p-3 bg-white text-slate-700 rounded-full shadow-lg hover:bg-slate-100 hover:text-rose-600 transition-all" title="Tutup">
                <X size={20} />
            </button>
            <button onClick={handlePrint} className="p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all" title="Print / PDF">
                <Printer size={20} />
            </button>
            <button onClick={handleExportExcel} className="p-3 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-all" title="Excel">
                <FileSpreadsheet size={20} />
            </button>
        </div>

        {/* A4 PAPER CONTAINER */}
        <div className="bg-white w-[210mm] min-h-[297mm] shadow-2xl relative flex flex-col print:shadow-none print:w-full print:absolute print:inset-0 print:m-0">
            
            {/* HEADER PAPER */}
            <div className="px-[15mm] pt-[15mm] pb-4 border-b-2 border-slate-800 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-widest leading-none">KARTU STOK</h1>
                    <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wide">Stock Card Ledger</p>
                </div>
                <div className="text-right">
                    <h2 className="text-sm font-bold text-slate-800">{item.name}</h2>
                    <p className="text-xs font-mono text-slate-500">{item.code} • {item.category || 'UMUM'}</p>
                </div>
            </div>

            {/* INFO BAR */}
            <div className="px-[15mm] py-4 flex justify-between items-center bg-slate-50 border-b border-slate-200 text-xs">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400"/>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none w-24 cursor-pointer hover:text-blue-600"/>
                        <span className="text-slate-400">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none w-24 cursor-pointer hover:text-blue-600"/>
                    </div>
                    <div className="h-4 w-px bg-slate-300"></div>
                    <div className="font-bold text-slate-500">
                        Base Unit: <span className="text-slate-800">{item.baseUnit}</span>
                    </div>
                </div>
                <button onClick={loadData} className="flex items-center gap-1 text-slate-400 hover:text-blue-600 print:hidden">
                    <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''}/> Refresh
                </button>
            </div>

            {/* SUMMARY BOXES (A4 Width) */}
            <div className="px-[15mm] py-6 grid grid-cols-4 gap-4">
                <div className="p-3 border border-slate-200 rounded bg-white">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Saldo Awal</div>
                    <div className="text-lg font-mono font-bold text-slate-600 mt-1">{openingBalance.toLocaleString()}</div>
                </div>
                <div className="p-3 border border-emerald-100 rounded bg-emerald-50/30">
                    <div className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider">Total Masuk</div>
                    <div className="text-lg font-mono font-bold text-emerald-700 mt-1">+{summary.totalIn.toLocaleString()}</div>
                </div>
                <div className="p-3 border border-rose-100 rounded bg-rose-50/30">
                    <div className="text-[10px] text-rose-600 uppercase font-bold tracking-wider">Total Keluar</div>
                    <div className="text-lg font-mono font-bold text-rose-700 mt-1">-{summary.totalOut.toLocaleString()}</div>
                </div>
                <div className="p-3 border border-slate-800 rounded bg-slate-900 text-white">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Saldo Akhir</div>
                    <div className="text-lg font-mono font-bold text-white mt-1">{summary.closing.toLocaleString()}</div>
                </div>
            </div>

            {/* LEDGER TABLE */}
            <div className="flex-1 px-[15mm] pb-[15mm]">
                <table className="w-full text-left border-collapse border-t-2 border-slate-800">
                    <thead>
                        <tr className="border-b border-slate-300">
                            <th className="py-2 text-[10px] font-bold text-slate-500 uppercase w-20">Tanggal</th>
                            <th className="py-2 text-[10px] font-bold text-slate-500 uppercase w-28">No. Bukti</th>
                            <th className="py-2 text-[10px] font-bold text-slate-500 uppercase">Keterangan / Partner</th>
                            <th className="py-2 text-[10px] font-bold text-slate-800 uppercase w-20 text-right bg-slate-50">Masuk</th>
                            <th className="py-2 text-[10px] font-bold text-slate-800 uppercase w-20 text-right bg-slate-50">Keluar</th>
                            <th className="py-2 text-[10px] font-bold text-slate-800 uppercase w-24 text-right">Saldo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                        {/* Opening Balance Row */}
                        <tr className="bg-slate-50/50">
                            <td className="py-2 font-mono text-slate-400 italic">{startDate}</td>
                            <td className="py-2 text-slate-300 text-center">—</td>
                            <td className="py-2 font-bold text-slate-500">SALDO AWAL</td>
                            <td className="py-2 text-right font-mono text-slate-300 bg-slate-50/30">—</td>
                            <td className="py-2 text-right font-mono text-slate-300 bg-slate-50/30">—</td>
                            <td className="py-2 text-right font-mono font-bold text-slate-700 bg-slate-100">{openingBalance.toLocaleString()}</td>
                        </tr>

                        {ledgerRows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-slate-400 italic">Tidak ada transaksi pada periode ini.</td>
                            </tr>
                        ) : (
                            ledgerRows.map((row) => (
                                <tr key={row.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="py-2 font-mono text-slate-600">{row.date}</td>
                                    <td className="py-2 font-mono text-blue-600 group-hover:underline cursor-pointer" onClick={() => handleEditTransaction(row.originalTx)}>
                                        {row.ref}
                                    </td>
                                    <td className="py-2 text-slate-700 truncate max-w-[250px]">
                                        <div className="flex flex-col">
                                            <span className="font-semibold">{row.partner !== '-' ? row.partner : row.whName}</span>
                                            {row.note && <span className="text-[10px] text-slate-400 italic">{row.note}</span>}
                                        </div>
                                    </td>
                                    
                                    {/* CLICKABLE IN QTY */}
                                    <td 
                                        className={`py-2 text-right font-mono cursor-pointer border-l border-slate-100 bg-slate-50/30 hover:bg-blue-100 hover:text-blue-700 transition-colors ${row.inQty > 0 ? 'font-bold text-emerald-700' : 'text-slate-200'}`}
                                        onClick={() => handleEditTransaction(row.originalTx)}
                                        title="Klik untuk edit transaksi"
                                    >
                                        {row.inQty > 0 ? row.inQty.toLocaleString() : '—'}
                                    </td>

                                    {/* CLICKABLE OUT QTY */}
                                    <td 
                                        className={`py-2 text-right font-mono cursor-pointer border-l border-slate-100 bg-slate-50/30 hover:bg-blue-100 hover:text-blue-700 transition-colors ${row.outQty > 0 ? 'font-bold text-rose-700' : 'text-slate-200'}`}
                                        onClick={() => handleEditTransaction(row.originalTx)}
                                        title="Klik untuk edit transaksi"
                                    >
                                        {row.outQty > 0 ? row.outQty.toLocaleString() : '—'}
                                    </td>

                                    <td className="py-2 text-right font-mono font-bold text-slate-800 bg-slate-50 border-l border-slate-200">
                                        {row.balance.toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* FOOTER */}
            <div className="px-[15mm] py-4 border-t border-slate-200 text-[10px] text-slate-400 flex justify-between items-center print:hidden">
                <span>GudangPro Inventory System • Dicetak pada {new Date().toLocaleDateString()}</span>
                <span className="italic">Page 1 of 1</span>
            </div>
        </div>
        
        <style>{`
            @media print {
                @page { size: A4; margin: 0; }
                body { background: white; }
                .print\\:hidden { display: none !important; }
                .print\\:shadow-none { box-shadow: none !important; }
                .print\\:w-full { width: 100% !important; }
                .print\\:absolute { position: absolute !important; }
                .print\\:inset-0 { inset: 0 !important; }
            }
        `}</style>
    </div>
  );
};
