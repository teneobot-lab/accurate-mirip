
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Warehouse, Partner, AppUser } from '../types';
import { Plus, Edit3, Trash2, Search, MapPin, Users, Building2, UserCircle, Save, X, Phone, Mail, Loader2, Share2, FileSpreadsheet, Calendar, Link as LinkIcon, Code, Copy, Check } from 'lucide-react';
import { useToast } from './Toast';

type SettingsTab = 'WAREHOUSE' | 'SUPPLIER' | 'CUSTOMER' | 'USERS' | 'EXTERNAL_SYNC';

const GS_CODE_BOILERPLATE = `/**
 * GudangPro - Google Sheets Connector v1.0
 * Tempel kode ini di Extensions > Apps Script
 */

function doPost(e) {
  var contents = JSON.parse(e.postData.contents);
  var action = contents.action;
  
  if (action === "APPEND_ROWS") {
    var sheet = setupSheet();
    var rows = contents.rows;
    
    // Append data ke baris terakhir
    rows.forEach(function(row) {
      sheet.appendRow(row);
    });
    
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  }
}

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "Mutasi GudangPro";
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Header Setup
    var headers = ["Tanggal", "Ref No", "Tipe", "Kode Barang", "Nama Barang", "Qty", "Satuan", "Keterangan"];
    sheet.appendRow(headers);
    
    // Formatting Header
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#1e293b")
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setHorizontalAlignment("center");
    
    sheet.setFrozenRows(1);
  }
  return sheet;
}`;

// --- HELPERS FOR DENSE TABLE ---
const DenseRow = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <tr className={`hover:bg-blue-50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800 ${className}`}>
    {children}
  </tr>
);

