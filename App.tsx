
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
import { MusicPlayer } from './components/MusicPlayer';
import { LayoutDashboard, Package, FileBarChart, ChevronRight, Warehouse as WhIcon, Settings, AlertOctagon } from 'lucide-react';
import { TransactionType, Transaction, Item } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY' | 'REPORTS' | 'SETTINGS' | 'REJECT'>('DASHBOARD');
  
  // Transaction Modal State
  const [showTransactionModal, setShowTransactionModal] = useState<TransactionType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Stock Card Modal State
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  useEffect(() => {
    StorageService.init();
    
    // Check initial theme
    const theme = StorageService.getTheme();
    if (theme === 'dark') document.documentElement.classList.add('dark');
  }, []);

  const handleEditTransaction = (tx: Transaction) => {
      setEditingTransaction(tx);
      setShowTransactionModal(tx.type);
  };

  const NavItem = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center w-full p-3 mb-1 text-sm font-medium rounded-lg transition-all ${
        activeTab === id 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}
    >
      <Icon size={18} className="mr-3" />
      {label}
      {activeTab === id && <ChevronRight size={16} className="ml-auto opacity-50" />}
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex-shrink-0 flex flex-col text-slate-300 shadow-2xl z-30">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-blue-500/20">
              <WhIcon className="text-white" size={20} />
           </div>
           <h1 className="font-bold text-lg text-white tracking-tight">GudangPro</h1>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
           <div className="text-xs font-bold text-slate-500 uppercase mb-4 px-3 tracking-widest">Main Menu</div>
           <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
           <NavItem id="INVENTORY" label="Stock Inventory" icon={Package} />
           <NavItem id="REPORTS" label="Mutation Reports" icon={FileBarChart} />
           <NavItem id="REJECT" label="Reject / Afkir" icon={AlertOctagon} />
           
           <div className="mt-8 text-xs font-bold text-slate-500 uppercase mb-4 px-3 tracking-widest">Quick Actions</div>
           <div className="space-y-2">
              <button onClick={() => { setShowTransactionModal('IN'); setEditingTransaction(null); }} className="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-slate-800 rounded-lg flex items-center transition-colors">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3"></div> Inbound
              </button>
              <button onClick={() => { setShowTransactionModal('OUT'); setEditingTransaction(null); }} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-lg flex items-center transition-colors">
                 <div className="w-2 h-2 rounded-full bg-red-500 mr-3"></div> Outbound
              </button>
           </div>
           
           <div className="mt-8 border-t border-slate-800 pt-4">
               <NavItem id="SETTINGS" label="Settings" icon={Settings} />
           </div>
        </div>
        
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 flex justify-between items-center">
           <span>v1.2.0 &copy; 2024</span>
           <span className="font-bold text-blue-500">Premium</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
         <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shadow-sm z-20 transition-colors">
             <div className="flex-shrink-0 flex flex-col">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
                    {activeTab === 'DASHBOARD' && 'Executive Dashboard'}
                    {activeTab === 'INVENTORY' && 'Inventory Master Data'}
                    {activeTab === 'REPORTS' && 'Stock Mutation Reports'}
                    {activeTab === 'SETTINGS' && 'System Configuration'}
                    {activeTab === 'REJECT' && 'Reject / Afkir Management'}
                </h2>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Warehouse Management System</div>
             </div>
             
             {/* Center Widgets */}
             <div className="flex-1 flex justify-center px-4">
                <ClockWidget />
             </div>

             <div className="flex items-center gap-3 flex-shrink-0">
                <MusicPlayer />
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <ThemeToggle />
                
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold border border-blue-400 shadow-md">
                    AD
                </div>
             </div>
         </header>

         <div className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-slate-950 transition-colors">
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
  );
}

export default App;
