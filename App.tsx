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
import { LayoutDashboard, Package, FileBarChart, ChevronRight, Warehouse as WhIcon, Settings, AlertOctagon, Menu, LogOut, User as UserIcon, Smartphone, Monitor, X } from 'lucide-react';
import { TransactionType, Transaction, Item } from './types';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY' | 'REPORTS' | 'SETTINGS' | 'REJECT'>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [showTransactionModal, setShowTransactionModal] = useState<TransactionType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  // Fix: Added handleEditTransaction to manage the state when editing a transaction from ReportsView
  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setShowTransactionModal(tx.type);
  };

  useEffect(() => {
    StorageService.init();
    document.documentElement.classList.add('dark');
    const savedSession = StorageService.getSession();
    if (savedSession) {
        setCurrentUser(savedSession);
        setIsLoggedIn(true);
    }
    setIsLoadingSession(false);

    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
      setIsLoggedIn(false);
      setCurrentUser(null);
      setActiveTab('DASHBOARD');
      StorageService.clearSession();
  };

  const NavItem = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => {
        setActiveTab(id);
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
      }}
      className={`flex items-center w-full p-3 mb-1 text-sm font-medium rounded-lg transition-all ${
        activeTab === id 
        ? 'bg-spectra text-white shadow-lg shadow-black/20 border border-cutty/30' 
        : 'text-slate-400 hover:bg-spectra/50 hover:text-slate-100'
      }`}
    >
      <Icon size={18} className="mr-3 flex-shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
      {activeTab === id && <ChevronRight size={16} className="ml-auto opacity-50" />}
    </button>
  );

  if (isLoadingSession) return <div className="min-h-screen bg-daintree"></div>;
  if (!isLoggedIn) return <LoginPage onLogin={(user) => { setCurrentUser(user); setIsLoggedIn(true); StorageService.saveSession(user); }} />;

  return (
    <ToastProvider>
      <div className="flex h-screen bg-daintree font-sans text-slate-200 overflow-hidden relative">
        
        {/* Sidebar Overlay for Mobile */}
        {isSidebarOpen && window.innerWidth < 1024 && (
          <div className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>
        )}

        {/* Sidebar */}
        <aside className={`
          fixed lg:relative z-[70] h-full bg-gable shadow-2xl transition-all duration-300 ease-in-out border-r border-spectra/30 flex flex-col
          ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 lg:w-0 -translate-x-full lg:-translate-x-0'}
        `}>
          <div className="h-16 flex items-center justify-between px-6 bg-daintree border-b border-spectra/30 shrink-0">
              <div className="flex items-center leading-none">
                  <span className="text-white font-black text-xl tracking-tighter">ware</span>
                  <span className="text-cutty font-black text-xl tracking-tighter">SIX</span>
              </div>
              <button className="lg:hidden text-slate-400 p-1" onClick={() => setIsSidebarOpen(false)}><X size={20}/></button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto whitespace-nowrap scrollbar-hide">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-4 px-3 tracking-widest opacity-60">Main Menu</div>
              <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
              <NavItem id="INVENTORY" label="Stock Inventory" icon={Package} />
              <NavItem id="REPORTS" label="Reports" icon={FileBarChart} />
              <NavItem id="REJECT" label="Reject / Afkir" icon={AlertOctagon} />
              
              <div className="mt-8 text-[10px] font-bold text-slate-500 uppercase mb-4 px-3 tracking-widest opacity-60">Quick Actions</div>
              <div className="space-y-2">
                  <button onClick={() => { setShowTransactionModal('IN'); setEditingTransaction(null); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-spectra/30 rounded-lg flex items-center transition-colors">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3"></div> Inbound
                  </button>
                  <button onClick={() => { setShowTransactionModal('OUT'); setEditingTransaction(null); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-spectra/30 rounded-lg flex items-center transition-colors">
                    <div className="w-2 h-2 rounded-full bg-red-500 mr-3"></div> Outbound
                  </button>
              </div>
              
              <div className="mt-auto border-t border-spectra/30 pt-4">
                  <NavItem id="SETTINGS" label="Settings" icon={Settings} />
                  <button onClick={handleLogout} className="flex items-center w-full p-3 mb-1 text-sm font-medium rounded-lg text-red-400 hover:bg-red-900/20 mt-2">
                      <LogOut size={18} className="mr-3" /> <span>Log Out</span>
                  </button>
              </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <header className="h-16 bg-gable border-b border-spectra/50 flex items-center justify-between px-4 lg:px-6 shadow-sm z-20 shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                  <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg text-slate-400 hover:bg-spectra/50 transition-colors">
                      <Menu size={20} />
                  </button>
                  <div className="flex flex-col truncate">
                      <h2 className="text-sm lg:text-lg font-bold text-white leading-tight truncate">
                          {activeTab === 'DASHBOARD' && 'Dashboard'}
                          {activeTab === 'INVENTORY' && 'Inventory'}
                          {activeTab === 'REPORTS' && 'Reports'}
                          {activeTab === 'SETTINGS' && 'Settings'}
                          {activeTab === 'REJECT' && 'Reject'}
                      </h2>
                      <div className="text-[9px] text-cutty font-bold uppercase tracking-wider truncate">Waresix Warehouse System</div>
                  </div>
              </div>
              
              <div className="hidden md:flex flex-1 justify-center px-4">
                  <ClockWidget />
              </div>

              <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                  <MusicPlayer />
                  <div className="h-8 w-px bg-spectra mx-1 hidden lg:block"></div>
                  <div className="hidden sm:block">
                      <div className="flex items-center gap-3 pl-3 border-l border-spectra">
                          <div className="text-right hidden xl:block">
                              <div className="text-xs font-bold text-slate-200">{currentUser?.name}</div>
                              <div className="text-[9px] text-cutty uppercase font-bold">{currentUser?.role}</div>
                          </div>
                          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-spectra flex items-center justify-center text-white font-bold shadow-md text-xs">
                              {currentUser?.name.substring(0,2).toUpperCase() || 'AD'}
                          </div>
                      </div>
                  </div>
              </div>
          </header>

          <div className="flex-1 overflow-hidden relative bg-daintree">
              {activeTab === 'DASHBOARD' && <DashboardView />}
              {activeTab === 'INVENTORY' && <InventoryView />}
              {activeTab === 'REPORTS' && <ReportsView onEditTransaction={handleEditTransaction} />}
              {activeTab === 'SETTINGS' && <SettingsView />}
              {activeTab === 'REJECT' && <RejectView />}
          </div>

          {showTransactionModal && (
              <TransactionForm 
                  type={showTransactionModal} 
                  initialData={editingTransaction}
                  onClose={() => { setShowTransactionModal(null); setEditingTransaction(null); }} 
                  onSuccess={() => { setShowTransactionModal(null); setEditingTransaction(null); setActiveTab('REPORTS'); }}
              />
          )}

          {viewingItem && <StockCardModal item={viewingItem} onClose={() => setViewingItem(null)} />}
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;