const DenseCell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`p-2 text-xs text-slate-600 dark:text-slate-400 ${className}`}>
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

    // Sync States
    const [scriptUrl, setScriptUrl] = useState(() => localStorage.getItem('gp_gsheet_url') || '');
    const [syncStart, setSyncStart] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
    const [syncEnd, setSyncEnd] = useState(new Date().toISOString().split('T')[0]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [copied, setCopied] = useState(false);

    const refreshData = async () => {
        setIsLoading(true);
        try {
            const [whs, pts, usrs] = await Promise.all([
                StorageService.fetchWarehouses(),
                StorageService.fetchPartners(),
                StorageService.fetchUsers()
            ]);
            setWarehouses(whs);
            setPartners(pts);
            setUsers(usrs);
        } catch (e) {
            console.error("Fetch Settings Error", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(GS_CODE_BOILERPLATE);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        showToast("Kode Apps Script berhasil disalin!", "success");
    };

    const handleGoogleSync = async () => {
        if (!scriptUrl) return showToast("Masukkan URL Apps Script", "warning");
        if (!scriptUrl.includes('script.google.com')) return showToast("URL tidak valid", "error");
        
        setIsSyncing(true);
        try {
            localStorage.setItem('gp_gsheet_url', scriptUrl);
            await StorageService.syncToGoogleSheets(scriptUrl, syncStart, syncEnd);
            showToast("Sinkronisasi Berhasil (Data Terkirim)", "success");
        } catch (e) {
            showToast("Gagal sinkronisasi", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus data ini dari Database MySQL?')) return;
        try {
            if (activeTab === 'WAREHOUSE') await StorageService.deleteWarehouse(id);
            else if (activeTab === 'USERS') await StorageService.deleteUser(id);
            else await StorageService.deletePartner(id);
            
            showToast("Data dihapus", "success");
            refreshData();
        } catch (e) {
            showToast("Gagal hapus data", "error");
        }
    };

    const handleSave = async (data: any) => {
        try {
            if (activeTab === 'WAREHOUSE') await StorageService.saveWarehouse({ id: data.id || crypto.randomUUID(), ...data });
            else if (activeTab === 'USERS') await StorageService.saveUser({ id: data.id || crypto.randomUUID(), ...data });
            else await StorageService.savePartner({ id: data.id || crypto.randomUUID(), type: activeTab as any, ...data });
            
            showToast("Data tersimpan ke MySQL", "success");
            setShowModal(false);
            setEditData(null);
            refreshData();
        } catch (e) {
            showToast("Gagal simpan ke server", "error");
        }
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
            <div className="w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="p-4 border-b dark:border-slate-800">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Master Settings</h2>
                </div>
                <div className="p-2 space-y-1">
                    <button onClick={() => setActiveTab('WAREHOUSE')} className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 transition-colors ${activeTab === 'WAREHOUSE' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <Building2 size={16} /> Warehouses
                    </button>
                    <button onClick={() => setActiveTab('SUPPLIER')} className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 transition-colors ${activeTab === 'SUPPLIER' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <Building2 size={16} /> Suppliers
                    </button>
                    <button onClick={() => setActiveTab('CUSTOMER')} className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 transition-colors ${activeTab === 'CUSTOMER' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <Users size={16} /> Customers
                    </button>
                    <button onClick={() => setActiveTab('USERS')} className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 transition-colors ${activeTab === 'USERS' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <UserCircle size={16} /> Users
                    </button>
                    
                    <div className="pt-4 pb-2 px-3">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">External Connectivity</h3>
                    </div>
                    <button onClick={() => setActiveTab('EXTERNAL_SYNC')} className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 transition-colors ${activeTab === 'EXTERNAL_SYNC' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <Share2 size={16} /> Google Sheets Sync
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                {activeTab !== 'EXTERNAL_SYNC' ? (
                    <>
                        <div className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 p-3 flex justify-between items-center shadow-sm">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input type="text" placeholder="Filter..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-3 py-1.5 border dark:border-slate-700 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none w-64 dark:bg-slate-800 dark:text-slate-200" />
                            </div>
                            <button onClick={() => { setEditData({}); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-2">
                                <Plus size={16} /> Tambah Data
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4">
                            {isLoading ? (
                                <div className="h-full flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2"/> Syncing with MySQL...</div>
                            ) : (
                                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase border-b dark:border-slate-700">
                                            <tr>
                                                <th className="p-2 w-10 text-center">#</th>
                                                <th className="p-2">Informasi Utama</th>
                                                <th className="p-2">Detail Kontak</th>
                                                <th className="p-2 w-20 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredData().map((item: any, idx) => (
                                                <DenseRow key={item.id}>
                                                    <DenseCell className="text-center bg-slate-50/50 dark:bg-slate-800/30">{idx + 1}</DenseCell>
                                                    <DenseCell>
                                                        <div className="font-bold text-slate-700 dark:text-slate-200">{item.name}</div>
                                                        <div className="text-[10px] text-slate-400">{item.location || item.address || item.role}</div>
                                                    </DenseCell>
                                                    <DenseCell>
                                                        <div className="flex flex-col gap-0.5">
                                                            {item.phone && <span className="flex items-center gap-1"><Phone size={10}/> {item.phone}</span>}
                                                            {item.username && <span className="flex items-center gap-1 font-mono text-blue-500">@{item.username}</span>}
                                                        </div>
                                                    </DenseCell>
                                                    <DenseCell className="text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <button onClick={() => { setEditData(item); setShowModal(true); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit3 size={14}/></button>
                                                            <button onClick={() => handleDelete(item.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
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
                    /* ENHANCED GOOGLE SHEETS SYNC VIEW */
                    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6">
                        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Left Side: Config Form */}
                            <div className="space-y-6">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600">
                                            <FileSpreadsheet size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold">Spreadsheet Integration</h3>
                                            <p className="text-xs text-slate-500">Kirim data mutasi ke Google Sheet per Baris</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                                <LinkIcon size={12}/> Apps Script Web App URL
                                            </label>
                                            <input 
                                                type="text" 
                                                placeholder="https://script.google.com/macros/s/.../exec"
                                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                                                value={scriptUrl}
                                                onChange={e => setScriptUrl(e.target.value)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                                    <Calendar size={12}/> Dari Tanggal
                                                </label>
                                                <input 
                                                    type="date" 
                                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                                    value={syncStart}
                                                    onChange={e => setSyncStart(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                                    <Calendar size={12}/> Sampai Tanggal
                                                </label>
                                                <input 
                                                    type="date" 
                                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                                    value={syncEnd}
                                                    onChange={e => setSyncEnd(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <button 
                                            onClick={handleGoogleSync}
                                            disabled={isSyncing}
                                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                                        >
                                            {isSyncing ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20} />}
                                            Mulai Sinkronisasi Baris Data
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                                    <div className="relative z-10">
                                        <h4 className="font-bold mb-2 flex items-center gap-2"><Share2 size={18}/> Cara Kerja</h4>
                                        <ul className="text-xs space-y-2 opacity-90 list-disc pl-4">
                                            <li>Aplikasi mengekstrak mutasi stok dari MySQL.</li>
                                            <li>Data diformat menjadi array per baris (tabular).</li>
                                            <li>Apps Script menerima data dan melakukan <code>appendRow</code>.</li>
                                            <li>Header otomatis dibuat jika sheet masih kosong.</li>
                                        </ul>
                                    </div>
                                    <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10 rotate-12">
                                        <FileSpreadsheet size={120} />
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Code Snippet */}
                            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[600px]">
                                <div className="p-4 bg-slate-800 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Code size={16} className="text-emerald-400" />
                                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Google Apps Script (GS)</span>
                                    </div>
                                    <button 
                                        onClick={copyToClipboard}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-[10px] font-bold text-white transition-colors"
                                    >
                                        {copied ? <Check size={14} className="text-emerald-400"/> : <Copy size={14}/>}
                                        {copied ? 'TERSALIN' : 'SALIN KODE'}
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-slate-400 custom-scrollbar">
                                    <pre className="whitespace-pre">{GS_CODE_BOILERPLATE}</pre>
                                </div>
                                <div className="p-3 bg-slate-800/50 text-[10px] text-slate-500 italic px-4 border-t border-slate-800">
                                    * Klik salin, lalu tempel di Apps Script Spreadsheet Anda. Publish sebagai Web App (Anyone access).
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 border-b dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-xs">Form {activeTab}</h3>
                            <button onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSave(editData); }} className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Nama / Title</label>
                                <input required className="w-full border dark:border-slate-700 rounded p-2 text-sm dark:bg-slate-800" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Phone / Contact</label>
                                    <input className="w-full border dark:border-slate-700 rounded p-2 text-sm dark:bg-slate-800" value={editData.phone || ''} onChange={e => setEditData({...editData, phone: e.target.value})} />
                                </div>
                                {activeTab === 'USERS' ? (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Username</label>
                                        <input required className="w-full border dark:border-slate-700 rounded p-2 text-sm dark:bg-slate-800" value={editData.username || ''} onChange={e => setEditData({...editData, username: e.target.value})} />
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">PIC / Penanggung Jawab</label>
                                        <input className="w-full border dark:border-slate-700 rounded p-2 text-sm dark:bg-slate-800" value={editData.pic || ''} onChange={e => setEditData({...editData, pic: e.target.value})} />
                                    </div>
                                )}
                            </div>
                            <div className="pt-4 flex justify-end gap-2 border-t dark:border-slate-800">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 text-sm font-bold">Batal</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow-lg">Simpan ke Database</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
