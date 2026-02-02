
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Item, RejectBatch, RejectItem } from '../types';
import { Trash2, Plus, Save, Upload, Copy, Search, Calendar, MapPin, History, Eye, X, CornerDownLeft, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from './Toast';

export const RejectView: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
    const [items, setItems] = useState<Item[]>([]);
    const [outlets, setOutlets] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // --- New Entry State ---
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedOutlet, setSelectedOutlet] = useState('');
    const [rejectLines, setRejectLines] = useState<RejectItem[]>([]);
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Item[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
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
                StorageService.fetchItems(),
                StorageService.fetchRejectOutlets(),
                StorageService.fetchRejectBatches()
            ]);
            setItems(its);
            setOutlets(ols);
            setBatches(bts);
            if (ols.length > 0 && !selectedOutlet) setSelectedOutlet(ols[0]);
        } catch (e) {
            showToast("Gagal sinkronisasi Database Reject", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Autocomplete Logic
    useEffect(() => {
        if (!query.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
        const lower = query.toLowerCase();
        const matches = items.filter(i => i.code.toLowerCase().includes(lower) || i.name.toLowerCase().includes(lower)).slice(0, 10);
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
    }, [query, items]);

    const handleAddLine = () => {
        if (!pendingItem || !pendingQty || !pendingReason) return showToast("Lengkapi data item", "warning");
        const newLine: RejectItem = {
            itemId: pendingItem.id,
            sku: pendingItem.code,
            name: pendingItem.name,
            qty: Number(pendingQty),
            unit: pendingItem.baseUnit,
            baseQty: Number(pendingQty),
            reason: pendingReason
        };
        setRejectLines([...rejectLines, newLine]);
        setQuery(''); setPendingItem(null); setPendingQty(''); setPendingReason('');
    };

    const handleSaveBatch = async () => {
        if (rejectLines.length === 0) return showToast("Tidak ada item reject", "warning");
        try {
            const batch: RejectBatch = {
                id: `REJ-${Date.now().toString().slice(-6)}`,
                date,
                outlet: selectedOutlet,
                createdAt: Date.now(),
                items: rejectLines
            };
            await StorageService.saveRejectBatch(batch);
            showToast("Reject tersimpan di Database Utama", "success");
            setRejectLines([]);
            loadData();
        } catch (e) {
            showToast("Gagal simpan ke database", "error");
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 gap-4 transition-colors">
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex gap-2">
                <button onClick={() => setActiveTab('NEW')} className={`px-4 py-2 rounded text-xs font-bold transition-all ${activeTab === 'NEW' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <CornerDownLeft size={16} className="inline mr-2"/> Entry Reject Baru
                </button>
                <button onClick={() => setActiveTab('HISTORY')} className={`px-4 py-2 rounded text-xs font-bold transition-all ${activeTab === 'HISTORY' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <History size={16} className="inline mr-2"/> History Reject
                </button>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                    <Loader2 size={24} className="animate-spin mr-2"/> Sinkronisasi MySQL...
                </div>
            ) : activeTab === 'NEW' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border dark:border-slate-800 flex flex-wrap gap-4 items-end">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Tanggal</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded p-2 text-xs dark:bg-slate-800 dark:text-white" />
                        </div>
                        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Outlet / Lokasi Afkir</label>
                            <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} className="border rounded p-2 text-xs dark:bg-slate-800 dark:text-white">
                                {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-800 flex flex-col overflow-hidden shadow-sm">
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 font-bold uppercase text-slate-500">
                                    <tr>
                                        <th className="p-3">Item</th>
                                        <th className="p-3 text-right">Qty</th>
                                        <th className="p-3">Reason</th>
                                        <th className="p-3 text-center">Act</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rejectLines.map((line, idx) => (
                                        <tr key={idx} className="border-b dark:border-slate-800">
                                            <td className="p-2 font-bold">{line.name}</td>
                                            <td className="p-2 text-right font-mono text-red-600">-{line.qty} {line.unit}</td>
                                            <td className="p-2 text-slate-500 italic">{line.reason}</td>
                                            <td className="p-2 text-center"><button onClick={() => setRejectLines(rejectLines.filter((_, i) => i !== idx))}><Trash2 size={14}/></button></td>
                                        </tr>
                                    ))}
                                    <tr className="bg-red-50/20 dark:bg-red-900/10">
                                        <td className="p-2 relative">
                                            <input type="text" placeholder="Scan/Cari Item..." value={query} onChange={e => setQuery(e.target.value)} className="w-full p-2 border rounded text-xs dark:bg-slate-800" />
                                            {showSuggestions && (
                                                <div className="absolute z-50 left-0 top-full w-full bg-white dark:bg-slate-800 shadow-xl border dark:border-slate-700 rounded-md max-h-40 overflow-auto">
                                                    {suggestions.map(it => (
                                                        <div key={it.id} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer" onClick={() => { setPendingItem(it); setQuery(it.name); setShowSuggestions(false); }}>
                                                            {it.name} <span className="text-[10px] text-slate-400 font-mono">({it.code})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2"><input type="number" placeholder="Qty" value={pendingQty} onChange={e => setPendingQty(e.target.value === '' ? '' : Number(e.target.value))} className="w-20 p-2 border rounded text-right text-xs dark:bg-slate-800" /></td>
                                        <td className="p-2"><input type="text" placeholder="Alasan (Pecah/Exp/Dll)" value={pendingReason} onChange={e => setPendingReason(e.target.value)} className="w-full p-2 border rounded text-xs dark:bg-slate-800" /></td>
                                        <td className="p-2 text-center"><button onClick={handleAddLine} className="p-2 bg-red-600 text-white rounded"><Plus size={16}/></button></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                            <button onClick={handleSaveBatch} className="px-8 py-2 bg-red-600 text-white rounded font-bold text-sm shadow-xl hover:bg-red-700 active:scale-95 transition-all">SIMPAN REJECT KE DATABASE</button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-800 overflow-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800 uppercase font-bold text-slate-500">
                            <tr>
                                <th className="p-3">ID Batch</th>
                                <th className="p-3">Tanggal</th>
                                <th className="p-3">Outlet</th>
                                <th className="p-3 text-right">Total Item</th>
                                <th className="p-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {batches.map(b => (
                                <tr key={b.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="p-3 font-mono text-slate-400">{b.id}</td>
                                    <td className="p-3">{b.date}</td>
                                    <td className="p-3 font-bold">{b.outlet}</td>
                                    <td className="p-3 text-right font-bold text-red-600">{b.items.length}</td>
                                    <td className="p-3 text-center flex justify-center gap-2">
                                        <button onClick={() => setViewingBatch(b)} className="p-1 text-blue-500"><Eye size={16}/></button>
                                        <button onClick={() => StorageService.deleteRejectBatch(b.id).then(loadData)} className="p-1 text-red-400"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                                <thead><tr className="border-b"><th>Item</th><th className="text-right">Qty</th><th>Alasan</th></tr></thead>
                                <tbody>
                                    {viewingBatch.items.map((item, idx) => (
                                        <tr key={idx} className="border-b dark:border-slate-800 h-10">
                                            <td>{item.name}</td>
                                            <td className="text-right font-bold text-red-600">{item.qty} {item.unit}</td>
                                            <td className="italic text-slate-400">{item.reason}</td>
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
