import React, { useState, useEffect } from 'react';
import { StorageService } from './services/storage';
import { InventoryView } from './components/InventoryView';
import { TransactionForm } from './components/TransactionForm';
import { ReportsView } from './components/ReportsView';
import { DashboardView } from './components/DashboardView';
import { GlobalSearch } from './components/GlobalSearch';
import { StockCardModal } from './components/StockCardModal';
import { LayoutDashboard, Package, ArrowLeftRight, FileBarChart, ChevronRight, Warehouse as WhIcon } from 'lucide-react';
import { TransactionType, Transaction, Item } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY' | 'REPORTS'>('DASHBOARD');
  
  // Transaction Modal State
  const [showTransactionModal, setShowTransactionModal] = useState<TransactionType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Stock Card Modal State
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  useEffect(() => {
    StorageService.init();
    
    // Global keyboard shortcut to focus search
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
            e.preventDefault();
            const searchInput = document.querySelector('input[placeholder*="Search items"]') as HTMLInputElement;
            searchInput?.focus();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleEditTransaction = (tx: Transaction) => {
      setEditingTransaction(tx);
      setShowTransactionModal(tx.type);
  };

  const NavItem = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center w-full p-3 mb-1 text-sm font-medium rounded-lg transition-colors ${
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
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex-shrink-0 flex flex-col text-slate-300">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
              <WhIcon className="text-white" size={20} />
           </div>
           <h1 className="font-bold text-lg text-white tracking-tight">GudangPro</h1>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
           <div className="text-xs font-bold text-slate-500 uppercase mb-4 px-3">Main Menu</div>
           <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
           <NavItem id="INVENTORY" label="Stock Inventory" icon={Package} />
           <NavItem id="REPORTS" label="Mutation Reports" icon={FileBarChart} />
           
           <div className="mt-8 text-xs font-bold text-slate-500 uppercase mb-4 px-3">Quick Transactions</div>
           <div className="space-y-2">
              <button onClick={() => { setShowTransactionModal('IN'); setEditingTransaction(null); }} className="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-slate-800 rounded flex items-center">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3"></div> Inbound (Masuk)
              </button>
              <button onClick={() => { setShowTransactionModal('OUT'); setEditingTransaction(null); }} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded flex items-center">
                 <div className="w-2 h-2 rounded-full bg-red-500 mr-3"></div> Outbound (Keluar)
              </button>
              <button onClick={() => { setShowTransactionModal('TRANSFER'); setEditingTransaction(null); }} className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-slate-800 rounded flex items-center">
                 <div className="w-2 h-2 rounded-full bg-blue-500 mr-3"></div> Transfer Stock
              </button>
           </div>
        </div>
        
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
           v1.0.0 &copy; 2024 GudangPro
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
         <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10 gap-8">
             <div className="flex-shrink-0">
                <h2 className="text-xl font-bold text-slate-700 hidden md:block">
                    {activeTab === 'DASHBOARD' && 'Executive Dashboard'}
                    {activeTab === 'INVENTORY' && 'Inventory Master Data'}
                    {activeTab === 'REPORTS' && 'Stock Mutation Reports'}
                </h2>
             </div>
             
             {/* Global Search Bar */}
             <div className="flex-1 max-w-xl">
                <GlobalSearch onSelectItem={setViewingItem} />
             </div>

             <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right hidden sm:block">
                    <div className="text-sm font-bold text-slate-800">Administrator</div>
                    <div className="text-xs text-slate-500">Head of Logistics</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200">
                    AD
                </div>
             </div>
         </header>

         <div className="flex-1 overflow-hidden relative">
             {activeTab === 'DASHBOARD' && <DashboardView />}
             {activeTab === 'INVENTORY' && <InventoryView />}
             {activeTab === 'REPORTS' && <ReportsView onEditTransaction={handleEditTransaction} />}
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
                    // Force refresh logic via key or temporary toggle (simplified)
                    const current = activeTab;
                    setActiveTab('DASHBOARD'); // Hack to force re-render Dashboard if active
                    // Ideally use a context or a real refresh trigger
                    if (current !== 'DASHBOARD') setTimeout(() => setActiveTab(current), 50);
                    else setTimeout(() => window.location.reload(), 50); // Simple refresh for dashboard data
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