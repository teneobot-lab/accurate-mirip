
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Warehouse, Partner, AppUser } from '../types';
import { Plus, Edit3, Trash2, Search, MapPin, Users, Building2, UserCircle, Save, X, Phone, Mail, Loader2 } from 'lucide-react';
import { useToast } from './Toast';

type SettingsTab = 'WAREHOUSE' | 'SUPPLIER' | 'CUSTOMER' | 'USERS';

const DenseRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <tr className="hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors group border-b border-slate-200 dark:border-slate-800 last:border-0 text-xs text-slate-700 dark:text-slate-300">
        {children}
    </tr>
);

const DenseCell = ({ children, className = '' }: { children?: React.ReactNode, className?: string }) => (
    <td className={`p-1.5 border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${className}`}>
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
            else await StorageService.savePartner({ id: data.id || crypto.randomUUID(), type: activeTab, ...data });
            
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
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
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
