
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Warehouse, Partner, AppUser } from '../types';
import { Plus, Edit3, Trash2, Search, Building2, UserCircle, Save, X, Phone, Loader2, Share2, FileSpreadsheet, Calendar, Link as LinkIcon, Code, Copy, Check, Users } from 'lucide-react';
import { useToast } from './Toast';

type SettingsTab = 'WAREHOUSE' | 'SUPPLIER' | 'CUSTOMER' | 'USERS' | 'EXTERNAL_SYNC';

const TabBtn = ({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) => (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-3 w-full p-3 rounded-xl text-xs font-bold transition-all ${
        active 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
          : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600'
      }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

const DenseRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tr className="hover:bg-blue-50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
    {children}
  </tr>
);

const DenseCell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <td className={`p-3 text-xs text-slate-600 dark:text-slate-400 ${className}`}>
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

    const filteredData = () => {
        let data: any[] = [];
        if (activeTab === 'WAREHOUSE') data = warehouses;
        else if (activeTab === 'USERS') data = users;
        else data = partners.filter(p => p.type === activeTab);

        if (!searchTerm) return data;
        const lower = searchTerm.toLowerCase();
        return data.filter(item => 
            (item.name && item.name.toLowerCase().includes(lower)) ||
            (item.username && item.username.toLowerCase().includes(lower)) ||
            (item.location && item.location.toLowerCase().includes(lower)) ||
            (item.address && item.address.toLowerCase().includes(lower))
        );
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus?')) return;
        try {
            if (activeTab === 'WAREHOUSE') await StorageService.deleteWarehouse(id);
            else if (activeTab === 'USERS') await StorageService.deleteUser(id);
            else await StorageService.deletePartner(id);
            showToast("Hapus berhasil", "success");
            refreshData();
        } catch (e) { showToast("Gagal", "error"); }
    };

    const handleSave = async (data: any) => {
        try {
            const payload = { ...data, id: data.id || crypto.randomUUID() };
            if (activeTab === 'WAREHOUSE') await StorageService.saveWarehouse(payload);
            else if (activeTab === 'USERS') await StorageService.saveUser({ ...payload, status: 'ACTIVE' });
            else await StorageService.savePartner({ ...payload, type: activeTab as any });
            showToast("Simpan berhasil", "success");
            setShowModal(false); 
            refreshData();
        } catch (e) { showToast("Gagal", "error"); }
    };

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-950 transition-colors">
            <div className="w-56 bg-white dark:bg-slate-900 border-r dark:border-slate-800 flex flex-col p-2 gap-1 shadow-inner">
                <div className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-slate-800 mb-2">Sistem</div>
                <TabBtn active={activeTab === 'WAREHOUSE'} onClick={() => setActiveTab('WAREHOUSE')} icon={<Building2 size={16}/>} label="Warehouses" />
                <TabBtn active={activeTab === 'SUPPLIER'} onClick={() => setActiveTab('SUPPLIER')} icon={<Users size={16}/>} label="Suppliers" />
                <TabBtn active={activeTab === 'CUSTOMER'} onClick={() => setActiveTab('CUSTOMER')} icon={<Users size={16}/>} label="Customers" />
                <TabBtn active={activeTab === 'USERS'} onClick={() => setActiveTab('USERS')} icon={<UserCircle size={16}/>} label="Users" />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex justify-between items-center shadow-sm">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input type="text" placeholder="" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-1.5 border dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 w-64 dark:bg-slate-800" />
                    </div>
                    <button onClick={() => { setEditData({}); setShowModal(true); }} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95">
                        <Plus size={16}/> Tambah
                    </button>
                </div>
                <div className="flex-1 overflow-auto p-6">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold tracking-[0.2em] animate-pulse"><Loader2 className="animate-spin mr-2"/> Sync...</div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500 border-b dark:border-slate-700">
                                    <tr>
                                        <th className="p-4 w-12 text-center">#</th>
                                        <th className="p-4">Nama</th>
                                        <th className="p-4">Kontak</th>
                                        <th className="p-4 w-24 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-800">
                                    {filteredData().map((item: any, idx) => (
                                        <DenseRow key={item.id}>
                                            <DenseCell className="text-center font-mono opacity-40">{idx + 1}</DenseCell>
                                            <DenseCell>
                                                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{item.name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{item.location || item.role || item.address}</div>
                                            </DenseCell>
                                            <DenseCell>
                                                <div className="flex flex-col gap-1">
                                                    {item.phone && <span className="flex items-center gap-2"><Phone size={10} className="text-blue-500"/> {item.phone}</span>}
                                                    {item.username && <span className="text-blue-600 dark:text-blue-400 font-mono text-[10px] bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded w-fit">@{item.username}</span>}
                                                </div>
                                            </DenseCell>
                                            <DenseCell className="text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => { setEditData(item); setShowModal(true); }} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"><Edit3 size={16}/></button>
                                                    <button onClick={() => handleDelete(item.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
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

            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-sm border dark:border-slate-800 overflow-hidden border-t-8 border-t-blue-600">
                        <div className="p-5 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                            <h3 className="font-black text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                {editData.id ? 'Perbarui' : 'Registrasi'}
                            </h3>
                            <button onClick={() => setShowModal(false)}><X size={20}/></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSave(editData); }} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Nama</label>
                                <input required className="w-full p-3 border dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 font-bold" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} />
                            </div>
                            {activeTab === 'USERS' && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Username</label>
                                    <input required className="w-full p-3 border dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 font-mono font-bold text-blue-600" value={editData.username || ''} onChange={e => setEditData({...editData, username: e.target.value})} />
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">{activeTab === 'WAREHOUSE' ? 'Lokasi' : 'No. Telp'}</label>
                                <input className="w-full p-3 border dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800" value={activeTab === 'WAREHOUSE' ? (editData.location || '') : (editData.phone || '')} onChange={e => setEditData({...editData, [activeTab === 'WAREHOUSE' ? 'location' : 'phone']: e.target.value})} />
                            </div>
                            <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-800 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 text-xs font-black text-slate-400 uppercase">Batal</button>
                                <button type="submit" className="px-10 py-3 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/30 uppercase tracking-widest active:scale-95 transition-all">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
