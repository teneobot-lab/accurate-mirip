
import React, { useMemo, useState, useEffect } from 'react';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { StorageService } from '../services/storage';
import { ArrowLeft, RefreshCw, FileSpreadsheet, Printer, Calendar, Search, ArrowDownLeft, ArrowUpRight, Hash, Package, Info, ChevronRight } from 'lucide-react';
import ExcelJS from 'exceljs';
import { useToast } from './Toast';

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
}

export const StockCardView: React.FC<Props> = ({ item, onBack }) => {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
            unit: item.baseUnit
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

  const MiniStat = ({ label, value, color = "text-slate-600" }: any) => (
    <div className="flex flex-col border-r border-slate-200 px-4 last:border-0">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</span>
        <span className={`text-[13px] font-bold font-mono ${color}`}>{value.toLocaleString()}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
        {/* COMPACT TOOLBAR */}
        <div className="h-10 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between px-2 shrink-0">
            <div className="flex items-center h-full">
                <button onClick={onBack} className="flex items-center gap-1.5 px-3 h-full border-r border-slate-200 text-slate-500 hover:bg-white transition-colors">
                    <ArrowLeft size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-tight">Kembali</span>
                </button>
                <div className="px-4 flex items-center gap-2">
                    <Package size={14} className="text-slate-400"/>
                    <span className="text-[11px] font-bold text-slate-700 truncate max-w-[200px]">{item.name}</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 rounded">{item.code}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2 h-full pr-2">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2 py-0.5">
                    <Calendar size={12} className="text-slate-400" />
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[10px] font-bold outline-none border-none bg-transparent w-24" />
                    <span className="text-slate-300">/</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[10px] font-bold outline-none border-none bg-transparent w-24" />
                </div>
                <button onClick={loadData} className="p-1.5 text-slate-400 hover:text-blue-600">
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''}/>
                </button>
                <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold shadow-sm hover:bg-emerald-700 transition-all">
                    <FileSpreadsheet size={13}/> EXCEL
                </button>
            </div>
        </div>

        {/* SUMMARY BAR (VERY DENSE) */}
        <div className="h-12 bg-white border-b border-slate-200 flex items-center px-2 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <MiniStat label="Saldo Awal" value={openingBalance} />
            <MiniStat label="Total Masuk" value={summary.totalIn} color="text-emerald-600" />
            <MiniStat label="Total Keluar" value={summary.totalOut} color="text-rose-600" />
            <div className="flex flex-col px-4 bg-slate-800 rounded mx-2 py-1 shadow-sm">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Saldo Akhir</span>
                <span className="text-[13px] font-bold font-mono text-white leading-none">{summary.closing.toLocaleString()} <span className="text-[9px] font-medium opacity-50 ml-0.5">{item.baseUnit}</span></span>
            </div>
        </div>

        {/* ULTRA DENSE LEDGER GRID */}
        <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse table-fixed text-left">
                <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                    <tr className="h-8">
                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-24">Tanggal</th>
                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-32">No. Referensi</th>
                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase w-16 text-center">Tipe</th>
                        <th className="px-3 text-[10px] font-bold text-slate-400 uppercase">Partner / Keterangan</th>
                        <th className="px-3 text-[10px] font-bold text-emerald-600 uppercase w-24 text-right">Masuk</th>
                        <th className="px-3 text-[10px] font-bold text-rose-600 uppercase w-24 text-right">Keluar</th>
                        <th className="px-3 text-[10px] font-bold text-slate-700 uppercase w-28 text-right bg-slate-50/50">Saldo</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {/* OPENING ROW */}
                    <tr className="h-7 bg-slate-50/50">
                        <td className="px-3 text-[11px] font-mono text-slate-400">{startDate}</td>
                        <td className="px-3 text-[10px] font-bold text-slate-300 italic text-center">—</td>
                        <td className="px-3 text-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">OPEN</span>
                        </td>
                        <td className="px-3 text-[11px] text-slate-400 italic">Saldo Awal Periode</td>
                        <td className="px-3 text-right text-[11px] font-mono text-slate-300">—</td>
                        <td className="px-3 text-right text-[11px] font-mono text-slate-300">—</td>
                        <td className="px-3 text-right text-[11px] font-mono font-bold text-slate-500 bg-slate-50">{openingBalance.toLocaleString()}</td>
                    </tr>

                    {ledgerRows.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="h-20 text-center text-slate-300 text-[11px] font-medium uppercase tracking-widest italic">Tidak ada mutasi transaksi</td>
                        </tr>
                    ) : (
                        ledgerRows.map((row) => (
                            <tr key={row.id} className="h-7 hover:bg-slate-50 transition-colors group">
                                <td className="px-3 text-[11px] font-mono text-slate-500">{row.date}</td>
                                <td className="px-3 text-[11px] font-mono font-semibold text-blue-600 truncate cursor-default">{row.ref}</td>
                                <td className="px-3 text-center">
                                    <span className={`px-1 rounded text-[9px] font-bold border ${
                                        row.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                        row.type === 'OUT' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                        'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>{row.type}</span>
                                </td>
                                <td className="px-3 text-[11px] font-medium text-slate-700 truncate">
                                    {row.partner !== '-' ? <span className="text-blue-700 mr-2">{row.partner}</span> : null}
                                    <span className="text-slate-500 italic font-normal">{row.note}</span>
                                </td>
                                <td className={`px-3 text-right text-[11px] font-mono font-semibold ${row.inQty > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                    {row.inQty > 0 ? row.inQty.toLocaleString() : '—'}
                                </td>
                                <td className={`px-3 text-right text-[11px] font-mono font-semibold ${row.outQty > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                                    {row.outQty > 0 ? row.outQty.toLocaleString() : '—'}
                                </td>
                                <td className="px-3 text-right text-[11px] font-mono font-bold text-slate-700 bg-slate-50/30 group-hover:bg-blue-50/50">
                                    {row.balance.toLocaleString()}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

        {/* MINI STATUS BAR */}
        <div className="h-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-3 text-[9px] font-bold text-slate-400 shrink-0">
            <div className="flex items-center gap-2">
                <Info size={10}/>
                <span className="uppercase tracking-widest">Gudang: {item.category || 'SEMUA'}</span>
                <span className="text-slate-200">|</span>
                <span className="uppercase tracking-widest">Satuan: {item.baseUnit}</span>
            </div>
            <div className="italic opacity-60">System Accurate Interface V2.0</div>
        </div>
        <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 3px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        `}</style>
    </div>
  );
};
