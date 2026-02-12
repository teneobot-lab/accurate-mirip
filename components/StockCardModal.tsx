
import React, { useMemo, useState, useEffect } from 'react';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { StorageService } from '../services/storage';
import { ArrowLeft, RefreshCw, FileSpreadsheet, Printer, Calendar, Search, ArrowDownLeft, ArrowUpRight, Hash } from 'lucide-react';
import * as XLSX from 'xlsx';
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
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Default tanggal: Awal bulan ini s/d Hari ini
  const [startDate, setStartDate] = useState(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedTx, fetchedWh, fetchedStocks] = await Promise.all([
        StorageService.fetchTransactions(),
        StorageService.fetchWarehouses(),
        StorageService.fetchStocks()
      ]);
      setTransactions(fetchedTx);
      setWarehouses(fetchedWh);
      setStocks(fetchedStocks);
    } catch (error) {
      showToast("Gagal memuat data kartu stok", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [item.id]);

  // --- LOGIC PERHITUNGAN KARTU STOK (LEDGER) ---
  const { ledgerRows, summary, openingBalance } = useMemo(() => {
    // 1. Filter transaksi hanya untuk item ini
    const itemTxs = transactions.filter(tx => 
        tx.items.some(line => line.itemId === item.id)
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.createdAt - b.createdAt);

    // 2. Hitung Saldo Awal (Transaksi sebelum Start Date)
    let opening = 0;
    // Optional: Jika ada initial stock di master item, tambahkan di sini (jika didukung DB)
    
    const beforePeriodTxs = itemTxs.filter(tx => tx.date < startDate);
    beforePeriodTxs.forEach(tx => {
        const line = tx.items.find(l => l.itemId === item.id);
        if (!line) return;
        const qtyBase = line.qty * (line.ratio || 1);
        
        if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') opening += qtyBase;
        else if (tx.type === 'OUT' || tx.type === 'TRANSFER') opening -= qtyBase;
    });

    // 3. Proses Transaksi dalam Periode
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

  // --- EXPORT TO EXCEL ---
  const handleExportExcel = () => {
    if (ledgerRows.length === 0) return showToast("Tidak ada data untuk diekspor", "warning");

    // Format Data untuk Excel
    const excelData = [
        { 
            Tanggal: startDate, 
            'No. Referensi': 'SALDO AWAL', 
            Keterangan: 'Bawaan Periode Sebelumnya', 
            Masuk: 0, 
            Keluar: 0, 
            Saldo: openingBalance 
        },
        ...ledgerRows.map(row => ({
            Tanggal: row.date,
            'No. Referensi': row.ref,
            'Tipe': row.type,
            'Gudang': row.whName,
            'Partner': row.partner,
            'Keterangan': row.note,
            'Masuk': row.inQty,
            'Keluar': row.outQty,
            'Saldo': row.balance
        }))
    ];

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kartu Stok");

    // Auto width columns
    const wscols = [
        {wch: 12}, {wch: 20}, {wch: 10}, {wch: 20}, {wch: 20}, {wch: 30}, {wch: 10}, {wch: 10}, {wch: 12}
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, `KartuStok_${item.code}_${startDate}_${endDate}.xlsx`);
    showToast("File Excel Berhasil Diunduh", "success");
  };

  return (
    <div className="flex flex-col h-full bg-[#e8e8e8] font-sans">
        
        {/* 1. HEADER & TOOLBAR (Classic Style) */}
        <div className="bg-[#f0f0f0] border-b border-[#999] px-4 py-2 flex justify-between items-center shadow-sm shrink-0">
            <div className="flex items-center gap-4">
                 <button onClick={onBack} className="p-1.5 border border-[#999] bg-[#e1e1e1] hover:bg-white rounded shadow-sm text-slate-700">
                    <ArrowLeft size={16} />
                 </button>
                 <div>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">KARTU STOK (STOCK CARD)</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="font-mono font-bold bg-yellow-100 border border-yellow-300 px-1">{item.code}</span>
                        <span className="font-bold">{item.name}</span>
                        <span className="text-[10px] bg-slate-200 px-1 rounded border border-slate-300">{item.baseUnit}</span>
                    </div>
                 </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border border-[#999] px-2 py-1 shadow-inner">
                    <span className="text-[10px] font-bold text-slate-500 mr-2 uppercase">Periode:</span>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs font-bold border-none outline-none w-24" />
                    <span className="text-xs mx-1">-</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs font-bold border-none outline-none w-24" />
                    <button onClick={loadData} className="ml-2 text-blue-600 hover:text-blue-800"><RefreshCw size={14}/></button>
                </div>
                
                <button onClick={handleExportExcel} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-700 text-white text-xs font-bold border border-emerald-800 hover:bg-emerald-600 shadow-sm">
                    <FileSpreadsheet size={14}/> Export Excel
                </button>
            </div>
        </div>

        {/* 2. SUMMARY PANEL */}
        <div className="bg-[#d4d0c8] px-4 py-2 border-b border-white grid grid-cols-4 gap-4 text-xs shrink-0">
            <div className="bg-white border border-[#999] p-2 flex justify-between items-center shadow-inner">
                <span className="font-bold text-slate-500 uppercase">Saldo Awal</span>
                <span className="font-mono font-black text-slate-800">{openingBalance.toLocaleString()}</span>
            </div>
            <div className="bg-white border border-[#999] p-2 flex justify-between items-center shadow-inner">
                <span className="font-bold text-emerald-600 uppercase flex items-center gap-1"><ArrowDownLeft size={12}/> Masuk</span>
                <span className="font-mono font-black text-emerald-600">{summary.totalIn.toLocaleString()}</span>
            </div>
            <div className="bg-white border border-[#999] p-2 flex justify-between items-center shadow-inner">
                <span className="font-bold text-red-600 uppercase flex items-center gap-1"><ArrowUpRight size={12}/> Keluar</span>
                <span className="font-mono font-black text-red-600">{summary.totalOut.toLocaleString()}</span>
            </div>
            <div className="bg-yellow-50 border border-yellow-400 p-2 flex justify-between items-center shadow-sm">
                <span className="font-bold text-slate-800 uppercase flex items-center gap-1"><Hash size={12}/> Saldo Akhir</span>
                <span className="font-mono font-black text-slate-900 text-sm">{summary.closing.toLocaleString()} <span className="text-[9px] text-slate-500">{item.baseUnit}</span></span>
            </div>
        </div>

        {/* 3. DENSE DATA TABLE */}
        <div className="flex-1 overflow-auto p-4">
            <div className="bg-white border border-[#999] shadow-sm min-w-[900px]">
                <table className="w-full border-collapse text-xs">
                    <thead className="bg-[#e1e1e1] text-slate-800 font-bold uppercase sticky top-0 z-10">
                        <tr>
                            <th className="border border-[#999] px-2 py-1.5 w-24">Tanggal</th>
                            <th className="border border-[#999] px-2 py-1.5 w-32">No. Bukti</th>
                            <th className="border border-[#999] px-2 py-1.5 w-20 text-center">Tipe</th>
                            <th className="border border-[#999] px-2 py-1.5">Keterangan / Partner / Gudang</th>
                            <th className="border border-[#999] px-2 py-1.5 w-24 text-right bg-emerald-50">Masuk</th>
                            <th className="border border-[#999] px-2 py-1.5 w-24 text-right bg-red-50">Keluar</th>
                            <th className="border border-[#999] px-2 py-1.5 w-28 text-right bg-yellow-50">Saldo</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-700">
                        {/* OPENING BALANCE ROW */}
                        <tr className="bg-[#f9f9f9] font-bold italic text-slate-500">
                            <td className="border border-[#ccc] px-2 py-1">{startDate}</td>
                            <td className="border border-[#ccc] px-2 py-1 text-center">-</td>
                            <td className="border border-[#ccc] px-2 py-1 text-center">OPENING</td>
                            <td className="border border-[#ccc] px-2 py-1">SALDO AWAL PERIODE</td>
                            <td className="border border-[#ccc] px-2 py-1 text-right bg-emerald-50/50">-</td>
                            <td className="border border-[#ccc] px-2 py-1 text-right bg-red-50/50">-</td>
                            <td className="border border-[#ccc] px-2 py-1 text-right font-mono text-slate-800 bg-yellow-50/50">{openingBalance.toLocaleString()}</td>
                        </tr>

                        {ledgerRows.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-slate-400 italic">Tidak ada transaksi pada periode ini</td>
                            </tr>
                        ) : ledgerRows.map((row) => (
                            <tr key={row.id} className="hover:bg-blue-50 transition-colors">
                                <td className="border border-[#ccc] px-2 py-1 font-mono text-[11px] whitespace-nowrap">
                                    {new Date(row.date).toLocaleDateString('id-ID')}
                                </td>
                                <td className="border border-[#ccc] px-2 py-1 font-mono text-[11px] text-blue-700 whitespace-nowrap cursor-pointer hover:underline" title="Lihat Detail Transaksi">
                                    {row.ref}
                                </td>
                                <td className="border border-[#ccc] px-2 py-1 text-center text-[10px]">
                                    {row.type}
                                </td>
                                <td className="border border-[#ccc] px-2 py-1 truncate max-w-xs">
                                    <span className="font-bold text-slate-800">{row.partner}</span>
                                    <span className="mx-1 text-slate-400">|</span>
                                    <span className="text-slate-600">{row.whName}</span>
                                    {row.note && <span className="ml-2 italic text-slate-500 text-[10px]">({row.note})</span>}
                                </td>
                                <td className={`border border-[#ccc] px-2 py-1 text-right font-mono ${row.inQty > 0 ? 'text-emerald-600 font-bold bg-emerald-50/30' : 'text-slate-300'}`}>
                                    {row.inQty > 0 ? row.inQty.toLocaleString() : '-'}
                                </td>
                                <td className={`border border-[#ccc] px-2 py-1 text-right font-mono ${row.outQty > 0 ? 'text-red-600 font-bold bg-red-50/30' : 'text-slate-300'}`}>
                                    {row.outQty > 0 ? row.outQty.toLocaleString() : '-'}
                                </td>
                                <td className="border border-[#ccc] px-2 py-1 text-right font-mono font-bold text-slate-900 bg-yellow-50/30">
                                    {row.balance.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};
