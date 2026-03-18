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
  Sun, Moon,
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
type Theme = 'dark' | 'light';

// ─────────────────────────────────────────────
// Theme tokens — satu tempat untuk semua warna
// ─────────────────────────────────────────────
const THEME = {
  dark: {
    // Layout
    pageBg:         'bg-slate-950',
    sidebarBg:      'linear-gradient(180deg, #1e293b 0%, #1a2332 100%)',
    sidebarBrand:   'rgba(15,23,42,0.5)',
    sidebarBorder:  'border-slate-700/80',
    // Topbar
    topbarBg:       'bg-slate-800',
    topbarBorder:   'border-slate-700',
    topbarSep:      'border-slate-700',
    // Text
    textPrimary:    'text-slate-200',
    textSecondary:  'text-slate-400',
    textMuted:      'text-slate-500',
    // Interactive
    btnHover:       'hover:bg-slate-700 hover:text-slate-200',
    btnIcon:        'text-slate-400',
    // Avatar
    avatarBg:       'bg-sky-500/20 border-sky-500/30 text-sky-300',
    // Content
    contentBg:      'bg-slate-900',
    // Scrollbar
    scrollThumb:    '#475569',
    scrollThumbHover: '#64748b',
    // Backdrop
    backdropMobile: 'bg-slate-900/20',
  },
  light: {
    // Layout
    pageBg:         'bg-slate-50',
    sidebarBg:      'linear-gradient(180deg, #1e293b 0%, #1a2332 100%)',
    sidebarBrand:   'rgba(15,23,42,0.5)',
    sidebarBorder:  'border-slate-700/80',
    // Topbar
    topbarBg:       'bg-white',
    topbarBorder:   'border-slate-200',
    topbarSep:      'border-slate-200',
    // Text
    textPrimary:    'text-slate-700',
    textSecondary:  'text-slate-500',
    textMuted:      'text-slate-400',
    // Interactive
    btnHover:       'hover:bg-slate-100 hover:text-slate-700',
    btnIcon:        'text-slate-400',
    // Avatar
    avatarBg:       'bg-sky-50 border-sky-200 text-sky-600',
    // Content
    contentBg:      'bg-slate-50',
    // Scrollbar
    scrollThumb:    '#cbd5e1',
    scrollThumbHover: '#94a3b8',
    // Backdrop
    backdropMobile: 'bg-slate-900/20',
  },
} as const;

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

  // ── Theme state — persist ke localStorage ──
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('gp_theme') as Theme) ?? 'dark';
    } catch {
      return 'dark';
    }
  });

  const t = THEME[theme];

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('gp_theme', next); } catch {}
      return next;
    });
  }, []);

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
          .custom-scrollbar::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${t.scrollThumbHover}; }
          @keyframes appFadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
          .app-animate-in { animation: appFadeIn 0.2s ease-out forwards; }
          @keyframes themePop { 0% { transform: scale(1); } 50% { transform: scale(1.2) rotate(12deg); } 100% { transform: scale(1) rotate(0deg); } }
          .theme-btn-anim { animation: themePop 0.3s ease-out; }
        `}</style>

        <div className={`min-h-screen ${t.pageBg} relative overflow-hidden font-sans transition-colors duration-300`}>

          {/* Mobile sidebar backdrop */}
          {isSidebarOpen && (
            <div
              className={`fixed inset-0 ${t.backdropMobile} z-40 lg:hidden backdrop-blur-[2px]`}
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          <div className="flex h-screen overflow-hidden">

            {/* ── SIDEBAR ── */}
            <aside className={`
              fixed inset-y-0 left-0 z-50 w-56 flex flex-col text-slate-300
              border-r ${t.sidebarBorder} transition-transform duration-300
              lg:relative lg:translate-x-0
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
              style={{ background: t.sidebarBg }}
            >
              {/* Brand header */}
              <div className="h-14 flex items-center justify-between px-4 border-b border-slate-700/60 shrink-0"
                style={{ background: t.sidebarBrand }}>
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
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-2 px-3 tracking-widest mt-3">
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

                  {/* User card */}
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
            <main className="flex-1 flex flex-col overflow-hidden">

              {/* ── TOPBAR ── */}
              <header className={`
                h-12 ${t.topbarBg} border-b ${t.topbarBorder}
                flex items-center justify-between px-4
                z-30 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]
                transition-colors duration-300
              `}>
                <div className="flex items-center gap-3">
                  {/* Hamburger */}
                  {!isSidebarOpen && (
                    <button
                      onClick={() => setIsSidebarOpen(true)}
                      className={`p-1.5 rounded-lg ${t.btnIcon} ${t.btnHover} transition-colors`}
                      aria-label="Buka sidebar"
                    >
                      <Menu size={16} />
                    </button>
                  )}

                  {/* Breadcrumb / back */}
                  {hasOverlay ? (
                    <button
                      onClick={handleBack}
                      className={`flex items-center gap-1.5 ${t.textSecondary} transition-colors group`}
                    >
                      <div className={`p-1 rounded-md group-hover:${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'} transition-colors`}>
                        <ArrowLeft size={14} />
                      </div>
                      <span className={`uppercase tracking-tight text-[10px] font-bold ${t.textSecondary}`}>Kembali</span>
                    </button>
                  ) : (
                    <span className={`text-[11px] font-semibold ${t.textPrimary}`}>
                      {TAB_LABELS[activeTab]}
                    </span>
                  )}
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

                  {/* ── Theme toggle ── */}
                  <button
                    onClick={toggleTheme}
                    className={`p-1.5 rounded-lg ${t.btnIcon} ${t.btnHover} transition-colors`}
                    title={theme === 'dark' ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}
                    aria-label="Toggle tema"
                  >
                    {theme === 'dark'
                      ? <Sun size={15} className="text-amber-400" />
                      : <Moon size={15} className="text-slate-500" />
                    }
                  </button>

                  {/* User pill */}
                  <div className={`hidden md:flex items-center gap-2 pl-3 border-l ${t.topbarSep} ml-1`}>
                    <div className="text-right">
                      <p className={`text-[11px] font-semibold ${t.textPrimary} leading-none`}>{currentUser.name}</p>
                      <p className={`text-[9px] ${t.textMuted} font-medium uppercase mt-0.5 tracking-tight`}>{currentUser.role}</p>
                    </div>
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-[10px] shadow-sm ${t.avatarBg}`}>
                      {avatarInitials}
                    </div>
                  </div>
                </div>
              </header>

              {/* Page content */}
              <div className={`flex-1 overflow-auto ${t.contentBg} transition-colors duration-300`}>
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
                  <div className={`${t.contentBg} min-h-full app-animate-in`}>
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
