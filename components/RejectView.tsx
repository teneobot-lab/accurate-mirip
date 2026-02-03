
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

        const dateList: string[] = Array.from(new Set(filteredBatches.map(b => b.date))).sort();
        const itemMap = new Map<string, { code: string, name: string }>();
        filteredBatches.forEach(b => b.items.forEach(it => {
            itemMap.set(it.itemId, { code: it.sku, name: it.name });
        }));

        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const headerRow1 = ['Kode', 'Nama Barang', ...dateList.map((d: string) => days[new Date(d).getDay()])];
        const headerRow2 = ['', '', ...dateList.map((d: string) => {
            const [y, m, day] = d.split('-');
            return `${day}/${m}/${y}`;
        })];

        const rows = Array.from(itemMap.entries()).map(([itemId, itemInfo]) => {
            const rowData: any[] = [itemInfo.code, itemInfo.name];
            dateList.forEach(d => {
                const totalQty = filteredBatches
                    .filter(b => b.date === d)
                    .flatMap(b => b.items)
                    .filter(it => it.itemId === itemId)
                    .reduce((sum, it) => sum + Number(it.qty), 0);
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
        <div className="flex flex-col h-full bg-daintree p-4 gap-4 transition-colors font-sans">
            {/* Header Tabs */}
            <div className="bg-gable p-2 rounded-xl shadow-lg border border-spectra flex flex-wrap gap-2">
                <TabBtn active={activeTab === 'NEW'} onClick={() => setActiveTab('NEW')} label="Entry Reject" icon={<Plus size={16}/>} />
                <TabBtn active={activeTab === 'HISTORY'} onClick={() => setActiveTab('HISTORY')} label="History" icon={<History size={16}/>} />
                <TabBtn active={activeTab === 'MASTER_ITEMS'} onClick={() => setActiveTab('MASTER_ITEMS')} label="Master Items" icon={<Database size={16}/>} />
                <TabBtn active={activeTab === 'MASTER'} onClick={() => setActiveTab('MASTER')} label="Master Outlet" icon={<MapPin size={16}/>} />
            </div>

            {isLoading && activeTab !== 'MASTER_ITEMS' && activeTab !== 'HISTORY' ? (
                <div className="flex-1 flex items-center justify-center text-cutty animate-pulse uppercase text-xs font-bold tracking-widest"><Loader2 className="animate-spin mr-2 text-spectra"/> Syncing Reject Data...</div>
            ) : activeTab === 'NEW' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-gable p-6 rounded-xl border border-spectra grid grid-cols-2 gap-8 shadow-sm">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-cutty uppercase tracking-widest ml-1">Outlet Afkir</label>
                            <div className="flex items-center gap-3 bg-daintree p-3 rounded-xl border border-spectra">
                                <Building size={16} className="text-spectra"/>
                                <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-white">
                                    {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-cutty uppercase tracking-widest ml-1">Tanggal</label>
                            <div className="flex items-center gap-3 bg-daintree p-3 rounded-xl border border-spectra">
                                <Calendar size={16} className="text-emerald-500"/>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 bg-gable rounded-xl border border-spectra flex flex-col overflow-hidden shadow-sm">
                        <div className="overflow-auto flex-1 scrollbar-thin">
                            <table className="w-full text-[11px] text-left">
                                <thead className="bg-daintree sticky top-0 font-black uppercase text-cutty border-b border-spectra tracking-widest p-4 z-10">
                                    <tr>
                                        <th className="px-4 py-2.5">Informasi Barang</th>
                                        <th className="px-4 py-2.5 w-32 text-right">Qty</th>
                                        <th className="px-4 py-2.5 w-32 text-center">Satuan</th>
                                        <th className="px-4 py-2.5">Alasan</th>
                                        <th className="px-4 py-2.5 w-20 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rejectLines.map((line, idx) => (
                                        <tr key={idx} className="border-b border-spectra/20 group hover:bg-spectra/10 transition-colors">
                                            <td className="px-4 py-2">
                                                <div className="font-bold text-white">{line.name}</div>
                                                <div className="text-[9px] text-slate-400 font-mono font-bold mt-0.5">{line.sku}</div>
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-red-400 font-black text-sm">-{line.qty.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-center"><span className="px-2 py-0.5 rounded bg-daintree text-[10px] font-black text-slate-300 border border-spectra">{line.unit}</span></td>
                                            <td className="px-4 py-2 text-slate-400 italic font-medium">{line.reason}</td>
                                            <td className="px-4 py-2 text-center"><button onClick={() => setRejectLines(rejectLines.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16}/></button></td>
                                        </tr>
                                    ))}
                                    {/* Input Row */}
                                    <tr className="bg-daintree/30 border-t border-spectra/50">
                                        <td className="p-2">
                                            <input list="reject-master-list" placeholder="Cari Master Reject..." value={query} onChange={e => {
                                                setQuery(e.target.value);
                                                const it = rejectMasterItems.find(i => i.name === e.target.value || i.code === e.target.value);
                                                if(it) { setPendingItem(it); setPendingUnit(it.baseUnit); }
                                            }} className="w-full p-2 bg-gable border border-spectra rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-spectra placeholder:text-cutty" />
                                            <datalist id="reject-master-list">{rejectMasterItems.map(it => <option key={it.id} value={it.name}>{it.code}</option>)}</datalist>
                                        </td>
                                        <td className="p-2"><input type="number" placeholder="Qty" value={pendingQty} onChange={e => setPendingQty(Number(e.target.value))} className="w-full p-2 bg-gable border border-spectra rounded-lg text-right text-sm text-white font-black outline-none focus:ring-1 focus:ring-spectra placeholder:text-cutty" /></td>
                                        <td className="p-2 text-center">
                                            <select value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="w-full p-2 bg-gable border border-spectra rounded-lg text-[10px] font-black text-white outline-none">
                                                {pendingItem ? (
                                                    <>
                                                        <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>
                                                        {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                                    </>
                                                ) : <option value="">-</option>}
                                            </select>
                                        </td>
                                        <td className="p-2"><input type="text" placeholder="Catatan alasan..." value={pendingReason} onChange={e => setPendingReason(e.target.value)} className="w-full p-2 bg-gable border border-spectra rounded-lg text-xs text-white outline-none placeholder:text-cutty" /></td>
                                        <td className="p-2 text-center"><button onClick={handleAddLine} className="p-2 bg-spectra text-white rounded-lg shadow-lg hover:bg-white hover:text-spectra transition-all border border-transparent"><Plus size={16}/></button></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t border-spectra bg-gable flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                            <div className="flex gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-cutty uppercase tracking-widest">Total SKU</span>
                                    <span className="text-sm font-black text-white">{rejectLines.length} Line</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-cutty uppercase tracking-widest">Isolation Status</span>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1"><Info size={10}/> Independent Logic</span>
                                </div>
                            </div>
                            <button onClick={handleSaveBatch} className="px-12 py-3 bg-spectra hover:bg-daintree text-white rounded-xl font-black text-xs shadow-xl shadow-black/20 active:scale-95 transition-all border border-spectra/50">SIMPAN ENTRY REJECT</button>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'HISTORY' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-gable p-4 rounded-xl shadow-sm border border-spectra flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-cutty uppercase">Export Range Start</label>
                                <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="p-2 bg-daintree border border-spectra rounded-lg text-xs font-bold outline-none text-white" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-cutty uppercase">Export Range End</label>
                                <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="p-2 bg-daintree border border-spectra rounded-lg text-xs font-bold outline-none text-white" />
                            </div>
                            <button onClick={handleExportFlattened} className="mt-4 px-4 py-2 bg-emerald-900/20 text-emerald-400 border border-emerald-900 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg active:scale-95 transition-all hover:bg-emerald-900/40">
                                <FileSpreadsheet size={16}/> Export Flattened Matrix
                            </button>
                        </div>
                        <button onClick={loadData} className="p-3 text-cutty hover:bg-spectra/20 hover:text-white rounded-full transition-colors"><History size={20}/></button>
                    </div>

                    <div className="flex-1 bg-gable rounded-xl border border-spectra overflow-auto shadow-sm">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-daintree uppercase font-black text-cutty border-b border-spectra tracking-widest sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2.5 w-32">ID Batch</th>
                                    <th className="px-4 py-2.5 w-32">Tanggal</th>
                                    <th className="px-4 py-2.5">Lokasi Outlet</th>
                                    <th className="px-4 py-2.5 w-24 text-right">Items</th>
                                    <th className="px-4 py-2.5 w-40 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-spectra/20 text-white">
                                {batches.map(b => (
                                    <tr key={b.id} className="hover:bg-spectra/10 transition-colors">
                                        <td className="px-4 py-2 font-mono font-bold text-cutty">{b.id}</td>
                                        <td className="px-4 py-2 font-bold">{b.date}</td>
                                        <td className="px-4 py-2">
                                            <div className="flex items-center gap-2"><MapPin size={12} className="text-red-400"/> <span className="font-black uppercase text-slate-200">{b.outlet}</span></div>
                                        </td>
                                        <td className="px-4 py-2 text-right font-black text-red-400">{b.items.length}</td>
                                        <td className="px-4 py-2 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => handleCopyToClipboard(b)} title="Salin format teks" className="p-2 text-emerald-500 hover:bg-emerald-900/20 rounded-lg transition-all"><Share2 size={16}/></button>
                                                <button onClick={() => setViewingBatch(b)} className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg transition-all"><Eye size={16}/></button>
                                                <button onClick={() => { if(confirm('Hapus batch ini?')) StorageService.deleteRejectBatch(b.id).then(loadData); }} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-all"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {batches.length === 0 && <tr><td colSpan={10} className="p-20 text-center text-cutty italic font-bold">Riwayat Reject Kosong</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === 'MASTER_ITEMS' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="bg-gable p-3 rounded-xl shadow-sm border border-spectra flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:bg-spectra/20 rounded-xl text-[10px] font-black border border-spectra bg-daintree">
                                <Download size={14}/> Template
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportXLSX} />
                            <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex items-center gap-2 px-4 py-2 bg-emerald-900/20 text-emerald-400 rounded-xl text-[10px] font-black border border-emerald-900 hover:bg-emerald-900/40">
                                {isImporting ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>} Import Bulk
                            </button>
                        </div>
                        <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', conversions: [] }); setShowItemModal(true); }} className="px-6 py-2.5 bg-spectra text-white rounded-xl text-[10px] font-black shadow-lg shadow-black/20 flex items-center gap-2 hover:bg-daintree active:scale-95 transition-all border border-spectra/50">
                            <Plus size={16}/> Master Item Baru
                        </button>
                    </div>

                    <div className="flex-1 bg-gable rounded-xl border border-spectra overflow-auto shadow-sm">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-daintree font-black uppercase text-cutty border-b border-spectra tracking-widest sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2.5 w-32">Kode Ref</th>
                                    <th className="px-4 py-2.5">Deskripsi Master Reject</th>
                                    <th className="px-4 py-2.5 w-32">Kategori</th>
                                    <th className="px-4 py-2.5 w-24 text-center">Unit</th>
                                    <th className="px-4 py-2.5 w-32 text-center">Conversions</th>
                                    <th className="px-4 py-2.5 w-16 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-spectra/20 text-white">
                                {rejectMasterItems.map(item => (
                                    <tr key={item.id} className="hover:bg-spectra/10 transition-colors">
                                        <td className="px-4 py-2 font-mono font-bold text-cutty uppercase">{item.code}</td>
                                        <td className="px-4 py-2 font-black text-slate-200">{item.name}</td>
                                        <td className="px-4 py-2 text-slate-400 font-bold uppercase">{item.category}</td>
                                        <td className="px-4 py-2 text-center"><span className="px-2 py-0.5 rounded bg-daintree text-[9px] font-black border border-spectra">{item.baseUnit}</span></td>
                                        <td className="px-4 py-2 text-center">
                                            {item.conversions?.length > 0 ? (
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    {item.conversions.map(c => <span key={c.name} className="bg-spectra/20 text-white text-[8px] font-bold px-1.5 py-0.5 rounded border border-spectra">{c.name}</span>)}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => { setEditingItem(item); setItemForm({...item}); setShowItemModal(true); }} className="p-1.5 text-blue-400 hover:bg-blue-900/20 rounded"><Edit3 size={14}/></button>
                                                <button onClick={() => handleDeleteMasterItem(item.id)} className="p-1.5 text-red-400 hover:bg-red-900/20 rounded"><Trash2 size={14}/></button>
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
                <div className="flex-1 max-w-xl mx-auto w-full bg-gable p-10 rounded-[32px] border border-spectra shadow-xl space-y-8 animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-5 mb-4 text-white">
                        <div className="p-4 bg-daintree rounded-3xl text-spectra border border-spectra"><Building size={32}/></div>
                        <div><h3 className="text-xl font-black">Manajemen Outlet Afkir</h3><p className="text-xs text-cutty font-bold uppercase tracking-widest">Isolated Master Database</p></div>
                    </div>
                    <div className="flex gap-4">
                        <input type="text" placeholder="Nama Outlet Baru..." value={newOutlet} onChange={e => setNewOutlet(e.target.value)} className="flex-1 p-4 bg-daintree border border-spectra rounded-2xl outline-none focus:ring-1 focus:ring-spectra text-sm font-bold text-white placeholder:text-cutty" />
                        <button onClick={handleAddOutlet} className="px-8 py-4 bg-spectra hover:bg-daintree text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-black/20 transition-all active:scale-95 border border-spectra/50"><Plus size={18}/> Tambah</button>
                    </div>
                    <div className="space-y-3">
                        {outlets.map(o => (
                            <div key={o} className="flex justify-between items-center p-4 bg-daintree/30 rounded-2xl border border-spectra group transition-all hover:border-spectra/80 hover:bg-daintree">
                                <span className="text-sm font-black text-slate-200">{o}</span>
                                <div className="text-[10px] text-cutty font-black opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Terdaftar</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Master Item Modal */}
            {showItemModal && (
                <div className="fixed inset-0 bg-daintree/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-gable rounded-[32px] w-full max-w-2xl shadow-2xl border border-spectra overflow-hidden animate-in zoom-in-95">
                        <div className="bg-daintree text-white p-8 flex justify-between items-center border-b border-spectra">
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-gable border border-spectra rounded-2xl text-spectra"><Tag size={24}/></div>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">{editingItem ? 'Edit' : 'Tambah'} Master Reject</h3>
                                    <p className="text-[10px] text-cutty font-bold uppercase tracking-widest">Isolated Master Data Management</p>
                                </div>
                            </div>
                            <button onClick={() => setShowItemModal(false)} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white"><X size={24}/></button>
                        </div>
                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-cutty uppercase tracking-widest ml-1">Kode SKU</label>
                                    <input type="text" className="rej-input font-mono font-bold uppercase text-emerald-400" value={itemForm.code} onChange={e => setItemForm({...itemForm, code: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-cutty uppercase tracking-widest ml-1">Kategori</label>
                                    <input type="text" className="rej-input font-bold" value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})} />
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-black text-cutty uppercase tracking-widest ml-1">Nama Barang</label>
                                    <input type="text" className="rej-input font-black" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-cutty uppercase tracking-widest ml-1">Satuan Dasar</label>
                                    <input type="text" className="rej-input font-black text-spectra" value={itemForm.baseUnit} onChange={e => setItemForm({...itemForm, baseUnit: e.target.value})} />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-spectra/50 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-[11px] font-black uppercase text-cutty tracking-widest">Conversion Ratios</h4>
                                    <button onClick={() => setItemForm({...itemForm, conversions: [...(itemForm.conversions || []), { name: '', ratio: 1, operator: '*' }]})} className="px-4 py-1.5 bg-daintree text-white rounded-lg text-[10px] font-black uppercase border border-spectra hover:bg-spectra/50"><Plus size={14} className="inline mr-1"/> Tambah</button>
                                </div>
                                {itemForm.conversions?.map((c, i) => (
                                    <div key={i} className="bg-daintree/50 p-4 rounded-2xl border border-spectra space-y-3">
                                        <div className="grid grid-cols-12 gap-4 items-end">
                                            <div className="col-span-4 space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Satuan</label>
                                                <input type="text" className="w-full bg-gable p-2 rounded-lg border border-spectra text-xs font-black outline-none text-white" value={c.name} onChange={e => {
                                                    const next = [...(itemForm.conversions || [])];
                                                    next[i].name = e.target.value.toUpperCase();
                                                    setItemForm({...itemForm, conversions: next});
                                                }} />
                                            </div>
                                            <div className="col-span-3 space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Operator</label>
                                                <select className="w-full bg-gable p-2 rounded-lg border border-spectra text-xs font-black outline-none text-white" value={c.operator} onChange={e => {
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
                                                <input type="number" className="w-full bg-gable p-2 rounded-lg border border-spectra text-xs font-black text-right outline-none text-white" value={c.ratio} onChange={e => {
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
                        <div className="p-8 border-t border-spectra flex justify-between items-center bg-daintree">
                            <span className="text-[10px] font-bold text-cutty uppercase flex items-center gap-2"><Info size={14} className="text-spectra"/> Isolated Master Logic</span>
                            <div className="flex gap-4">
                                <button onClick={() => setShowItemModal(false)} className="px-6 py-3 text-xs font-black text-slate-400 uppercase hover:text-white transition-colors">Batal</button>
                                <button onClick={handleSaveMasterItem} className="px-10 py-3 bg-spectra hover:bg-white hover:text-spectra text-white rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all">Simpan Master</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Detail Modal */}
            {viewingBatch && (
                <div className="fixed inset-0 bg-daintree/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-gable rounded-[32px] shadow-2xl w-full max-w-2xl border border-spectra overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 bg-daintree text-white flex justify-between items-center border-b border-spectra">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-red-900/30 border border-red-900 rounded-xl text-red-400"><Box size={20}/></div>
                                <div><h3 className="font-black text-sm uppercase">Detail Batch: {viewingBatch.id}</h3><p className="text-[10px] text-cutty font-bold uppercase tracking-widest">{viewingBatch.outlet} • {viewingBatch.date}</p></div>
                            </div>
                            <button onClick={() => setViewingBatch(null)} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="p-8 overflow-auto max-h-[60vh] scrollbar-thin">
                            <table className="w-full text-left text-[11px]">
                                <thead className="border-b border-spectra font-black uppercase text-cutty tracking-widest pb-4">
                                    <tr><th className="px-4 py-2">Item</th><th className="px-4 py-2 w-32 text-right">Qty Terpilih</th><th className="px-4 py-2 w-32 text-right">Qty Base (Pcs)</th><th className="px-4 py-2">Alasan</th></tr>
                                </thead>
                                <tbody className="divide-y divide-spectra/20 text-white">
                                    {viewingBatch.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-spectra/10 transition-colors">
                                            <td className="px-4 py-2">
                                                <div className="font-bold">{item.name}</div>
                                                <div className="text-[9px] text-spectra font-mono">{item.sku}</div>
                                            </td>
                                            <td className="px-4 py-2 text-right font-black text-red-400">{item.qty.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">{item.unit}</span></td>
                                            <td className="px-4 py-2 text-right font-black text-slate-400">{item.baseQty.toLocaleString()}</td>
                                            <td className="px-4 py-2 italic text-slate-500">{item.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .rej-input { @apply w-full bg-daintree border border-spectra rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-spectra focus:border-spectra transition-all shadow-inner text-white placeholder:text-cutty; }
                .scrollbar-thin::-webkit-scrollbar { width: 5px; }
                .scrollbar-thin::-webkit-scrollbar-thumb { @apply bg-cutty rounded-full; }
            `}</style>
        </div>
    );
};

const TabBtn = ({ active, onClick, label, icon }: any) => (
    <button onClick={onClick} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 border ${active ? 'bg-spectra text-white shadow-lg shadow-black/20 border-spectra' : 'text-slate-400 hover:bg-daintree hover:text-white border-transparent'}`}>
        {icon} {label}
    </button>
);
