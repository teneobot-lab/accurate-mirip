
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Warehouse, Partner, AppUser } from '../types';
import { Plus, Edit3, Trash2, Search, Building2, UserCircle, Save, X, Phone, Loader2, Share2, FileSpreadsheet, Calendar, Link as LinkIcon, Code, Copy, Check, Users, ToggleLeft, ToggleRight, Lock, MapPin, Mail, Key } from 'lucide-react';
import { useToast } from './Toast';

type SettingsTab = 'WAREHOUSE' | 'SUPPLIER' | 'CUSTOMER' | 'USERS' | 'EXTERNAL_SYNC';

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

    const [scriptUrl, setScriptUrl] = useState('');
    const [syncStart, setSyncStart] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [syncEnd, setSyncEnd] = useState(new Date().toISOString().split('T')[0]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [copied, setCopied] = useState(false);

    const GS_CODE_BOILERPLATE = `/**
 * GudangPro - Smart Sync v5.0 (Enterprise Ready)
 * Supports: Partner, Warehouse, Global Notes, Multi-Sheet, Deduplication
 */
function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    
    // Support V2 Payload (Separate Transactions & Rejects)
    if (contents.action === "SYNC_V2") {
      var results = [];
      
      // 1. Process Transactions (Sheet: Mutasi GudangPro)
      if (contents.transactions && contents.transactions.length > 0) {
         // Header mapping v5: Tanggal, Ref, Tipe, Gudang, Partner, SKU, Nama, Qty, Satuan, Keterangan
         results.push(processSheet("Mutasi GudangPro", contents.transactions, ["Tanggal", "Ref No", "Tipe", "Gudang", "Partner", "Kode", "Nama", "Qty", "Satuan", "Keterangan"]));
      }
      
      // 2. Process Rejects (Sheet: Laporan Reject)
      if (contents.rejects && contents.rejects.length > 0) {
         results.push(processSheet("Laporan Reject", contents.rejects, ["Tanggal", "ID Aggregasi", "SKU", "Nama Barang", "Total Base Qty", "Base Unit", "Alasan"]));
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: "success", details: results})).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Invalid action version"}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Generic Function to Append Data with Deduplication
function processSheet(sheetName, newRows, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  // Create Sheet if not exists
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setBackground("#335157").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  
  var lastRow = sheet.getLastRow();
  var existingIds = [];
  
  // Get existing IDs (Column B is always the unique key: RefNo or AggID)
  if (lastRow > 1) {
     var data = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); 
     existingIds = data.flat().map(String); 
  }
  
  // Filter duplicates
  var uniqueRows = [];
  for (var i = 0; i < newRows.length; i++) {
     var id = String(newRows[i][1]); // Index 1 is the Key
     if (existingIds.indexOf(id) === -1) {
        uniqueRows.push(newRows[i]);
     }
  }
  
  // Append
  if (uniqueRows.length > 0) {
    sheet.getRange(lastRow + 1, 1, uniqueRows.length, uniqueRows[0].length).setValues(uniqueRows);
  }
  
  return sheetName + ": Added " + uniqueRows.length + " rows";
}`;

    const refreshData = async () => {
        setIsLoading(true);
        try {
            const [whs, pts, usrs] = await Promise.all([
                StorageService.fetchWarehouses().catch(() => []),
                StorageService.fetchPartners().catch(() => []),
                StorageService.fetchUsers().catch(() => [])
            ]);
            const mappedUsers = (Array.isArray(usrs) ? usrs : []).map((u: any) => ({
                ...u, isActive: u.status === 'ACTIVE'
            }));
            setWarehouses(Array.isArray(whs) ? whs : []);
            setPartners(Array.isArray(pts) ? pts : []);
            setUsers(mappedUsers);
        } catch (e) {
            console.error("Fetch Settings Error", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'EXTERNAL_SYNC') {
            StorageService.fetchSystemConfig('gsheet_url').then(url => setScriptUrl(url));
        }
    }, [activeTab]);

    useEffect(() => { refreshData(); }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus data secara permanen dari Database?')) return;
        try {
            if (activeTab === 'WAREHOUSE') await StorageService.deleteWarehouse(id);
            else if (activeTab === 'USERS') await StorageService.deleteUser(id);
            else await StorageService.deletePartner(id);
            showToast("Berhasil dihapus dari server", "success");
            refreshData();
        } catch (e) { showToast("Gagal menghapus data", "error"); }
    };

    const handleSave = async (data: any) => {
        try {
            const payload = { ...data, id: data.id || crypto.randomUUID() };
            if (activeTab === 'USERS') {
                payload.status = data.isActive ? 'ACTIVE' : 'INACTIVE';
                await StorageService.saveUser(payload);
            } 
            else if (activeTab === 'WAREHOUSE') {
                payload.isActive = data.isActive === undefined ? true : data.isActive;
                await StorageService.saveWarehouse(payload);
            }
            else {
                payload.isActive = data.isActive === undefined ? true : data.isActive;
                await StorageService.savePartner({ ...payload, type: activeTab as any });
            }
            showToast("Tersimpan ke MySQL Database", "success");
            setShowModal(false); refreshData();
        } catch (e) { showToast("Gagal menyimpan ke server", "error"); }
    };

    const handleSaveScriptUrl = async () => {
        if (!scriptUrl.trim()) return;
        try {
            await StorageService.saveSystemConfig('gsheet_url', scriptUrl.trim());
            showToast("URL Google Script disimpan ke Database", "success");
        } catch (e) { showToast("Gagal menyimpan URL", "error"); }
    };

    const handleStartSync = async () => {
        if (!scriptUrl) return showToast("Masukkan Script URL terlebih dahulu", "warning");
        setIsSyncing(true);
        try {
            await StorageService.saveSystemConfig('gsheet_url', scriptUrl.trim());
            await StorageService.syncToGoogleSheets(scriptUrl, syncStart, syncEnd);
            showToast("Sync Selesai. Cek Sheet 'Mutasi' dan 'Reject'.", "success");
        } catch (e: any) {
            showToast("Gagal Sync. Pastikan script V5.0 sudah di-update.", "error");
        } finally {
            setIsSyncing(false);
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

    // --- TAB COMPONENT ---
    const TabBtn = ({ active, onClick, icon, label, count }: any) => (
        <button 
            onClick={onClick} 
            className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all ${
                active 
                ? 'bg-brand/10 text-brand' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
        >
            <div className="flex items-center gap-3">
                {icon} <span className="tracking-tight">{label}</span>
            </div>
            {count !== undefined && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] text-slate-400">{count}</span>}
        </button>
    );

    return (
        <div className="flex h-full bg-[#f8fafc] font-sans">
            {/* 1. SIDEBAR */}
            <div className="w-60 bg-white border-r border-slate-200 flex flex-col p-4 shadow-sm z-10">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Data Master</div>
                <div className="space-y-1">
                    <TabBtn active={activeTab === 'WAREHOUSE'} onClick={() => setActiveTab('WAREHOUSE')} icon={<Building2 size={16}/>} label="Gudang" count={warehouses.length} />
                    <TabBtn active={activeTab === 'SUPPLIER'} onClick={() => setActiveTab('SUPPLIER')} icon={<Users size={16}/>} label="Supplier" count={partners.filter(p=>p.type==='SUPPLIER').length} />
                    <TabBtn active={activeTab === 'CUSTOMER'} onClick={() => setActiveTab('CUSTOMER')} icon={<Users size={16}/>} label="Customer" count={partners.filter(p=>p.type==='CUSTOMER').length} />
                </div>
                
                <div className="mt-8 text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Keamanan</div>
                <div className="space-y-1">
                    <TabBtn active={activeTab === 'USERS'} onClick={() => setActiveTab('USERS')} icon={<UserCircle size={16}/>} label="Pengguna" count={users.length} />
                </div>

                <div className="mt-8 text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Integrasi</div>
                <div className="space-y-1">
                    <TabBtn active={activeTab === 'EXTERNAL_SYNC'} onClick={() => setActiveTab('EXTERNAL_SYNC')} icon={<Share2 size={16}/>} label="Google Sync" />
                </div>
            </div>

            {/* 2. MAIN CONTENT */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
                {activeTab !== 'EXTERNAL_SYNC' ? (
                    <div className="p-6 h-full flex flex-col">
                        {/* HEADER TOOLBAR */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Cari data..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium w-64 outline-none focus:border-brand focus:ring-2 focus:ring-brand/5 transition-all shadow-sm" 
                                />
                            </div>
                            <button onClick={() => { setEditData({ isActive: true }); setShowModal(true); }} className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm hover:bg-brand/90 transition-all active:scale-95">
                                <Plus size={16}/> Tambah Baru
                            </button>
                        </div>

                        {/* DATA TABLE */}
                        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-xl shadow-sm">
                            {isLoading ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <Loader2 className="animate-spin mb-2 text-brand" size={24}/>
                                    <span className="text-xs font-medium">Memuat data...</span>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 w-12 text-center">No</th>
                                            <th className="px-4 py-3">Informasi Utama</th>
                                            <th className="px-4 py-3">Kontak / Detail</th>
                                            <th className="px-4 py-3 text-center w-24">Status</th>
                                            <th className="px-4 py-3 text-center w-20">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {filteredData().map((item: any, idx) => (
                                            <tr key={item.id} className={`hover:bg-slate-50 transition-colors group ${!item.isActive ? 'bg-slate-50/50' : ''}`}>
                                                <td className="px-4 py-2 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                                                <td className="px-4 py-2">
                                                    <div className={`font-semibold ${!item.isActive ? 'text-slate-400' : 'text-slate-700'}`}>{item.name}</div>
                                                    {/* Location / Role Subtext */}
                                                    {(item.location || item.role || item.address) && (
                                                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                                            {activeTab === 'WAREHOUSE' && <MapPin size={10}/>}
                                                            {activeTab === 'USERS' && <Key size={10}/>}
                                                            {item.location || item.role || item.address}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex flex-col gap-0.5">
                                                        {item.phone && (
                                                            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                                                <Phone size={10} className="text-slate-400"/> {item.phone}
                                                            </div>
                                                        )}
                                                        {item.username && (
                                                            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-mono">
                                                                <span className="text-slate-300">@</span>{item.username}
                                                            </div>
                                                        )}
                                                        {item.email && (
                                                            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                                                <Mail size={10} className="text-slate-400"/> {item.email}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                                        item.isActive 
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                        : 'bg-slate-100 text-slate-400 border-slate-200'
                                                    }`}>
                                                        {item.isActive ? 'Aktif' : 'Nonaktif'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setEditData(item); setShowModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit3 size={14}/></button>
                                                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 size={14}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                ) : (
                    /* GOOGLE SYNC TAB */
                    <div className="flex-1 overflow-auto p-8">
                         <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100"><FileSpreadsheet size={24}/></div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Google Sync V5</h3>
                                        <p className="text-xs text-slate-500 font-medium">Enterprise Multi-Sheet Synchronization</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-600">Web App Script URL</label>
                                        <div className="flex gap-2">
                                            <input type="text" className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 text-slate-700 placeholder:text-slate-400" value={scriptUrl} onChange={e => setScriptUrl(e.target.value)} placeholder="https://script.google.com/..." />
                                            <button onClick={handleSaveScriptUrl} className="px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition-colors" title="Simpan URL"><Save size={16}/></button>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-600">Filter Periode</label>
                                        <div className="flex gap-3">
                                            <div className="flex-1 relative">
                                                <input type="date" value={syncStart} onChange={e => setSyncStart(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none" />
                                                <span className="absolute -top-2 left-2 bg-white px-1 text-[9px] text-slate-400 font-bold">START</span>
                                            </div>
                                            <div className="flex-1 relative">
                                                <input type="date" value={syncEnd} onChange={e => setSyncEnd(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none" />
                                                <span className="absolute -top-2 left-2 bg-white px-1 text-[9px] text-slate-400 font-bold">END</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button onClick={handleStartSync} disabled={isSyncing} className="w-full py-3 bg-brand hover:bg-brand/90 text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 mt-2">
                                        {isSyncing ? <Loader2 size={16} className="animate-spin"/> : <Share2 size={16} />} 
                                        {isSyncing ? 'MENGIRIM DATA...' : 'MULAI SINKRONISASI'}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-2xl border border-slate-800 flex flex-col h-[500px] shadow-xl overflow-hidden">
                                <div className="p-3 bg-slate-950 flex justify-between items-center border-b border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2">Apps Script Code (V5.0)</span>
                                    <button onClick={() => { navigator.clipboard.writeText(GS_CODE_BOILERPLATE); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-bold text-slate-300 flex items-center gap-2 border border-slate-700 transition-colors">
                                        {copied ? <Check size={12} className="text-emerald-400"/> : <Copy size={12}/>} {copied ? 'COPIED' : 'COPY'}
                                    </button>
                                </div>
                                <pre className="flex-1 overflow-auto p-4 font-mono text-[10px] text-emerald-400/90 leading-relaxed scrollbar-hide bg-slate-900 selection:bg-emerald-900 selection:text-white">{GS_CODE_BOILERPLATE}</pre>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden animate-in zoom-in-95">
                        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-sm text-slate-800">
                                {editData.id ? 'Edit' : 'Tambah'} {activeTab === 'USERS' ? 'Pengguna' : activeTab === 'WAREHOUSE' ? 'Gudang' : 'Partner'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-rose-500 rounded-full p-1 hover:bg-rose-50"><X size={18}/></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSave(editData); }} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600">Nama Lengkap / Instansi</label>
                                <input required className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} />
                            </div>
                            
                            {activeTab === 'USERS' && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">Username Login</label>
                                        <input required className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-mono text-slate-800 outline-none focus:border-brand" value={editData.username || ''} onChange={e => setEditData({...editData, username: e.target.value})} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">Password</label>
                                        <div className="relative">
                                            <input 
                                                type="password" 
                                                placeholder={editData.id ? "Kosongkan jika tetap" : "Password baru"}
                                                className="w-full p-2.5 pl-9 border border-slate-300 rounded-lg text-sm font-medium outline-none focus:border-brand" 
                                                value={editData.password || ''} 
                                                onChange={e => setEditData({...editData, password: e.target.value})} 
                                            />
                                            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600">{activeTab === 'WAREHOUSE' ? 'Lokasi' : 'No. Telepon'}</label>
                                <input className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-medium outline-none focus:border-brand" value={activeTab === 'WAREHOUSE' ? (editData.location || '') : (editData.phone || '')} onChange={e => setEditData({...editData, [activeTab === 'WAREHOUSE' ? 'location' : 'phone']: e.target.value})} />
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer hover:bg-white transition-colors">
                                    <span className="text-xs font-bold text-slate-600">Status Aktif</span>
                                    <div onClick={() => setEditData({...editData, isActive: !(editData.isActive !== false)})} className={`transition-colors ${editData.isActive !== false ? 'text-emerald-500' : 'text-slate-300'}`}>
                                        {editData.isActive !== false ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
                                    </div>
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Batal</button>
                                <button type="submit" className="px-6 py-2 bg-brand text-white rounded-lg text-xs font-bold shadow-sm hover:bg-brand/90 transition-all">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
