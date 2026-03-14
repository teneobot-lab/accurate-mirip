import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { ClockWidget } from './components/ClockWidget';
import { ToastProvider } from './components/Toast';
import { SearchProvider } from './search/SearchProvider';
import {
  LayoutDashboard, Package, FileBarChart, Settings,
  AlertOctagon, Menu, LogOut, X, ArrowLeft, Plus, Music, Loader2,
} from 'lucide-react';
import { TransactionType, Transaction, Item } from './types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface AppUser {
  id: string;
  name: string;
  role: string;
}

type TabId = 'DASHBOARD' | 'INVENTORY' | 'REPORTS' | 'SETTINGS' | 'REJECT';
type AppState = 'loading' | 'ready' | 'logging-out';

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
const AppLogo: React.FC<{ className?: string; strokeColor?: string }> = ({
  className = 'w-4 h-4',
  strokeColor = 'white',
}) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="50" cy="50" r="40" stroke={strokeColor} strokeWidth="12" />
    <path d="M50 30V70M30 50H70" stroke={strokeColor} strokeWidth="12" />
  </svg>
);

interface NavItemProps {
  id: TabId;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  activeTab: TabId;
  hasOverlay: boolean;
  onClick: (id: TabId) => void;
}

// Warna sidebar diperhalus: dari slate-900 pekat ke slate-800/slate-850
// Active state pakai warna lebih lembut, tidak terlalu kontras
const NavItem: React.FC<NavItemProps> = ({ id, label, icon: Icon, activeTab, hasOverlay, onClick }) => {
  const isActive = activeTab === id && !hasOverlay;
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center w-full px-3 py-2 mb-0.5 text-[12px] font-medium rounded-lg transition-all ${
        isActive
          ? 'bg-sky-500/15 text-sky-300 border border-sky-500/25'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 border border-transparent'
      }`}
    >
      <Icon size={15} className="mr-3 flex-shrink-0" />
      <span className="whitespace-nowrap tracking-tight">{label}</span>
      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />}
    </button>
  );
};

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────
function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('DASHBOARD');

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024
  );

  const [activeTransaction, setActiveTransaction] = useState<{
    type: TransactionType;
    data?: Transaction | null;
  } | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Boot
  useEffect(() => {
    const boot = async () => {
      try { await StorageService.init(); } catch {}
      const savedSession = StorageService.getSession() as AppUser | null;
      if (savedSession) setCurrentUser(savedSession);
      setAppState('ready');
    };
    boot();
  }, []);

  useEffect(() => {
    return () => { if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current); };
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setIsSidebarOpen(true); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Handlers ──
  const handleLogin = useCallback((user: AppUser) => {
    setCurrentUser(user);
    StorageService.saveSession(user);
    setAppState('ready');
  }, []);

  const handleLogout = useCallback(() => {
    setAppState('logging-out');
    logoutTimerRef.current = setTimeout(() => {
      StorageService.clearSession();
      setCurrentUser(null);
      setActiveTab('DASHBOARD');
      setViewingItem(null);
      setActiveTransaction(null);
      setAppState('ready');
    }, 800);
  }, []);

  const handleNavClick = useCallback((id: TabId) => {
    setActiveTab(id);
    setViewingItem(null);
    setActiveTransaction(null);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, []);

  const handleBack = useCallback(() => {
    setViewingItem(null);
    setActiveTransaction(null);
  }, []);

  const openMusicPlayer = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-music-player'));
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, []);

  const openTransaction = useCallback((txType: TransactionType) => {
    setActiveTransaction({ type: txType });
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, []);

  // ── Derived ──
  const hasOverlay = !!(viewingItem || activeTransaction);
  const avatarInitials = currentUser?.name?.substring(0, 2).toUpperCase() ?? '??';

  // ── Tab label mapping ──
  const TAB_LABELS: Record<TabId, string> = {
    DASHBOARD: 'Dashboard',
    INVENTORY: 'Stok Barang',
    REPORTS:   'Mutasi Stok',
    SETTINGS:  'Pengaturan',
    REJECT:    'Barang Reject',
  };

  if (appState === 'loading') return <div className="min-h-screen bg-slate-50" />;
  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  return (
    <ToastProvider>
      <SearchProvider>
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 3px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          @keyframes appFadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
          .app-animate-in { animation: appFadeIn 0.2s ease-out forwards; }
        `}</style>

        {/* 
          Warna background utama: slate-50 (off-white lembut) 
          bukan mist-50 yang terlalu dingin — lebih nyaman di mata
        */}
        <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans">

          {/* Mobile sidebar backdrop */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-slate-900/20 z-40 lg:hidden backdrop-blur-[2px]"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          <div className="flex h-screen overflow-hidden">

            {/* ── SIDEBAR ──
                Warna: slate-850 (antara slate-800 dan slate-900)
                Lebih terang dari sebelumnya — tidak terlalu gelap, mengurangi fatigue
            */}
            <aside className={`
              fixed inset-y-0 left-0 z-50 w-56 flex flex-col text-slate-300
              border-r border-slate-700/80 transition-transform duration-300
              lg:relative lg:translate-x-0
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
              style={{ background: 'linear-gradient(180deg, #1e293b 0%, #1a2332 100%)' }}
            >

              {/* Brand header */}
              <div className="h-14 flex items-center justify-between px-4 border-b border-slate-700/60 shrink-0"
                style={{ background: 'rgba(15,23,42,0.5)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 flex items-center justify-center bg-sky-500 rounded-lg shadow-md shadow-sky-500/30">
                    <AppLogo className="w-4 h-4" strokeColor="white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-bold text-xs tracking-tight leading-none">GudangPro</span>
                    <span className="text-slate-500 font-normal text-[9px] tracking-widest leading-none mt-1 uppercase">Research</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="lg:hidden p-1.5 text-slate-500 hover:text-slate-200 rounded transition-colors"
                  aria-label="Tutup sidebar"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Nav content */}
              <div className="p-2 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                <div className="flex-1">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-2 px-3 tracking-widest mt-3 letter-spacing-widest">
                    Menu Utama
                  </p>

                  <NavItem id="DASHBOARD"  label="Dashboard"     icon={LayoutDashboard} activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />
                  <NavItem id="INVENTORY"  label="Stok Barang"   icon={Package}         activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />
                  <NavItem id="REPORTS"    label="Mutasi Stok"   icon={FileBarChart}    activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />
                  <NavItem id="REJECT"     label="Barang Reject" icon={AlertOctagon}    activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />

                  <p className="mt-5 text-[9px] font-bold text-slate-500 uppercase mb-2 px-3 tracking-widest">Aplikasi</p>
                  <button
                    onClick={openMusicPlayer}
                    className="flex items-center w-full px-3 py-2 mb-0.5 text-[12px] font-medium rounded-lg transition-all text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 border border-transparent"
                  >
                    <Music size={15} className="mr-3 flex-shrink-0" />
                    <span className="whitespace-nowrap tracking-tight">Music Player</span>
                  </button>

                  <p className="mt-5 text-[9px] font-bold text-slate-500 uppercase mb-2 px-3 tracking-widest">Transaksi</p>
                  <div className="space-y-0.5 px-0.5">
                    {/* Tombol transaksi — warna lebih soft, tidak terlalu saturated */}
                    <button
                      onClick={() => openTransaction('IN')}
                      className="w-full text-left px-3 py-2 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/10 rounded-lg flex items-center gap-2.5 transition-all border border-transparent hover:border-emerald-500/20"
                    >
                      <div className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <Plus size={10} className="text-emerald-400" />
                      </div>
                      Penerimaan
                    </button>
                    <button
                      onClick={() => openTransaction('OUT')}
                      className="w-full text-left px-3 py-2 text-[11px] font-semibold text-rose-400 hover:bg-rose-500/10 rounded-lg flex items-center gap-2.5 transition-all border border-transparent hover:border-rose-500/20"
                    >
                      <div className="w-4 h-4 rounded bg-rose-500/20 flex items-center justify-center shrink-0">
                        <Plus size={10} className="text-rose-400" />
                      </div>
                      Pengiriman
                    </button>
                  </div>
                </div>

                {/* Bottom: settings + logout + user card */}
                <div className="border-t border-slate-700/60 pt-2 mt-4">
                  <NavItem id="SETTINGS" label="Pengaturan" icon={Settings} activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 mt-0.5"
                  >
                    <LogOut size={15} className="mr-3 flex-shrink-0" />
                    <span>Keluar</span>
                  </button>

                  {/* User card — lebih compact dan soft */}
                  <div className="mt-2 px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sky-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {avatarInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-slate-200 leading-none truncate">{currentUser.name}</p>
                      <p className="text-[9px] text-slate-500 font-medium uppercase mt-0.5 tracking-tight">{currentUser.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">

              {/* Topbar — putih bersih dengan shadow subtle */}
              <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-3">
                  {!isSidebarOpen && (
                    <button
                      onClick={() => setIsSidebarOpen(true)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      aria-label="Buka sidebar"
                    >
                      <Menu size={16} />
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    {hasOverlay ? (
                      <button
                        onClick={handleBack}
                        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors group"
                      >
                        <div className="p-1 rounded-md group-hover:bg-slate-100 transition-colors">
                          <ArrowLeft size={14} />
                        </div>
                        <span className="uppercase tracking-tight text-[10px] font-bold text-slate-500">Kembali</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        {/* Breadcrumb sederhana */}
                        <span className="text-[11px] font-semibold text-slate-700">
                          {TAB_LABELS[activeTab]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Global search */}
                {!hasOverlay && (
                  <div className="flex-1 max-w-sm mx-4">
                    <GlobalSearch onSelectItem={(item) => setViewingItem(item)} />
                  </div>
                )}

                <div className="flex items-center gap-1.5 shrink-0">
                  <ClockWidget />
                  <LowStockAlert />
                  <MusicPlayer />

                  {/* User pill — topbar */}
                  <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-200 ml-1">
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-slate-700 leading-none">{currentUser.name}</p>
                      <p className="text-[9px] text-slate-400 font-medium uppercase mt-0.5 tracking-tight">{currentUser.role}</p>
                    </div>
                    {/* Avatar — warna sky lebih segar dari slate */}
                    <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center font-bold text-[10px] shadow-sm">
                      {avatarInitials}
                    </div>
                  </div>
                </div>
              </header>

              {/* Page content */}
              <div className="flex-1 overflow-auto bg-slate-50">
                {activeTransaction ? (
                  <TransactionForm
                    key={activeTransaction.data?.id ?? 'new'}
                    type={activeTransaction.type}
                    initialData={activeTransaction.data}
                    onClose={() => setActiveTransaction(null)}
                    onSuccess={() => setActiveTransaction(null)}
                  />
                ) : viewingItem ? (
                  <StockCardView item={viewingItem} onBack={() => setViewingItem(null)} />
                ) : (
                  <div className="bg-slate-50 min-h-full app-animate-in">
                    {activeTab === 'DASHBOARD' && (
                      <DashboardView
                        onEditTransaction={(tx) => setActiveTransaction({ type: tx.type, data: tx })}
                        onViewItem={(item) => setViewingItem(item)}
                        onNavigate={(tab) => handleNavClick(tab)}
                      />
                    )}
                    {activeTab === 'INVENTORY' && (
                      <InventoryView onViewItem={(item) => setViewingItem(item)} />
                    )}
                    {activeTab === 'REPORTS' && (
                      <ReportsView
                        onEditTransaction={(tx) => setActiveTransaction({ type: tx.type, data: tx })}
                        onCreateTransaction={(type) => setActiveTransaction({ type })}
                      />
                    )}
                    {activeTab === 'SETTINGS' && <SettingsView />}
                    {activeTab === 'REJECT'   && <RejectView />}
                  </div>
                )}
              </div>
            </main>
          </div>

          {/* Logout overlay */}
          {appState === 'logging-out' && (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-sm app-animate-in">
              <div className="w-16 h-16 flex items-center justify-center bg-white rounded-2xl mb-4 shadow-2xl animate-pulse">
                <AppLogo className="w-10 h-10" strokeColor="#0f172a" />
              </div>
              <div className="flex items-center gap-3 text-white">
                <Loader2 size={18} className="animate-spin text-sky-400" />
                <span className="text-sm font-semibold tracking-widest uppercase text-slate-200">Keluar...</span>
              </div>
            </div>
          )}
        </div>
      </SearchProvider>
    </ToastProvider>
  );
}

export default App;
