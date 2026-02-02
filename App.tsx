
import React, { useState, useEffect } from 'react';
import { StorageService } from './services/storage';
import { InventoryView } from './components/InventoryView';
import { TransactionForm } from './components/TransactionForm';
import { ReportsView } from './components/ReportsView';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { RejectView } from './components/RejectView';
import { StockCardModal } from './components/StockCardModal';
import { ThemeToggle } from './components/ThemeToggle';
import { ClockWidget } from './components/ClockWidget';
import { LoginPage } from './components/LoginPage';
import MusicPlayer from './components/MusicPlayer';
import { ToastProvider } from './components/Toast';
import { LayoutDashboard, Package, FileBarChart, ChevronRight, Warehouse as WhIcon, Settings, AlertOctagon, Menu, LogOut, User as UserIcon, Plus } from 'lucide-react';
import { TransactionType, Transaction, Item } from './types';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY' | 'REPORTS' | 'SETTINGS' | 'REJECT'>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showTransactionModal, setShowTransactionModal] = useState<TransactionType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  useEffect(() => {
    StorageService.init();
    const theme = StorageService.getTheme();
    if (theme === 'dark') document.documentElement.classList.add('dark');
    const savedSession = StorageService.getSession();
    if (savedSession) {
        setCurrentUser(savedSession);
        setIsLoggedIn(true);
    }
    setIsLoadingSession(false);
  }, []);

  const handleLogin = (user: any) => {
      setCurrentUser(user);
      setIsLoggedIn(true);
      StorageService.saveSession(user);
  };

  const handleLogout = () => {
      setIsLoggedIn(false);
      setCurrentUser(null);
      setActiveTab('DASHBOARD');
      StorageService.clearSession();
  };

  const handleEditTransaction = (tx: Transaction) => {
      setEditingTransaction(tx);
      setShowTransactionModal(tx.type);
  };

  const NavItem = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center w-full p-3 mb-1.5 text-sm font-medium rounded-xl transition-all ${
        activeTab === id 
        ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon size={20} className="mr-3 flex-shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
      {activeTab === id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
    </button>
  );

  if (isLoadingSession) return <div className="min-h-screen bg-white"></div>;
  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />;

  return (
    <ToastProvider>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        
        {/* Sidebar */}
        <aside className={`${isSidebarOpen ? 'w-72' : 'w-0'} bg-white dark:bg-slate-900 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 z-30 transition-all duration-300 ease-in-out overflow-hidden`}>
          <div className="h-20 flex items-center px-8 border-b border-slate-100 dark:border-slate-800">
             <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <WhIcon size={20} className="text-white" />
                </div>
                <div>
                   <div className="flex items-center leading-none">
                      <span className="text-slate-900 dark:text-white font-bold text-xl tracking-tight">Gudang</span>
                      <span className="text-blue-600 font-bold text-xl tracking-tight">Pro</span>
                   </div>
                   <div className="text-[10px] font-semibold text-slate-400 tracking-[0.1em] mt-0.5">WMS ENTERPRISE</div>
                </div>
             </div>
          </div>

          <div className="p-6 flex-1 overflow-y-auto whitespace-nowrap scrollbar-hide">
             <div className="text-[11px] font-bold text-slate-400 uppercase mb-4 px-3 tracking-widest">Utama</div>
             <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
             <NavItem id="INVENTORY" label="Stok Inventory" icon={Package} />
             <NavItem id="REPORTS" label="Laporan Mutasi" icon={FileBarChart} />
             <NavItem id="REJECT" label="Reject & Afkir" icon={AlertOctagon} />
             
             <div className="mt-8 text-[11px] font-bold text-slate-400 uppercase mb-4 px-3 tracking-widest">Transaksi Cepat</div>
             <div className="space-y-2 px-1">
                <button onClick={() => { setShowTransactionModal('IN'); setEditingTransaction(null); }} className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 bg-emerald-50 hover:bg-emerald-100 font-semibold rounded-xl flex items-center transition-all group">
                   <Plus size={16} className="mr-3 group-hover:rotate-90 transition-transform"/> Barang Masuk
                </button>
                <button onClick={() => { setShowTransactionModal('OUT'); setEditingTransaction(null); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 font-semibold rounded-xl flex items-center transition-all group">
                   <Plus size={16} className="mr-3 group-hover:rotate-90 transition-transform"/> Barang Keluar
                </button>
             </div>
             
             <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-6 mt-8">
                 <NavItem id="SETTINGS" label="Pengaturan" icon={Settings} />
                 <button onClick={handleLogout} className="flex items-center w-full p-3 text-sm font-medium rounded-xl transition-all text-slate-400 hover:bg-red-50 hover:text-red-600 mt-2">
                     <LogOut size={20} className="mr-3 flex-shrink-0" />
                     <span>Log Out</span>
                 </button>
             </div>
          </div>
          
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex justify-between items-center">
             <span>Version 2.0 HD</span>
             <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Pro</span>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
           <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-20 transition-colors shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
               <div className="flex items-center gap-6">
                  <button 
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors focus:outline-none"
                  >
                      <Menu size={20} />
                  </button>
                  <div className="flex-shrink-0">
                      <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-none">
                          {activeTab === 'DASHBOARD' && 'Ringkasan Eksekutif'}
                          {activeTab === 'INVENTORY' && 'Manajemen Stok'}
                          {activeTab === 'REPORTS' && 'Laporan Mutasi Barang'}
                          {activeTab === 'SETTINGS' && 'Konfigurasi Sistem'}
                          {activeTab === 'REJECT' && 'Kontrol Barang Afkir'}
                      </h2>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1.5">Control Panel</div>
                  </div>
               </div>
               
               <div className="flex-1 flex justify-center px-8">
                  <ClockWidget />
               </div>

               <div className="flex items-center gap-4 flex-shrink-0">
                  <MusicPlayer />
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                  <ThemeToggle />
                  
                  <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-800">
                      <div className="text-right hidden md:block">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{currentUser?.name}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{currentUser?.role}</div>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold shadow-sm">
                          {currentUser?.name.substring(0,2).toUpperCase() || 'AD'}
                      </div>
                  </div>
               </div>
           </header>

           <div className="flex-1 overflow-hidden relative p-8">
               <div className="h-full bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                  {activeTab === 'DASHBOARD' && <DashboardView />}
                  {activeTab === 'INVENTORY' && <InventoryView />}
                  {activeTab === 'REPORTS' && <ReportsView onEditTransaction={handleEditTransaction} />}
                  {activeTab === 'SETTINGS' && <SettingsView />}
                  {activeTab === 'REJECT' && <RejectView />}
               </div>
           </div>

           {/* Modals */}
           {showTransactionModal && (
               <TransactionForm 
                  type={showTransactionModal} 
                  initialData={editingTransaction}
                  onClose={() => {
                      setShowTransactionModal(null);
                      setEditingTransaction(null);
                  }} 
                  onSuccess={() => {
                      setShowTransactionModal(null);
                      setEditingTransaction(null);
                      const current = activeTab;
                      setActiveTab('DASHBOARD');
                      setTimeout(() => setActiveTab(current), 50);
                  }}
               />
           )}
           {viewingItem && <StockCardModal item={viewingItem} onClose={() => setViewingItem(null)} />}
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;
