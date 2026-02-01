
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Warehouse, Partner, AppUser } from '../types';
import { Plus, Edit3, Trash2, Search, MapPin, Users, Building2, UserCircle, Save, X, Phone, Mail, FileText } from 'lucide-react';

type SettingsTab = 'WAREHOUSE' | 'SUPPLIER' | 'CUSTOMER' | 'USERS';

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
            return users.filter(u => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower));
        }
        return [];
    };

    // Dense Table Row Component
    const DenseRow = ({ children }: { children: React.ReactNode }) => (
        <tr className="hover:bg-blue-50 transition-colors group border-b border-slate-200 last:border-0 text-xs text-slate-700">
            {children}
        </tr>
    );

    const DenseCell = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
        <td className={`p-1.5 border-r border-slate-100 last:border-r-0 ${className}`}>
            {children}
        </td>
    );

    return (
        <div className="flex h-full bg-slate-50">
            {/* Sub Sidebar */}
            <div className="w-56 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Configuration</h2>
                </div>
                <div className="p-2 space-y-1">
                    <button 
                        onClick={() => setActiveTab('WAREHOUSE')}
                        className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 ${activeTab === 'WAREHOUSE' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Building2 size={16} /> Warehouses
                    </button>
                    <button 
                        onClick={() => setActiveTab('SUPPLIER')}
                        className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 ${activeTab === 'SUPPLIER' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Building2 size={16} /> Suppliers
                    </button>
                    <button 
                        onClick={() => setActiveTab('CUSTOMER')}
                        className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 ${activeTab === 'CUSTOMER' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Users size={16} /> Customers
                    </button>
                    <button 
                        onClick={() => setActiveTab('USERS')}
                        className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-3 ${activeTab === 'USERS' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <UserCircle size={16} /> User Management
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="bg-white border-b border-slate-200 p-3 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                type="text" 
                                placeholder="Search data..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none w-64"
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
                <div className="flex-1 overflow-auto bg-white p-4">
                    <div className="border border-slate-300 rounded overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-100 text-slate-600 text-[11px] font-bold uppercase tracking-wider sticky top-0">
                                <tr>
                                    <th className="p-2 border-r border-slate-300 w-10 text-center">#</th>
                                    {activeTab === 'WAREHOUSE' && (
                                        <>
                                            <th className="p-2 border-r border-slate-300">Warehouse Name</th>
                                            <th className="p-2 border-r border-slate-300">Location</th>
                                            <th className="p-2 border-r border-slate-300">PIC</th>
                                            <th className="p-2 border-r border-slate-300">Phone</th>
                                        </>
                                    )}
                                    {(activeTab === 'SUPPLIER' || activeTab === 'CUSTOMER') && (
                                        <>
                                            <th className="p-2 border-r border-slate-300 w-1/4">Name</th>
                                            <th className="p-2 border-r border-slate-300">Contact</th>
                                            <th className="p-2 border-r border-slate-300">Address</th>
                                            <th className="p-2 border-r border-slate-300 w-24">NPWP</th>
                                            <th className="p-2 border-r border-slate-300 w-16 text-center">Term</th>
                                        </>
                                    )}
                                    {activeTab === 'USERS' && (
                                        <>
                                            <th className="p-2 border-r border-slate-300">Full Name</th>
                                            <th className="p-2 border-r border-slate-300">Email Login</th>
                                            <th className="p-2 border-r border-slate-300 w-32">Role</th>
                                            <th className="p-2 border-r border-slate-300 w-24 text-center">Status</th>
                                        </>
                                    )}
                                    <th className="p-2 w-20 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData().map((item: any, idx) => (
                                    <DenseRow key={item.id}>
                                        <DenseCell className="text-center text-slate-500 bg-slate-50">{idx + 1}</DenseCell>
                                        
                                        {activeTab === 'WAREHOUSE' && (
                                            <>
                                                <DenseCell><span className="font-semibold text-slate-700">{item.name}</span></DenseCell>
                                                <DenseCell>{item.location}</DenseCell>
                                                <DenseCell>{item.pic || '-'}</DenseCell>
                                                <DenseCell className="font-mono">{item.phone || '-'}</DenseCell>
                                            </>
                                        )}

                                        {(activeTab === 'SUPPLIER' || activeTab === 'CUSTOMER') && (
                                            <>
                                                <DenseCell><span className="font-semibold text-slate-700">{item.name}</span></DenseCell>
                                                <DenseCell>
                                                    <div className="flex flex-col text-[10px]">
                                                        {item.phone && <span className="flex items-center gap-1"><Phone size={8}/> {item.phone}</span>}
                                                        {item.email && <span className="flex items-center gap-1 text-blue-600"><Mail size={8}/> {item.email}</span>}
                                                    </div>
                                                </DenseCell>
                                                <DenseCell><span className="truncate block max-w-xs" title={item.address}>{item.address}</span></DenseCell>
                                                <DenseCell className="font-mono">{item.npwp || '-'}</DenseCell>
                                                <DenseCell className="text-center">{item.term} Days</DenseCell>
                                            </>
                                        )}

                                        {activeTab === 'USERS' && (
                                            <>
                                                <DenseCell><span className="font-semibold text-slate-700">{item.name}</span></DenseCell>
                                                <DenseCell className="text-blue-600">{item.email}</DenseCell>
                                                <DenseCell>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${item.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                        {item.role}
                                                    </span>
                                                </DenseCell>
                                                <DenseCell className="text-center">
                                                    <span className={`text-[10px] font-bold ${item.status === 'ACTIVE' ? 'text-emerald-600' : 'text-red-500'}`}>{item.status}</span>
                                                </DenseCell>
                                            </>
                                        )}

                                        <DenseCell className="text-center">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => { setEditData(item); setShowModal(true); }} className="p-1 text-blue-600 hover:bg-blue-100 rounded">
                                                    <Edit3 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(item.id, activeTab === 'WAREHOUSE' ? 'WH' : activeTab === 'USERS' ? 'USER' : 'PARTNER')} className="p-1 text-red-600 hover:bg-red-100 rounded">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </DenseCell>
                                    </DenseRow>
                                ))}
                                {filteredData().length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="p-8 text-center text-slate-400 italic">No records found.</td>
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
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
                        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 uppercase text-sm">
                                {editData?.id ? 'Edit' : 'Add New'} {activeTab}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        
                        <form onSubmit={(e) => { e.preventDefault(); handleSave(editData); }} className="p-6 space-y-4">
                            
                            {/* WAREHOUSE FORM */}
                            {activeTab === 'WAREHOUSE' && (
                                <>
                                    <div className="grid grid-cols-1 gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Warehouse Name</label>
                                        <input required type="text" className="input-dense" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} placeholder="e.g. Gudang Pusat" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                                            <input type="text" className="input-dense" value={editData.phone || ''} onChange={e => setEditData({...editData, phone: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">PIC Name</label>
                                            <input type="text" className="input-dense" value={editData.pic || ''} onChange={e => setEditData({...editData, pic: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Address / Location</label>
                                        <textarea className="input-dense" rows={3} value={editData.location || ''} onChange={e => setEditData({...editData, location: e.target.value})} />
                                    </div>
                                </>
                            )}

                            {/* PARTNER FORM */}
                            {(activeTab === 'SUPPLIER' || activeTab === 'CUSTOMER') && (
                                <>
                                    <div className="grid grid-cols-1 gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Company / Name</label>
                                        <input required type="text" className="input-dense" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                                            <input required type="text" className="input-dense" value={editData.phone || ''} onChange={e => setEditData({...editData, phone: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
                                            <input type="email" className="input-dense" value={editData.email || ''} onChange={e => setEditData({...editData, email: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">NPWP</label>
                                            <input type="text" className="input-dense" value={editData.npwp || ''} onChange={e => setEditData({...editData, npwp: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Term (Days)</label>
                                            <input type="number" className="input-dense" value={editData.term || ''} onChange={e => setEditData({...editData, term: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Address</label>
                                        <textarea className="input-dense" rows={2} value={editData.address || ''} onChange={e => setEditData({...editData, address: e.target.value})} />
                                    </div>
                                </>
                            )}

                            {/* USER FORM */}
                            {activeTab === 'USERS' && (
                                <>
                                    <div className="grid grid-cols-1 gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</label>
                                        <input required type="text" className="input-dense" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} />
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Email Address</label>
                                        <input required type="email" className="input-dense" value={editData.email || ''} onChange={e => setEditData({...editData, email: e.target.value})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Role</label>
                                            <select className="input-dense" value={editData.role || 'STAFF'} onChange={e => setEditData({...editData, role: e.target.value})}>
                                                <option value="ADMIN">Administrator</option>
                                                <option value="MANAGER">Manager</option>
                                                <option value="STAFF">Staff</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                                            <select className="input-dense" value={editData.status || 'ACTIVE'} onChange={e => setEditData({...editData, status: e.target.value})}>
                                                <option value="ACTIVE">Active</option>
                                                <option value="INACTIVE">Inactive</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm font-medium">Cancel</button>
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
                    border: 1px solid #cbd5e1;
                    padding: 0.35rem 0.5rem;
                    font-size: 0.875rem;
                    border-radius: 0.25rem;
                    outline: none;
                }
                .input-dense:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 1px #3b82f6;
                }
            `}</style>
        </div>
    );
};
