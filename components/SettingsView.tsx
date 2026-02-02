
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Warehouse, Partner, AppUser } from '../types';
import { Plus, Edit3, Trash2, Search, MapPin, Users, Building2, UserCircle, Save, X, Phone, Mail, FileText, Key } from 'lucide-react';

type SettingsTab = 'WAREHOUSE' | 'SUPPLIER' | 'CUSTOMER' | 'USERS';

// Dense Table Row Component
// Fix: Added React.FC type to handle the key prop when used in lists
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
    const [activeTab, setActiveTab] = useState<SettingsTab>('WAREHOUSE');
    
    // Data States
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [editData, setEditData] = useState<any>(null); // Polymorphic state for editing

    const refreshData = () => {
        setWarehouses(StorageService.getWarehouses());
        setPartners(StorageService.getPartners());
        setUsers(StorageService.getUsers());
    };

    useEffect(() => {
        refreshData();
    }, []);

    const handleDelete = (id: string, type: 'WH' | 'PARTNER' | 'USER') => {
        if (!confirm('Are you sure you want to delete this record?')) return;
        
        if (type === 'WH') StorageService.deleteWarehouse(id);
        if (type === 'PARTNER') StorageService.deletePartner(id);
        if (type === 'USER') StorageService.deleteUser(id);
        
        refreshData();
    };

    const handleSave = (data: any) => {
        if (activeTab === 'WAREHOUSE') {
            const payload: Warehouse = {
                id: data.id || crypto.randomUUID(),
                name: data.name,
                location: data.location,
                phone: data.phone,
                pic: data.pic
            };
            StorageService.saveWarehouse(payload);
        } else if (activeTab === 'SUPPLIER' || activeTab === 'CUSTOMER') {
            const payload: Partner = {
                id: data.id || crypto.randomUUID(),
                type: activeTab,
                name: data.name,
                phone: data.phone,
                email: data.email,
                address: data.address,
                npwp: data.npwp,
                term: Number(data.term) || 0
            };
            StorageService.savePartner(payload);
        } else if (activeTab === 'USERS') {
            const payload: AppUser = {
                id: data.id || crypto.randomUUID(),
                name: data.name,
                username: data.username,
                password: data.password, // Saving password for login
                email: data.email,
                role: data.role,
                status: data.status || 'ACTIVE'
            };
            StorageService.saveUser(payload);
        }
        setShowModal(false);
        setEditData(null);
        refreshData();
    };

    // Filter Logic
    const filteredData = () => {
        const lower = searchTerm.toLowerCase();
        if (activeTab === 'WAREHOUSE') {
            return warehouses.filter(w => w.name.toLowerCase().includes(lower) || w.location.toLowerCase().includes(lower));
        }
        if (activeTab === 'SUPPLIER') {
            return partners.filter(p => p.type === 'SUPPLIER' && (p.name.toLowerCase().includes(lower) || p.phone.includes(lower)));
        }
        if (activeTab === 'CUSTOMER') {
            return partners.filter(p => p.type === 'CUSTOMER' && (p.name.toLowerCase().includes(lower) || p.phone.includes(lower)));
        }
        if (activeTab === 'USERS') {
            return users.filter(u => u.name.toLowerCase().includes(lower) || u.username.toLowerCase().includes(lower));
        }
        return [];
    };

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-950 transition-colors">
            {/* Sub Sidebar */}
            <div className="w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Configuration</h2>
                </div>
                <div className="p-2 space-y-1">
                    <button 
                        onClick={() => setActiveTab('WAREHOUSE')}
                        className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 transition-colors ${activeTab === 'WAREHOUSE' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <Building2 size={16} /> Warehouses
                    </button>
                    <button 
                        onClick={() => setActiveTab('SUPPLIER')}
                        className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 transition-colors ${activeTab === 'SUPPLIER' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <Building2 size={16} /> Suppliers
                    </button>
                    <button 
                        onClick={() => setActiveTab('CUSTOMER')}
                        className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 transition-colors ${activeTab === 'CUSTOMER' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <Users size={16} /> Customers
                    </button>
                    <button 
                        onClick={() => setActiveTab('USERS')}
                        className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 transition-colors ${activeTab === 'USERS' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <UserCircle size={16} /> User Management
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 flex justify-between items-center shadow-sm transition-colors">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                type="text" 
                                placeholder="Search data..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none w-64 bg-white dark:bg-slate-800 dark:text-slate-200"
                            />
                        </div>
                    </div>
                    <button 
                        onClick={() => { setEditData({}); setShowModal(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 shadow-sm"
                    >
                        <Plus size={16} /> Add New
                    </button>
                </div>

                {/* Dense Table */}
                <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 p-4 transition-colors">
                    <div className="border border-slate-300 dark:border-slate-700 rounded overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider sticky top-0">
                                <tr>
                                    <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-10 text-center">#</th>
                                    {activeTab === 'WAREHOUSE' && (
                                        <>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700">Warehouse Name</th>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700">Location</th>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700">PIC</th>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700">Phone</th>
                                        </>
                                    )}
                                    {(activeTab === 'SUPPLIER' || activeTab === 'CUSTOMER') && (
                                        <>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-1/4">Name</th>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700">Contact</th>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700">Address</th>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-24">NPWP</th>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-16 text-center">Term</th>
                                        </>
                                    )}
                                    {activeTab === 'USERS' && (
                                        <>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700">Full Name</th>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700">Username</th>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-32">Role</th>
                                            <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-24 text-center">Status</th>
                                        </>
                                    )}
                                    <th className="p-2 w-20 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData().map((item: any, idx) => (
                                    <DenseRow key={item.id}>
                                        <DenseCell className="text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">{idx + 1}</DenseCell>
                                        
                                        {activeTab === 'WAREHOUSE' && (
                                            <>
                                                <DenseCell><span className="font-semibold text-slate-700 dark:text-slate-200">{item.name}</span></DenseCell>
                                                <DenseCell>{item.location}</DenseCell>
                                                <DenseCell>{item.pic || '-'}</DenseCell>
                                                <DenseCell className="font-mono">{item.phone || '-'}</DenseCell>
                                            </>
                                        )}

                                        {(activeTab === 'SUPPLIER' || activeTab === 'CUSTOMER') && (
                                            <>
                                                <DenseCell><span className="font-semibold text-slate-700 dark:text-slate-200">{item.name}</span></DenseCell>
                                                <DenseCell>
                                                    <div className="flex flex-col text-[10px]">
                                                        {item.phone && <span className="flex items-center gap-1"><Phone size={8}/> {item.phone}</span>}
                                                        {item.email && <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400"><Mail size={8}/> {item.email}</span>}
                                                    </div>
                                                </DenseCell>
                                                <DenseCell><span className="truncate block max-w-xs" title={item.address}>{item.address}</span></DenseCell>
                                                <DenseCell className="font-mono">{item.npwp || '-'}</DenseCell>
                                                <DenseCell className="text-center">{item.term} Days</DenseCell>
                                            </>
                                        )}

                                        {activeTab === 'USERS' && (
                                            <>
                                                <DenseCell><span className="font-semibold text-slate-700 dark:text-slate-200">{item.name}</span></DenseCell>
                                                <DenseCell className="text-blue-600 dark:text-blue-400 font-mono font-medium">{item.username}</DenseCell>
                                                <DenseCell>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${item.role === 'ADMIN' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                                                        {item.role}
                                                    </span>
                                                </DenseCell>
                                                <DenseCell className="text-center">
                                                    <span className={`text-[10px] font-bold ${item.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{item.status}</span>
                                                </DenseCell>
                                            </>
                                        )}

                                        <DenseCell className="text-center">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => { setEditData(item); setShowModal(true); }} className="p-1 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded">
                                                    <Edit3 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(item.id, activeTab === 'WAREHOUSE' ? 'WH' : activeTab === 'USERS' ? 'USER' : 'PARTNER')} className="p-1 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30 rounded">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </DenseCell>
                                    </DenseRow>
                                ))}
                                {filteredData().length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="p-8 text-center text-slate-400 dark:text-slate-500 italic">No records found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Universal Modal Form */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-sm">
                                {editData?.id ? 'Edit' : 'Add New'} {activeTab}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={18} /></button>
                        </div>
                        
                        <form onSubmit={(e) => { e.preventDefault(); handleSave(editData); }} className="p-6 space-y-4">
                            
                            {/* WAREHOUSE FORM */}
                            {activeTab === 'WAREHOUSE' && (
                                <>
                                    <div className="grid grid-cols-1 gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Warehouse Name</label>
                                        <input required type="text" className="input-dense" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} placeholder="e.g. Gudang Pusat" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Phone</label>
                                            <input type="text" className="input-dense" value={editData.phone || ''} onChange={e => setEditData({...editData, phone: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">PIC Name</label>
                                            <input type="text" className="input-dense" value={editData.pic || ''} onChange={e => setEditData({...editData, pic: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Address / Location</label>
                                        <textarea className="input-dense" rows={3} value={editData.location || ''} onChange={e => setEditData({...editData, location: e.target.value})} />
                                    </div>
                                </>
                            )}

                            {/* PARTNER FORM */}
                            {(activeTab === 'SUPPLIER' || activeTab === 'CUSTOMER') && (
                                <>
                                    <div className="grid grid-cols-1 gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Company / Name</label>
                                        <input required type="text" className="input-dense" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Phone</label>
                                            <input required type="text" className="input-dense" value={editData.phone || ''} onChange={e => setEditData({...editData, phone: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Email</label>
                                            <input type="email" className="input-dense" value={editData.email || ''} onChange={e => setEditData({...editData, email: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">NPWP</label>
                                            <input type="text" className="input-dense" value={editData.npwp || ''} onChange={e => setEditData({...editData, npwp: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Payment Term (Days)</label>
                                            <input type="number" className="input-dense" value={editData.term || ''} onChange={e => setEditData({...editData, term: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Address</label>
                                        <textarea className="input-dense" rows={2} value={editData.address || ''} onChange={e => setEditData({...editData, address: e.target.value})} />
                                    </div>
                                </>
                            )}

                            {/* USER FORM */}
                            {activeTab === 'USERS' && (
                                <>
                                    <div className="grid grid-cols-1 gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Full Name</label>
                                        <input required type="text" className="input-dense" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} placeholder="e.g. John Doe" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Username</label>
                                            <input required type="text" className="input-dense" value={editData.username || ''} onChange={e => setEditData({...editData, username: e.target.value})} placeholder="johndoe" />
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Password</label>
                                            <input required type="text" className="input-dense" value={editData.password || ''} onChange={e => setEditData({...editData, password: e.target.value})} placeholder="Secret123" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Email (Optional)</label>
                                        <input type="email" className="input-dense" value={editData.email || ''} onChange={e => setEditData({...editData, email: e.target.value})} placeholder="john@example.com" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Role</label>
                                            <select className="input-dense" value={editData.role || 'STAFF'} onChange={e => setEditData({...editData, role: e.target.value})}>
                                                <option value="ADMIN">Administrator</option>
                                                <option value="MANAGER">Manager</option>
                                                <option value="STAFF">Staff</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Status</label>
                                            <select className="input-dense" value={editData.status || 'ACTIVE'} onChange={e => setEditData({...editData, status: e.target.value})}>
                                                <option value="ACTIVE">Active</option>
                                                <option value="INACTIVE">Inactive</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-sm font-medium">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm font-medium shadow-sm flex items-center gap-2">
                                    <Save size={16} /> Save Data
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            <style>{`
                .input-dense {
                    width: 100%;
                    border-width: 1px;
                    border-style: solid;
                    padding: 0.35rem 0.5rem;
                    font-size: 0.875rem;
                    border-radius: 0.25rem;
                    outline: none;
                }
                :global(.dark) .input-dense {
                    background-color: #1e293b;
                    border-color: #334155;
                    color: #e2e8f0;
                }
                :global(.dark) .input-dense:focus {
                     border-color: #3b82f6;
                     box-shadow: 0 0 0 1px #3b82f6;
                }
                :global(:not(.dark)) .input-dense {
                     background-color: #ffffff;
                     border-color: #cbd5e1;
                     color: #0f172a;
                }
                :global(:not(.dark)) .input-dense:focus {
                     border-color: #3b82f6;
                     box-shadow: 0 0 0 1px #3b82f6;
                }
            `}</style>
        </div>
    );
};
