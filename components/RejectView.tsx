import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Item, RejectBatch, RejectItem, UnitConversion } from '../types';
import { Trash2, Plus, CornerDownLeft, Loader2, History, MapPin, Search, Calendar, X, Eye, Save, Building, Database, Upload, Download, Tag, Edit3, Equal, Info, Box, ClipboardCopy, FileSpreadsheet, Share2 } from 'lucide-react';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';

export const RejectView: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY' | 'MASTER' | 'MASTER_ITEMS'>('NEW');
    const [rejectMasterItems, setRejectMasterItems] = useState<Item[]>([]);
    const [outlets, setOutlets] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // --- Master Items State ---
    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [itemForm, setItemForm] = useState<Partial<Item>>({
        code: '', name: '', category: '', baseUnit: 'Pcs', conversions: []
    });

    // --- Master Outlet State ---
    const [newOutlet, setNewOutlet] = useState('');

    // --- New Entry State ---
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedOutlet, setSelectedOutlet] = useState('');
    const [rejectLines, setRejectLines] = useState<RejectItem[]>([]);
    const [query, setQuery] = useState('');
    const [pendingItem, setPendingItem] = useState<Item | null>(null);
    const [pendingUnit, setPendingUnit] = useState('');
    const [pendingQty, setPendingQty] = useState<number | ''>('');
    const [pendingReason, setPendingReason] = useState('');

    // --- History & Export State ---
    const [batches, setBatches] = useState<RejectBatch[]>([]);
    const [viewingBatch, setViewingBatch] = useState<RejectBatch | null>(null);
    const [exportStart, setExportStart] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [exportEnd, setExportEnd] = useState(new Date().toISOString().split('T')[0]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [rmits, ols, bts] = await Promise.all([
                StorageService.fetchRejectMasterItems().catch(() => []),
                StorageService.fetchRejectOutlets().catch(() => []),
                StorageService.fetchRejectBatches().catch(() => [])
            ]);
            setRejectMasterItems(Array.isArray(rmits) ? rmits : []);
            setOutlets(Array.isArray(ols) ? ols : []);
            setBatches(Array.isArray(bts) ? bts : []);
            if (ols.length > 0 && !selectedOutlet) setSelectedOutlet(ols[0]);
        } catch (e) {
            showToast("Gagal sinkronisasi Database Reject", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // --- Actions ---
    const handleCopyToClipboard = (batch: RejectBatch) => {
        const d = new Date(batch.date);
        const dateStr = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`;
        
        let text = `Data Reject ${batch.outlet} ${dateStr}\n`;
        batch.items.forEach(it => {
            text += `- ${it.name.toLowerCase()} ${it.qty} ${it.unit.toLowerCase()} ${it.reason.toLowerCase()}\n`;
        });

        navigator.clipboard.writeText(text).then(() => {
            showToast("Format teks berhasil disalin ke clipboard", "success");
        }).catch(() => showToast("Gagal menyalin teks", "error"));
    };

    const handleExportFlattened = () => {
        const filteredBatches = batches.filter(b => b.date >= exportStart && b.date <= exportEnd);
        if (filteredBatches.length === 0) return showToast("Tidak ada data di rentang tanggal tersebut", "warning");

        // 1. Dapatkan list unik tanggal dan barang
        const dateList: string[] = Array.from(new Set(filteredBatches.map(b => b.date))).sort();
        const itemMap = new Map<string, { code: string, name: string }>();
        filteredBatches.forEach(b => b.items.forEach(it => {
            itemMap.set(it.itemId, { code: it.sku, name: it.name });
        }));

        // 2. Buat Header (Hari dan Tanggal)
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const headerRow1 = ['Kode', 'Nama Barang', ...dateList.map((d: string) => days[new Date(d).getDay()])];
        const headerRow2 = ['', '', ...dateList.map((d: string) => {
            const [y, m, day] = d.split('-');
            return `${day}/${m}/${y}`;
        })];

        // 3. Buat Data Matrix
        const rows = Array.from(itemMap.entries()).map(([itemId, itemInfo]) => {
            const rowData: any[] = [itemInfo.code, itemInfo.name];
            dateList.forEach(d => {
                const totalQty = filteredBatches
                    .filter(b => b.date === d)
                    .flatMap(b => b.items)
                    .filter(it => it.itemId === itemId)
                    .reduce((sum, it) => sum + Number(it.qty), 0);
                
                // Jika 0, biarkan kosong sesuai request
                rowData.push(totalQty > 0 ? totalQty : "");
            });
            return rowData;
        });

        const ws = XLSX.utils.aoa_to_sheet([headerRow1, headerRow2, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Laporan Flattened");
        XLSX.writeFile(wb, `Laporan_Reject_Flattened_${exportStart}_${exportEnd}.xlsx`);
        showToast("Laporan flattened berhasil dibuat", "success");
    };

    const handleAddLine = () => {
        if (!pendingItem || !pendingQty) return showToast("Pilih item & isi Qty", "warning");
        
        const unit = pendingUnit || pendingItem.baseUnit;
        let ratio = 1;
        if (unit !== pendingItem.baseUnit) {
            const conv = pendingItem.conversions?.find(c => c.name === unit);
            if (conv) ratio = conv.operator === '/' ? 1 / conv.ratio : conv.ratio;
        }

        const newLine: RejectItem = {
            itemId: pendingItem.id,
            sku: pendingItem.code,
            name: pendingItem.name,
            qty: Number(pendingQty),
            unit: unit,
            baseQty: Number(pendingQty) * ratio,
            reason: pendingReason || 'Afkir Reguler'
        };
        setRejectLines([...rejectLines, newLine]);
        setQuery(''); setPendingItem(null); setPendingQty(''); setPendingReason(''); setPendingUnit('');
    };

    const handleSaveBatch = async () => {
        if (!selectedOutlet) return showToast("Pilih lokasi outlet", "warning");
        if (rejectLines.length === 0) return showToast("Item kosong", "warning");
        try {
            const batch: RejectBatch = {
                id: `REJ-${Date.now().toString().slice(-6)}`,
                date,
                outlet: selectedOutlet,
                createdAt: Date.now(),
                items: rejectLines
            };
            await StorageService.saveRejectBatch(batch);
            showToast("Reject tersimpan (Isolated from Stock)", "success");
            setRejectLines([]); loadData();
        } catch (e) { showToast("Gagal simpan", "error"); }
    };

    // --- Master Item Logic ---
    const handleSaveMasterItem = async () => {
        if (!itemForm.code || !itemForm.name) return showToast("Kode & Nama wajib diisi.", "warning");
        setIsLoading(true);
        try {
            const payload = {
                ...itemForm,
                id: editingItem?.id || crypto.randomUUID(),
                conversions: (itemForm.conversions || []).map(c => ({ ...c, operator: c.operator || '*' }))
            } as Item;
            await StorageService.saveRejectMasterItem(payload);
            showToast("Reject Master Item disimpan", "success");
            setShowItemModal(false);
            loadData();
        } catch (e: any) {
            showToast(e.message || "Gagal menyimpan ke server.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteMasterItem = async (id: string) => {
        if (!confirm('Hapus item ini dari master reject?')) return;
        try {
            await StorageService.deleteRejectMasterItem(id);
            showToast("Item dihapus", "success");
            loadData();
        } catch (e) { showToast("Gagal hapus", "error"); }
    };

    // --- Bulk Import Logic ---
    const downloadTemplate = () => {
        const templateData = [
            { "Kode": "REJ-001", "Nama": "Semen Rusak", "Kategori": "Material", "Satuan_Dasar": "Pcs", "Konversi": "BAG:20:*,PALLET:100:*" }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template_Reject");
        XLSX.writeFile(wb, "Template_Master_Reject.xlsx");
    };

    const handleImportXLSX = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data: any[] = XLSX.utils.sheet_to_json(ws);

                const itemsPayload = data.map(row => {
                    const conversions: UnitConversion[] = [];
                    const convStr = String(row.Konversi || '');
                    if (convStr) {
                        convStr.split(',').forEach(c => {
                            const [name, ratio, op] = c.split(':');
                            if (name && ratio) conversions.push({ name, ratio: Number(ratio), operator: (op as any) || '*' });
                        });
                    }
                    return {
                        id: crypto.randomUUID(),
                        code: String(row.Kode || '').trim(),
                        name: String(row.Nama || '').trim(),
                        category: String(row.Kategori || 'General').trim(),
                        baseUnit: String(row.Satuan_Dasar || 'Pcs').trim(),
                        conversions,
                        minStock: 0
                    };
                }).filter(it => it.code && it.name);

                await StorageService.bulkSaveRejectMasterItems(itemsPayload);
                showToast(`Berhasil import ${itemsPayload.length} item reject`, "success");
                loadData();
            } catch (err) { showToast("Gagal import file", "error"); }
            finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
        };
        reader.readAsBinaryString(file);
    };

    const handleAddOutlet = async () => {
        if (!newOutlet.trim()) return;
        try {
            await StorageService.saveRejectOutlet(newOutlet.trim());
            setNewOutlet('');
            showToast("Outlet berhasil ditambahkan", "success");
            loadData();
        } catch (e) { showToast("Gagal tambah outlet", "error"); }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-daintree p-4 gap-4 transition-colors font-sans">
            {/* Header Tabs */}
            <div className="bg-white dark:bg-gable p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-spectra flex flex-wrap gap-2">
                <TabBtn active={activeTab === 'NEW'} onClick={() => setActiveTab('NEW')} label="Entry Reject" icon={<Plus size={16}/>} />
                <TabBtn active={activeTab === 'HISTORY'} onClick={() => setActiveTab('HISTORY')} label="History" icon={<History size={16}/>} />
                <TabBtn active={activeTab === 'MASTER_ITEMS'} onClick={() => setActiveTab('MASTER_ITEMS')} label="Master Items" icon={<Database size={16}/>} />
                <TabBtn active={activeTab === 'MASTER'} onClick={() => setActiveTab('MASTER')} label="Master Outlet" icon={<MapPin size={16}/>} />
            </div>

            {isLoading && activeTab !== 'MASTER_ITEMS' && activeTab !== 'HISTORY' ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 animate-pulse uppercase text-xs font-bold tracking-widest"><Loader2 className="animate-spin mr-2"/> Syncing Reject Data...</div>
            ) : activeTab === 'NEW' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-white dark:bg-gable p-6 rounded-2xl border border-slate-200 dark:border-spectra grid grid-cols-2 gap-8 shadow-sm">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 dark:text-cutty uppercase tracking-widest ml-1">Outlet Afkir</label>
                            <div className="flex items-center gap-3 bg-slate-50 dark:bg-daintree p-3 rounded-xl border border-slate-200 dark:border-spectra">
                                <Building size={16} className="text-spectra"/>
                                <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-daintree dark:text-white">
                                    {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 dark:text-cutty uppercase tracking-widest ml-1">Tanggal</label>
                            <div className="flex items-center gap-3 bg-slate-50 dark:bg-daintree p-3 rounded-xl border border-slate-200 dark:border-spectra">
                                <Calendar size={16} className="text-emerald-500"/>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-daintree dark:text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 bg-white dark:bg-gable rounded-2xl border border-slate-200 dark:border-spectra flex flex-col overflow-hidden shadow-sm">
                        <div className="overflow-auto flex-1 scrollbar-thin">
                            <table className="w-full text-[11px] text-left">
                                <thead className="bg-gable sticky top-0 font-black uppercase text-white border-b border-spectra tracking-widest p-4">
                                    <tr>
                                        <th className="p-4">Informasi Barang</th>
                                        <th className="p-4 w-32 text-right">Qty</th>
                                        <th className="p-4 w-32 text-center">Satuan</th>
                                        <th className="p-4">Alasan</th>
                                        <th className="p-4 w-20 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rejectLines.map((line, idx) => (
                                        <tr key={idx} className="border-b border-slate-100 dark:border-spectra/30 group hover:bg-slate-50 dark:hover:bg-spectra/20 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-daintree dark:text-white">{line.name}</div>
                                                <div className="text-[9px] text-spectra font-bold">{line.sku}</div>
                                            </td>
                                            <td className="p-4 text-right font-mono text-red-600 font-black text-sm">-{line.qty.toLocaleString()}</td>
                                            <td className="p-4 text-center"><span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-daintree text-[10px] font-black text-slate-600 dark:text-slate-300">{line.unit}</span></td>
                                            <td className="p-4 text-slate-400 italic font-medium">{line.reason}</td>
                                            <td className="p-4 text-center"><button onClick={() => setRejectLines(rejectLines.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button></td>
                                        </tr>
                                    ))}
                                    <tr className="bg-red-50 dark:bg-red-900/10">
                                        <td className="p-3">
                                            <input list="reject-master-list" placeholder="Cari Master Reject..." value={query} onChange={e => {
                                                setQuery(e.target.value);
                                                const it = rejectMasterItems.find(i => i.name === e.target.value || i.code === e.target.value);
                                                if(it) { setPendingItem(it); setPendingUnit(it.baseUnit); }
                                            }} className="w-full p-2.5 border border-red-200 dark:border-red-900 rounded-xl text-xs dark:bg-daintree dark:text-white outline-none focus:ring-2 focus:ring-red-500" />
                                            <datalist id="reject-master-list">{rejectMasterItems.map(it => <option key={it.id} value={it.name}>{it.code}</option>)}</datalist>
                                        </td>
                                        <td className="p-3"><input type="number" placeholder="Qty" value={pendingQty} onChange={e => setPendingQty(Number(e.target.value))} className="w-full p-2.5 border border-red-200 dark:border-red-900 rounded-xl text-right text-sm dark:bg-daintree dark:text-white font-black outline-none focus:ring-2 focus:ring-red-500" /></td>
                                        <td className="p-3 text-center">
                                            <select value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="w-full p-2.5 border border-red-200 dark:border-red-900 rounded-xl text-[10px] font-black dark:bg-daintree dark:text-white outline-none">
                                                {pendingItem ? (
                                                    <>
                                                        <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>
                                                        {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                                    </>
                                                ) : <option value="">-</option>}
                                            </select>
                                        </td>
                                        <td className="p-3"><input type="text" placeholder="Catatan alasan..." value={pendingReason} onChange={e => setPendingReason(e.target.value)} className="w-full p-2.5 border border-red-200 dark:border-red-900 rounded-xl text-xs dark:bg-daintree dark:text-white outline-none" /></td>
                                        <td className="p-3 text-center"><button onClick={handleAddLine} className="p-3 bg-red-600 text-white rounded-xl shadow-lg active:scale-90 transition-all"><Plus size={16}/></button></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t dark:border-spectra bg-slate-50 dark:bg-gable flex justify-between items-center">
                            <div className="flex gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 dark:text-cutty uppercase tracking-widest">Total SKU</span>
                                    <span className="text-sm font-black text-daintree dark:text-white">{rejectLines.length} Line</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 dark:text-cutty uppercase tracking-widest">Isolation Status</span>
                                    <span className="text-[10px] font-black text-emerald-600 uppercase">Independent Logic</span>
                                </div>
                            </div>
                            <button onClick={handleSaveBatch} className="px-12 py-3 bg-spectra hover:bg-daintree text-white rounded-2xl font-black text-xs shadow-xl shadow-black/20 active:scale-95 transition-all">SIMPAN ENTRY REJECT</button>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'HISTORY' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-white dark:bg-gable p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-spectra flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 dark:text-cutty uppercase">Export Range Start</label>
                                <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="p-2 bg-slate-50 dark:bg-daintree border border-slate-200 dark:border-spectra rounded-lg text-xs font-bold outline-none text-daintree dark:text-white" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 dark:text-cutty uppercase">Export Range End</label>
                                <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="p-2 bg-slate-50 dark:bg-daintree border border-slate-200 dark:border-spectra rounded-lg text-xs font-bold outline-none text-daintree dark:text-white" />
                            </div>
                            <button onClick={handleExportFlattened} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                                <FileSpreadsheet size={16}/> Export Flattened Matrix
                            </button>
                        </div>
                        <button onClick={loadData} className="p-3 text-slate-400 hover:bg-slate-100 dark:hover:bg-spectra/20 rounded-full transition-colors"><History size={20}/></button>
                    </div>

                    <div className="flex-1 bg-white dark:bg-gable rounded-2xl border border-slate-200 dark:border-spectra overflow-auto shadow-sm">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-gable uppercase font-black text-white border-b border-spectra tracking-widest">
                                <tr>
                                    <th className="p-4 w-32">ID Batch</th>
                                    <th className="p-4 w-32">Tanggal</th>
                                    <th className="p-4">Lokasi Outlet</th>
                                    <th className="p-4 w-24 text-right">Items</th>
                                    <th className="p-4 w-40 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-spectra/30 text-daintree dark:text-white">
                                {batches.map(b => (
                                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-spectra/20 transition-colors">
                                        <td className="p-4 font-mono font-bold text-slate-400 dark:text-cutty">{b.id}</td>
                                        <td className="p-4 font-bold">{b.date}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2"><MapPin size={12} className="text-red-500"/> <span className="font-black uppercase">{b.outlet}</span></div>
                                        </td>
                                        <td className="p-4 text-right font-black text-red-600">{b.items.length}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => handleCopyToClipboard(b)} title="Salin format teks" className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"><Share2 size={16}/></button>
                                                <button onClick={() => setViewingBatch(b)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Eye size={16}/></button>
                                                <button onClick={() => { if(confirm('Hapus batch ini?')) StorageService.deleteRejectBatch(b.id).then(loadData); }} className="p-2 text-red-400 hover:scale-110 transition-transform"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {batches.length === 0 && <tr><td colSpan={10} className="p-20 text-center text-slate-400 italic font-bold">Riwayat Reject Kosong</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === 'MASTER_ITEMS' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="bg-white dark:bg-gable p-3 rounded-2xl shadow-sm border border-slate-200 dark:border-spectra flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-spectra/20 rounded-xl text-[10px] font-black border border-slate-200 dark:border-spectra">
                                <Download size={14}/> Template
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportXLSX} />
                            <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black border border-emerald-100">
                                {isImporting ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>} Import Bulk
                            </button>
                        </div>
                        <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', conversions: [] }); setShowItemModal(true); }} className="px-6 py-2.5 bg-spectra text-white rounded-xl text-[10px] font-black shadow-lg shadow-black/20 flex items-center gap-2 hover:bg-daintree active:scale-95 transition-all">
                            <Plus size={16}/> Master Item Baru
                        </button>
                    </div>

                    <div className="flex-1 bg-white dark:bg-gable rounded-2xl border border-slate-200 dark:border-spectra overflow-auto shadow-sm">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-gable font-black uppercase text-white border-b border-spectra tracking-widest">
                                <tr>
                                    <th className="p-4 w-32">Kode Ref</th>
                                    <th className="p-4">Deskripsi Master Reject</th>
                                    <th className="p-4 w-32">Kategori</th>
                                    <th className="p-4 w-24 text-center">Unit</th>
                                    <th className="p-4 w-32 text-center">Conversions</th>
                                    <th className="p-4 w-16 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-spectra/30 text-daintree dark:text-white">
                                {rejectMasterItems.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-spectra/20 transition-colors">
                                        <td className="p-4 font-mono font-bold text-cutty dark:text-slate-400 uppercase">{item.code}</td>
                                        <td className="p-4 font-black">{item.name}</td>
                                        <td className="p-4 text-slate-400 font-bold uppercase">{item.category}</td>
                                        <td className="p-4 text-center"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-daintree text-[9px] font-black">{item.baseUnit}</span></td>
                                        <td className="p-4 text-center">
                                            {item.conversions?.length > 0 ? (
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    {item.conversions.map(c => <span key={c.name} className="bg-blue-50 text-blue-600 dark:bg-spectra/30 dark:text-white text-[8px] font-bold px-1.5 py-0.5 rounded border border-blue-100 dark:border-spectra">{c.name}</span>)}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => { setEditingItem(item); setItemForm({...item}); setShowItemModal(true); }} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded"><Edit3 size={14}/></button>
                                                <button onClick={() => handleDeleteMasterItem(item.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* MASTER OUTLET VIEW */
                <div className="flex-1 max-w-xl mx-auto w-full bg-white dark:bg-gable p-10 rounded-[32px] border border-slate-200 dark:border-spectra shadow-xl space-y-8 animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-5 mb-4 text-daintree dark:text-white">
                        <div className="p-4 bg-blue-50 dark:bg-daintree rounded-3xl text-spectra"><Building size={32}/></div>
                        <div><h3 className="text-xl font-black">Manajemen Outlet Afkir</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Isolated Master Database</p></div>
                    </div>
                    <div className="flex gap-4">
                        <input type="text" placeholder="Nama Outlet Baru..." value={newOutlet} onChange={e => setNewOutlet(e.target.value)} className="flex-1 p-4 bg-slate-50 dark:bg-daintree border border-slate-200 dark:border-spectra rounded-2xl outline-none focus:ring-4 focus:ring-spectra/20 focus:border-spectra text-sm font-bold text-daintree dark:text-white" />
                        <button onClick={handleAddOutlet} className="px-8 py-4 bg-daintree hover:bg-spectra text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-black/20 transition-all active:scale-95"><Plus size={18}/> Tambah</button>
                    </div>
                    <div className="space-y-3">
                        {outlets.map(o => (
                            <div key={o} className="flex justify-between items-center p-4 bg-white dark:bg-daintree/30 rounded-2xl border border-slate-200 dark:border-spectra group transition-all hover:border-spectra hover:shadow-md">
                                <span className="text-sm font-black text-daintree dark:text-white">{o}</span>
                                <div className="text-[10px] text-slate-400 font-black opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Terdaftar</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Master Item Modal */}
            {showItemModal && (
                <div className="fixed inset-0 bg-daintree/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-gable rounded-[32px] w-full max-w-2xl shadow-2xl border dark:border-spectra overflow-hidden animate-in zoom-in-95">
                        <div className="bg-gable text-white p-8 flex justify-between items-center">
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-spectra rounded-2xl"><Tag size={24}/></div>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">{editingItem ? 'Edit' : 'Tambah'} Master Reject</h3>
                                    <p className="text-[10px] text-cutty font-bold uppercase tracking-widest">Isolated Master Data Management</p>
                                </div>
                            </div>
                            <button onClick={() => setShowItemModal(false)} className="p-2 hover:bg-white/10 rounded-xl"><X size={24}/></button>
                        </div>
                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-cutty uppercase tracking-widest ml-1">Kode SKU</label>
                                    <input type="text" className="rej-input font-mono font-bold uppercase text-spectra" value={itemForm.code} onChange={e => setItemForm({...itemForm, code: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-cutty uppercase tracking-widest ml-1">Kategori</label>
                                    <input type="text" className="rej-input font-bold" value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})} />
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-cutty uppercase tracking-widest ml-1">Nama Barang</label>
                                    <input type="text" className="rej-input font-black" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-cutty uppercase tracking-widest ml-1">Satuan Dasar</label>
                                    <input type="text" className="rej-input font-black text-emerald-600" value={itemForm.baseUnit} onChange={e => setItemForm({...itemForm, baseUnit: e.target.value})} />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-spectra space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-[11px] font-black uppercase text-slate-400 dark:text-cutty tracking-widest">Conversion Ratios</h4>
                                    <button onClick={() => setItemForm({...itemForm, conversions: [...(itemForm.conversions || []), { name: '', ratio: 1, operator: '*' }]})} className="px-4 py-1.5 bg-slate-100 dark:bg-daintree text-daintree dark:text-white rounded-lg text-[10px] font-black uppercase"><Plus size={14} className="inline mr-1"/> Tambah</button>
                                </div>
                                {itemForm.conversions?.map((c, i) => (
                                    <div key={i} className="bg-slate-50 dark:bg-daintree p-4 rounded-2xl border border-slate-200 dark:border-spectra space-y-3">
                                        <div className="grid grid-cols-12 gap-4 items-end">
                                            <div className="col-span-4 space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Satuan</label>
                                                <input type="text" className="w-full bg-white dark:bg-gable p-2 rounded-lg border dark:border-spectra text-xs font-black outline-none" value={c.name} onChange={e => {
                                                    const next = [...(itemForm.conversions || [])];
                                                    next[i].name = e.target.value.toUpperCase();
                                                    setItemForm({...itemForm, conversions: next});
                                                }} />
                                            </div>
                                            <div className="col-span-3 space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Operator</label>
                                                <select className="w-full bg-white dark:bg-gable p-2 rounded-lg border dark:border-spectra text-xs font-black outline-none" value={c.operator} onChange={e => {
                                                    const next = [...(itemForm.conversions || [])];
                                                    next[i].operator = e.target.value as any;
                                                    setItemForm({...itemForm, conversions: next});
                                                }}>
                                                    <option value="*">KALI (*)</option>
                                                    <option value="/">BAGI (/)</option>
                                                </select>
                                            </div>
                                            <div className="col-span-4 space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Rasio ke {itemForm.baseUnit}</label>
                                                <input type="number" className="w-full bg-white dark:bg-gable p-2 rounded-lg border dark:border-spectra text-xs font-black text-right outline-none" value={c.ratio} onChange={e => {
                                                    const next = [...(itemForm.conversions || [])];
                                                    next[i].ratio = Number(e.target.value);
                                                    setItemForm({...itemForm, conversions: next});
                                                }} />
                                            </div>
                                            <div className="col-span-1 text-center"><button onClick={() => setItemForm({...itemForm, conversions: itemForm.conversions?.filter((_, idx) => idx !== i)})} className="text-red-400 p-2"><Trash2 size={14}/></button></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-8 border-t border-slate-100 dark:border-spectra flex justify-between items-center bg-slate-50 dark:bg-daintree">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-cutty uppercase flex items-center gap-2"><Info size={14} className="text-spectra"/> Isolated Master Logic</span>
                            <div className="flex gap-4">
                                <button onClick={() => setShowItemModal(false)} className="px-6 py-3 text-xs font-black text-slate-400 uppercase">Batal</button>
                                <button onClick={handleSaveMasterItem} className="px-10 py-3 bg-daintree hover:bg-spectra text-white rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all">Simpan Master</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Detail Modal */}
            {viewingBatch && (
                <div className="fixed inset-0 bg-daintree/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-gable rounded-[32px] shadow-2xl w-full max-w-2xl border dark:border-spectra overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 bg-gable text-white flex justify-between items-center border-b dark:border-spectra">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-red-600 rounded-xl"><Box size={20}/></div>
                                <div><h3 className="font-black text-sm uppercase">Detail Batch: {viewingBatch.id}</h3><p className="text-[10px] text-cutty font-bold uppercase tracking-widest">{viewingBatch.outlet} • {viewingBatch.date}</p></div>
                            </div>
                            <button onClick={() => setViewingBatch(null)} className="p-2 hover:bg-white/10 rounded-xl"><X size={20}/></button>
                        </div>
                        <div className="p-8 overflow-auto max-h-[60vh] scrollbar-thin">
                            <table className="w-full text-left text-[11px]">
                                <thead className="border-b border-slate-100 dark:border-spectra font-black uppercase text-slate-400 dark:text-cutty tracking-widest pb-4">
                                    <tr><th className="p-3">Item</th><th className="p-3 w-32 text-right">Qty Terpilih</th><th className="p-3 w-32 text-right">Qty Base (Pcs)</th><th className="p-3">Alasan</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-spectra/30 text-daintree dark:text-white">
                                    {viewingBatch.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-spectra/20 transition-colors">
                                            <td className="p-3">
                                                <div className="font-bold">{item.name}</div>
                                                <div className="text-[9px] text-spectra font-mono">{item.sku}</div>
                                            </td>
                                            <td className="p-3 text-right font-black text-red-600">{item.qty.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">{item.unit}</span></td>
                                            <td className="p-3 text-right font-black text-slate-500 dark:text-slate-400">{item.baseQty.toLocaleString()}</td>
                                            <td className="p-3 italic text-slate-400">{item.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .rej-input { @apply w-full bg-slate-50 dark:bg-daintree border border-slate-200 dark:border-spectra rounded-xl px-4 py-3 text-xs outline-none focus:ring-4 focus:ring-spectra/20 focus:border-spectra transition-all shadow-inner text-daintree dark:text-white; }
                .scrollbar-thin::-webkit-scrollbar { width: 5px; }
                .scrollbar-thin::-webkit-scrollbar-thumb { @apply bg-cutty rounded-full; }
            `}</style>
        </div>
    );
};

const TabBtn = ({ active, onClick, label, icon }: any) => (
    <button onClick={onClick} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 ${active ? 'bg-spectra text-white shadow-lg shadow-black/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-daintree hover:text-slate-600 dark:hover:text-white'}`}>
        {icon} {label}
    </button>
);