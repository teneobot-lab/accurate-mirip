
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
      className={`flex items-center w-full px-3 py-2 mb-0.5 text-[12px] font-medium rounded-lg transition-all ${
        activeTab === id && !viewingItem && !activeTransaction
        ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
      }`}
    >
      <Icon size={16} className="mr-3 flex-shrink-0" />
      <span className="whitespace-nowrap tracking-tight">{label}</span>
    </button>
  );

  if (isLoadingSession) return <div className="min-h-screen bg-white"></div>;
  if (!isLoggedIn) return <LoginPage onLogin={(user) => { setCurrentUser(user); setIsLoggedIn(true); StorageService.saveSession(user); }} />;

  return (
    <ToastProvider>
      <SearchProvider>
        <div className="min-h-screen bg-white relative overflow-hidden font-sans">
          {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/10 z-40 lg:hidden backdrop-blur-[1px]" onClick={() => setIsSidebarOpen(false)}></div>}

          <div className="flex h-screen overflow-hidden">
              <aside className={`fixed inset-y-0 left-0 z-50 w-56 bg-slate-50 flex flex-col text-slate-600 border-r border-slate-200 transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                  {/* BRAND HEADER */}
                  <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 bg-white/50 backdrop-blur-md">
                      <div className="flex items-center gap-2">
                          <div className="w-6 h-6 flex items-center justify-center bg-slate-800 rounded">
                              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4">
                                  <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="12"/>
                                  <path d="M50 30V70M30 50H70" stroke="white" strokeWidth="12"/>
                              </svg>
                          </div>
                          <div className="flex flex-col">
                              <span className="text-slate-800 font-semibold text-xs tracking-tight leading-none uppercase">GudangPro</span>
                              <span className="text-slate-400 font-normal text-[9px] tracking-widest leading-none mt-1 uppercase">Research</span>
                          </div>
                      </div>
                      <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600"><X size={16}/></button>
                  </div>

                  <div className="p-2 flex-1 overflow-y-auto custom-scrollbar">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase mb-2 px-3 tracking-widest mt-2">Main Menu</div>
                      <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
                      <NavItem id="INVENTORY" label="Stok Barang" icon={Package} />
                      <NavItem id="REPORTS" label="Mutasi Stok" icon={FileBarChart} />
                      <NavItem id="REJECT" label="Barang Reject" icon={AlertOctagon} />
                      
                      <div className="mt-5 text-[10px] font-semibold text-slate-400 uppercase mb-2 px-3 tracking-widest">Transaksi</div>
                      <div className="space-y-0.5 px-1">
                          <button onClick={() => { setActiveTransaction({ type: 'IN' }); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center transition-all border border-transparent hover:border-emerald-100">
                              <Plus size={14} className="mr-3"/> Penerimaan
                          </button>
                          <button onClick={() => { setActiveTransaction({ type: 'OUT' }); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2 text-[11px] font-medium text-rose-600 hover:bg-rose-50 rounded-lg flex items-center transition-all border border-transparent hover:border-rose-100">
                              <Plus size={14} className="mr-3"/> Pengiriman
                          </button>
                      </div>
                      
                      <div className="mt-auto border-t border-slate-200 pt-2">
                          <NavItem id="SETTINGS" label="Pengaturan" icon={Settings} />
                          <button onClick={handleLogout} className="flex items-center w-full px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-slate-500 hover:text-rose-600 hover:bg-rose-50 mt-0.5">
                              <LogOut size={16} className="mr-3 flex-shrink-0" />
                              <span>Log Out</span>
                          </button>
                      </div>
                  </div>
              </aside>

              <main className="flex-1 flex flex-col overflow-hidden bg-white">
                  {/* LIGHT TOPBAR */}
                  <header className="h-12 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4 z-30 shrink-0">
                      <div className="flex items-center gap-3">
                          <button onClick={() => setIsSidebarOpen(true)} className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 lg:${isSidebarOpen ? 'hidden' : 'block'}`}><Menu size={16} /></button>
                          <div className="text-xs font-medium text-slate-500">
                              {(viewingItem || activeTransaction) ? (
                                  <button onClick={() => { setViewingItem(null); setActiveTransaction(null); }} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
                                      <ArrowLeft size={14}/> <span className="uppercase tracking-tight text-[10px] font-semibold">Kembali</span>
                                  </button>
                              ) : (
                                  <span className="uppercase tracking-widest text-[10px] text-slate-400 font-bold">{activeTab}</span>
                              )}
                          </div>
                      </div>
                      
                      {!activeTransaction && !viewingItem && (
                          <div className="flex-1 max-w-xs mx-4">
                              <GlobalSearch onSelectItem={(item) => setViewingItem(item)} />
                          </div>
                      )}

                      <div className="flex items-center gap-2 shrink-0">
                          <LowStockAlert />
                          <MusicPlayer />
                          <div className="flex items-center gap-2 pl-3 border-l border-slate-200 ml-1">
                              <div className="hidden md:block text-right">
                                  <p className="text-[11px] font-semibold text-slate-700 leading-none">{currentUser?.name}</p>
                                  <p className="text-[9px] text-slate-400 font-medium uppercase mt-1 tracking-tight">{currentUser?.role}</p>
                              </div>
                              <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 flex items-center justify-center font-bold text-[10px] shadow-sm">
                                  {currentUser?.name.substring(0,2).toUpperCase()}
                              </div>
                          </div>
                      </div>
                  </header>

                  <div className="flex-1 overflow-auto bg-white">
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
                          <div className="bg-white min-h-full">
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
                          </div>
                      )}
                  </div>
              </main>
          </div>
          <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 3px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            
            /* Animasi Fade */
            .animate-in { animation: fadeIn 0.3s ease-in-out; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
        </div>
      </SearchProvider>
    </ToastProvider>
  );
}

export default App;
