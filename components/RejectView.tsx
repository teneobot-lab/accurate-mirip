
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
    const [pendingQty, setPendingQty] = useState<number | ''>(''); // Sanitized default
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
            showToast("Gagal sinkronisasi", "error");
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
            showToast("Berhasil salin", "success");
        }).catch(() => showToast("Gagal", "error"));
    };

    const handleAddLine = () => {
        if (!pendingItem || !pendingQty) return;
        
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
            reason: pendingReason || 'Afkir'
        };
        setRejectLines([...rejectLines, newLine]);
        setQuery(''); setPendingItem(null); setPendingQty(''); setPendingReason(''); setPendingUnit('');
    };

    const handleSaveBatch = async () => {
        if (!selectedOutlet || rejectLines.length === 0) return;
        try {
            const batch: RejectBatch = {
                id: `REJ-${Date.now().toString().slice(-6)}`,
                date,
                outlet: selectedOutlet,
                createdAt: Date.now(),
                items: rejectLines
            };
            await StorageService.saveRejectBatch(batch);
            showToast("Reject Tersimpan", "success");
            setRejectLines([]); loadData();
        } catch (e) { showToast("Gagal", "error"); }
    };

    // --- Master Item Logic ---
    const handleSaveMasterItem = async () => {
        if (!itemForm.code || !itemForm.name) return;
        setIsLoading(true);
        try {
            const payload = {
                ...itemForm,
                id: editingItem?.id || crypto.randomUUID(),
                conversions: (itemForm.conversions || []).map(c => ({ ...c, operator: c.operator || '*' }))
            } as Item;
            await StorageService.saveRejectMasterItem(payload);
            showToast("Berhasil", "success");
            setShowItemModal(false);
            loadData();
        } catch (e: any) {
            showToast("Gagal", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 gap-4 transition-colors">
            {/* Header Tabs */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
                <TabBtn active={activeTab === 'NEW'} onClick={() => setActiveTab('NEW')} label="Entry" icon={<Plus size={16}/>} />
                <TabBtn active={activeTab === 'HISTORY'} onClick={() => setActiveTab('HISTORY')} label="History" icon={<History size={16}/>} />
                <TabBtn active={activeTab === 'MASTER_ITEMS'} onClick={() => setActiveTab('MASTER_ITEMS')} label="Items" icon={<Database size={16}/>} />
                <TabBtn active={activeTab === 'MASTER'} onClick={() => setActiveTab('MASTER')} label="Outlet" icon={<MapPin size={16}/>} />
            </div>

            {isLoading && activeTab !== 'MASTER_ITEMS' && activeTab !== 'HISTORY' ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 animate-pulse uppercase text-xs font-bold tracking-widest"><Loader2 className="animate-spin mr-2"/> Sync...</div>
            ) : activeTab === 'NEW' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 grid grid-cols-2 gap-8 shadow-sm">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Outlet</label>
                            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border dark:border-slate-700">
                                <Building size={16} className="text-blue-500"/>
                                <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-xs font-bold">
                                    {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tanggal</label>
                            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border dark:border-slate-700">
                                <Calendar size={16} className="text-emerald-500"/>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-xs font-bold" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 flex flex-col overflow-hidden shadow-sm">
                        <div className="overflow-auto flex-1 scrollbar-thin">
                            <table className="w-full text-[11px] text-left">
                                <thead className="bg-[#fcfdfe] dark:bg-slate-800/50 sticky top-0 font-black uppercase text-slate-400 border-b dark:border-slate-700 tracking-widest p-4">
                                    <tr>
                                        <th className="p-4">Item</th>
                                        <th className="p-4 w-32 text-right">Qty</th>
                                        <th className="p-4 w-32 text-center">Satuan</th>
                                        <th className="p-4">Alasan</th>
                                        <th className="p-4 w-20 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rejectLines.map((line, idx) => (
                                        <tr key={idx} className="border-b dark:border-slate-800 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-700 dark:text-slate-200">{line.name}</div>
                                                <div className="text-[9px] text-blue-500 font-bold">{line.sku}</div>
                                            </td>
                                            <td className="p-4 text-right font-mono text-red-600 font-black text-sm">-{line.qty.toLocaleString()}</td>
                                            <td className="p-4 text-center"><span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black">{line.unit}</span></td>
                                            <td className="p-4 text-slate-400 italic font-medium">{line.reason}</td>
                                            <td className="p-4 text-center"><button onClick={() => setRejectLines(rejectLines.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button></td>
                                        </tr>
                                    ))}
                                    <tr className="bg-red-50/20">
                                        <td className="p-3">
                                            <input list="reject-master-list" placeholder="" value={query} onChange={e => {
                                                setQuery(e.target.value);
                                                const it = rejectMasterItems.find(i => i.name === e.target.value || i.code === e.target.value);
                                                if(it) { setPendingItem(it); setPendingUnit(it.baseUnit); }
                                            }} className="w-full p-2.5 border rounded-xl text-xs dark:bg-slate-800 outline-none focus:ring-2 focus:ring-red-500" />
                                            <datalist id="reject-master-list">{rejectMasterItems.map(it => <option key={it.id} value={it.name}>{it.code}</option>)}</datalist>
                                        </td>
                                        <td className="p-3"><input type="number" placeholder="" value={pendingQty} onChange={e => setPendingQty(e.target.value as any)} className="w-full p-2.5 border rounded-xl text-right text-sm dark:bg-slate-800 font-black outline-none focus:ring-2 focus:ring-red-500" /></td>
                                        <td className="p-3 text-center">
                                            <select value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="w-full p-2.5 border rounded-xl text-[10px] font-black dark:bg-slate-800 outline-none">
                                                {pendingItem ? (
                                                    <>
                                                        <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>
                                                        {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                                    </>
                                                ) : <option value="">-</option>}
                                            </select>
                                        </td>
                                        <td className="p-3"><input type="text" placeholder="" value={pendingReason} onChange={e => setPendingReason(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs dark:bg-slate-800 outline-none" /></td>
                                        <td className="p-3 text-center"><button onClick={handleAddLine} className="p-3 bg-red-600 text-white rounded-xl shadow-lg active:scale-90 transition-all"><Plus size={16}/></button></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                            <div className="flex gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Baris</span>
                                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">{rejectLines.length}</span>
                                </div>
                            </div>
                            <button onClick={handleSaveBatch} className="px-12 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-red-500/30 active:scale-95 transition-all">SIMPAN</button>
                        </div>
                    </div>
                </div>
            ) : null}

            <style>{`
                .rej-input { @apply w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-3 text-xs outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner; }
            `}</style>
        </div>
    );
};

const TabBtn = ({ active, onClick, label, icon }: any) => (
    <button onClick={onClick} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200'}`}>
        {icon} {label}
    </button>
);
