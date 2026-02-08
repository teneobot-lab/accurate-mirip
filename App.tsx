
import React, { useState, useEffect } from 'react';
import { StorageService } from './services/storage';
import { InventoryView } from './components/InventoryView';
import { TransactionForm } from './components/TransactionForm';
import { ReportsView } from './components/ReportsView';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { RejectView } from './components/RejectView';
import { StockCardView } from './components/StockCardModal';
import { LoginPage } from './components/LoginPage';
import MusicPlayer from './components/MusicPlayer';
import { GlobalSearch } from './components/GlobalSearch';
import { LowStockAlert } from './components/LowStockAlert';
import { ToastProvider } from './components/Toast';
import { SearchProvider } from './search/SearchProvider';
import { LayoutDashboard, Package, FileBarChart, ChevronRight, Settings, AlertOctagon, Menu, LogOut, X, ArrowLeft } from 'lucide-react';
import { TransactionType, Transaction, Item } from './types';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY' | 'REPORTS' | 'SETTINGS' | 'REJECT'>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  
  // FULL VIEW STATES
  const [activeTransaction, setActiveTransaction] = useState<{ type: TransactionType, data?: Transaction | null } | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  useEffect(() => {
    StorageService.init();
    document.documentElement.classList.add('dark');
    const savedSession = StorageService.getSession();
    if (savedSession) {
        setCurrentUser(savedSession);
        setIsLoggedIn(true);
    }
    setIsLoadingSession(false);
    if (window.innerWidth >= 1024) setIsSidebarOpen(true);
  }, []);

  const handleLogout = () => {
      setIsLoggedIn(false);
      setCurrentUser(null);
      setActiveTab('DASHBOARD');
      setViewingItem(null);
      setActiveTransaction(null);
      StorageService.clearSession();
  };

  const NavItem = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => {
          setActiveTab(id);
          setViewingItem(null);
          setActiveTransaction(null);
          if (window.innerWidth < 1024) setIsSidebarOpen(false); 
      }}
      className={`flex items-center w-full p-3 mb-1 text-sm font-medium rounded-lg transition-all ${
        activeTab === id && !viewingItem && !activeTransaction
        ? 'bg-spectra text-white shadow-lg border border-cutty/30' 
        : 'text-slate-400 hover:bg-spectra/50 hover:text-slate-100'
      }`}
    >
      <Icon size={18} className="mr-3 flex-shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );

  if (isLoadingSession) return <div className="min-h-screen bg-daintree"></div>;
  if (!isLoggedIn) return <LoginPage onLogin={(user) => { setCurrentUser(user); setIsLoggedIn(true); StorageService.saveSession(user); }} />;

  return (
    <ToastProvider>
      <SearchProvider>
        <div className="min-h-screen bg-daintree relative overflow-hidden">
          {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>}

          <div className="flex bg-daintree font-sans text-slate-200 h-screen overflow-hidden">
              <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-gable flex-col text-slate-300 shadow-2xl transition-transform duration-300 lg:relative lg:translate-x-0 flex ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                  <div className="h-20 flex items-center justify-between px-6 border-b border-spectra/30 bg-daintree">
                      <div className="flex flex-col leading-none">
                          <div className="flex items-center">
                              <span className="text-white font-black text-2xl tracking-tighter">ware</span>
                              <span className="text-cutty font-black text-2xl tracking-tighter">SIX</span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-500 tracking-[0.3em] mt-1 uppercase">Management</div>
                      </div>
                      <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-white"><X size={20}/></button>
                  </div>

                  <div className="p-4 flex-1 overflow-y-auto scrollbar-hide">
                      <div className="text-[10px] font-black text-slate-600 uppercase mb-4 px-3 tracking-widest">Main Menu</div>
                      <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
                      <NavItem id="INVENTORY" label="Stock Inventory" icon={Package} />
                      <NavItem id="REPORTS" label="Mutation Reports" icon={FileBarChart} />
                      <NavItem id="REJECT" label="Reject / Afkir" icon={AlertOctagon} />
                      
                      <div className="mt-8 text-[10px] font-black text-slate-600 uppercase mb-4 px-3 tracking-widest">Transaction Entry</div>
                      <div className="space-y-2">
                          <button onClick={() => { setActiveTransaction({ type: 'IN' }); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2.5 text-sm text-emerald-400 hover:bg-emerald-950/30 rounded-lg flex items-center transition-colors border border-emerald-900/20">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 animate-pulse"></div> Input Inbound (Masuk)
                          </button>
                          <button onClick={() => { setActiveTransaction({ type: 'OUT' }); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-950/30 rounded-lg flex items-center transition-colors border border-red-900/20">
                              <div className="w-2 h-2 rounded-full bg-red-500 mr-3 animate-pulse"></div> Input Outbound (Keluar)
                          </button>
                      </div>
                      
                      <div className="mt-8 border-t border-spectra/30 pt-4">
                          <NavItem id="SETTINGS" label="Settings" icon={Settings} />
                          <button onClick={handleLogout} className="flex items-center w-full p-3 text-sm font-medium rounded-lg transition-all text-red-400 hover:bg-red-900/20 mt-2">
                              <LogOut size={18} className="mr-3 flex-shrink-0" />
                              <span>Log Out</span>
                          </button>
                      </div>
                  </div>
              </aside>

              <main className="flex-1 flex flex-col overflow-hidden relative">
                  <header className="h-16 bg-gable border-b border-spectra/50 flex items-center justify-between px-4 lg:px-6 shadow-sm z-30 shrink-0">
                      <div className="flex items-center gap-4">
                          <button onClick={() => setIsSidebarOpen(true)} className={`p-2 rounded-lg text-slate-400 hover:bg-spectra/50 lg:${isSidebarOpen ? 'hidden' : 'block'}`}><Menu size={20} /></button>
                          <h2 className="text-sm lg:text-base font-bold text-white flex items-center gap-2">
                              {(viewingItem || activeTransaction) ? (
                                  <button onClick={() => { setViewingItem(null); setActiveTransaction(null); }} className="p-1.5 hover:bg-white/5 rounded-lg text-spectra flex items-center gap-2">
                                      <ArrowLeft size={18}/> <span className="text-slate-400 font-medium">Kembali</span>
                                  </button>
                              ) : (
                                  activeTab
                              )}
                          </h2>
                      </div>
                      
                      {!activeTransaction && !viewingItem && (
                          <div className="flex-1 max-w-xs md:max-w-md lg:max-w-lg mx-4">
                              <GlobalSearch onSelectItem={(item) => setViewingItem(item)} />
                          </div>
                      )}

                      <div className="flex items-center gap-3 shrink-0">
                          <LowStockAlert />
                          <MusicPlayer />
                          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-spectra to-daintree flex items-center justify-center text-white font-bold border border-cutty shadow-md text-xs">
                              {currentUser?.name.substring(0,2).toUpperCase()}
                          </div>
                      </div>
                  </header>

                  <div className="flex-1 overflow-auto bg-daintree relative">
                      {activeTransaction ? (
                          <TransactionForm 
                              type={activeTransaction.type} 
                              initialData={activeTransaction.data}
                              onClose={() => setActiveTransaction(null)} 
                              onSuccess={() => setActiveTransaction(null)}
                          />
                      ) : viewingItem ? (
                          <StockCardView item={viewingItem} onBack={() => setViewingItem(null)} />
                      ) : (
                          <>
                            {activeTab === 'DASHBOARD' && <DashboardView />}
                            {activeTab === 'INVENTORY' && <InventoryView onViewItem={(item) => setViewingItem(item)} />}
                            {activeTab === 'REPORTS' && <ReportsView onEditTransaction={(tx) => setActiveTransaction({ type: tx.type, data: tx })} />}
                            {activeTab === 'SETTINGS' && <SettingsView />}
                            {activeTab === 'REJECT' && <RejectView />}
                          </>
                      )}
                  </div>
              </main>
          </div>
        </div>
      </SearchProvider>
    </ToastProvider>
  );
}

export default App;
