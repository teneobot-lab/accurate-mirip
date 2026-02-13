
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
import { LayoutDashboard, Package, FileBarChart, ChevronRight, Settings, AlertOctagon, Menu, LogOut, X, ArrowLeft, Building2, Plus } from 'lucide-react';
import { TransactionType, Transaction, Item } from './types';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY' | 'REPORTS' | 'SETTINGS' | 'REJECT'>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  
  const [activeTransaction, setActiveTransaction] = useState<{ type: TransactionType, data?: Transaction | null } | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  useEffect(() => {
    StorageService.init();
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
      className={`flex items-center w-full px-3 py-2.5 mb-0.5 text-[13px] font-medium rounded-lg transition-all ${
        activeTab === id && !viewingItem && !activeTransaction
        ? 'bg-white text-slate-800 shadow-sm' 
        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
      }`}
    >
      <Icon size={18} className="mr-3 flex-shrink-0" />
      <span className="whitespace-nowrap tracking-tight">{label}</span>
    </button>
  );

  if (isLoadingSession) return <div className="min-h-screen bg-white"></div>;
  if (!isLoggedIn) return <LoginPage onLogin={(user) => { setCurrentUser(user); setIsLoggedIn(true); StorageService.saveSession(user); }} />;

  return (
    <ToastProvider>
      <SearchProvider>
        <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans">
          {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/20 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>}

          <div className="flex h-screen overflow-hidden">
              <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-[#1e293b] flex flex-col text-slate-400 border-r border-slate-700/30 transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                  {/* BRAND HEADER */}
                  <div className="h-14 flex items-center justify-between px-5 border-b border-slate-700/50">
                      <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 flex items-center justify-center">
                              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                                  <circle cx="50" cy="50" r="14" fill="white"/>
                                  <circle cx="50" cy="15" r="7" fill="white"/>
                                  <circle cx="80.3" cy="32.5" r="7" fill="white"/>
                                  <circle cx="80.3" cy="67.5" r="7" fill="white"/>
                                  <circle cx="50" cy="85" r="7" fill="white"/>
                                  <circle cx="19.7" cy="67.5" r="7" fill="white"/>
                                  <circle cx="19.7" cy="32.5" r="7" fill="white"/>
                              </svg>
                          </div>
                          <div className="flex flex-col">
                              <span className="text-white font-semibold text-sm tracking-widest leading-none">RESEARCH</span>
                              <span className="text-slate-400 font-normal text-[10px] tracking-widest leading-none mt-1 uppercase">Centre</span>
                          </div>
                      </div>
                      <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1.5 text-slate-500 hover:text-white"><X size={18}/></button>
                  </div>

                  <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase mb-3 px-3 tracking-[0.15em] mt-2">Core Navigation</div>
                      <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
                      <NavItem id="INVENTORY" label="Stok Barang" icon={Package} />
                      <NavItem id="REPORTS" label="Mutasi Stok" icon={FileBarChart} />
                      <NavItem id="REJECT" label="Barang Reject" icon={AlertOctagon} />
                      
                      <div className="mt-6 text-[10px] font-semibold text-slate-500 uppercase mb-3 px-3 tracking-[0.15em]">Quick Action</div>
                      <div className="space-y-1 px-1">
                          <button onClick={() => { setActiveTransaction({ type: 'IN' }); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2 text-[12px] font-medium text-emerald-400 hover:bg-emerald-400/5 rounded-lg flex items-center transition-all border border-emerald-400/10">
                              <Plus size={14} className="mr-3"/> Penerimaan
                          </button>
                          <button onClick={() => { setActiveTransaction({ type: 'OUT' }); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2 text-[12px] font-medium text-rose-400 hover:bg-rose-400/5 rounded-lg flex items-center transition-all border border-rose-400/10">
                              <Plus size={14} className="mr-3"/> Pengiriman
                          </button>
                      </div>
                      
                      <div className="mt-auto border-t border-slate-700/50 pt-3">
                          <NavItem id="SETTINGS" label="Pengaturan" icon={Settings} />
                          <button onClick={handleLogout} className="flex items-center w-full px-3 py-2.5 text-[13px] font-medium rounded-lg transition-all text-slate-400 hover:text-rose-400 hover:bg-rose-400/5 mt-1">
                              <LogOut size={18} className="mr-3 flex-shrink-0" />
                              <span>Keluar Sistem</span>
                          </button>
                      </div>
                  </div>
              </aside>

              <main className="flex-1 flex flex-col overflow-hidden">
                  {/* SLIM TOPBAR - DARK THEME SOFT */}
                  <header className="h-12 bg-[#1e293b] border-b border-slate-700/50 flex items-center justify-between px-5 z-30 shrink-0">
                      <div className="flex items-center gap-4">
                          <button onClick={() => setIsSidebarOpen(true)} className={`p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 lg:${isSidebarOpen ? 'hidden' : 'block'}`}><Menu size={18} /></button>
                          <div className="text-xs font-medium text-slate-300">
                              {(viewingItem || activeTransaction) ? (
                                  <button onClick={() => { setViewingItem(null); setActiveTransaction(null); }} className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
                                      <ArrowLeft size={16}/> <span className="uppercase tracking-wide text-[10px]">Kembali Ke List</span>
                                  </button>
                              ) : (
                                  <span className="uppercase tracking-widest text-[10px] text-slate-500 font-bold">{activeTab}</span>
                              )}
                          </div>
                      </div>
                      
                      {!activeTransaction && !viewingItem && (
                          <div className="flex-1 max-w-xs mx-4">
                              <GlobalSearch onSelectItem={(item) => setViewingItem(item)} />
                          </div>
                      )}

                      <div className="flex items-center gap-3 shrink-0">
                          <LowStockAlert />
                          <MusicPlayer />
                          <div className="flex items-center gap-3 pl-3 border-l border-slate-700/50">
                              <div className="hidden md:block text-right">
                                  <p className="text-[11px] font-semibold text-slate-200 leading-none">{currentUser?.name}</p>
                                  <p className="text-[9px] text-slate-500 font-medium uppercase mt-1 tracking-wider">{currentUser?.role}</p>
                              </div>
                              <div className="w-7 h-7 rounded-full bg-slate-700/50 text-slate-200 border border-slate-600/50 flex items-center justify-center font-bold text-[10px]">
                                  {currentUser?.name.substring(0,2).toUpperCase()}
                              </div>
                          </div>
                      </div>
                  </header>

                  <div className="flex-1 overflow-auto bg-[#f8fafc]">
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
                            {activeTab === 'REPORTS' && (
                                <ReportsView 
                                    onEditTransaction={(tx) => setActiveTransaction({ type: tx.type, data: tx })} 
                                    onCreateTransaction={(type) => setActiveTransaction({ type })}
                                />
                            )}
                            {activeTab === 'SETTINGS' && <SettingsView />}
                            {activeTab === 'REJECT' && <RejectView />}
                          </>
                      )}
                  </div>
              </main>
          </div>
          <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
          `}</style>
        </div>
      </SearchProvider>
    </ToastProvider>
  );
}

export default App;
