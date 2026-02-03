
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
import { LayoutDashboard, Package, FileBarChart, ChevronRight, Warehouse as WhIcon, Settings, AlertOctagon, Menu, LogOut, User as UserIcon } from 'lucide-react';
import { TransactionType, Transaction, Item } from './types';

function App() {
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY' | 'REPORTS' | 'SETTINGS' | 'REJECT'>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Transaction Modal State
  const [showTransactionModal, setShowTransactionModal] = useState<TransactionType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Stock Card Modal State
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  useEffect(() => {
    StorageService.init();
    
    // Force dark mode class for custom palette consistency
    document.documentElement.classList.add('dark');

    // Restore Session
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

  // Don't render until we check session
  if (isLoadingSession) return <div className="min-h-screen bg-daintree"></div>;

  // --- RENDER LOGIN PAGE IF NOT LOGGED IN ---
  if (!isLoggedIn) {
      return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-daintree font-sans text-slate-200 transition-colors duration-300">
        
        {/* Sidebar */}
        <aside className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-gable flex-shrink-0 flex flex-col text-slate-300 shadow-2xl z-30 transition-all duration-300 ease-in-out overflow-hidden border-r border-spectra/30`}>
          <div className="h-20 flex flex-col justify-center px-6 border-b border-spectra/30 whitespace-nowrap bg-daintree">
             <div className="flex items-center leading-none">
                <span className="text-white font-black text-2xl tracking-tighter">ware</span>
                <span className="text-cutty font-black text-2xl tracking-tighter">SIX</span>
             </div>
             <div className="text-[10px] font-bold text-slate-500 tracking-[0.3em] mt-1">MANAGEMENT</div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto whitespace-nowrap scrollbar-hide">
             <div className="text-xs font-bold text-slate-500 uppercase mb-4 px-3 tracking-widest">Main Menu</div>
             <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
             <NavItem id="INVENTORY" label="Stock Inventory" icon={Package} />
             <NavItem id="REPORTS" label="Mutation Reports" icon={FileBarChart} />
             <NavItem id="REJECT" label="Reject / Afkir" icon={AlertOctagon} />
             
             <div className="mt-8 text-xs font-bold text-slate-500 uppercase mb-4 px-3 tracking-widest">Quick Actions</div>
             <div className="space-y-2">
                <button onClick={() => { setShowTransactionModal('IN'); setEditingTransaction(null); }} className="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-spectra/30 rounded-lg flex items-center transition-colors whitespace-nowrap">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 flex-shrink-0"></div> Inbound
                </button>
                <button onClick={() => { setShowTransactionModal('OUT'); setEditingTransaction(null); }} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-spectra/30 rounded-lg flex items-center transition-colors whitespace-nowrap">
                   <div className="w-2 h-2 rounded-full bg-red-500 mr-3 flex-shrink-0"></div> Outbound
                </button>
             </div>
             
             <div className="mt-8 border-t border-spectra/30 pt-4">
                 <NavItem id="SETTINGS" label="Settings" icon={Settings} />
                 <button onClick={handleLogout} className="flex items-center w-full p-3 mb-1 text-sm font-medium rounded-lg transition-all text-red-400 hover:bg-red-900/20 hover:text-red-300 mt-2">
                     <LogOut size={18} className="mr-3 flex-shrink-0" />
                     <span className="whitespace-nowrap">Log Out</span>
                 </button>
             </div>
          </div>
          
          <div className="p-4 border-t border-spectra/30 bg-daintree text-xs text-slate-500 flex justify-between items-center whitespace-nowrap">
             <span>v1.2.0 &copy; 2024</span>
             <span className="font-bold text-cutty">Premium</span>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
           <header className="h-16 bg-gable border-b border-spectra/50 flex items-center justify-between px-6 shadow-sm z-20 transition-colors text-slate-200">
               <div className="flex items-center gap-4">
                  <button 
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-spectra/50 transition-colors focus:outline-none"
                      title="Toggle Sidebar"
                  >
                      <Menu size={20} />
                  </button>
                  <div className="flex-shrink-0 flex flex-col">
                      <h2 className="text-lg font-bold text-white leading-tight">
                          {activeTab === 'DASHBOARD' && 'Executive Dashboard'}
                          {activeTab === 'INVENTORY' && 'Inventory Master Data'}
                          {activeTab === 'REPORTS' && 'Stock Mutation Reports'}
                          {activeTab === 'SETTINGS' && 'System Configuration'}
                          {activeTab === 'REJECT' && 'Reject / Afkir Management'}
                      </h2>
                      <div className="text-[10px] text-cutty font-bold uppercase tracking-wider">Warehouse Management System</div>
                  </div>
               </div>
               
               {/* Center Widgets */}
               <div className="flex-1 flex justify-center px-4">
                  <ClockWidget />
               </div>

               <div className="flex items-center gap-3 flex-shrink-0">
                  <MusicPlayer />
                  <div className="h-8 w-px bg-spectra mx-1"></div>
                  <ThemeToggle />
                  
                  <div className="flex items-center gap-3 pl-3 border-l border-spectra">
                      <div className="text-right hidden sm:block">
                          <div className="text-xs font-bold text-slate-200">{currentUser?.name}</div>
                          <div className="text-[10px] text-cutty uppercase font-bold">{currentUser?.role}</div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-spectra to-daintree flex items-center justify-center text-white font-bold border border-cutty shadow-md">
                          {currentUser?.name.substring(0,2).toUpperCase() || 'AD'}
                      </div>
                  </div>
               </div>
           </header>

           <div className="flex-1 overflow-hidden relative bg-daintree transition-colors">
               {activeTab === 'DASHBOARD' && <DashboardView />}
               {activeTab === 'INVENTORY' && <InventoryView />}
               {activeTab === 'REPORTS' && <ReportsView onEditTransaction={handleEditTransaction} />}
               {activeTab === 'SETTINGS' && <SettingsView />}
               {activeTab === 'REJECT' && <RejectView />}
           </div>

           {/* Transaction Modal Overlay */}
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

           {/* Stock Card Modal */}
           {viewingItem && (
              <StockCardModal 
                  item={viewingItem} 
                  onClose={() => setViewingItem(null)} 
              />
           )}
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;
