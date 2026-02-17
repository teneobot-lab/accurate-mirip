
import React, { useMemo, useState, useEffect } from 'react';
import { Item, Warehouse, Transaction } from '../types';
import { StorageService } from '../services/storage';
import { ArrowLeft, RefreshCw, FileSpreadsheet, Printer, Calendar, Search, ArrowDownLeft, ArrowUpRight, Hash, Package, Info, ChevronRight, X, Edit3, ArrowRight, Filter } from 'lucide-react';
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

  // --- CORE LEDGER LOGIC ---
  const { ledgerRows, summary, openingBalance } = useMemo(() => {
    // 1. Pre-Filter & Sort Transactions
    // Sort by Date ASC, then CreatedAt ASC to ensure correct running balance order
    const itemTxs = transactions.filter(tx => 
        tx.items.some(line => line.itemId === item.id) && 
        (whFilter === 'ALL' || tx.sourceWarehouseId === whFilter)
    ).sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.createdAt - b.createdAt;
    });

    // 2. Calculate Opening Balance (Transactions BEFORE startDate)
    let opening = 0;
    const beforePeriodTxs = itemTxs.filter(tx => tx.date < startDate);
    
    beforePeriodTxs.forEach(tx => {
        const line = tx.items.find(l => l.itemId === item.id);
        if (!line) return;
        const qtyBase = line.qty * (line.ratio || 1);
        if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') opening += qtyBase;
        else if (tx.type === 'OUT' || tx.type === 'TRANSFER') opening -= qtyBase;
    });

    // 3. Calculate Ledger Rows (Transactions WITHIN Period)
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
  }, [transactions, item, startDate, endDate, warehouses, whFilter]);

  const handleExportExcel = async () => {
    if (ledgerRows.length === 0 && openingBalance === 0) return showToast("Tidak ada data untuk diekspor", "warning");
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Kartu Stok');
        
        // Style Headers
        sheet.getColumn('A').width = 12; // Date
        sheet.getColumn('B').width = 20; // Ref
        sheet.getColumn('C').width = 15; // Type
        sheet.getColumn('D').width = 20; // Warehouse
        sheet.getColumn('E').width = 40; // Desc
        sheet.getColumn('F').width = 12; // In
        sheet.getColumn('G').width = 12; // Out
        sheet.getColumn('H').width = 15; // Balance

        // Title Block
        sheet.addRow(['KARTU STOK BARANG']);
        sheet.addRow(['Item:', `[${item.code}] ${item.name}`]);
        sheet.addRow(['Satuan Dasar:', item.baseUnit]);
        sheet.addRow(['Periode:', `${startDate} s/d ${endDate}`]);
        sheet.addRow([]);

        // Table Header
        const headerRow = sheet.addRow(['TANGGAL', 'NO. REF', 'TIPE', 'GUDANG', 'KETERANGAN', 'MASUK', 'KELUAR', 'SALDO']);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FF000000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCDCFDB' } }; // Silver Mist Color
            cell.border = { bottom: { style: 'thin' } };
            cell.alignment = { horizontal: 'center' };
        });

        // Opening Balance Row
        const openRow = sheet.addRow([startDate, '', 'OPENING', '', 'Saldo Awal Periode', null, null, openingBalance]);
        openRow.font = { italic: true, color: { argb: 'FF64748B' } };
        openRow.getCell(8).font = { bold: true };

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
                row.balance
            ]);
            
            // Format Numbers
            [6, 7, 8].forEach(idx => {
                r.getCell(idx).numFmt = '#,##0.00';
                r.getCell(idx).alignment = { horizontal: 'right' };
            });
            r.getCell(8).font = { bold: true };
        });

        // Footer Totals
        const footerRow = sheet.addRow(['', '', '', '', 'TOTAL PERIODE', summary.totalIn, summary.totalOut, summary.closing]);
        footerRow.font = { bold: true };
        footerRow.getCell(5).alignment = { horizontal: 'right' };
        footerRow.eachCell((cell, colNumber) => {
            if (colNumber >= 5) cell.border = { top: { style: 'double' } };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `StockCard_${item.code}_${startDate}_${endDate}.xlsx`;
        anchor.click();
    } catch (e) { showToast("Gagal export excel", "error"); }
  };

  const handleEditSuccess = () => {
      setEditingTx(null);
      loadData();
  };

  if (editingTx) {
      return (
          <div className="fixed inset-0 z-[100] bg-white">
              <TransactionForm type={editingTx.type} initialData={editingTx} onClose={() => setEditingTx(null)} onSuccess={handleEditSuccess}/>
          </div>
      );
  }

  // --- STAT WIDGET ---
  const StatWidget = ({ label, value, colorClass }: any) => (
      <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
          <span className={`text-base font-mono font-bold ${colorClass}`}>{value.toLocaleString()}</span>
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-mist-50 flex flex-col font-sans animate-in slide-in-from-bottom-2 duration-300">
        
        {/* 1. TOP HEADER BAR (Compact & Professional) */}
        <div className="h-12 border-b border-mist-300 flex justify-between items-center px-4 bg-white shrink-0 shadow-sm z-20">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-1.5 hover:bg-mist-100 rounded-lg text-slate-500 transition-colors border border-transparent hover:border-mist-300">
                    <ArrowLeft size={16} />
                </button>
                <div className="h-6 w-px bg-mist-300 mx-1"></div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">{item.code}</span>
                        <h1 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{item.name}</h1>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center bg-mist-50 border border-mist-300 rounded-md p-0.5">
                     <div className="px-2 border-r border-mist-300">
                        <Filter size={12} className="text-slate-400"/>
                     </div>
                     <select value={whFilter} onChange={e => setWhFilter(e.target.value)} className="bg-transparent text-[11px] font-bold text-slate-600 outline-none px-2 py-1 cursor-pointer w-32">
                         <option value="ALL">Semua Gudang</option>
                         {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                     </select>
                </div>

                <div className="flex items-center gap-1 bg-white border border-mist-300 rounded-md px-2 py-1 shadow-sm">
                    <Calendar size={12} className="text-slate-400 mr-1"/>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[11px] font-bold text-slate-700 outline-none w-24 bg-transparent"/>
                    <span className="text-slate-300 text-[10px] mx-1">s/d</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[11px] font-bold text-slate-700 outline-none w-24 bg-transparent"/>
                </div>
                
                <div className="h-6 w-px bg-mist-300 mx-1"></div>

                <button onClick={loadData} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Refresh Data"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
                <button onClick={handleExportExcel} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Export Excel"><FileSpreadsheet size={16}/></button>
                <button onClick={() => window.print()} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors" title="Print"><Printer size={16}/></button>
            </div>
        </div>

        {/* 2. SUMMARY DASHBOARD (Pinned Below Header) */}
        <div className="bg-mist-50 border-b border-mist-300 py-3 px-6 flex items-center gap-8 shrink-0 shadow-[0_2px_4px_rgba(0,0,0,0.02)] z-10">
             <StatWidget label="Saldo Awal" value={openingBalance} colorClass="text-slate-500" />
             <div className="h-8 w-px bg-mist-300"></div>
             <StatWidget label="Total Masuk" value={summary.totalIn} colorClass="text-emerald-600" />
             <div className="h-8 w-px bg-mist-300"></div>
             <StatWidget label="Total Keluar" value={summary.totalOut} colorClass="text-rose-600" />
             <div className="flex-1"></div>
             <div className="bg-white border border-mist-300 px-4 py-2 rounded-lg shadow-sm flex flex-col items-end min-w-[150px]">
                 <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">Saldo Akhir</span>
                 <span className="text-xl font-mono font-black text-slate-800 tracking-tight">{summary.closing.toLocaleString()} <span className="text-xs font-bold text-slate-400">{item.baseUnit}</span></span>
             </div>
        </div>

        {/* 3. DENSE LEDGER TABLE (Main Content) */}
        <div className="flex-1 overflow-auto bg-white relative">
            <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                {/* SILVER MIST HEADER - STICKY */}
                <thead className="bg-mist-300 sticky top-0 z-10 shadow-sm border-b border-mist-300">
                    <tr className="h-9">
                        <th className="px-3 w-28 text-[10px] font-extrabold text-slate-700 uppercase border-r border-mist-400/30">Tanggal</th>
                        <th className="px-3 w-36 text-[10px] font-extrabold text-slate-700 uppercase border-r border-mist-400/30">No. Referensi</th>
                        <th className="px-3 w-40 text-[10px] font-extrabold text-slate-700 uppercase border-r border-mist-400/30">Gudang</th>
                        <th className="px-3 w-24 text-[10px] font-extrabold text-slate-700 uppercase text-center border-r border-mist-400/30">Tipe</th>
                        <th className="px-3 text-[10px] font-extrabold text-slate-700 uppercase border-r border-mist-400/30">Keterangan / Partner</th>
                        <th className="px-3 w-28 text-[10px] font-extrabold text-slate-700 uppercase text-right border-r border-mist-400/30 bg-emerald-100/20 text-emerald-800">Masuk</th>
                        <th className="px-3 w-28 text-[10px] font-extrabold text-slate-700 uppercase text-right border-r border-mist-400/30 bg-rose-100/20 text-rose-800">Keluar</th>
                        <th className="px-3 w-28 text-[10px] font-extrabold text-slate-700 uppercase text-right">Saldo</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-mist-100">
                     {/* Row 1: Opening Balance (Distinct Style) */}
                     <tr className="bg-mist-50/50 h-8 hover:bg-mist-100">
                         <td className="px-3 font-mono text-[10px] text-slate-400 font-bold">{startDate}</td>
                         <td className="px-3 text-[10px] text-slate-400 italic">OPENING_BAL</td>
                         <td className="px-3"></td>
                         <td className="px-3"></td>
                         <td className="px-3 text-[11px] font-bold text-slate-500 italic uppercase">Saldo Awal Periode</td>
                         <td className="px-3 bg-emerald-50/10 border-l border-mist-100"></td>
                         <td className="px-3 bg-rose-50/10 border-l border-mist-100"></td>
                         <td className="px-3 text-right font-mono font-bold text-[11px] text-slate-600 bg-mist-50 border-l border-mist-200">
                             {openingBalance.toLocaleString()}
                         </td>
                     </tr>

                     {/* Transaction Rows */}
                     {ledgerRows.map((row) => (
                         <tr key={row.id} className="h-8 hover:bg-blue-50/30 group transition-colors cursor-default border-b border-mist-100">
                             <td className="px-3 text-[11px] text-slate-600 font-medium whitespace-nowrap">{row.date}</td>
                             <td className="px-3">
                                 <button 
                                    onClick={() => setEditingTx(row.originalTx)}
                                    className="text-[10px] font-mono text-blue-600 hover:underline hover:text-blue-800 truncate block w-full text-left font-medium"
                                 >
                                     {row.ref}
                                 </button>
                             </td>
                             <td className="px-3 text-[10px] text-slate-500 uppercase truncate" title={row.whName}>{row.whName}</td>
                             <td className="px-3 text-center">
                                 <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                     row.type === 'IN' || row.type === 'ADJUSTMENT'
                                     ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                     : 'bg-rose-50 text-rose-600 border-rose-100'
                                 }`}>
                                     {row.type}
                                 </span>
                             </td>
                             <td className="px-3 text-[11px] text-slate-700 relative">
                                 <div className="truncate w-full max-w-sm group-hover:whitespace-normal group-hover:absolute group-hover:bg-white group-hover:z-20 group-hover:shadow-lg group-hover:border group-hover:border-mist-200 group-hover:p-1 group-hover:rounded group-hover:-mt-2 group-hover:left-2" title={`${row.partner} - ${row.note}`}>
                                     <span className="font-bold text-slate-800">{row.partner !== '-' ? row.partner : ''}</span>
                                     <span className="text-slate-500 ml-1">{row.note}</span>
                                 </div>
                             </td>
                             
                             {/* IN Column */}
                             <td className="px-3 text-right bg-emerald-50/10 border-l border-mist-100 font-mono text-[11px]">
                                 {row.inQty > 0 ? (
                                     <span className="font-bold text-emerald-600">+{row.inQty.toLocaleString()}</span>
                                 ) : <span className="text-slate-200">-</span>}
                             </td>
                             
                             {/* OUT Column */}
                             <td className="px-3 text-right bg-rose-50/10 border-l border-mist-100 font-mono text-[11px]">
                                 {row.outQty > 0 ? (
                                     <span className="font-bold text-rose-600">-{row.outQty.toLocaleString()}</span>
                                 ) : <span className="text-slate-200">-</span>}
                             </td>
                             
                             {/* Balance Column (Running) */}
                             <td className="px-3 text-right font-mono text-[11px] font-bold text-slate-800 bg-mist-50/30 border-l border-mist-200">
                                 {row.balance.toLocaleString()}
                             </td>
                         </tr>
                     ))}

                     {ledgerRows.length === 0 && (
                         <tr>
                             <td colSpan={8} className="py-24 text-center text-slate-400 italic text-xs">
                                 <div className="flex flex-col items-center justify-center gap-2">
                                     <Info size={24} className="opacity-20"/>
                                     <span>Tidak ada transaksi pada periode ini</span>
                                 </div>
                             </td>
                         </tr>
                     )}
                </tbody>
            </table>
        </div>
        
        {/* PRINT CSS OVERRIDE */}
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
