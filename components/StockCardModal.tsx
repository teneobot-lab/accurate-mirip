
import React, { useMemo, useState, useEffect } from 'react';
import { Item, Warehouse, Transaction } from '../types';
import { StorageService } from '../services/storage';
import { ArrowLeft, RefreshCw, FileSpreadsheet, Printer, Calendar, Search, ArrowDownLeft, ArrowUpRight, Hash, Package, Info, ChevronRight, X, Edit3, ArrowRight } from 'lucide-react';
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

  const { ledgerRows, summary, openingBalance } = useMemo(() => {
    // 1. Filter Item & Warehouse (Global)
    const itemTxs = transactions.filter(tx => 
        tx.items.some(line => line.itemId === item.id) && 
        (whFilter === 'ALL' || tx.sourceWarehouseId === whFilter)
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.createdAt - b.createdAt);

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
        
        // Header Info
        sheet.addRow(['KARTU STOK SISTEM']);
        sheet.addRow(['ITEM:', item.name, item.code]);
        sheet.addRow(['PERIODE:', startDate, 's/d', endDate]);
        sheet.addRow([]);

        const headerRow = sheet.addRow(['TANGGAL', 'REF', 'TIPE', 'GUDANG', 'PARTNER/KET', 'MASUK', 'KELUAR', 'SALDO']);
        headerRow.font = { bold: true };
        
        sheet.addRow([startDate, 'OPENING', '-', '-', 'SALDO AWAL', null, null, openingBalance]);
        ledgerRows.forEach(row => {
            sheet.addRow([row.date, row.ref, row.type, row.whName, `${row.partner} ${row.note}`, row.inQty || null, row.outQty || null, row.balance]);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `StockCard_${item.code}_${startDate}.xlsx`;
        anchor.click();
    } catch (e) { showToast("Gagal export", "error"); }
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

  // --- STAT CARD COMPONENT ---
  const StatCard = ({ label, val, color }: any) => (
      <div className="flex flex-col px-4 border-r border-slate-200 last:border-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
          <span className={`text-lg font-mono font-bold ${color}`}>{val.toLocaleString()}</span>
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col font-sans animate-in slide-in-from-bottom-2 duration-300">
        
        {/* 1. HEADER BAR */}
        <div className="h-14 border-b border-slate-200 flex justify-between items-center px-4 bg-white shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-sm font-bold text-slate-800">{item.name}</h1>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono font-semibold">{item.code}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                         <Package size={10}/> {item.category || 'Uncategorized'} 
                         <span className="text-slate-300">•</span>
                         <Hash size={10}/> Base Unit: <strong className="text-slate-600">{item.baseUnit}</strong>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1 mr-4">
                     <div className="flex items-center px-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-2">Filter:</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none w-24"/>
                        <ArrowRight size={10} className="text-slate-400 mx-1"/>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none w-24"/>
                     </div>
                     <div className="w-px h-4 bg-slate-300"></div>
                     <select value={whFilter} onChange={e => setWhFilter(e.target.value)} className="bg-transparent text-xs font-bold text-slate-600 outline-none px-2 cursor-pointer">
                         <option value="ALL">Semua Gudang</option>
                         {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                     </select>
                </div>
                
                <button onClick={loadData} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
                <button onClick={handleExportExcel} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><FileSpreadsheet size={18}/></button>
                <button onClick={() => window.print()} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"><Printer size={18}/></button>
            </div>
        </div>

        {/* 2. SUMMARY STRIP */}
        <div className="bg-slate-50 border-b border-slate-200 py-3 flex items-center px-4 shrink-0 overflow-x-auto">
             <StatCard label="Saldo Awal" val={openingBalance} color="text-slate-600" />
             <StatCard label="Total Masuk" val={summary.totalIn} color="text-emerald-600" />
             <StatCard label="Total Keluar" val={summary.totalOut} color="text-rose-600" />
             <div className="flex flex-col px-4 border-l-2 border-slate-200 bg-white ml-2 rounded-r-lg shadow-sm">
                 <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Saldo Akhir</span>
                 <span className="text-xl font-mono font-bold text-slate-800">{summary.closing.toLocaleString()} <span className="text-xs text-slate-400">{item.baseUnit}</span></span>
             </div>
        </div>

        {/* 3. DENSE LEDGER TABLE */}
        <div className="flex-1 overflow-auto bg-white relative">
            <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
                <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                    <tr className="h-9">
                        <th className="px-3 w-28 text-[10px] font-bold text-slate-400 uppercase">Tanggal</th>
                        <th className="px-3 w-36 text-[10px] font-bold text-slate-400 uppercase">No. Referensi</th>
                        <th className="px-3 w-40 text-[10px] font-bold text-slate-400 uppercase">Gudang</th>
                        <th className="px-3 w-20 text-[10px] font-bold text-slate-400 uppercase text-center">Tipe</th>
                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase">Keterangan / Partner</th>
                        <th className="px-3 w-24 text-[10px] font-bold text-slate-400 uppercase text-right bg-emerald-50/30 text-emerald-600">Masuk</th>
                        <th className="px-3 w-24 text-[10px] font-bold text-slate-400 uppercase text-right bg-rose-50/30 text-rose-600">Keluar</th>
                        <th className="px-3 w-28 text-[10px] font-bold text-slate-400 uppercase text-right">Saldo</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                     {/* Opening Balance Row */}
                     <tr className="bg-slate-50/40 h-8">
                         <td className="px-3 font-mono text-[10px] text-slate-400">{startDate}</td>
                         <td className="px-3 text-[10px] text-slate-300 italic">OPENING</td>
                         <td className="px-3"></td>
                         <td className="px-3"></td>
                         <td className="px-3 text-[11px] font-bold text-slate-500 italic">SALDO AWAL PERIODE</td>
                         <td className="px-3 bg-emerald-50/10"></td>
                         <td className="px-3 bg-rose-50/10"></td>
                         <td className="px-3 text-right font-mono font-bold text-[11px] text-slate-700">{openingBalance.toLocaleString()}</td>
                     </tr>

                     {ledgerRows.map((row) => (
                         <tr key={row.id} className="h-8 hover:bg-blue-50/50 group transition-colors cursor-default">
                             <td className="px-3 text-[11px] text-slate-600 font-medium whitespace-nowrap">{row.date}</td>
                             <td className="px-3">
                                 <button 
                                    onClick={() => setEditingTx(row.originalTx)}
                                    className="text-[10px] font-mono text-blue-600 hover:underline hover:text-blue-700 truncate block w-full text-left"
                                 >
                                     {row.ref}
                                 </button>
                             </td>
                             <td className="px-3 text-[10px] text-slate-500 uppercase truncate" title={row.whName}>{row.whName}</td>
                             <td className="px-3 text-center">
                                 <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${row.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                     {row.type}
                                 </span>
                             </td>
                             <td className="px-3 text-[11px] text-slate-700 relative group-hover:text-slate-900">
                                 <div className="truncate w-full max-w-xs" title={`${row.partner} - ${row.note}`}>
                                     <span className="font-semibold">{row.partner !== '-' ? row.partner : ''}</span>
                                     <span className="text-slate-400 ml-1">{row.note}</span>
                                 </div>
                             </td>
                             <td className="px-3 text-right bg-emerald-50/20 font-mono text-[11px]">
                                 {row.inQty > 0 ? <span className="font-bold text-emerald-600">+{row.inQty.toLocaleString()}</span> : <span className="text-slate-200">-</span>}
                             </td>
                             <td className="px-3 text-right bg-rose-50/20 font-mono text-[11px]">
                                 {row.outQty > 0 ? <span className="font-bold text-rose-600">-{row.outQty.toLocaleString()}</span> : <span className="text-slate-200">-</span>}
                             </td>
                             <td className="px-3 text-right font-mono text-[11px] font-bold text-slate-700 bg-slate-50/30">
                                 {row.balance.toLocaleString()}
                             </td>
                         </tr>
                     ))}

                     {ledgerRows.length === 0 && (
                         <tr>
                             <td colSpan={8} className="py-20 text-center text-slate-400 italic text-xs">
                                 Tidak ada transaksi pada periode ini
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
            }
        `}</style>
    </div>
  );
};
