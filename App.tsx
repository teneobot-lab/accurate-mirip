
import React, { useState, useEffect } from 'react';
import { StorageService } from './services/storage';
import { InventoryView } from './components/InventoryView';
import { TransactionForm } from './components/TransactionForm';
import { ReportsView } from './components/ReportsView';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { RejectView } from './components/RejectView';
import { StockCardModal } from './components/StockCardModal';
import { ClockWidget } from './components/ClockWidget';
import { LoginPage } from './components/LoginPage';
import MusicPlayer from './components/MusicPlayer';
import { ToastProvider } from './components/Toast';
import { LayoutDashboard, Package, FileBarChart, Warehouse as WhIcon, Settings, AlertOctagon, Plus, LogOut, User as UserIcon, X, Menu, List } from 'lucide-react';
import { TransactionType, Transaction, Item } from './types';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY' | 'REPORTS' | 'SETTINGS' | 'REJECT'>('DASHBOARD');
  const [showTransactionModal, setShowTransactionModal] = useState<TransactionType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setShowTransactionModal(tx.type);
  };

  const handleNewTransaction = (type: TransactionType) => {
    setEditingTransaction(null);
    setShowTransactionModal(type);
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
  }, []);

  const handleLogout = () => {
      if(confirm('Keluar dari sistem?')) {
          setIsLoggedIn(false);
          setCurrentUser(null);
          setActiveTab('DASHBOARD');
          StorageService.clearSession();
      }
  };

  const NavItem = ({ id, label, icon: Icon }: any) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`flex flex-col lg:flex-row items-center justify-center lg:justify-start w-full lg:p-3 p-2 transition-all group ${
          isActive 
          ? 'text-white lg:bg-spectra lg:rounded-xl lg:shadow-lg lg:shadow-black/20' 
          : 'text-slate-400 hover:text-slate-100 lg:hover:bg-spectra/30 lg:rounded-xl'
        }`}
      >
        <Icon size={20} className={`${isActive ? 'text-emerald-400 lg:text-white' : 'group-hover:text-white'} lg:mr-3 mb-1 lg:mb-0 transition-colors`} />
        <span className={`text-[10px] lg:text-sm font-bold whitespace-nowrap ${isActive ? 'opacity-100' : 'opacity-60 lg:opacity-100'}`}>{label}</span>
        {isActive && <div className="absolute top-0 h-1 w-8 bg-emerald-500 rounded-b-full lg:hidden"></div>}
      </button>
    );
  };

  if (isLoadingSession) return <div className="min-h-screen bg-daintree"></div>;
  if (!isLoggedIn) return <LoginPage onLogin={(user) => { setCurrentUser(user); setIsLoggedIn(true); StorageService.saveSession(user); }} />;

  return (
    <ToastProvider>
      <div className="flex flex-col lg:flex-row h-screen bg-daintree font-sans text-slate-200 overflow-hidden relative">
        
        {/* DESKTOP SIDEBAR / MOBILE BOTTOM NAV */}
        <nav className={`
          fixed lg:relative z-[70] bg-gable border-spectra/30 transition-all duration-300 flex
          bottom-0 left-0 w-full h-16 border-t flex-row justify-around items-center px-2
          lg:top-0 lg:h-full lg:w-64 lg:border-t-0 lg:border-r lg:flex-col lg:justify-start lg:px-4 lg:py-6
        `}>
          {/* Logo - Desktop Only */}
          <div className="hidden lg:flex items-center mb-8 px-2">
              <span className="text-white font-black text-2xl tracking-tighter">ware</span>
              <span className="text-cutty font-black text-2xl tracking-tighter">SIX</span>
          </div>

          <div className="flex flex-row lg:flex-col items-center justify-around lg:justify-start w-full gap-1 lg:gap-2">
              <NavItem id="DASHBOARD" label="Home" icon={LayoutDashboard} />
              <NavItem id="INVENTORY" label="Stock" icon={Package} />
              <NavItem id="REPORTS" label="Reports" icon={FileBarChart} />
              <NavItem id="REJECT" label="Reject" icon={AlertOctagon} />
              
              {/* Desktop Settings & Logout */}
              <div className="hidden lg:flex flex-col w-full mt-auto pt-4 border-t border-spectra/30 gap-2">
                  <NavItem id="SETTINGS" label="Settings" icon={Settings} />
                  <button onClick={handleLogout} className="flex items-center w-full p-3 text-sm font-bold text-red-400 hover:bg-red-900/20 rounded-xl transition-colors">
                      <LogOut size={18} className="mr-3" /> <span>Log Out</span>
                  </button>
              </div>

              {/* Mobile Settings - Shown as icon */}
              <button 
                onClick={() => setActiveTab('SETTINGS')}
                className={`lg:hidden flex flex-col items-center justify-center p-2 ${activeTab === 'SETTINGS' ? 'text-white' : 'text-slate-400'}`}
              >
                <Settings size={20} className={activeTab === 'SETTINGS' ? 'text-emerald-400' : ''} />
                <span className="text-[10px] font-bold mt-1">Settings</span>
              </button>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative mb-16 lg:mb-0">
          <header className="h-14 lg:h-16 bg-gable border-b border-spectra/50 flex items-center justify-between px-4 lg:px-6 shadow-sm z-20 shrink-0">
              <div className="flex items-center gap-3">
                  <div className="lg:hidden flex items-center leading-none mr-2">
                      <span className="text-white font-black text-lg tracking-tighter">w</span>
                      <span className="text-cutty font-black text-lg tracking-tighter">6</span>
                  </div>
                  <div className="flex flex-col">
                      <h2 className="text-sm lg:text-lg font-bold text-white leading-tight">
                          {activeTab === 'DASHBOARD' && 'Dashboard Overview'}
                          {activeTab === 'INVENTORY' && 'Master Inventory'}
                          {activeTab === 'REPORTS' && 'Mutation Reports'}
                          {activeTab === 'SETTINGS' && 'System Settings'}
                          {activeTab === 'REJECT' && 'Reject Management'}
                      </h2>
                      <div className="text-[9px] text-cutty font-bold uppercase tracking-widest hidden sm:block">Waresix Warehouse System</div>
                  </div>
              </div>
              
              <div className="hidden md:flex flex-1 justify-center px-4">
                  <ClockWidget />
              </div>

              <div className="flex items-center gap-3">
                  <div className="hidden sm:block">
                      <MusicPlayer />
                  </div>
                  <div className="h-8 w-px bg-spectra mx-1 hidden lg:block"></div>
                  <div className="flex items-center gap-2">
                      <div className="text-right hidden xl:block">
                          <div className="text-[10px] font-bold text-slate-200">{currentUser?.name}</div>
                          <div className="text-[8px] text-cutty uppercase font-black">{currentUser?.role}</div>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-spectra border border-white/10 flex items-center justify-center text-white font-bold shadow-md text-[10px]">
                          {currentUser?.name.substring(0,2).toUpperCase() || 'AD'}
                      </div>
                      <button onClick={handleLogout} className="lg:hidden p-2 text-red-400"><LogOut size={18}/></button>
                  </div>
              </div>
          </header>

          <div className="flex-1 overflow-hidden relative bg-daintree">
              {activeTab === 'DASHBOARD' && <DashboardView />}
              {activeTab === 'INVENTORY' && <InventoryView />}
              {activeTab === 'REPORTS' && <ReportsView onEditTransaction={handleEditTransaction} onNewTransaction={handleNewTransaction} />}
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
