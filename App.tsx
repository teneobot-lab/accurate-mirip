
import React, { useState, useEffect } from 'react';
import { StorageService } from './services/storage';
import { InventoryView } from './components/InventoryView';
import { TransactionForm } from './components/TransactionForm';
import { ReportsView } from './components/ReportsView';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { RejectView } from './components/RejectView';
import { StockCardModal } from './components/StockCardModal';
import { LoginPage } from './components/LoginPage';
import MusicPlayer from './components/MusicPlayer';
import { GlobalSearch } from './components/GlobalSearch';
import { LowStockAlert } from './components/LowStockAlert';
import { ToastProvider } from './components/Toast';
import { SearchProvider } from './search/SearchProvider';
import { LayoutDashboard, Package, FileBarChart, ChevronRight, Warehouse as WhIcon, Settings, AlertOctagon, Menu, LogOut, User as UserIcon, X } from 'lucide-react';
import { TransactionType, Transaction, Item } from './types';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY' | 'REPORTS' | 'SETTINGS' | 'REJECT'>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed for mobile flexibility
  
  const [showTransactionModal, setShowTransactionModal] = useState<TransactionType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  const refreshData = () => {
    // This function can be used to trigger data refreshes across the app if needed
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

    if (window.innerWidth >= 1024) setIsSidebarOpen(true);
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

  const NavItem = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => {
          setActiveTab(id);
          if (window.innerWidth < 1024) setIsSidebarOpen(false); // Auto close on mobile
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
  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />;

  return (
    <ToastProvider>
      <SearchProvider>
        <div className="min-h-screen bg-daintree relative overflow-hidden">
          {/* MOBILE OVERLAY */}
          {isSidebarOpen && (
              <div 
                  className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
                  onClick={() => setIsSidebarOpen(false)}
              ></div>
          )}

          <div className="flex bg-daintree font-sans text-slate-200 h-screen overflow-hidden">
              {/* ASIDE - RESPONSIVE DRAWER */}
              <aside className={`
                  fixed inset-y-0 left-0 z-50 w-72 bg-gable flex-col text-slate-300 shadow-2xl transition-transform duration-300 ease-in-out border-r border-spectra/30
                  lg:relative lg:translate-x-0 flex
                  ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              `}>
                  <div className="h-20 flex items-center justify-between px-6 border-b border-spectra/30 bg-daintree">
                      <div className="flex flex-col leading-none">
                          <div className="flex items-center">
                              <span className="text-white font-black text-2xl tracking-tighter">ware</span>
                              <span className="text-cutty font-black text-2xl tracking-tighter">SIX</span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-500 tracking-[0.3em] mt-1 uppercase">Management</div>
                      </div>
                      <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-white">
                          <X size={20}/>
                      </button>
                  </div>

                  <div className="p-4 flex-1 overflow-y-auto scrollbar-hide">
                      <div className="text-[10px] font-black text-slate-600 uppercase mb-4 px-3 tracking-widest">Main Menu</div>
                      <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
                      <NavItem id="INVENTORY" label="Stock Inventory" icon={Package} />
                      <NavItem id="REPORTS" label="Mutation Reports" icon={FileBarChart} />
                      <NavItem id="REJECT" label="Reject / Afkir" icon={AlertOctagon} />
                      
                      <div className="mt-8 text-[10px] font-black text-slate-600 uppercase mb-4 px-3 tracking-widest">Quick Actions</div>
                      <div className="space-y-2">
                          <button onClick={() => { setShowTransactionModal('IN'); setEditingTransaction(null); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-spectra/30 rounded-lg flex items-center transition-colors">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3"></div> Inbound
                          </button>
                          <button onClick={() => { setShowTransactionModal('OUT'); setEditingTransaction(null); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-spectra/30 rounded-lg flex items-center transition-colors">
                              <div className="w-2 h-2 rounded-full bg-red-500 mr-3"></div> Outbound
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
                  
                  <div className="p-4 border-t border-spectra/30 bg-daintree text-[10px] text-slate-500 flex justify-between items-center font-bold">
                      <span>v1.2.0-FLEX</span>
                      <span className="text-spectra uppercase">Enterprise</span>
                  </div>
              </aside>

              <main className="flex-1 flex flex-col overflow-hidden relative">
                  {/* HEADER - ADAPTIVE */}
                  <header className="h-16 bg-gable border-b border-spectra/50 flex items-center justify-between px-4 lg:px-6 shadow-sm z-30 shrink-0">
                      <div className="flex items-center gap-2 lg:gap-4 overflow-hidden">
                          <button 
                              onClick={() => setIsSidebarOpen(true)}
                              className={`p-2 rounded-lg text-slate-400 hover:bg-spectra/50 transition-colors lg:${isSidebarOpen ? 'hidden' : 'block'}`}
                          >
                              <Menu size={20} />
                          </button>
                          <div className="flex-col hidden sm:flex">
                              <h2 className="text-sm lg:text-base font-bold text-white leading-none truncate">
                                  {activeTab === 'DASHBOARD' && 'Executive Dashboard'}
                                  {activeTab === 'INVENTORY' && 'Inventory Master'}
                                  {activeTab === 'REPORTS' && 'Reports'}
                                  {activeTab === 'REJECT' && 'Reject Management'}
                                  {activeTab === 'SETTINGS' && 'System Config'}
                              </h2>
                          </div>
                      </div>
                      
                      <div className="flex-1 max-w-xs md:max-w-md lg:max-w-lg mx-2 lg:mx-4">
                          <GlobalSearch onSelectItem={(item) => setViewingItem(item)} />
                      </div>

                      <div className="flex items-center gap-1 lg:gap-3 shrink-0">
                          {/* Restored Features */}
                          <div className="flex items-center gap-1 lg:gap-2">
                            <LowStockAlert />
                            <MusicPlayer />
                          </div>
                          
                          <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-spectra">
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-spectra to-daintree flex items-center justify-center text-white font-bold border border-cutty shadow-md text-xs lg:text-sm">
                                {currentUser?.name.substring(0,2).toUpperCase()}
                            </div>
                          </div>
                      </div>
                  </header>

                  {/* CONTENT AREA */}
                  <div className="flex-1 overflow-auto bg-daintree relative">
                      {activeTab === 'DASHBOARD' && <DashboardView />}
                      {activeTab === 'INVENTORY' && <InventoryView />}
                      {activeTab === 'REPORTS' && <ReportsView onEditTransaction={(tx) => { setEditingTransaction(tx); setShowTransactionModal(tx.type); }} />}
                      {activeTab === 'SETTINGS' && <SettingsView />}
                      {activeTab === 'REJECT' && <RejectView />}
                  </div>

                  {showTransactionModal && (
                      <TransactionForm 
                          type={showTransactionModal} 
                          initialData={editingTransaction}
                          onClose={() => { setShowTransactionModal(null); setEditingTransaction(null); }} 
                          onSuccess={() => { setShowTransactionModal(null); setEditingTransaction(null); refreshData(); }}
                      />
                  )}

                  {viewingItem && (
                      <StockCardModal item={viewingItem} onClose={() => setViewingItem(null)} />
                  )}
              </main>
          </div>
        </div>
      </SearchProvider>
    </ToastProvider>
  );
}

export default App;
