
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Item, RejectBatch, RejectItem, UnitConversion } from '../types';
import { Trash2, Plus, CornerDownLeft, Loader2, History, MapPin, Search, Calendar, X, Eye, Save, Building, Database, Upload, Download, Tag, Edit3, Equal, Info, Box, ClipboardCopy, FileSpreadsheet, Share2, ChevronDown, Check, Ruler, LayoutGrid } from 'lucide-react';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';

// --- PERFORMANCE HOOK ---
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

// --- HELPER: CLEAN NUMBER FORMATTER ---
const formatCleanNumber = (val: string | number | undefined): string => {
    if (val === undefined || val === null || val === '') return '';
    const num = Number(val);
    return isNaN(num) ? '' : parseFloat(num.toFixed(4)).toString();
};

export const RejectView: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY' | 'MASTER' | 'MASTER_ITEMS'>('NEW');
    const [rejectMasterItems, setRejectMasterItems] = useState<Item[]>([]);
    const [outlets, setOutlets] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // --- Master Items State ---
    const [showItemModal, setShowItemModal] = useState(false);
    const [masterSearch, setMasterSearch] = useState(''); 
    const debouncedMasterSearch = useDebounce(masterSearch, 300); 

    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [itemForm, setItemForm] = useState<Partial<Item>>({
        code: '', name: '', category: '', baseUnit: 'Pcs', conversions: []
    });

    const [newOutlet, setNewOutlet] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedOutlet, setSelectedOutlet] = useState('');
    const [rejectLines, setRejectLines] = useState<RejectItem[]>([]);
    
    // --- Autocomplete State ---
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 300);

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const [pendingItem, setPendingItem] = useState<Item | null>(null);
    const [pendingUnit, setPendingUnit] = useState('');
    const [pendingQty, setPendingQty] = useState<string>(''); 
    const [pendingReason, setPendingReason] = useState('');
    
    const itemInputRef = useRef<HTMLInputElement>(null);
    const qtyInputRef = useRef<HTMLInputElement>(null);
    const reasonInputRef = useRef<HTMLInputElement>(null);
    const [unitPrefs, setUnitPrefs] = useState<Record<string, string>>({});

    // --- History ---
    const [batches, setBatches] = useState<RejectBatch[]>([]);
    const [viewingBatch, setViewingBatch] = useState<RejectBatch | null>(null);
    const [exportStart, setExportStart] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [exportEnd, setExportEnd] = useState(new Date().toISOString().split('T')[0]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [rmits, ols, bts] = await Promise.all([
                StorageService.fetchRejectMasterItems().catch(() => [] as Item[]),
                StorageService.fetchRejectOutlets().catch(() => [] as string[]),
                StorageService.fetchRejectBatches().catch(() => [] as RejectBatch[])
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

    const filteredItems = useMemo(() => {
        if (!debouncedQuery || pendingItem) return [];
        const lower = debouncedQuery.toLowerCase();
        return rejectMasterItems.filter(it => 
            it.code.toLowerCase().includes(lower) || 
            it.name.toLowerCase().includes(lower)
        ).slice(0, 10);
    }, [debouncedQuery, rejectMasterItems, pendingItem]);

    useEffect(() => {
        if (filteredItems.length > 0 && !pendingItem) {
            setIsDropdownOpen(true);
            setSelectedIndex(0);
        } else {
            setIsDropdownOpen(false);
        }
    }, [filteredItems, pendingItem]);

    const selectItem = (item: Item) => {
        setPendingItem(item);
        setQuery(item.name);
        const preferredUnit = unitPrefs[item.id] || item.baseUnit;
        setPendingUnit(preferredUnit);
        setIsDropdownOpen(false);
        setTimeout(() => qtyInputRef.current?.focus(), 50);
    };

    const handleItemKeyDown = (e: React.KeyboardEvent) => {
        if (isDropdownOpen && filteredItems.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredItems.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                selectItem(filteredItems[selectedIndex]);
            } else if (e.key === 'Escape') {
                setIsDropdownOpen(false);
            }
        } else if (e.key === 'Enter' && pendingItem) {
             e.preventDefault();
             qtyInputRef.current?.focus();
        }
    };

    const handleCopyToClipboard = (batch: RejectBatch) => {
        const d = new Date(batch.date);
        const dateStr = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`;
        let text = `Data Reject ${batch.outlet} ${dateStr}\n`;
        batch.items.forEach(it => {
            const displayQty = formatCleanNumber(it.qty);
            text += `- ${it.name.toLowerCase()} ${displayQty} ${it.unit.toLowerCase()} ${it.reason.toLowerCase()}\n`;
        });
        navigator.clipboard.writeText(text).then(() => {
            showToast("Copied to clipboard", "success");
        });
    };

    const handleAddLine = () => {
        if (!pendingItem) return showToast("Pilih item", "warning");
        if (!pendingQty || Number(pendingQty) <= 0) return showToast("Qty invalid", "warning");
        const unit = pendingUnit || pendingItem.baseUnit;
        setUnitPrefs(prev => ({...prev, [pendingItem.id]: unit}));
        
        let ratio = 1;
        if (unit !== pendingItem.baseUnit) {
            const conv = pendingItem.conversions?.find(c => c.name === unit);
            if (conv) ratio = conv.operator === '/' ? 1 / conv.ratio : conv.ratio;
        }

        const newLine: RejectItem = {
            itemId: pendingItem.id, sku: pendingItem.code, name: pendingItem.name,
            qty: Number(pendingQty), unit: unit, baseQty: Number(pendingQty) * ratio, reason: pendingReason || '-'
        };
        setRejectLines([...rejectLines, newLine]);
        setQuery(''); setPendingItem(null); setPendingQty(''); setPendingReason(''); setPendingUnit('');
        setTimeout(() => itemInputRef.current?.focus(), 50);
    };

    const handleSaveBatch = async () => {
        if (!selectedOutlet) return showToast("Pilih outlet", "warning");
        if (rejectLines.length === 0) return showToast("Item kosong", "warning");
        try {
            await StorageService.saveRejectBatch({
                id: `REJ-${Date.now().toString().slice(-6)}`, date, outlet: selectedOutlet, createdAt: Date.now(), items: rejectLines
            });
            showToast("Reject Saved", "success");
            setRejectLines([]); loadData();
        } catch (e) { showToast("Gagal simpan", "error"); }
    };

    const handleSaveMasterItem = async () => {
        if (!itemForm.code || !itemForm.name) return showToast("Wajib diisi", "warning");
        setIsLoading(true);
        try {
            const payload = { 
                ...itemForm, 
                id: editingItem?.id || crypto.randomUUID(), 
                conversions: (itemForm.conversions || []).map(c => ({ ...c, operator: c.operator || '*' })) 
            } as Item;
            await StorageService.saveRejectMasterItem(payload);
            showToast("Saved", "success"); setShowItemModal(false); loadData();
        } catch (e: any) { showToast(e.message, "error"); } finally { setIsLoading(false); }
    };

    const handleDeleteMasterItem = async (id: string) => {
        if (!confirm('Hapus?')) return;
        try { await StorageService.deleteRejectMasterItem(id); showToast("Deleted", "success"); loadData(); } catch (e) { showToast("Error", "error"); }
    };

    const handleAddOutlet = async () => {
        if (!newOutlet.trim()) return;
        try { await StorageService.saveRejectOutlet(newOutlet.trim()); setNewOutlet(''); showToast("Outlet Added", "success"); loadData(); } catch (e) { showToast("Error", "error"); }
    };

    const updateConversion = (index: number, updates: Partial<UnitConversion>) => {
        const next = [...(itemForm.conversions || [])];
        next[index] = { ...next[index], ...updates };
        setItemForm({ ...itemForm, conversions: next });
    };

    const filteredMasterItems = useMemo(() => {
        const lower = debouncedMasterSearch.toLowerCase();
        return rejectMasterItems.filter(i => i.name.toLowerCase().includes(lower) || i.code.toLowerCase().includes(lower));
    }, [debouncedMasterSearch, rejectMasterItems]);

    return (
        <div className="flex flex-col h-full bg-daintree p-4 gap-4 font-sans">
            <div className="bg-gable p-2 rounded-xl shadow-lg border border-spectra flex flex-wrap gap-2">
                <TabBtn active={activeTab === 'NEW'} onClick={() => setActiveTab('NEW')} label="Entry Reject" icon={<Plus size={16}/>} />
                <TabBtn active={activeTab === 'HISTORY'} onClick={() => setActiveTab('HISTORY')} label="History" icon={<History size={16}/>} />
                <TabBtn active={activeTab === 'MASTER_ITEMS'} onClick={() => setActiveTab('MASTER_ITEMS')} label="Master Items" icon={<Database size={16}/>} />
                <TabBtn active={activeTab === 'MASTER'} onClick={() => setActiveTab('MASTER')} label="Master Outlet" icon={<MapPin size={16}/>} />
            </div>

            {isLoading && activeTab !== 'MASTER_ITEMS' && activeTab !== 'HISTORY' ? (
                <div className="flex-1 flex items-center justify-center text-cutty animate-pulse text-xs font-bold"><Loader2 className="animate-spin mr-2"/> Syncing...</div>
            ) : activeTab === 'NEW' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-gable p-4 rounded-xl border border-spectra grid grid-cols-2 gap-4 shadow-sm">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-cutty uppercase ml-1">Outlet</label>
                            <div className="flex items-center gap-2 bg-daintree p-2 rounded-lg border border-spectra">
                                <Building size={14} className="text-spectra"/>
                                <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-white">
                                    {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-cutty uppercase ml-1">Tanggal</label>
                            <div className="flex items-center gap-2 bg-daintree p-2 rounded-lg border border-spectra">
                                <Calendar size={14} className="text-emerald-500"/>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 bg-gable rounded-xl border border-spectra flex flex-col overflow-hidden shadow-sm">
                        <div className="overflow-auto flex-1 scrollbar-thin">
                            <table className="w-full text-[11px] text-left">
                                <thead className="bg-daintree sticky top-0 font-black uppercase text-cutty border-b border-spectra tracking-widest p-4 z-10">
                                    <tr>
                                        <th className="px-4 py-2">Item</th>
                                        <th className="px-4 py-2 w-24 text-right">Qty</th>
                                        <th className="px-4 py-2 w-24 text-center">Unit</th>
                                        <th className="px-4 py-2">Alasan</th>
                                        <th className="px-4 py-2 w-16 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rejectLines.map((line, idx) => (
                                        <tr key={idx} className="border-b border-spectra/20 group hover:bg-spectra/10 transition-colors">
                                            <td className="px-4 py-1.5">
                                                <div className="font-bold text-white">{line.name}</div>
                                                <div className="text-[9px] text-slate-400 font-mono mt-0.5">{line.sku}</div>
                                            </td>
                                            <td className="px-4 py-1.5 text-right font-mono text-red-400 font-black">-{formatCleanNumber(line.qty)}</td>
                                            <td className="px-4 py-1.5 text-center"><span className="px-2 py-0.5 rounded bg-daintree text-[9px] font-black text-slate-300 border border-spectra">{line.unit}</span></td>
                                            <td className="px-4 py-1.5 text-slate-400 italic">{line.reason}</td>
                                            <td className="px-4 py-1.5 text-center"><button onClick={() => setRejectLines(rejectLines.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-400"><Trash2 size={14}/></button></td>
                                        </tr>
                                    ))}
                                    <tr className="bg-daintree/30 border-t border-spectra/50">
                                        <td className="p-2 relative">
                                            <input 
                                                ref={itemInputRef}
                                                type="text"
                                                placeholder="SCAN / TYPE..." 
                                                value={query} 
                                                onChange={e => { setQuery(e.target.value); if(pendingItem) setPendingItem(null); }} 
                                                onKeyDown={handleItemKeyDown}
                                                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                                onFocus={() => { if(query && !pendingItem) setIsDropdownOpen(true); }}
                                                className="w-full p-2 bg-black/20 border border-spectra rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-spectra font-bold uppercase placeholder:text-cutty" 
                                            />
                                            {isDropdownOpen && (
                                                <div className="absolute left-2 top-full mt-1 w-[400px] bg-gable rounded-xl shadow-2xl border border-spectra z-[100] max-h-48 overflow-y-auto">
                                                    {filteredItems.map((it, idx) => (
                                                        <div 
                                                            key={it.id}
                                                            className={`px-3 py-2 cursor-pointer border-b border-spectra/30 text-xs flex justify-between items-center ${idx === selectedIndex ? 'bg-spectra text-white' : 'hover:bg-daintree'}`}
                                                            onMouseDown={(e) => { e.preventDefault(); selectItem(it); }}
                                                        >
                                                            <div><div className="font-bold">{it.code}</div><div className="text-[10px] text-slate-400">{it.name}</div></div>
                                                            <span className="text-[9px] font-bold bg-daintree px-2 py-0.5 rounded border border-spectra">{it.baseUnit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2">
                                            <input ref={qtyInputRef} type="number" placeholder="0" value={pendingQty} onChange={e => setPendingQty(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); reasonInputRef.current?.focus(); } }} className="w-full p-2 bg-black/20 border border-spectra rounded-lg text-right text-xs text-white font-black outline-none focus:ring-1 focus:ring-spectra" />
                                        </td>
                                        <td className="p-2 text-center">
                                            <select value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="w-full p-2 bg-black/20 border border-spectra rounded-lg text-[10px] font-bold text-white outline-none">
                                                {pendingItem ? (<> <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option> {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)} </>) : <option value="">-</option>}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input ref={reasonInputRef} type="text" placeholder="..." value={pendingReason} onChange={e => setPendingReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLine(); } }} className="w-full p-2 bg-black/20 border border-spectra rounded-lg text-xs text-white outline-none" />
                                        </td>
                                        <td className="p-2 text-center">
                                            <button onClick={handleAddLine} disabled={!pendingItem} className="p-2 bg-spectra text-white rounded-lg hover:bg-white hover:text-spectra transition-colors disabled:opacity-50"><Plus size={14}/></button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-spectra bg-gable flex justify-between items-center">
                            <div className="text-[10px] font-black text-cutty uppercase tracking-widest">{rejectLines.length} Lines</div>
                            <button onClick={handleSaveBatch} className="px-8 py-2 bg-spectra hover:bg-daintree text-white rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">SIMPAN</button>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'HISTORY' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                     <div className="bg-gable p-3 rounded-xl border border-spectra flex gap-4 items-end">
                         <div className="flex flex-col gap-1">
                             <label className="text-[10px] font-bold text-cutty uppercase">Start</label>
                             <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="bg-daintree border border-spectra rounded-lg px-2 py-1 text-xs text-white" />
                         </div>
                         <div className="flex flex-col gap-1">
                             <label className="text-[10px] font-bold text-cutty uppercase">End</label>
                             <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="bg-daintree border border-spectra rounded-lg px-2 py-1 text-xs text-white" />
                         </div>
                         <button onClick={loadData} className="ml-auto p-1.5 text-slate-400 hover:text-white"><History size={18}/></button>
                     </div>
                     <div className="flex-1 bg-gable rounded-xl border border-spectra overflow-auto">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-daintree uppercase font-black text-cutty border-b border-spectra sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">ID</th>
                                    <th className="px-4 py-2">Date</th>
                                    <th className="px-4 py-2">Outlet</th>
                                    <th className="px-4 py-2 text-right">Items</th>
                                    <th className="px-4 py-2 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-spectra/20 text-white">
                                {batches.map(b => (
                                    <tr key={b.id} className="hover:bg-spectra/10">
                                        <td className="px-4 py-2 font-mono text-cutty">{b.id}</td>
                                        <td className="px-4 py-2">{b.date}</td>
                                        <td className="px-4 py-2"><MapPin size={10} className="inline text-red-400 mr-1"/> {b.outlet}</td>
                                        <td className="px-4 py-2 text-right font-black text-red-400">{b.items.length}</td>
                                        <td className="px-4 py-2 text-center flex justify-center gap-2">
                                            <button onClick={() => handleCopyToClipboard(b)} className="text-emerald-500"><Share2 size={14}/></button>
                                            <button onClick={() => setViewingBatch(b)} className="text-blue-400"><Eye size={14}/></button>
                                            <button onClick={() => { if(confirm('Delete?')) StorageService.deleteRejectBatch(b.id).then(loadData); }} className="text-red-400"><Trash2 size={14}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                </div>
            ) : activeTab === 'MASTER_ITEMS' ? (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-gable p-3 rounded-xl border border-spectra flex justify-between items-center">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cutty" size={14} />
                            <input type="text" placeholder="Search Master..." value={masterSearch} onChange={e => setMasterSearch(e.target.value)} className="pl-9 pr-4 py-1.5 bg-daintree border border-spectra rounded-lg text-xs font-bold text-white outline-none w-64" />
                        </div>
                        <button onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', conversions: [] }); setShowItemModal(true); }} className="px-4 py-1.5 bg-spectra text-white rounded-lg text-[10px] font-black flex items-center gap-2 hover:bg-daintree"><Plus size={14}/> NEW ITEM</button>
                    </div>
                    <div className="flex-1 bg-gable rounded-xl border border-spectra overflow-auto">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-daintree font-black uppercase text-cutty border-b border-spectra sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Code</th>
                                    <th className="px-4 py-2">Name</th>
                                    <th className="px-4 py-2 text-center">Unit Utama</th>
                                    <th className="px-4 py-2 text-center">Konversi</th>
                                    <th className="px-4 py-2 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-spectra/20 text-white">
                                {filteredMasterItems.map(item => (
                                    <tr key={item.id} className="hover:bg-spectra/10">
                                        <td className="px-4 py-2 font-mono font-bold text-cutty">{item.code}</td>
                                        <td className="px-4 py-2 font-bold">{item.name}</td>
                                        <td className="px-4 py-2 text-center"><span className="px-2 py-0.5 rounded bg-daintree text-[9px] border border-spectra font-black text-emerald-400">{item.baseUnit}</span></td>
                                        <td className="px-4 py-2 text-center text-[10px] text-slate-400 italic">
                                            {item.conversions?.length ? `${item.conversions.length} Satuan` : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-center flex justify-center gap-2">
                                            <button onClick={() => { setEditingItem(item); setItemForm({...item, conversions: item.conversions ? [...item.conversions] : []}); setShowItemModal(true); }} className="text-blue-400"><Edit3 size={14}/></button>
                                            <button onClick={() => handleDeleteMasterItem(item.id)} className="text-red-400"><Trash2 size={14}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex-1 max-w-lg mx-auto w-full bg-gable p-8 rounded-2xl border border-spectra space-y-6">
                    <h3 className="text-lg font-black text-white">Manage Outlets</h3>
                    <div className="flex gap-2">
                        <input type="text" placeholder="New Outlet Name..." value={newOutlet} onChange={e => setNewOutlet(e.target.value)} className="flex-1 p-3 bg-daintree border border-spectra rounded-xl outline-none text-xs font-bold text-white" />
                        <button onClick={handleAddOutlet} className="px-6 py-3 bg-spectra text-white rounded-xl font-black text-xs">ADD</button>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {outlets.map(o => (
                            <div key={o} className="p-3 bg-daintree/50 rounded-lg border border-spectra text-xs font-bold text-slate-200">{o}</div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal MASTER ITEM - DENGAN TABEL KONVERSI BARU */}
            {showItemModal && (
                <div className="fixed inset-0 bg-daintree/90 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-gable rounded-[24px] w-full max-w-xl shadow-2xl border border-spectra overflow-hidden flex flex-col max-h-[95vh]">
                         <div className="bg-daintree p-5 border-b border-spectra flex justify-between items-center">
                             <div className="flex items-center gap-3">
                                 <div className="p-2 bg-gable rounded-lg border border-spectra text-white shadow-sm"><Tag size={18}/></div>
                                 <h3 className="font-black text-sm uppercase tracking-widest text-white">{editingItem ? 'Edit Master Item' : 'New Master Item'}</h3>
                             </div>
                             <button onClick={()=>setShowItemModal(false)} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"><X size={20}/></button>
                         </div>
                         
                         <div className="p-6 overflow-y-auto scrollbar-thin space-y-6">
                             <div className="space-y-4">
                                 <h4 className="text-[10px] font-black uppercase text-cutty tracking-widest border-b border-spectra pb-1 flex items-center gap-2"><Box size={12}/> Identitas Produk</h4>
                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="col-span-1 space-y-1">
                                         <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Kode Item</label>
                                         <input type="text" placeholder="SKU..." className="rej-input font-mono tracking-widest text-emerald-400" value={itemForm.code} onChange={e=>setItemForm({...itemForm, code:e.target.value})} />
                                     </div>
                                     <div className="col-span-1 space-y-1">
                                         <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Satuan Utama (BASE)</label>
                                         <input type="text" placeholder="PCS / GRM" className="rej-input text-center font-black text-white" value={itemForm.baseUnit} onChange={e=>setItemForm({...itemForm, baseUnit:e.target.value.toUpperCase()})} />
                                     </div>
                                     <div className="col-span-2 space-y-1">
                                         <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nama Barang</label>
                                         <input type="text" placeholder="Nama Lengkap Barang..." className="rej-input" value={itemForm.name} onChange={e=>setItemForm({...itemForm, name:e.target.value})} />
                                     </div>
                                 </div>
                             </div>

                             {/* Tabel Baru: Konversi Satuan ke Base */}
                             <div className="space-y-3 pt-2">
                                <div className="flex justify-between items-end border-b border-spectra pb-1">
                                    <h4 className="text-[10px] font-black uppercase text-cutty tracking-widest flex items-center gap-2"><LayoutGrid size={12}/> Tabel Konversi Satuan</h4>
                                    <button 
                                        onClick={() => setItemForm({...itemForm, conversions: [...(itemForm.conversions || []), { name: '', ratio: 1, operator: '*' }]})} 
                                        className="text-[9px] font-black text-spectra hover:text-white bg-spectra/10 hover:bg-spectra px-3 py-1 rounded-full transition-colors flex items-center gap-1.5"
                                    >
                                        <Plus size={12}/> TAMBAH UNIT
                                    </button>
                                </div>
                                
                                <div className="rounded-xl border border-spectra/30 overflow-hidden bg-daintree/20">
                                    <table className="w-full text-left table-fixed">
                                        <thead className="bg-daintree text-[9px] font-black uppercase text-cutty tracking-wider">
                                            <tr>
                                                <th className="px-3 py-2 w-28">Nama Satuan</th>
                                                <th className="px-3 py-2 w-20 text-center">Op</th>
                                                <th className="px-3 py-2 text-right">Rasio ({itemForm.baseUnit})</th>
                                                <th className="px-3 py-2 w-10 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-spectra/10 text-xs">
                                            {(itemForm.conversions || []).length === 0 ? (
                                                <tr><td colSpan={4} className="p-6 text-center text-[10px] text-slate-500 italic opacity-50">Belum ada konversi tambahan</td></tr>
                                            ) : (
                                                itemForm.conversions?.map((c, i) => (
                                                    <tr key={i} className="group hover:bg-white/5 transition-colors">
                                                        <td className="p-1">
                                                            <input type="text" className="rej-input text-center h-8 text-[10px] uppercase" placeholder="BOX / CTN" value={c.name} onChange={e => updateConversion(i, { name: e.target.value.toUpperCase() })} />
                                                        </td>
                                                        <td className="p-1">
                                                            <div className="relative h-8">
                                                                <select className="rej-input h-full text-[10px] appearance-none pr-4 cursor-pointer text-center" value={c.operator} onChange={e => updateConversion(i, { operator: e.target.value as any })}>
                                                                    <option value="*">x (Kali)</option>
                                                                    <option value="/">/ (Bagi)</option>
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td className="p-1">
                                                            <input type="number" className="rej-input text-right h-8 font-mono text-[10px] text-emerald-400" value={c.ratio} onChange={e => updateConversion(i, { ratio: Number(e.target.value) })} />
                                                        </td>
                                                        <td className="p-1 text-center">
                                                            <button onClick={() => setItemForm({...itemForm, conversions: itemForm.conversions?.filter((_, idx) => idx !== i)})} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-[9px] text-slate-500 italic px-1 flex items-center gap-1">
                                    <Info size={10}/> Saat Sync ke Google Sheet, semua jumlah akan otomatis dikonversi ke <b>{itemForm.baseUnit}</b>.
                                </p>
                             </div>
                         </div>

                         <div className="bg-daintree p-5 border-t border-spectra flex justify-end gap-3">
                             <button onClick={()=>setShowItemModal(false)} className="px-5 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Batal</button>
                             <button onClick={handleSaveMasterItem} className="px-8 py-2 bg-spectra text-white rounded-xl text-xs font-black shadow-lg hover:bg-white hover:text-spectra transition-all border border-spectra active:scale-95 flex items-center gap-2">
                                 <Save size={14}/> SIMPAN MASTER
                             </button>
                         </div>
                    </div>
                </div>
            )}

            {viewingBatch && (
                <div className="fixed inset-0 bg-daintree/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                     <div className="bg-gable rounded-2xl w-full max-w-lg border border-spectra overflow-hidden max-h-[80vh]">
                         <div className="p-4 bg-daintree flex justify-between"><h3 className="font-black text-white text-xs uppercase tracking-widest">Detail Batch {viewingBatch.id}</h3><button onClick={()=>setViewingBatch(null)}><X size={18} className="text-slate-400"/></button></div>
                         <div className="p-4 overflow-auto">
                            <table className="w-full text-[10px] text-white">
                                <thead className="text-cutty uppercase font-black border-b border-spectra/30">
                                    <tr>
                                        <th className="py-2 text-left">Nama Barang</th>
                                        <th className="py-2 text-right">Qty Input</th>
                                        <th className="py-2 text-right">Qty Base</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-spectra/20">
                                    {viewingBatch.items.map((it,i)=>(
                                        <tr key={i}>
                                            <td className="py-2">
                                                <div className="font-bold">{it.name}</div>
                                                <div className="text-slate-500 text-[8px] italic">{it.reason}</div>
                                            </td>
                                            <td className="text-right py-2 text-red-400 font-bold">{formatCleanNumber(it.qty)} {it.unit}</td>
                                            <td className="text-right py-2 text-emerald-400 font-black">{formatCleanNumber(it.baseQty)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                     </div>
                </div>
            )}
            
            <style>{` 
                .rej-input { 
                    width: 100%; 
                    background-color: #0b1619 !important; 
                    border: 1px solid #335157 !important; 
                    outline: none !important; 
                    box-shadow: inset 0 1px 3px rgba(0,0,0,0.3) !important;
                    border-radius: 0.75rem; 
                    padding: 0.5rem 0.75rem;
                    font-size: 0.75rem; 
                    font-weight: 700; 
                    color: #f1f5f9 !important; 
                    transition: border-color 0.2s ease;
                }
                .rej-input:focus { border-color: #496569 !important; }
                .rej-input::placeholder { color: #475569 !important; font-weight: 500; }
                input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
            `}</style>
        </div>
    );
};

const TabBtn = ({ active, onClick, label, icon }: any) => (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 border transition-all ${active ? 'bg-spectra text-white border-spectra shadow-lg' : 'text-slate-400 border-transparent hover:bg-daintree'}`}>{icon} {label}</button>
);
