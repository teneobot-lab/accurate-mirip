
import React, { useMemo, useState, useEffect } from 'react';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { StorageService } from '../services/storage';
import { ArrowLeft, RefreshCw, FileSpreadsheet, Printer, Calendar, Search, ArrowDownLeft, ArrowUpRight, Hash, Package } from 'lucide-react';
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

  // --- EXPORT TO EXCEL (PROFESSIONAL WITH EXCELJS) ---
  const handleExportExcel = async () => {
    if (ledgerRows.length === 0 && openingBalance === 0) return showToast("Tidak ada data untuk diekspor", "warning");

    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Kartu Stok');

        // --- 1. HEADER INFORMASI BARANG ---
        sheet.mergeCells('A1:G1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = 'KARTU STOK BARANG (STOCK CARD)';
        titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF335157' } }; // Dark Teal
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Detail Barang
        sheet.mergeCells('A2:G2');
        sheet.getCell('A2').value = `ITEM: [${item.code}] ${item.name}`;
        sheet.getCell('A2').font = { name: 'Arial', size: 10, bold: true };
        sheet.getCell('A2').alignment = { horizontal: 'left' };

        sheet.mergeCells('A3:G3');
        sheet.getCell('A3').value = `SATUAN DASAR: ${item.baseUnit}  |  PERIODE: ${startDate} s/d ${endDate}`;
        sheet.getCell('A3').font = { name: 'Arial', size: 10 };

        // Spasi
        sheet.getRow(4).height = 10;

        // --- 2. TABLE HEADER ---
        const headerRow = sheet.getRow(5);
        headerRow.values = ['TANGGAL', 'NO. BUKTI', 'TIPE', 'KETERANGAN / PARTNER', 'MASUK', 'KELUAR', 'SALDO'];
        headerRow.height = 25;
        
        const headerStyle: Partial<ExcelJS.Style> = {
            font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }, // Light Gray
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
            }
        };

        headerRow.eachCell((cell) => {
            cell.style = headerStyle;
        });

        // --- 3. OPENING BALANCE ROW ---
        const openRow = sheet.addRow([
            startDate, 
            '-', 
            'OPENING', 
            'SALDO AWAL PERIODE', 
            null, 
            null, 
            openingBalance
        ]);
        
        openRow.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF555555' } };
        openRow.getCell(7).font = { name: 'Arial', size: 9, bold: true }; // Saldo Bold
        openRow.eachCell(cell => {
             cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
        });

        // --- 4. DATA ROWS ---
        ledgerRows.forEach(row => {
            const r = sheet.addRow([
                row.date,
                row.ref,
                row.type,
                `${row.partner !== '-' ? row.partner : ''} ${row.note ? `(${row.note})` : ''}`.trim() || row.whName,
                row.inQty > 0 ? row.inQty : null,
                row.outQty > 0 ? row.outQty : null,
                row.balance
            ]);

            // Styling per cell
            r.font = { name: 'Arial', size: 9 };
            r.getCell(1).alignment = { horizontal: 'center' }; // Date
            r.getCell(2).alignment = { horizontal: 'left' };   // Ref
            r.getCell(3).alignment = { horizontal: 'center' }; // Type
            
            // Warna Angka
            if (row.inQty > 0) r.getCell(5).font = { color: { argb: 'FF10B981' } }; // Green
            if (row.outQty > 0) r.getCell(6).font = { color: { argb: 'FFEF4444' } }; // Red
            r.getCell(7).font = { bold: true }; // Saldo Bold

            // Border tipis
            r.eachCell(cell => {
                cell.border = {
                    left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } }
                };
            });
        });

        // --- 5. FORMATTING COLUMNS ---
        sheet.getColumn(1).width = 12; // Tanggal
        sheet.getColumn(2).width = 20; // Ref
        sheet.getColumn(3).width = 10; // Tipe
        sheet.getColumn(4).width = 40; // Keterangan
        sheet.getColumn(5).width = 12; // Masuk
        sheet.getColumn(6).width = 12; // Keluar
        sheet.getColumn(7).width = 15; // Saldo

        // Number Format (#,##0)
        ['E', 'F', 'G'].forEach(col => {
            sheet.getColumn(col).numFmt = '#,##0.###;-#,##0.###;"-"';
        });

        // --- 6. DOWNLOAD ---
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `StockCard_${item.code}_${startDate}_${endDate}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
        
        showToast("Laporan Excel Berhasil Diunduh", "success");

    } catch (e) {
        console.error(e);
        showToast("Gagal membuat file Excel", "error");
    }
  };

  const StatCard = ({ label, value, colorClass, icon: Icon }: any) => (
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col shadow-sm">
          <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</span>
              {Icon && <Icon size={14} className="text-slate-300"/>}
          </div>
          <div className={`text-lg font-bold font-mono ${colorClass}`}>
              {value.toLocaleString()} <span className="text-[10px] text-slate-400 font-medium ml-1">{item.baseUnit}</span>
          </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] font-sans">
        
        {/* 1. HEADER (Clean & Minimalist) */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-4">
                 <button onClick={onBack} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                    <ArrowLeft size={18} />
                 </button>
                 <div>
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        {item.name}
                        <span className="text-xs font-medium text-slate-400 font-mono px-2 py-0.5 bg-slate-50 rounded-full border border-slate-100">{item.code}</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Kartu stok pergerakan barang (Stock Ledger)</p>
                 </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1">
                    <div className="px-2 py-1 border-r border-slate-200">
                        <Calendar size={14} className="text-slate-400"/>
                    </div>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-xs font-semibold text-slate-700 outline-none px-2 w-28" />
                    <span className="text-slate-300">-</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-xs font-semibold text-slate-700 outline-none px-2 w-28" />
                    <button onClick={loadData} className="p-1.5 hover:bg-slate-200 rounded text-slate-500 transition-colors mx-1"><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''}/></button>
                </div>
                
                <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition-all active:scale-95">
                    <FileSpreadsheet size={16}/> Export
                </button>
            </div>
        </div>

        {/* 2. SUMMARY STATS (Grid Layout) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-4">
            <StatCard label="Saldo Awal" value={openingBalance} colorClass="text-slate-600" icon={Package} />
            <StatCard label="Total Masuk" value={summary.totalIn} colorClass="text-emerald-600" icon={ArrowDownLeft} />
            <StatCard label="Total Keluar" value={summary.totalOut} colorClass="text-rose-600" icon={ArrowUpRight} />
            <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Hash size={48} color="white"/></div>
                <div className="flex justify-between items-start mb-1 relative z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Saldo Akhir</span>
                </div>
                <div className="text-xl font-bold font-mono text-white relative z-10">
                    {summary.closing.toLocaleString()} <span className="text-[10px] text-slate-400 font-medium ml-1">{item.baseUnit}</span>
                </div>
            </div>
        </div>

        {/* 3. DENSE DATA TABLE */}
        <div className="flex-1 overflow-auto px-6 pb-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full border-collapse text-left">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider w-32">Tanggal</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider w-40">No. Ref</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider w-24 text-center">Tipe</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Keterangan / Gudang</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider w-28 text-right text-emerald-600">Masuk</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider w-28 text-right text-rose-600">Keluar</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider w-32 text-right">Saldo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {/* OPENING BALANCE ROW */}
                        <tr className="bg-slate-50/50">
                            <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{startDate}</td>
                            <td className="px-4 py-2 text-center text-slate-400">-</td>
                            <td className="px-4 py-2 text-center text-[10px] font-bold text-slate-400">OPENING</td>
                            <td className="px-4 py-2 font-medium italic text-slate-500">Saldo Awal Periode</td>
                            <td className="px-4 py-2 text-right font-mono text-slate-300">-</td>
                            <td className="px-4 py-2 text-right font-mono text-slate-300">-</td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-slate-700 bg-slate-100/50">{openingBalance.toLocaleString()}</td>
                        </tr>

                        {ledgerRows.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-slate-400 text-sm">Tidak ada transaksi pada periode ini</td>
                            </tr>
                        ) : ledgerRows.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-4 py-2 font-mono text-[11px] text-slate-600">
                                    {new Date(row.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </td>
                                <td className="px-4 py-2 font-mono text-[11px] text-blue-600 font-medium cursor-pointer hover:underline">
                                    {row.ref}
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                        row.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                        row.type === 'OUT' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                        'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>
                                        {row.type}
                                    </span>
                                </td>
                                <td className="px-4 py-2 truncate max-w-xs">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-700">{row.partner !== '-' ? row.partner : row.whName}</span>
                                        {row.note && <span className="text-[10px] text-slate-400 italic truncate">{row.note}</span>}
                                    </div>
                                </td>
                                <td className={`px-4 py-2 text-right font-mono font-medium ${row.inQty > 0 ? 'text-emerald-600 bg-emerald-50/30' : 'text-slate-300'}`}>
                                    {row.inQty > 0 ? `+${row.inQty.toLocaleString()}` : '-'}
                                </td>
                                <td className={`px-4 py-2 text-right font-mono font-medium ${row.outQty > 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-300'}`}>
                                    {row.outQty > 0 ? `-${row.outQty.toLocaleString()}` : '-'}
                                </td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-slate-800 bg-slate-50/50 group-hover:bg-white">
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
