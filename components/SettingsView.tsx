
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Warehouse, Partner, AppUser } from '../types';
import { Plus, Edit3, Trash2, Search, Building2, UserCircle, Save, X, Phone, Loader2, Share2, FileSpreadsheet, Calendar, Link as LinkIcon, Code, Copy, Check, Users } from 'lucide-react';
import { useToast } from './Toast';

type SettingsTab = 'WAREHOUSE' | 'SUPPLIER' | 'CUSTOMER' | 'USERS' | 'EXTERNAL_SYNC';

const GS_CODE_BOILERPLATE = `/**
 * GudangPro - Google Sheets Connector v1.0
 */
function doPost(e) {
  var contents = JSON.parse(e.postData.contents);
  if (contents.action === "APPEND_ROWS") {
    var sheet = setupSheet();
    contents.rows.forEach(function(row) { sheet.appendRow(row); });
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  }
}

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = "Mutasi GudangPro";
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    var h = ["Tanggal", "Ref No", "Tipe", "Kode", "Nama", "Qty", "Satuan", "Ket"];
    sheet.appendRow(h);
    sheet.getRange(1, 1, 1, h.length).setBackground("#1e293b").setFontColor("#fff").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}`;

// Fix: Explicitly type DenseRow as React.FC to handle children and key props correctly in JSX
const DenseRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tr className="hover:bg-blue-50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
    {children}
  </tr>
);

// Fix: Explicitly type DenseCell as React.FC to ensure children prop is correctly recognized by the JSX transform
const DenseCell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <td className={`p-2.5 text-xs text-slate-600 dark:text-slate-400 ${className}`}>
    {children}
  </td>
);

