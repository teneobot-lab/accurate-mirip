
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Warehouse } from '../types';
import { Filter, Search, Calendar, RefreshCw, FileSpreadsheet, Edit3, Trash2, Loader2, ChevronDown, ChevronRight, Box, User, Hash, Terminal } from 'lucide-react';
import ExcelJS from 'exceljs';
import { useToast } from './Toast';

interface Props {
    onEditTransaction: (tx: Transaction) => void;
}

export const ReportsView: React.FC<Props> = ({ onEditTransaction }) => {
    const { showToast } = useToast();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedTx, setExpandedTx] = useState<Set<string>>(new Set());

    const [filterWh, setFilterWh] = useState('ALL');
    const [filterType, setFilterType] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const refreshData = async () => {
        setIsLoading(true);
        try {
            const filters = { start: startDate, end: endDate, warehouse: filterWh, type: filterType };
            const [txs, whs] = await Promise.all([
                StorageService.fetchTransactions(filters).catch(() => []),
                StorageService.fetchWarehouses().catch(() => [])
            ]);
            setTransactions(Array.isArray(txs) ? txs : []);
            setWarehouses(Array.isArray(whs) ? whs : []);
        } catch (error) {
            console.error("Failed to load reports data", error);
            showToast("Gagal memuat data dari database", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { refreshData(); }, [startDate, endDate, filterWh, filterType]);

    const filteredTransactions = useMemo(() => {
        const lower = searchQuery.toLowerCase().trim();
        if (!lower) return transactions;
        return transactions.filter(tx => 
            tx.referenceNo.toLowerCase().includes(lower) || 
            (tx.partnerName && tx.partnerName.toLowerCase().includes(lower)) ||
            tx.items.some(it => it.name?.toLowerCase().includes(lower) || it.code?.toLowerCase().includes(lower))
        );
    }, [transactions, searchQuery]);

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus transaksi ini? Stok akan otomatis disesuaikan kembali.")) return;
        try {
            await StorageService.deleteTransaction(id);
            showToast("Transaksi berhasil dihapus & stok dikoreksi", "success");
            refreshData();
        } catch (e: any) {
            showToast(e.message || "Gagal menghapus transaksi", "error");
        }
    };

    const handleCopyCurl = (id: string) => {
        const cmd = `curl -v -X DELETE http://localhost:3000/api/transactions/${id}`;
        navigator.clipboard.writeText(cmd).then(() => {
            showToast("Perintah CURL disalin! Jalankan di Terminal Server.", "info");
        }).catch(() => {
            showToast("Gagal menyalin perintah", "error");
        });
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expandedTx);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpandedTx(next);
    };

    const handleExport = async () => {
        if (filteredTransactions.length === 0) {
            return showToast("Tidak ada data untuk diexport", "warning");
        }

        try {
            showToast("Menyiapkan file Excel...", "info");
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Laporan Mutasi');

            // 1. Setup Columns
            sheet.columns = [
                { header: 'TANGGAL', key: 'date', width: 12 },
                { header: 'NO. REFERENSI', key: 'ref', width: 20 },
                { header: 'TIPE', key: 'type', width: 10 },
                { header: 'GUDANG', key: 'warehouse', width: 15 },
                { header: 'PARTNER', key: 'partner', width: 20 },
                { header: 'KODE ITEM', key: 'code', width: 15 },
                { header: 'NAMA BARANG', key: 'itemName', width: 30 },
                { header: 'QTY', key: 'qty', width: 10 },
                { header: 'SATUAN', key: 'unit', width: 8 },
                { header: 'TOTAL BASE', key: 'totalBase', width: 12 },
                { header: 'CATATAN', key: 'note', width: 25 },
            ];

            // 2. Add Title Rows
            sheet.insertRow(1, [`LAPORAN MUTASI GUDANGPRO`]);
            sheet.insertRow(2, [`Periode: ${startDate} s/d ${endDate}`]);
            sheet.insertRow(3, [`Filter Gudang: ${warehouses.find(w => w.id === filterWh)?.name || 'Semua Gudang'} | Tipe: ${filterType}`]);
            sheet.insertRow(4, ['']); // Spacer

            // Styling Title
            sheet.mergeCells('A1:K1');
            sheet.mergeCells('A2:K2');
            sheet.mergeCells('A3:K3');
            
            const titleRow = sheet.getRow(1);
            titleRow.font = { name: 'Arial', size: 16, bold: true };
            titleRow.alignment = { horizontal: 'center' };

            const subTitleRow = sheet.getRow(2);
            subTitleRow.font = { name: 'Arial', size: 11, italic: true };
            subTitleRow.alignment = { horizontal: 'center' };

            const filterRow = sheet.getRow(3);
            filterRow.font = { name: 'Arial', size: 10 };
            filterRow.alignment = { horizontal: 'center' };

            // 3. Styling Header Row (Row 5 because we inserted 4 rows)
            const headerRow = sheet.getRow(5);
            headerRow.values = sheet.columns.map(c => c.header);
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF335157' } // Warna Spectra
                };
                cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            headerRow.height = 24;

            // 4. Populate Data (Using filteredTransactions to respect user filters)
            const rows: any[] = [];
            filteredTransactions.forEach(tx => {
                const warehouseName = warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || 'Unknown';
                tx.items.forEach(item => {
                    rows.push({
                        date: tx.date,
                        ref: tx.referenceNo,
                        type: tx.type,
                        warehouse: warehouseName,
                        partner: tx.partnerName || '-',
                        code: item.code,
                        itemName: item.name,
                        qty: item.qty,
                        unit: item.unit,
                        totalBase: item.qty * (item.ratio || 1),
                        note: item.note || tx.notes || ''
                    });
                });
            });

            // Add rows starting from row 6
            const addedRows = sheet.addRows(rows);

            // 5. Styling Data Rows
            addedRows.forEach(row => {
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    cell.alignment = { vertical: 'middle', wrapText: true };
                    
                    // Align Numbers to Right
                    if ([8, 10].includes(colNumber)) { // Qty & TotalBase columns
                         cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    }
                    // Align Center items
                    if ([1, 3, 9].includes(colNumber)) {
                         cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                    
                    // Colorize Transaction Type
                    if (colNumber === 3) {
                        const val = cell.value?.toString();
                        if (val === 'IN') cell.font = { color: { argb: 'FF10B981' }, bold: true }; // Emerald
                        else if (val === 'OUT') cell.font = { color: { argb: 'FFEF4444' }, bold: true }; // Red
                    }
                });
            });

            // 6. Generate Buffer & Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `Laporan_Mutasi_${startDate}_${endDate}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);

            showToast("Export berhasil!", "success");

        } catch (error) {
            console.error("Export Error", error);
            showToast("Gagal export Excel", "error");
        }
    };

    return (
        <div className="flex flex-col h-full bg-daintree p-4 gap-4 overflow-hidden font-sans">
            {/* Header & Filter Bar - Comfortable Layout */}
            <div className="bg-gable p-4 rounded-xl border border-spectra flex flex-wrap gap-5 items-end shadow-sm">
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black text-cutty uppercase tracking-widest ml-1">Periode Laporan</span>
                    <div className="flex items-center gap-2 bg-daintree p-1 rounded-lg border border-spectra/50">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-xs font-bold text-white outline-none px-2 py-1.5" />
                        <span className="text-cutty font-bold text-xs">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-xs font-bold text-white outline-none px-2 py-1.5" />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black text-cutty uppercase tracking-widest ml-1">Filter Data</span>
                    <div className="flex gap-2">
                        <div className="relative">
                            <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="appearance-none bg-daintree border border-spectra/50 rounded-lg pl-3 pr-8 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-spectra w-40 cursor-pointer">
                                <option value="ALL">Semua Gudang</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-cutty pointer-events-none"/>
                        </div>
                        <div className="relative">
                            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="appearance-none bg-daintree border border-spectra/50 rounded-lg pl-3 pr-8 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-spectra w-32 cursor-pointer">
                                <option value="ALL">Semua Tipe</option>
                                <option value="IN">Masuk (IN)</option>
                                <option value="OUT">Keluar (OUT)</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-cutty pointer-events-none"/>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-1.5">
                    <span className="text-[10px] font-black text-cutty uppercase tracking-widest ml-1">Pencarian Global</span>
                    <div className="relative group">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-spectra transition-colors"/>
                        <input type="text" placeholder="Cari No. Referensi, Nama Partner, atau Nama Barang..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-daintree border border-spectra/50 rounded-lg px-3 py-2 pl-10 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-spectra transition-all placeholder:text-slate-600 shadow-inner" />
                    </div>
                </div>

                <div className="flex gap-2 pb-0.5">
                    <button onClick={refreshData} className="p-2.5 bg-daintree border border-spectra/50 rounded-lg text-slate-400 hover:text-white hover:bg-spectra/20 transition-all shadow-sm"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
                    <button onClick={handleExport} className="px-5 py-2.5 bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 text-xs font-black uppercase tracking-wide rounded-lg flex items-center gap-2 hover:bg-emerald-900/40 transition-all shadow-sm active:scale-95"><FileSpreadsheet size={16}/> Export Excel</button>
                </div>
            </div>

            {/* Table - Comfortable Style */}
            <div className="flex-1 rounded-xl border border-spectra overflow-hidden flex flex-col bg-gable shadow-md">
                <div className="overflow-auto flex-1 scrollbar-thin">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-daintree text-[11px] font-black text-cutty uppercase tracking-widest sticky top-0 z-10 shadow-md">
                            <tr>
                                <th className="px-4 py-3 w-12 text-center border-b border-spectra">#</th>
                                <th className="px-4 py-3 w-32 border-b border-spectra">Tanggal</th>
                                <th className="px-4 py-3 w-48 border-b border-spectra">No. Referensi</th>
                                <th className="px-4 py-3 w-24 text-center border-b border-spectra">Tipe</th>
                                <th className="px-4 py-3 border-b border-spectra">Partner & Lokasi</th>
                                <th className="px-4 py-3 w-24 text-right border-b border-spectra">Total Item</th>
                                <th className="px-4 py-3 w-32 text-center border-b border-spectra">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-slate-300 divide-y divide-spectra/20">
                             {filteredTransactions.map((tx, idx) => (
                                 <React.Fragment key={tx.id}>
                                     <tr className={`hover:bg-spectra/10 transition-colors group ${expandedTx.has(tx.id) ? 'bg-spectra/5' : ''}`}>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => toggleExpand(tx.id)} className={`p-1 rounded-full transition-colors ${expandedTx.has(tx.id) ? 'bg-spectra text-white' : 'text-slate-500 hover:bg-daintree hover:text-white'}`}>
                                                {expandedTx.has(tx.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-emerald-500 font-bold text-xs">{tx.date}</td>
                                        <td className="px-4 py-3 font-bold text-white">{tx.referenceNo}</td>
                                        <td className="px-4 py-3 text-center">
                                             <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${tx.type === 'IN' ? 'text-emerald-400 bg-emerald-900/20 border-emerald-900/50' : 'text-red-400 bg-red-900/20 border-red-900/50'}`}>{tx.type}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col justify-center">
                                                <div className="font-bold text-slate-200 flex items-center gap-2">
                                                    <User size={12} className="text-cutty"/>
                                                    {tx.partnerName || '-'}
                                                </div>
                                                <div className="text-[10px] text-cutty uppercase font-bold flex items-center gap-2 mt-0.5">
                                                    <Box size={12}/>
                                                    {warehouses.find(w => w.id === tx.sourceWarehouseId)?.name}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-white font-bold">{tx.items.length}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleCopyCurl(tx.id)} className="p-2 text-yellow-500 hover:bg-yellow-900/30 rounded-lg transition-colors border border-transparent hover:border-yellow-900/50" title="Salin Perintah CURL"><Terminal size={14}/></button>
                                                <button onClick={() => onEditTransaction(tx)} className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors border border-transparent hover:border-blue-900/50"><Edit3 size={14}/></button>
                                                <button onClick={() => handleDelete(tx.id)} className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors border border-transparent hover:border-red-900/50"><Trash2 size={14}/></button>
                                            </div>
                                        </td>
                                     </tr>
                                     {expandedTx.has(tx.id) && (
                                         <tr className="bg-black/20 animate-in fade-in slide-in-from-top-1">
                                             <td colSpan={7} className="p-0 border-b border-spectra/50">
                                                 <div className="p-4 pl-16">
                                                     <div className="rounded-lg border border-spectra/30 overflow-hidden bg-daintree shadow-inner">
                                                        <table className="w-full text-xs">
                                                            <thead className="text-cutty uppercase bg-black/20 font-bold border-b border-spectra/30">
                                                                <tr>
                                                                    <th className="px-4 py-2 w-32">Kode SKU</th>
                                                                    <th className="px-4 py-2">Nama Barang</th>
                                                                    <th className="px-4 py-2 text-right w-24">Qty</th>
                                                                    <th className="px-4 py-2 text-center w-20">Unit</th>
                                                                    <th className="px-4 py-2 text-right w-32">Total Base</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-spectra/10">
                                                                {tx.items.map((it, i) => (
                                                                    <tr key={i} className="hover:bg-white/5">
                                                                        <td className="px-4 py-2 font-mono text-emerald-500 font-bold">{it.code}</td>
                                                                        <td className="px-4 py-2 text-slate-300">{it.name}</td>
                                                                        <td className="px-4 py-2 text-right font-bold text-white">{it.qty.toLocaleString()}</td>
                                                                        <td className="px-4 py-2 text-center text-slate-500 font-bold bg-black/10">{it.unit}</td>
                                                                        <td className="px-4 py-2 text-right font-mono text-slate-400">{(it.qty * (it.ratio || 1)).toLocaleString()}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                     </div>
                                                     {tx.notes && (
                                                         <div className="mt-2 flex items-start gap-2 text-xs text-slate-500 bg-yellow-900/10 p-2 rounded border border-yellow-900/30">
                                                             <span className="font-bold uppercase text-yellow-600">Catatan:</span> 
                                                             <span className="italic text-yellow-500/80">{tx.notes}</span>
                                                         </div>
                                                     )}
                                                 </div>
                                             </td>
                                         </tr>
                                     )}
                                 </React.Fragment>
                             ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
