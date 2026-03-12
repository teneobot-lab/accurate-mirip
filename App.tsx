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

// FIX #6: Typed user instead of `any`
export interface AppUser {
  id: string;
  name: string;
  role: string;
}

type TabId = 'DASHBOARD' | 'INVENTORY' | 'REPORTS' | 'SETTINGS' | 'REJECT';

// FIX #10: Single unified app state instead of two separate booleans
type AppState = 'loading' | 'ready' | 'logging-out';

// ─────────────────────────────────────────────
// Sub-components (extracted OUT of App — FIX #2)
// ─────────────────────────────────────────────

// FIX #9: Single reusable logo component — no more duplicated SVG
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
  hasOverlay: boolean; // viewingItem || activeTransaction
  onClick: (id: TabId) => void;
}

// FIX #2: NavItem lives outside App — no remount on every App render
const NavItem: React.FC<NavItemProps> = ({ id, label, icon: Icon, activeTab, hasOverlay, onClick }) => {
  const isActive = activeTab === id && !hasOverlay;
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center w-full px-3 py-2 mb-0.5 text-[12px] font-medium rounded-lg transition-all ${
        isActive
          ? 'bg-brand/10 text-brand shadow-sm border border-brand/20'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
      }`}
    >
      <Icon size={16} className="mr-3 flex-shrink-0" />
      <span className="whitespace-nowrap tracking-tight">{label}</span>
    </button>
  );
};

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────
function App() {
  // FIX #10: unified app state
  const [appState, setAppState] = useState<AppState>('loading');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('DASHBOARD');

  // FIX #3: lazy initializer — no sidebar flash on desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024
  );

  const [activeTransaction, setActiveTransaction] = useState<{
    type: TransactionType;
    data?: Transaction | null;
  } | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  // FIX #4: ref to hold logout timer for cleanup
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Boot: init storage then restore session ──
  useEffect(() => {
    // FIX #5: await async init before reading session
    const boot = async () => {
      try {
        await StorageService.init();
      } catch {
        // Storage init failed — continue without session
      }
      const savedSession = StorageService.getSession() as AppUser | null;
      if (savedSession) setCurrentUser(savedSession);
      setAppState('ready');
    };
    boot();
  }, []);

  // FIX #4: clear logout timer on unmount
  useEffect(() => {
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);

  // FIX #7: resize listener to sync sidebar state
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setIsSidebarOpen(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Handlers ──

  const handleLogin = useCallback((user: AppUser) => {
    setCurrentUser(user);
    StorageService.saveSession(user);
    setAppState('ready');
  }, []);

  // FIX #4: clearTimeout before setting new timer; no setState after unmount
  const handleLogout = useCallback(() => {
    setAppState('logging-out');
    logoutTimerRef.current = setTimeout(() => {
      StorageService.clearSession();
      setCurrentUser(null);
      setActiveTab('DASHBOARD');
      setViewingItem(null);
      setActiveTransaction(null);
      setAppState('ready'); // triggers re-render to LoginPage (currentUser null)
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

  // FIX #1: safe avatar initials
  const avatarInitials = currentUser?.name?.substring(0, 2).toUpperCase() ?? '??';

  // ── Loading splash ──
  if (appState === 'loading') {
    return <div className="min-h-screen bg-mist-50" />;
  }

  // ── Login screen ──
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // ── Main app ──
  return (
    <ToastProvider>
      <SearchProvider>
        {/* FIX #8: global styles moved to a <style> tag but scoped — ideally move to index.css */}
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 3px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cdcfdb; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #aeb1c2; }
          @keyframes appFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
          .app-animate-in { animation: appFadeIn 0.25s ease-out forwards; }
        `}</style>

        <div className="min-h-screen bg-mist-50 relative overflow-hidden font-sans">

          {/* Mobile sidebar backdrop */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-slate-900/10 z-40 lg:hidden backdrop-blur-[1px]"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          <div className="flex h-screen overflow-hidden">

            {/* ── SIDEBAR ── */}
            <aside className={`
              fixed inset-y-0 left-0 z-50 w-56 bg-slate-900 flex flex-col text-slate-300
              border-r border-slate-800 transition-transform duration-300
              lg:relative lg:translate-x-0
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>

              {/* Brand header */}
              <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center bg-brand rounded">
                    {/* FIX #9: reuse AppLogo */}
                    <AppLogo className="w-4 h-4" strokeColor="white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-semibold text-xs tracking-tight leading-none uppercase">GudangPro</span>
                    <span className="text-slate-500 font-normal text-[9px] tracking-widest leading-none mt-1 uppercase">Research</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded transition-colors"
                  aria-label="Tutup sidebar"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Nav content */}
              <div className="p-2 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase mb-2 px-3 tracking-widest mt-2">Main Menu</p>

                  {/* FIX #2: NavItem now receives props instead of closing over App state */}
                  <NavItem id="DASHBOARD"  label="Dashboard"     icon={LayoutDashboard} activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />
                  <NavItem id="INVENTORY"  label="Stok Barang"   icon={Package}         activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />
                  <NavItem id="REPORTS"    label="Mutasi Stok"   icon={FileBarChart}    activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />
                  <NavItem id="REJECT"     label="Barang Reject" icon={AlertOctagon}    activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />

                  <p className="mt-5 text-[10px] font-semibold text-slate-500 uppercase mb-2 px-3 tracking-widest">Aplikasi</p>
                  <button
                    onClick={openMusicPlayer}
                    className="flex items-center w-full px-3 py-2 mb-0.5 text-[12px] font-medium rounded-lg transition-all text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                  >
                    <Music size={16} className="mr-3 flex-shrink-0" />
                    <span className="whitespace-nowrap tracking-tight">Music Player</span>
                  </button>

                  <p className="mt-5 text-[10px] font-semibold text-slate-500 uppercase mb-2 px-3 tracking-widest">Transaksi</p>
                  <div className="space-y-0.5 px-1">
                    <button
                      onClick={() => openTransaction('IN')}
                      className="w-full text-left px-3 py-2 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/10 rounded-lg flex items-center transition-all border border-transparent hover:border-emerald-500/20"
                    >
                      <Plus size={14} className="mr-3" /> Penerimaan
                    </button>
                    <button
                      onClick={() => openTransaction('OUT')}
                      className="w-full text-left px-3 py-2 text-[11px] font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg flex items-center transition-all border border-transparent hover:border-rose-500/20"
                    >
                      <Plus size={14} className="mr-3" /> Pengiriman
                    </button>
                  </div>
                </div>

                {/* Bottom: settings + logout */}
                <div className="border-t border-slate-800 pt-2 mt-4">
                  <NavItem id="SETTINGS" label="Pengaturan" icon={Settings} activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 mt-0.5"
                  >
                    <LogOut size={16} className="mr-3 flex-shrink-0" />
                    <span>Log Out</span>
                  </button>

                  {/* User info at bottom of sidebar */}
                  <div className="mt-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-brand/20 border border-brand/30 text-brand flex items-center justify-center font-bold text-[10px] shrink-0">
                      {avatarInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-200 leading-none truncate">{currentUser.name}</p>
                      <p className="text-[9px] text-slate-500 font-medium uppercase mt-0.5 tracking-tight">{currentUser.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <main className="flex-1 flex flex-col overflow-hidden bg-mist-50">

              {/* Topbar */}
              <header className="h-12 bg-white border-b border-mist-300 flex items-center justify-between px-4 z-30 shrink-0">
                <div className="flex items-center gap-3">
                  {/* FIX #11: static Tailwind classes instead of interpolated */}
                  {!isSidebarOpen && (
                    <button
                      onClick={() => setIsSidebarOpen(true)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-mist-100"
                      aria-label="Buka sidebar"
                    >
                      <Menu size={16} />
                    </button>
                  )}

                  <div className="text-xs font-medium text-slate-500">
                    {hasOverlay ? (
                      <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        <ArrowLeft size={14} />
                        <span className="uppercase tracking-tight text-[10px] font-semibold">Kembali</span>
                      </button>
                    ) : (
                      <span className="uppercase tracking-widest text-[10px] text-slate-400 font-bold">{activeTab}</span>
                    )}
                  </div>
                </div>

                {/* Global search — hidden when overlay active */}
                {!hasOverlay && (
                  <div className="flex-1 max-w-xs mx-4">
                    <GlobalSearch onSelectItem={(item) => setViewingItem(item)} />
                  </div>
                )}

                <div className="flex items-center gap-2 shrink-0">
                  <ClockWidget />
                  <LowStockAlert />
                  <MusicPlayer />
                  {/* User pill — topbar (desktop, md+) */}
                  <div className="hidden md:flex items-center gap-2 pl-3 border-l border-mist-300 ml-1">
                    <div className="text-right">
                      {/* FIX #1: safe optional chaining */}
                      <p className="text-[11px] font-semibold text-slate-700 leading-none">{currentUser.name}</p>
                      <p className="text-[9px] text-slate-400 font-medium uppercase mt-1 tracking-tight">{currentUser.role}</p>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-white border border-mist-300 text-slate-500 flex items-center justify-center font-bold text-[10px] shadow-sm">
                      {avatarInitials}
                    </div>
                  </div>
                </div>
              </header>

              {/* Page content */}
              <div className="flex-1 overflow-auto bg-mist-50">
                {activeTransaction ? (
                  <TransactionForm
                    key={activeTransaction.data?.id ?? 'new'} // remount on different tx
                    type={activeTransaction.type}
                    initialData={activeTransaction.data}
                    onClose={() => setActiveTransaction(null)}
                    onSuccess={() => setActiveTransaction(null)}
                  />
                ) : viewingItem ? (
                  <StockCardView item={viewingItem} onBack={() => setViewingItem(null)} />
                ) : (
                  <div className="bg-mist-50 min-h-full app-animate-in">
                    {activeTab === 'DASHBOARD' && <DashboardView />}
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

          {/* ── LOGOUT OVERLAY — FIX #10 unified state ── */}
          {appState === 'logging-out' && (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm app-animate-in">
              <div className="w-16 h-16 flex items-center justify-center bg-white rounded-2xl mb-4 shadow-2xl animate-pulse">
                {/* FIX #9: reuse AppLogo */}
                <AppLogo className="w-10 h-10" strokeColor="#0f172a" />
              </div>
              <div className="flex items-center gap-3 text-white">
                <Loader2 size={20} className="animate-spin text-rose-500" />
                <span className="text-sm font-bold tracking-widest uppercase">Logging out...</span>
              </div>
            </div>
          )}
        </div>
      </SearchProvider>
    </ToastProvider>
  );
}

export default App;