export const SettingsView: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<SettingsTab>('WAREHOUSE');
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editData, setEditData] = useState<any>(null);

    const [scriptUrl, setScriptUrl] = useState(() => localStorage.getItem('gp_gsheet_url') || '');
    const [syncStart, setSyncStart] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
    const [syncEnd, setSyncEnd] = useState(new Date().toISOString().split('T')[0]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [copied, setCopied] = useState(false);

    const refreshData = async () => {
        setIsLoading(true);
        try {
            const [whs, pts, usrs] = await Promise.all([
                StorageService.fetchWarehouses().catch(() => []),
                StorageService.fetchPartners().catch(() => []),
                StorageService.fetchUsers().catch(() => [])
            ]);
            setWarehouses(Array.isArray(whs) ? whs : []);
            setPartners(Array.isArray(pts) ? pts : []);
            setUsers(Array.isArray(usrs) ? usrs : []);
        } catch (e) {
            console.error("Fetch Settings Error", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { refreshData(); }, []);

    const handleGoogleSync = async () => {
        if (!scriptUrl) return showToast("URL Apps Script diperlukan", "warning");
        setIsSyncing(true);
        try {
            localStorage.setItem('gp_gsheet_url', scriptUrl);
            await StorageService.syncToGoogleSheets(scriptUrl, syncStart, syncEnd);
            showToast("Sinkronisasi Berhasil", "success");
        } catch (e) {
            showToast("Gagal sinkronisasi", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus data secara permanen?')) return;
        try {
            if (activeTab === 'WAREHOUSE') await StorageService.deleteWarehouse(id);
            else if (activeTab === 'USERS') await StorageService.deleteUser(id);
            else await StorageService.deletePartner(id);
            showToast("Berhasil dihapus", "success");
            refreshData();
        } catch (e) { showToast("Gagal menghapus", "error"); }
    };

    const handleSave = async (data: any) => {
        try {
            if (activeTab === 'WAREHOUSE') await StorageService.saveWarehouse({ id: data.id || crypto.randomUUID(), ...data });
            else if (activeTab === 'USERS') await StorageService.saveUser({ id: data.id || crypto.randomUUID(), ...data });
            else await StorageService.savePartner({ id: data.id || crypto.randomUUID(), type: activeTab as any, ...data });
            showToast("Tersimpan ke MySQL", "success");
            setShowModal(false); refreshData();
        } catch (e) { showToast("Gagal menyimpan", "error"); }
    };

    const filteredData = () => {
        const lower = searchTerm.toLowerCase();
        if (activeTab === 'WAREHOUSE') return warehouses.filter(w => w.name.toLowerCase().includes(lower));
        if (activeTab === 'SUPPLIER') return partners.filter(p => p.type === 'SUPPLIER' && p.name.toLowerCase().includes(lower));
        if (activeTab === 'CUSTOMER') return partners.filter(p => p.type === 'CUSTOMER' && p.name.toLowerCase().includes(lower));
        if (activeTab === 'USERS') return users.filter(u => u.name.toLowerCase().includes(lower));
        return [];
    };

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-950 transition-colors">
            <div className="w-56 bg-white dark:bg-slate-900 border-r dark:border-slate-800 flex flex-col p-2 gap-1">
                <div className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-slate-800 mb-2">Master Data</div>
                <button onClick={() => setActiveTab('WAREHOUSE')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${activeTab === 'WAREHOUSE' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <Building2 size={16}/> Warehouses
                </button>
                <button onClick={() => setActiveTab('SUPPLIER')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${activeTab === 'SUPPLIER' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <Building2 size={16}/> Suppliers
                </button>
                <button onClick={() => setActiveTab('CUSTOMER')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${activeTab === 'CUSTOMER' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <Users size={16}/> Customers
                </button>
                <button onClick={() => setActiveTab('USERS')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${activeTab === 'USERS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <UserCircle size={16}/> Users
                </button>
                <div className="mt-6 p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-slate-800 mb-2">Integrasi</div>
                <button onClick={() => setActiveTab('EXTERNAL_SYNC')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${activeTab === 'EXTERNAL_SYNC' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <Share2 size={16}/> Google Sheets
                </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                {activeTab !== 'EXTERNAL_SYNC' ? (
                    <>
                        <div className="p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex justify-between items-center">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input type="text" placeholder="Cari..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-1.5 border dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 w-64 dark:bg-slate-800" />
                            </div>
                            <button onClick={() => { setEditData({}); setShowModal(true); }} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-md">
                                <Plus size={16}/> Tambah
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            {isLoading ? (
                                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold tracking-widest animate-pulse"><Loader2 className="animate-spin mr-2"/> Syncing...</div>
                            ) : (
                                <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500 border-b dark:border-slate-700">
                                            <tr>
                                                <th className="p-3 w-12 text-center">#</th>
                                                <th className="p-3">Info</th>
                                                <th className="p-3">Kontak</th>
                                                <th className="p-3 w-20 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredData().map((item: any, idx) => (
                                                <DenseRow key={item.id}>
                                                    <DenseCell className="text-center font-mono opacity-50">{idx + 1}</DenseCell>
                                                    <DenseCell>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200">{item.name}</div>
                                                        <div className="text-[10px] opacity-60">{item.location || item.role}</div>
                                                    </DenseCell>
                                                    <DenseCell>
                                                        <div className="flex flex-col gap-0.5">
                                                            {item.phone && <span className="flex items-center gap-1"><Phone size={10}/> {item.phone}</span>}
                                                            {item.username && <span className="text-blue-500 font-mono">@{item.username}</span>}
                                                        </div>
                                                    </DenseCell>
                                                    <DenseCell className="text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button onClick={() => { setEditData(item); setShowModal(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit3 size={14}/></button>
                                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                                                        </div>
                                                    </DenseCell>
                                                </DenseRow>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 overflow-auto p-8 bg-slate-50 dark:bg-slate-950">
                        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border dark:border-slate-800 space-y-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600"><FileSpreadsheet size={32}/></div>
                                    <div><h3 className="text-lg font-bold">GS Integration</h3><p className="text-xs text-slate-500">Sync MySQL to Sheets</p></div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Script URL</label>
                                        <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm font-mono outline-none" value={scriptUrl} onChange={e => setScriptUrl(e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="date" className="p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-xs" value={syncStart} onChange={e => setSyncStart(e.target.value)} />
                                        <input type="date" className="p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-xs" value={syncEnd} onChange={e => setSyncEnd(e.target.value)} />
                                    </div>
                                    <button onClick={handleGoogleSync} disabled={isSyncing} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-3 transition-all">
                                        {isSyncing ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20} />} Sync to Sheets
                                    </button>
                                </div>
                            </div>
                            <div className="bg-slate-900 rounded-2xl border border-slate-800 flex flex-col h-[500px]">
                                <div className="p-4 bg-slate-800 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Google Apps Script</span>
                                    <button onClick={() => { navigator.clipboard.writeText(GS_CODE_BOILERPLATE); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="px-3 py-1 bg-slate-700 rounded text-[10px] font-bold text-white flex items-center gap-2">
                                        {copied ? <Check size={12}/> : <Copy size={12}/>} {copied ? 'COPIED' : 'COPY'}
                                    </button>
                                </div>
                                <pre className="flex-1 overflow-auto p-4 font-mono text-[10px] text-slate-400 leading-relaxed">{GS_CODE_BOILERPLATE}</pre>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border dark:border-slate-800 overflow-hidden">
                        <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-xs uppercase tracking-widest">{editData.id ? 'Edit' : 'Tambah'} {activeTab}</h3>
                            <button onClick={() => setShowModal(false)}><X size={18}/></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSave(editData); }} className="p-6 space-y-4">
                            <input required placeholder="Nama" className="w-full p-2.5 border dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} />
                            {activeTab === 'USERS' && <input required placeholder="Username" className="w-full p-2.5 border dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 font-mono" value={editData.username || ''} onChange={e => setEditData({...editData, username: e.target.value})} />}
                            <input placeholder="Telepon" className="w-full p-2.5 border dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800" value={editData.phone || ''} onChange={e => setEditData({...editData, phone: e.target.value})} />
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 text-xs font-bold text-slate-500">Batal</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
