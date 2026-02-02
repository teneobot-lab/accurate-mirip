
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, RejectBatch, RejectItem } from '../types';
import { Trash2, Plus, CornerDownLeft, Loader2, History, MapPin, Search, Calendar, X, Eye, Save, Building } from 'lucide-react';
import { useToast } from './Toast';

export const RejectView: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY' | 'MASTER'>('NEW');
    const [items, setItems] = useState<Item[]>([]);
    const [outlets, setOutlets] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // --- Master Outlet State ---
    const [newOutlet, setNewOutlet] = useState('');

    // --- New Entry State ---
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedOutlet, setSelectedOutlet] = useState('');
    const [rejectLines, setRejectLines] = useState<RejectItem[]>([]);
    const [query, setQuery] = useState('');
    const [pendingItem, setPendingItem] = useState<Item | null>(null);
    const [pendingQty, setPendingQty] = useState<number | ''>('');
    const [pendingReason, setPendingReason] = useState('');

    // --- History State ---
    const [batches, setBatches] = useState<RejectBatch[]>([]);
    const [viewingBatch, setViewingBatch] = useState<RejectBatch | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [its, ols, bts] = await Promise.all([
                StorageService.fetchItems().catch(() => []),
                StorageService.fetchRejectOutlets().catch(() => []),
                StorageService.fetchRejectBatches().catch(() => [])
            ]);
            setItems(Array.isArray(its) ? its : []);
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

    const handleAddLine = () => {
        if (!pendingItem || !pendingQty) return showToast("Pilih item & isi Qty", "warning");
        const newLine: RejectItem = {
            itemId: pendingItem.id,
            sku: pendingItem.code,
            name: pendingItem.name,
            qty: Number(pendingQty),
            unit: pendingItem.baseUnit,
            baseQty: Number(pendingQty),
            reason: pendingReason || 'Afkir Reguler'
        };
        setRejectLines([...rejectLines, newLine]);
        setQuery(''); setPendingItem(null); setPendingQty(''); setPendingReason('');
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
            showToast("Reject tersimpan", "success");
            setRejectLines([]); loadData();
        } catch (e) { showToast("Gagal simpan", "error"); }
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
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 gap-4 transition-colors">
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex gap-2">
                <button onClick={() => setActiveTab('NEW')} className={`px-4 py-2 rounded text-xs font-bold transition-all ${activeTab === 'NEW' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                    Entry Reject
                </button>
                <button onClick={() => setActiveTab('HISTORY')} className={`px-4 py-2 rounded text-xs font-bold transition-all ${activeTab === 'HISTORY' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                    History
                </button>
                <button onClick={() => setActiveTab('MASTER')} className={`px-4 py-2 rounded text-xs font-bold transition-all ${activeTab === 'MASTER' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                    Master Outlet
                </button>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 animate-pulse uppercase text-xs font-bold tracking-widest"><Loader2 className="animate-spin mr-2"/> Syncing Reject Data...</div>
            ) : activeTab === 'NEW' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border dark:border-slate-800 grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Outlet Afkir</label>
                            <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} className="w-full border rounded p-2 text-xs dark:bg-slate-800">
                                {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Tanggal</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border rounded p-2 text-xs dark:bg-slate-800" />
                        </div>
                    </div>

                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-800 flex flex-col overflow-hidden">
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 font-bold uppercase text-slate-500 border-b dark:border-slate-700">
                                    <tr>
                                        <th className="p-3">Item</th>
                                        <th className="p-3 w-24 text-right">Qty</th>
                                        <th className="p-3">Alasan</th>
                                        <th className="p-3 w-16 text-center">Act</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rejectLines.map((line, idx) => (
                                        <tr key={idx} className="border-b dark:border-slate-800">
                                            <td className="p-3 font-bold">{line.name}</td>
                                            <td className="p-3 text-right font-mono text-red-600 font-bold">-{line.qty}</td>
                                            <td className="p-3 text-slate-400 italic">{line.reason}</td>
                                            <td className="p-3 text-center"><button onClick={() => setRejectLines(rejectLines.filter((_, i) => i !== idx))} className="text-red-400"><Trash2 size={16}/></button></td>
                                        </tr>
                                    ))}
                                    <tr className="bg-red-50/20">
                                        <td className="p-2">
                                            <input list="item-list-rej" placeholder="Klik cari barang..." value={query} onChange={e => {
                                                setQuery(e.target.value);
                                                const it = items.find(i => i.name === e.target.value || i.code === e.target.value);
                                                if(it) setPendingItem(it);
                                            }} className="w-full p-2 border rounded text-xs dark:bg-slate-800" />
                                            <datalist id="item-list-rej">{items.map(it => <option key={it.id} value={it.name}>{it.code}</option>)}</datalist>
                                        </td>
                                        <td className="p-2"><input type="number" placeholder="Qty" value={pendingQty} onChange={e => setPendingQty(Number(e.target.value))} className="w-full p-2 border rounded text-right text-xs dark:bg-slate-800 font-bold" /></td>
                                        <td className="p-2"><input type="text" placeholder="Reason..." value={pendingReason} onChange={e => setPendingReason(e.target.value)} className="w-full p-2 border rounded text-xs dark:bg-slate-800" /></td>
                                        <td className="p-2 text-center"><button onClick={handleAddLine} className="p-2 bg-red-600 text-white rounded shadow-md"><Plus size={16}/></button></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                            <button onClick={handleSaveBatch} className="px-8 py-2 bg-red-600 text-white rounded font-black text-sm shadow-xl active:scale-95 transition-all">SIMPAN ENTRY REJECT</button>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'HISTORY' ? (
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-800 overflow-auto shadow-sm">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 uppercase font-bold text-slate-500 border-b dark:border-slate-700">
                            <tr>
                                <th className="p-3">ID Batch</th>
                                <th className="p-3">Tanggal</th>
                                <th className="p-3">Lokasi Outlet</th>
                                <th className="p-3 text-right">Items</th>
                                <th className="p-3 text-center">Act</th>
                            </tr>
                        </thead>
                        <tbody>
                            {batches.map(b => (
                                <tr key={b.id} className="border-b dark:border-slate-800 hover:bg-slate-50 transition-colors">
                                    <td className="p-3 font-mono text-slate-400">{b.id}</td>
                                    <td className="p-3">{b.date}</td>
                                    <td className="p-3 font-bold">{b.outlet}</td>
                                    <td className="p-3 text-right font-bold text-red-600">{b.items.length}</td>
                                    <td className="p-3 text-center flex justify-center gap-2">
                                        <button onClick={() => setViewingBatch(b)} className="p-1 text-blue-500"><Eye size={16}/></button>
                                        <button onClick={() => StorageService.deleteRejectBatch(b.id).then(loadData)} className="p-1 text-red-400 hover:scale-110 transition-transform"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* MASTER OUTLET VIEW */
                <div className="flex-1 max-w-xl mx-auto w-full bg-white dark:bg-slate-900 p-6 rounded-xl border dark:border-slate-800 shadow-xl space-y-6">
                    <div className="flex items-center gap-3 mb-4 text-slate-600">
                        <Building size={24} className="text-blue-500"/>
                        <h3 className="font-bold">Manajemen Outlet Afkir</h3>
                    </div>
                    <div className="flex gap-2">
                        <input type="text" placeholder="Nama Outlet Baru..." value={newOutlet} onChange={e => setNewOutlet(e.target.value)} className="flex-1 p-2.5 border rounded-xl dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
                        <button onClick={handleAddOutlet} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center gap-2"><Plus size={16}/> Tambah</button>
                    </div>
                    <div className="space-y-2">
                        {outlets.map(o => (
                            <div key={o} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border dark:border-slate-700 group transition-all hover:border-blue-300">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{o}</span>
                                <div className="text-[10px] text-slate-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Active Outlet</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {viewingBatch && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-2xl border dark:border-slate-800 overflow-hidden">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-between items-center border-b dark:border-slate-700">
                            <h3 className="font-bold text-sm uppercase">Detail Batch: {viewingBatch.id}</h3>
                            <button onClick={() => setViewingBatch(null)}><X size={20}/></button>
                        </div>
                        <div className="p-4 overflow-auto max-h-[60vh]">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b"><tr><th className="p-2">Item</th><th className="p-2 text-right">Qty</th><th className="p-2">Alasan</th></tr></thead>
                                <tbody>
                                    {viewingBatch.items.map((item, idx) => (
                                        <tr key={idx} className="border-b dark:border-slate-800 h-10">
                                            <td className="p-2 font-bold">{item.name}</td>
                                            <td className="p-2 text-right font-black text-red-600">{item.qty} {item.unit}</td>
                                            <td className="p-2 italic text-slate-400">{item.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
