
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
// Added Plus to imports
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
      className={`flex items-center w-full p-3 mb-1 text-sm font-semibold rounded-xl transition-all ${
        activeTab === id && !viewingItem && !activeTransaction
        ? 'bg-brand text-white shadow-md' 
        : 'text-slate-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon size={20} className="mr-3 flex-shrink-0" />
      <span className="whitespace-nowrap tracking-tight">{label}</span>
    </button>
  );

  if (isLoadingSession) return <div className="min-h-screen bg-white"></div>;
  if (!isLoggedIn) return <LoginPage onLogin={(user) => { setCurrentUser(user); setIsLoggedIn(true); StorageService.saveSession(user); }} />;

  return (
    <ToastProvider>
      <SearchProvider>
        <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans">
          {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>}

          <div className="flex h-screen overflow-hidden">
              <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0f172a] flex flex-col text-slate-300 shadow-xl transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                  <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#0f172a]">
                      <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white font-black text-lg">G</div>
                          <span className="text-white font-extrabold text-xl tracking-tighter">Gudang<span className="text-brand">Pro</span></span>
                      </div>
                      <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-white"><X size={20}/></button>
                  </div>

                  <div className="p-4 flex-1 overflow-y-auto">
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-4 px-3 tracking-[0.2em]">Menu Utama</div>
                      <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
                      <NavItem id="INVENTORY" label="Stok Barang" icon={Package} />
                      <NavItem id="REPORTS" label="Mutasi Stok" icon={FileBarChart} />
                      <NavItem id="REJECT" label="Barang Reject" icon={AlertOctagon} />
                      
                      <div className="mt-8 text-[10px] font-bold text-slate-500 uppercase mb-4 px-3 tracking-[0.2em]">Input Transaksi</div>
                      <div className="space-y-2">
                          <button onClick={() => { setActiveTransaction({ type: 'IN' }); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-emerald-400 hover:bg-emerald-400/10 rounded-xl flex items-center transition-all border border-emerald-400/20">
                              <Plus size={16} className="mr-3"/> Penerimaan (Masuk)
                          </button>
                          <button onClick={() => { setActiveTransaction({ type: 'OUT' }); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-400/10 rounded-xl flex items-center transition-all border border-rose-400/20">
                              <Plus size={16} className="mr-3"/> Pengiriman (Keluar)
                          </button>
                      </div>
                      
                      <div className="mt-auto border-t border-white/5 pt-4">
                          <NavItem id="SETTINGS" label="Pengaturan" icon={Settings} />
                          <button onClick={handleLogout} className="flex items-center w-full p-3 text-sm font-semibold rounded-xl transition-all text-rose-400 hover:bg-rose-400/10 mt-2">
                              <LogOut size={20} className="mr-3 flex-shrink-0" />
                              <span>Keluar Sistem</span>
                          </button>
                      </div>
                  </div>
              </aside>

              <main className="flex-1 flex flex-col overflow-hidden">
                  <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-30 shrink-0">
                      <div className="flex items-center gap-4">
                          <button onClick={() => setIsSidebarOpen(true)} className={`p-2 rounded-lg text-slate-500 hover:bg-slate-100 lg:${isSidebarOpen ? 'hidden' : 'block'}`}><Menu size={20} /></button>
                          <h2 className="text-sm lg:text-base font-bold text-slate-800 flex items-center gap-2">
                              {(viewingItem || activeTransaction) ? (
                                  <button onClick={() => { setViewingItem(null); setActiveTransaction(null); }} className="flex items-center gap-2 text-brand hover:underline">
                                      <ArrowLeft size={18}/> <span className="font-semibold uppercase tracking-tight text-xs">Kembali Ke List</span>
                                  </button>
                              ) : (
                                  <span className="uppercase tracking-widest text-xs text-slate-500">{activeTab}</span>
                              )}
                          </h2>
                      </div>
                      
                      {!activeTransaction && !viewingItem && (
                          <div className="flex-1 max-w-lg mx-8">
                              <GlobalSearch onSelectItem={(item) => setViewingItem(item)} />
                          </div>
                      )}

                      <div className="flex items-center gap-4 shrink-0">
                          <LowStockAlert />
                          <MusicPlayer />
                          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                              <div className="hidden md:block text-right">
                                  <p className="text-xs font-bold text-slate-800 leading-none">{currentUser?.name}</p>
                                  <p className="text-[10px] text-slate-500 font-medium uppercase mt-1">{currentUser?.role}</p>
                              </div>
                              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-brand font-black shadow-sm">
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
        </div>
      </SearchProvider>
    </ToastProvider>
  );
}

export default App;
