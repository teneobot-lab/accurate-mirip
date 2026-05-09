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

// ── ZINE / GRUNGE PALETTE ──────────────────────────────────────
// Primary: hsl(325 100% 50%) Hot Pink  |  Accent: hsl(60 100% 50%) Yellow
// Light bg: hsl(40 10% 96%)  |  Dark bg: hsl(20 10% 10%)
// Border radius: 0 everywhere  |  Shadow: 4px solid offset
const THEME = {
  dark: {
    pageBg:         '[background-color:hsl(20,10%,18%)]',
    sidebarBg:      'hsl(20,10%,14%)',
    sidebarBrand:   'rgba(0,0,0,0.4)',
    sidebarBorder:  'border-[hsl(40,10%,96%)]',
    topbarBg:       '[background-color:hsl(20,10%,21%)]',
    topbarBorder:   'border-[hsl(40,10%,96%)]',
    topbarSep:      'border-[hsl(40,10%,96%)]',
    textPrimary:    'text-[hsl(40,10%,96%)]',
    textSecondary:  'text-[hsl(40,10%,75%)]',
    textMuted:      'text-[hsl(20,10%,45%)]',
    btnHover:       'hover:bg-[hsl(325,100%,50%)] hover:text-[hsl(40,10%,96%)]',
    btnIcon:        'text-[hsl(40,10%,70%)]',
    avatarBg:       'bg-[hsl(325,100%,50%)] border-[hsl(325,100%,40%)] text-white',
    contentBg:      '[background-color:hsl(20,10%,18%)]',
    scrollThumb:    'hsl(40,10%,96%)',
    scrollThumbHover: 'hsl(325,100%,50%)',
    backdropMobile: 'bg-black/40',
  },
  light: {
    pageBg:         '[background-color:hsl(40,10%,96%)]',
    sidebarBg:      'hsl(20,10%,18%)',
    sidebarBrand:   'rgba(0,0,0,0.3)',
    sidebarBorder:  'border-[hsl(20,10%,18%)]',
    topbarBg:       '[background-color:hsl(40,10%,96%)]',
    topbarBorder:   'border-[hsl(20,10%,18%)]',
    topbarSep:      'border-[hsl(20,10%,18%)]',
    textPrimary:    'text-[hsl(20,10%,18%)]',
    textSecondary:  'text-[hsl(20,10%,30%)]',
    textMuted:      'text-[hsl(20,10%,50%)]',
    btnHover:       'hover:bg-[hsl(325,100%,50%)] hover:text-white',
    btnIcon:        'text-[hsl(20,10%,40%)]',
    avatarBg:       'bg-[hsl(325,100%,50%)] border-[hsl(325,100%,40%)] text-white',
    contentBg:      '[background-color:hsl(40,10%,96%)]',
    scrollThumb:    'hsl(20,10%,18%)',
    scrollThumbHover: 'hsl(325,100%,50%)',
    backdropMobile: 'bg-black/30',
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
      className={`flex items-center w-full px-3 py-2 mb-0.5 text-[12px] font-medium transition-all ${
        isActive
          ? 'bg-[hsl(325,100%,50%)] text-white border-2 border-[hsl(325,100%,50%)] shadow-[2px_2px_0px_hsl(20,10%,18%)]'
          : 'text-[hsl(40,10%,70%)] hover:text-white hover:bg-[hsl(325,100%,50%)] border-2 border-transparent'
      }`}
    >
      <Icon size={15} className="mr-3 flex-shrink-0" />
      <span className="whitespace-nowrap tracking-tight">{label}</span>
      {isActive && <span className="ml-auto w-1.5 h-1.5 bg-[hsl(60,100%,50%)] shrink-0" />}
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

  const hasOverlay = !!(viewingItem || activeTransaction);
  const avatarInitials = currentUser?.name?.substring(0, 2).toUpperCase() ?? '??';

  const TAB_LABELS: Record<TabId, string> = {
    DASHBOARD: 'Dashboard',
    INVENTORY: 'Stok Barang',
    REPORTS:   'Mutasi Stok',
    SETTINGS:  'Pengaturan',
    REJECT:    'Barang Reject',
  };

  if (appState === 'loading') return <div className="min-h-screen" style={{backgroundColor:'hsl(40,10%,96%)'}} />;
  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  return (
    <ToastProvider>
      <SearchProvider>
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 3px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${t.scrollThumbHover}; }
          @keyframes appFadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
          .app-animate-in { animation: appFadeIn 0.2s ease-out forwards; }
          @keyframes themePop { 0% { transform: scale(1); } 50% { transform: scale(1.2) rotate(12deg); } 100% { transform: scale(1) rotate(0deg); } }
          .theme-btn-anim { animation: themePop 0.3s ease-out; }
        `}</style>

        <div className={`min-h-screen ${t.pageBg} relative overflow-hidden font-sans transition-colors duration-300`}>

          {isSidebarOpen && (
            <div
              className={`fixed inset-0 ${t.backdropMobile} z-40 lg:hidden backdrop-blur-[2px]`}
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          <div className="flex h-screen overflow-hidden">

            {/* ── SIDEBAR ── */}
            <aside className={`
              fixed inset-y-0 left-0 z-50 w-56 flex flex-col text-[hsl(40,10%,96%)]
              border-r-2 ${t.sidebarBorder} transition-transform duration-300
              lg:relative lg:translate-x-0
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
              style={{ background: t.sidebarBg }}
            >
              {/* Brand header */}
              <div className="h-14 flex items-center justify-between px-4 border-b-2 border-[hsl(325,100%,50%)] shrink-0"
                style={{ background: t.sidebarBrand }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 flex items-center justify-center bg-[hsl(325,100%,50%)] border-2 border-[hsl(60,100%,50%)] shadow-[2px_2px_0px_hsl(60,100%,50%)]">
                    <AppLogo className="w-4 h-4" strokeColor="white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-display font-bold text-xs tracking-widest uppercase leading-none">GudangPro</span>
                    <span className="text-[hsl(325,100%,50%)] font-mono text-[9px] tracking-widest leading-none mt-1 uppercase">Inventory</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="lg:hidden p-1.5 text-[hsl(40,10%,70%)] hover:text-[hsl(325,100%,50%)] transition-colors"
                  aria-label="Tutup sidebar"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Nav content */}
              <div className="p-2 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                <div className="flex-1">
                  <p className="zine-label text-[hsl(325,100%,50%)] mb-2 px-3 mt-3">
                    Menu Utama
                  </p>
                  <NavItem id="DASHBOARD"  label="Dashboard"     icon={LayoutDashboard} activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />
                  <NavItem id="INVENTORY"  label="Stok Barang"   icon={Package}         activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />
                  <NavItem id="REPORTS"    label="Mutasi Stok"   icon={FileBarChart}    activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />
                  <NavItem id="REJECT"     label="Barang Reject" icon={AlertOctagon}    activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />

                  <p className="zine-label text-[hsl(325,100%,50%)] mt-5 mb-2 px-3">Aplikasi</p>
                  <button
                    onClick={openMusicPlayer}
                    className="flex items-center w-full px-3 py-2 mb-0.5 text-[12px] font-medium transition-all text-[hsl(40,10%,70%)] hover:text-white hover:bg-[hsl(325,100%,50%)] border-2 border-transparent"
                  >
                    <Music size={15} className="mr-3 flex-shrink-0" />
                    <span className="whitespace-nowrap tracking-widest uppercase text-[10px] font-mono">Music Player</span>
                  </button>

                  <p className="zine-label text-[hsl(325,100%,50%)] mt-5 mb-2 px-3">Transaksi</p>
                  <div className="space-y-1 px-0.5">
                    <button
                      onClick={() => openTransaction('IN')}
                      className="w-full text-left px-3 py-2 text-[10px] font-mono font-bold text-[hsl(60,100%,50%)] hover:bg-[hsl(60,100%,50%)] hover:text-[hsl(20,10%,18%)] flex items-center gap-2.5 transition-all border-2 border-[hsl(60,100%,50%)] tracking-widest uppercase"
                    >
                      <div className="w-4 h-4 bg-[hsl(60,100%,50%)] flex items-center justify-center shrink-0">
                        <Plus size={10} className="text-[hsl(20,10%,18%)]" />
                      </div>
                      Penerimaan
                    </button>
                    <button
                      onClick={() => openTransaction('OUT')}
                      className="w-full text-left px-3 py-2 text-[10px] font-mono font-bold text-[hsl(325,100%,50%)] hover:bg-[hsl(325,100%,50%)] hover:text-white flex items-center gap-2.5 transition-all border-2 border-[hsl(325,100%,50%)] tracking-widest uppercase"
                    >
                      <div className="w-4 h-4 bg-[hsl(325,100%,50%)] flex items-center justify-center shrink-0">
                        <Plus size={10} className="text-white" />
                      </div>
                      Pengiriman
                    </button>
                  </div>
                </div>

                {/* Bottom: settings + logout + user card */}
                <div className="border-t-2 border-[hsl(325,100%,50%)] pt-2 mt-4">
                  <NavItem id="SETTINGS" label="Pengaturan" icon={Settings} activeTab={activeTab} hasOverlay={hasOverlay} onClick={handleNavClick} />
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 py-2 text-[10px] font-mono font-bold tracking-widest uppercase transition-all text-[hsl(40,10%,60%)] hover:text-[hsl(325,100%,50%)] hover:bg-[hsl(325,100%,50%)]/10 mt-0.5 border-2 border-transparent"
                  >
                    <LogOut size={15} className="mr-3 flex-shrink-0" />
                    <span>Keluar</span>
                  </button>

                  {/* User card */}
                  <div className="mt-2 px-3 py-2.5 bg-[hsl(325,100%,50%)]/10 border-2 border-[hsl(325,100%,50%)] shadow-[2px_2px_0px_hsl(325,100%,50%)] flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-[hsl(325,100%,50%)] border-2 border-[hsl(60,100%,50%)] text-white flex items-center justify-center font-display font-bold text-[10px] shrink-0">
                      {avatarInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-[hsl(40,10%,96%)] leading-none truncate">{currentUser.name}</p>
                      <p className="zine-label text-[hsl(325,100%,50%)] mt-0.5">{currentUser.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <main className="flex-1 flex flex-col overflow-hidden">

              {/* ── TOPBAR ── */}
              <header className={`
                h-12 ${t.topbarBg} border-b-2 ${t.topbarBorder}
                flex items-center justify-between px-4
                z-30 shrink-0
                transition-colors duration-300
              `}>
                <div className="flex items-center gap-3">
                  {!isSidebarOpen && (
                    <button
                      onClick={() => setIsSidebarOpen(true)}
                      className={`p-1.5 ${t.btnIcon} ${t.btnHover} transition-colors border-2 border-transparent`}
                      aria-label="Buka sidebar"
                    >
                      <Menu size={16} />
                    </button>
                  )}

                  {hasOverlay ? (
                    <button
                      onClick={handleBack}
                      className={`flex items-center gap-1.5 ${t.textSecondary} transition-colors group`}
                    >
                      <div className="p-1 group-hover:bg-[hsl(325,100%,50%)] group-hover:text-white transition-colors">
                        <ArrowLeft size={14} />
                      </div>
                      <span className={`uppercase tracking-widest text-[10px] font-mono font-bold ${t.textSecondary}`}>Kembali</span>
                    </button>
                  ) : (
                    <span className={`font-display font-bold text-[13px] uppercase tracking-wider ${t.textPrimary}`}>
                      {TAB_LABELS[activeTab]}
                    </span>
                  )}
                </div>

                {!hasOverlay && (
                  <div className="flex-1 max-w-sm mx-4">
                    <GlobalSearch onSelectItem={(item) => setViewingItem(item)} />
                  </div>
                )}

                <div className="flex items-center gap-1.5 shrink-0">
                  <ClockWidget />
                  <LowStockAlert />
                  <MusicPlayer />

                  <button
                    onClick={toggleTheme}
                    className={`p-1.5 ${t.btnIcon} ${t.btnHover} transition-colors border-2 border-transparent`}
                    title={theme === 'dark' ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}
                    aria-label="Toggle tema"
                  >
                    {theme === 'dark'
                      ? <Sun size={15} className="text-[hsl(60,100%,50%)]" />
                      : <Moon size={15} className="text-[hsl(20,10%,40%)]" />
                    }
                  </button>

                  <div className={`hidden md:flex items-center gap-2 pl-3 border-l-2 ${t.topbarSep} ml-1`}>
                    <div className="text-right">
                      <p className={`text-[11px] font-bold ${t.textPrimary} leading-none uppercase tracking-wide`}>{currentUser.name}</p>
                      <p className={`zine-label ${t.textMuted} mt-0.5`}>{currentUser.role}</p>
                    </div>
                    <div className={`w-7 h-7 border-2 flex items-center justify-center font-display font-bold text-[10px] shadow-[2px_2px_0px_hsl(325,100%,50%)] ${t.avatarBg}`}>
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

          {appState === 'logging-out' && (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[hsl(20,10%,18%)]/90 app-animate-in">
              <div className="w-16 h-16 flex items-center justify-center bg-[hsl(325,100%,50%)] border-2 border-[hsl(60,100%,50%)] shadow-[6px_6px_0px_hsl(60,100%,50%)] mb-4 animate-pulse">
                <AppLogo className="w-10 h-10" strokeColor="white" />
              </div>
              <div className="flex items-center gap-3 text-white">
                <Loader2 size={18} className="animate-spin text-[hsl(325,100%,50%)]" />
                <span className="font-mono font-bold tracking-widest uppercase text-[hsl(40,10%,96%)]">Keluar...</span>
              </div>
            </div>
          )}
        </div>
      </SearchProvider>
    </ToastProvider>
  );
}

export default App;
