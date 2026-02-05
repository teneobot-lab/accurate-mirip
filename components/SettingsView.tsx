
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Warehouse, Partner, AppUser } from '../types';
import { Plus, Edit3, Trash2, Search, Building2, UserCircle, Save, X, Phone, Loader2, Share2, FileSpreadsheet, Calendar, Link as LinkIcon, Code, Copy, Check, Users, ToggleLeft, ToggleRight, Lock } from 'lucide-react';
import { useToast } from './Toast';

type SettingsTab = 'WAREHOUSE' | 'SUPPLIER' | 'CUSTOMER' | 'USERS' | 'EXTERNAL_SYNC';

const DenseRow: React.FC<{ children: React.ReactNode; inactive?: boolean }> = ({ children, inactive }) => (
  <tr className={`hover:bg-spectra/20 transition-colors border-b border-spectra/30 group ${inactive ? 'opacity-50' : ''}`}>
    {children}
  </tr>
);

const DenseCell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <td className={`px-4 py-2.5 text-xs text-slate-300 ${className}`}>
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

    const [scriptUrl, setScriptUrl] = useState('');
    const [syncStart, setSyncStart] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
    const [syncEnd, setSyncEnd] = useState(new Date().toISOString().split('T')[0]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [copied, setCopied] = useState(false);

    // --- UPDATED GAS CODE FOR IDEMPOTENCY ---
    const GS_CODE_BOILERPLATE = `/**
 * GudangPro - Google Sheets Connector v3.0 (Smart Sync)
 * Features: Auto-Date, Deduplication (Idempotency)
 */
function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    
    if (contents.action === "APPEND_ROWS") {
      var sheet = setupSheet();
      var newRows = contents.rows; // Data sent from App
      var addedCount = 0;
      
      // 1. Get Existing Reference Numbers (Column B) to prevent duplicates
      var lastRow = sheet.getLastRow();
      var existingRefs = [];
      if (lastRow > 1) {
         // Ambil semua data di kolom ke-2 (Ref No)
         var refData = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); 
         existingRefs = refData.flat().map(String); 
      }
      
      // 2. Filter Rows: Only add if Ref No (Index 1) is NOT in existingRefs
      var uniqueRows = [];
      for (var i = 0; i < newRows.length; i++) {
         var rowRef = String(newRows[i][1]); // Index 1 is Ref No
         if (existingRefs.indexOf(rowRef) === -1) {
            uniqueRows.push(newRows[i]);
         }
      }
      
      // 3. Batch Append
      if (uniqueRows.length > 0) {
        sheet.getRange(lastRow + 1, 1, uniqueRows.length, uniqueRows[0].length).setValues(uniqueRows);
        addedCount = uniqueRows.length;
      }
      
      return ContentService.createTextOutput(JSON.stringify({
          status: "success", 
          total_received: newRows.length,
          added: addedCount,
          message: addedCount + " new rows added. " + (newRows.length - addedCount) + " duplicates skipped."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Invalid action"}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = "Mutasi GudangPro";
  var sheet = ss.getSheetByName(name);
  
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Header Row
    var h = ["Tanggal", "Ref No", "Tipe", "Kode", "Nama", "Qty", "Satuan", "Ket"];
    sheet.appendRow(h);
    
    // Styling
    var range = sheet.getRange(1, 1, 1, h.length);
    range.setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}`;

    const refreshData = async () => {
        setIsLoading(true);
        try {
            const [whs, pts, usrs] = await Promise.all([
                StorageService.fetchWarehouses().catch(() => []),
                StorageService.fetchPartners().catch(() => []),
                StorageService.fetchUsers().catch(() => [])
            ]);
            
            // Ensure consistency in frontend state
            const mappedUsers = (Array.isArray(usrs) ? usrs : []).map((u: any) => ({
                ...u,
                isActive: u.status === 'ACTIVE' // Normalize for UI toggle
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

    // Load Config separately to not block main UI
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
            
            // Handling Status & Password logic based on Type
            if (activeTab === 'USERS') {
                payload.status = data.isActive ? 'ACTIVE' : 'INACTIVE';
                // Password sent automatically if present in 'data'
                await StorageService.saveUser(payload);
            } 
            else if (activeTab === 'WAREHOUSE') {
                payload.isActive = data.isActive === undefined ? true : data.isActive;
                await StorageService.saveWarehouse(payload);
            }
            else {
                // Partners
                payload.isActive = data.isActive === undefined ? true : data.isActive;
                await StorageService.savePartner({ ...payload, type: activeTab as any });
            }
            
            showToast("Tersimpan ke MySQL Database", "success");
            setShowModal(false); 
            refreshData();
        } catch (e) { showToast("Gagal menyimpan ke server", "error"); }
    };

    const handleSaveScriptUrl = async () => {
        if (!scriptUrl.trim()) return;
        try {
            await StorageService.saveSystemConfig('gsheet_url', scriptUrl.trim());
            showToast("URL Google Script disimpan ke Database", "success");
        } catch (e) {
            showToast("Gagal menyimpan URL", "error");
        }
    };

    const handleStartSync = async () => {
        if (!scriptUrl) return showToast("Masukkan Script URL terlebih dahulu", "warning");
        setIsSyncing(true);
        try {
            // Save URL first just in case
            await StorageService.saveSystemConfig('gsheet_url', scriptUrl.trim());
            
            await StorageService.syncToGoogleSheets(scriptUrl, syncStart, syncEnd);
            showToast("Sync Selesai. Cek Spreadsheet Anda.", "success");
        } catch (e: any) {
            console.error(e);
            showToast("Gagal Sync. Pastikan URL benar & Deployment mode 'Web App'", "error");
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

    return (
        <div className="flex h-full bg-daintree transition-colors font-sans">
            {/* Sidebar Tab */}
            <div className="w-60 bg-gable border-r border-spectra flex flex-col p-3 gap-1 shadow-lg z-10">
                <div className="p-3 text-[10px] font-black text-cutty uppercase tracking-widest border-b border-spectra mb-3">Konfigurasi Sistem</div>
                <TabBtn active={activeTab === 'WAREHOUSE'} onClick={() => setActiveTab('WAREHOUSE')} icon={<Building2 size={16}/>} label="Warehouses" />
                <TabBtn active={activeTab === 'SUPPLIER'} onClick={() => setActiveTab('SUPPLIER')} icon={<Users size={16}/>} label="Suppliers" />
                <TabBtn active={activeTab === 'CUSTOMER'} onClick={() => setActiveTab('CUSTOMER')} icon={<Users size={16}/>} label="Customers" />
                <TabBtn active={activeTab === 'USERS'} onClick={() => setActiveTab('USERS')} icon={<UserCircle size={16}/>} label="User Access" />
                <div className="mt-6 p-3 text-[10px] font-black text-cutty uppercase tracking-widest border-b border-spectra mb-2">Eksternal</div>
                <TabBtn active={activeTab === 'EXTERNAL_SYNC'} onClick={() => setActiveTab('EXTERNAL_SYNC')} icon={<Share2 size={16}/>} label="Google Sync" />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-daintree">
                {activeTab !== 'EXTERNAL_SYNC' ? (
                    <div className="p-6 h-full flex flex-col">
                        <div className="bg-gable p-4 rounded-xl border border-spectra flex justify-between items-center shadow-sm mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cutty" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Cari data..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    className="pl-10 pr-4 py-2.5 bg-daintree border border-spectra rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-spectra w-72 transition-all placeholder:text-slate-500 text-white" 
                                />
                            </div>
                            <button onClick={() => { setEditData({ isActive: true }); setShowModal(true); }} className="px-6 py-2.5 bg-spectra hover:bg-daintree text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-black/20 transition-all active:scale-95 border border-spectra">
                                <Plus size={18}/> Tambah Baru
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            {isLoading ? (
                                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold tracking-[0.2em] animate-pulse"><Loader2 className="animate-spin mr-2"/> Sinkronisasi MySQL...</div>
                            ) : (
                                <div className="bg-gable border border-spectra rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-daintree text-[10px] font-black uppercase text-cutty border-b border-spectra tracking-wider sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-2.5 w-12 text-center">#</th>
                                                <th className="px-4 py-2.5">Informasi Master</th>
                                                <th className="px-4 py-2.5">Kontak / Kredensial</th>
                                                <th className="px-4 py-2.5 text-center">Status</th>
                                                <th className="px-4 py-2.5 w-24 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-spectra/30 bg-gable">
                                            {filteredData().map((item: any, idx) => (
                                                <DenseRow key={item.id} inactive={!item.isActive}>
                                                    <DenseCell className="text-center font-mono opacity-40">{idx + 1}</DenseCell>
                                                    <DenseCell>
                                                        <div className="font-bold text-white text-sm mb-0.5">{item.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-cutty"></div>
                                                            {item.location || item.role || item.address || 'No Location Set'}
                                                        </div>
                                                    </DenseCell>
                                                    <DenseCell>
                                                        <div className="flex flex-col gap-1">
                                                            {item.phone && <span className="flex items-center gap-2 font-medium text-slate-400"><Phone size={12} className="text-spectra"/> {item.phone}</span>}
                                                            {item.username && <span className="text-cutty font-mono text-[10px] bg-daintree px-2 py-0.5 rounded w-fit border border-spectra">@{item.username}</span>}
                                                        </div>
                                                    </DenseCell>
                                                    <DenseCell className="text-center">
                                                        {item.isActive ? 
                                                            <span className="text-[9px] font-black text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-900/50">AKTIF</span> : 
                                                            <span className="text-[9px] font-black text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">NONAKTIF</span>
                                                        }
                                                    </DenseCell>
                                                    <DenseCell className="text-center">
                                                        <div className="flex justify-center gap-2">
                                                            <button onClick={() => { setEditData(item); setShowModal(true); }} className="p-1.5 text-slate-400 hover:text-spectra hover:bg-spectra/10 rounded-lg transition-colors"><Edit3 size={16}/></button>
                                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                                        </div>
                                                    </DenseCell>
                                                </DenseRow>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* EXTERNAL SYNC VIEW */
                    <div className="flex-1 overflow-auto p-8 bg-daintree">
                         <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-gable p-8 rounded-[24px] shadow-sm border border-spectra space-y-6">
                                <div className="flex items-center gap-5 mb-4">
                                    <div className="p-4 bg-emerald-900/30 rounded-2xl text-emerald-400 shadow-inner border border-emerald-900"><FileSpreadsheet size={32}/></div>
                                    <div><h3 className="text-xl font-black text-white">Google Sync</h3><p className="text-xs text-cutty font-bold uppercase tracking-wider">Tabular Row Export</p></div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-cutty uppercase tracking-widest ml-1">Web App Script URL</label>
                                        <div className="flex gap-2">
                                            <input type="text" className="w-full p-3 bg-daintree border border-spectra rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-spectra text-white" value={scriptUrl} onChange={e => setScriptUrl(e.target.value)} placeholder="https://script.google.com/..." />
                                            <button onClick={handleSaveScriptUrl} className="p-3 bg-daintree border border-spectra rounded-xl hover:bg-spectra/20 text-white" title="Simpan URL ke Database"><Save size={16}/></button>
                                        </div>
                                    </div>
                                    
                                    {/* Date Range Filter for Sync */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-cutty uppercase tracking-widest ml-1">Filter Periode Data</label>
                                        <div className="flex gap-3">
                                            <div className="flex-1 relative">
                                                <input type="date" value={syncStart} onChange={e => setSyncStart(e.target.value)} className="w-full p-3 bg-daintree border border-spectra rounded-xl text-xs font-bold text-white outline-none" />
                                                <span className="absolute -top-2 left-2 bg-gable px-1 text-[9px] text-slate-500 font-bold">START</span>
                                            </div>
                                            <div className="flex-1 relative">
                                                <input type="date" value={syncEnd} onChange={e => setSyncEnd(e.target.value)} className="w-full p-3 bg-daintree border border-spectra rounded-xl text-xs font-bold text-white outline-none" />
                                                <span className="absolute -top-2 left-2 bg-gable px-1 text-[9px] text-slate-500 font-bold">END</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button onClick={handleStartSync} disabled={isSyncing} className="w-full py-4 bg-spectra hover:bg-gable text-white rounded-xl font-black text-sm shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 border border-spectra/50 disabled:opacity-50">
                                        {isSyncing ? <Loader2 size={20} className="animate-spin"/> : <Share2 size={20} />} 
                                        {isSyncing ? 'MENGIRIM DATA...' : 'MULAI SINKRONISASI'}
                                    </button>
                                    <p className="text-[10px] text-center text-slate-500 italic mt-2">
                                        Note: Transaksi & Reject akan digabungkan. Data yang sudah ada (Ref No sama) tidak akan diduplikat.
                                    </p>
                                </div>
                            </div>
                            <div className="bg-daintree rounded-[24px] border border-spectra flex flex-col h-[500px] shadow-2xl overflow-hidden">
                                <div className="p-4 bg-gable flex justify-between items-center border-b border-spectra">
                                    <span className="text-[10px] font-black text-cutty uppercase tracking-widest">Google Apps Script Snippet</span>
                                    <button onClick={() => { navigator.clipboard.writeText(GS_CODE_BOILERPLATE); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="px-4 py-1.5 bg-spectra/20 hover:bg-spectra/50 rounded-lg text-[10px] font-black text-white flex items-center gap-2 border border-spectra transition-colors">
                                        {copied ? <Check size={14} className="text-emerald-400"/> : <Copy size={14}/>} {copied ? 'COPIED' : 'COPY CODE'}
                                    </button>
                                </div>
                                <pre className="flex-1 overflow-auto p-5 font-mono text-[10px] text-slate-400 leading-relaxed scrollbar-hide bg-daintree">{GS_CODE_BOILERPLATE}</pre>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* CRUD MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-daintree/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-gable rounded-2xl shadow-2xl w-full max-w-sm border border-spectra overflow-hidden animate-in zoom-in-95">
                        <div className="p-5 border-b border-spectra flex justify-between items-center bg-daintree">
                            <h3 className="font-black text-xs uppercase tracking-widest text-white">
                                {editData.id ? 'Perbarui' : 'Registrasi'} {activeTab}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSave(editData); }} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-cutty uppercase ml-1">Nama Lengkap / Instansi</label>
                                <input required className="w-full p-3 border border-spectra rounded-xl text-sm bg-daintree font-bold text-white outline-none focus:ring-2 focus:ring-spectra" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} />
                            </div>
                            
                            {activeTab === 'USERS' && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-cutty uppercase ml-1">Username Login</label>
                                        <input required className="w-full p-3 border border-spectra rounded-xl text-sm bg-daintree font-mono font-bold text-spectra text-white outline-none focus:ring-2 focus:ring-spectra" value={editData.username || ''} onChange={e => setEditData({...editData, username: e.target.value})} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-cutty uppercase ml-1">Password</label>
                                        <div className="relative">
                                            <input 
                                                type="password" 
                                                placeholder={editData.id ? "Biarkan kosong jika tidak diubah" : "Password baru"}
                                                className="w-full p-3 border border-spectra rounded-xl text-sm bg-daintree font-bold text-white outline-none focus:ring-2 focus:ring-spectra pl-10" 
                                                value={editData.password || ''} 
                                                onChange={e => setEditData({...editData, password: e.target.value})} 
                                            />
                                            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cutty"/>
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-cutty uppercase ml-1">{activeTab === 'WAREHOUSE' ? 'Lokasi' : 'No. Telepon'}</label>
                                <input className="w-full p-3 border border-spectra rounded-xl text-sm bg-daintree text-white outline-none focus:ring-2 focus:ring-spectra" value={activeTab === 'WAREHOUSE' ? (editData.location || '') : (editData.phone || '')} onChange={e => setEditData({...editData, [activeTab === 'WAREHOUSE' ? 'location' : 'phone']: e.target.value})} />
                            </div>

                            {/* Active Status Toggle for All Entity Types */}
                            <div className="space-y-1.5 pt-2">
                                <div className="flex items-center justify-between bg-daintree p-3 rounded-xl border border-spectra">
                                    <span className="text-[10px] font-bold text-cutty uppercase">Status {activeTab}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold uppercase ${editData.isActive !== false ? 'text-emerald-400' : 'text-slate-500'}`}>
                                            {editData.isActive !== false ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                        <button 
                                            type="button"
                                            onClick={() => setEditData({...editData, isActive: !(editData.isActive !== false)})} 
                                            className={`transition-colors ${editData.isActive !== false ? 'text-emerald-400' : 'text-slate-500'}`}
                                        >
                                            {editData.isActive !== false ? <ToggleRight size={24}/> : <ToggleLeft size={24}/>}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-spectra mt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 text-xs font-bold text-slate-400 uppercase hover:text-white">Batal</button>
                                <button type="submit" className="px-8 py-2.5 bg-spectra hover:bg-daintree text-white rounded-xl text-xs font-bold shadow-lg shadow-black/20 uppercase tracking-widest active:scale-95 transition-all border border-spectra">Simpan Data</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const TabBtn = ({ active, onClick, icon, label }: any) => (
    <button onClick={onClick} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${active ? 'bg-spectra text-white shadow-lg shadow-black/20 translate-x-1 border border-spectra/50' : 'text-slate-400 hover:bg-daintree hover:text-white border border-transparent'}`}>
        {icon} {label}
    </button>
);
