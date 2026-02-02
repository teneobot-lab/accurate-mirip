
import { Item, Warehouse, Stock, Transaction, Partner, AppUser, RejectBatch, Playlist } from '../types';

const STORAGE_KEYS = {
  ITEMS: 'gp_items',
  WAREHOUSES: 'gp_warehouses',
  STOCKS: 'gp_stocks',
  TRANSACTIONS: 'gp_transactions',
  PARTNERS: 'gp_partners',
  USERS: 'gp_users',
  REJECTS: 'gp_rejects',
  REJECT_OUTLETS: 'gp_reject_outlets',
  THEME: 'gp_theme',
  PLAYLISTS: 'gp_playlists',
  SESSION: 'gp_session'
};

// Menggunakan path relatif agar proxy Vercel (vercel.json) bisa menangani request
// dan menghindari error Mixed Content (HTTPS -> HTTP)
export const API_URL = ''; 

const isBrowser = typeof window !== 'undefined';

export const StorageService = {
  init: () => {
    if (!isBrowser) return;
    if (!localStorage.getItem(STORAGE_KEYS.ITEMS)) {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.WAREHOUSES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify([]));
      // Default Admin
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([
          { id: 'u1', name: 'Super Admin', username: 'admin', password: '22', role: 'ADMIN', status: 'ACTIVE' }
      ]));
      localStorage.setItem(STORAGE_KEYS.REJECTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.REJECT_OUTLETS, JSON.stringify(['Outlet Pusat']));
      localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify([]));
    }
  },

  // --- API HELPER ---
  async apiCall(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API Call Failed');
    }
    return response.json();
  },

  // --- SESSION MANAGEMENT ---
  getSession: () => {
    if (!isBrowser) return null;
    const session = localStorage.getItem(STORAGE_KEYS.SESSION);
    return session ? JSON.parse(session) : null;
  },
  saveSession: (user: any) => {
    if (!isBrowser) return;
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
  },
  clearSession: () => {
    if (!isBrowser) return;
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  },

  // Theme
  getTheme: (): 'light' | 'dark' => {
    if (!isBrowser) return 'light';
    return (localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark') || 'light';
  },
  saveTheme: (theme: 'light' | 'dark') => {
    if (isBrowser) localStorage.setItem(STORAGE_KEYS.THEME, theme);
  },

  // Playlists
  getPlaylists: (): Playlist[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '[]') as Playlist[];
  },
  savePlaylists: (playlists: Playlist[]) => {
    if (isBrowser) localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
  },

  // Items
  getItems: (): Item[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ITEMS) || '[]') as Item[];
  },
  saveItem: (item: Item) => {
    if (!isBrowser) return;
    const items = StorageService.getItems();
    const index = items.findIndex(i => i.id === item.id);
    if (index >= 0) items[index] = item;
    else items.push(item);
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
  },
  importItems: (newItems: Item[]) => {
    if (!isBrowser) return;
    const items = StorageService.getItems();
    // Avoid duplicates by code
    const existingCodes = new Set(items.map(i => i.code));
    const filteredNew = newItems.filter(i => !existingCodes.has(i.code));
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify([...items, ...filteredNew]));
  },
  deleteItems: (ids: string[]) => {
    if (!isBrowser) return;
    const txs = StorageService.getTransactions();
    const usedItemIds = new Set<string>();
    txs.forEach(t => t.items.forEach(ti => usedItemIds.add(ti.itemId)));
    const safeToDelete = ids.filter(id => !usedItemIds.has(id));
    const rejected = ids.length - safeToDelete.length;
    if (rejected > 0) alert(`${rejected} items are in use and cannot be deleted.`);
    if (safeToDelete.length > 0) {
        const items = StorageService.getItems().filter(i => !safeToDelete.includes(i.id));
        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
        const stocks = StorageService.getStocks().filter(s => !safeToDelete.includes(s.itemId));
        localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(stocks));
    }
  },

  // Warehouses
  getWarehouses: (): Warehouse[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.WAREHOUSES) || '[]') as Warehouse[];
  },
  saveWarehouse: (wh: Warehouse) => {
      if (!isBrowser) return;
      const list = StorageService.getWarehouses();
      const idx = list.findIndex(w => w.id === wh.id);
      if (idx >= 0) list[idx] = wh; else list.push(wh);
      localStorage.setItem(STORAGE_KEYS.WAREHOUSES, JSON.stringify(list));
  },
  deleteWarehouse: (id: string) => {
      if (!isBrowser) return;
      const txs = StorageService.getTransactions();
      const isUsed = txs.some(t => t.sourceWarehouseId === id || t.targetWarehouseId === id);
      if (isUsed) { alert("Warehouse has transaction history."); return; }
      const list = StorageService.getWarehouses().filter(w => w.id !== id);
      localStorage.setItem(STORAGE_KEYS.WAREHOUSES, JSON.stringify(list));
  },

  // Stocks
  getStocks: (): Stock[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCKS) || '[]') as Stock[];
  },
  
  updateStock: (itemId: string, warehouseId: string, deltaQty: number) => {
      if (!isBrowser) return;
      const stocks = StorageService.getStocks();
      const index = stocks.findIndex(s => s.itemId === itemId && s.warehouseId === warehouseId);
      if (index >= 0) {
          stocks[index].qty += deltaQty;
          stocks[index].qty = Math.round(stocks[index].qty * 10000) / 10000;
      } else {
          stocks.push({ itemId, warehouseId, qty: deltaQty });
      }
      localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(stocks));
  },

  getTransactions: (): Transaction[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]') as Transaction[];
  },

  commitTransaction: (tx: Transaction) => {
    if (!isBrowser) return;
    const transactions = StorageService.getTransactions();
    transactions.unshift(tx);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    tx.items.forEach(item => {
        const baseQty = item.qty * item.ratio;
        if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
            StorageService.updateStock(item.itemId, tx.sourceWarehouseId, baseQty);
        } else if (tx.type === 'OUT') {
            StorageService.updateStock(item.itemId, tx.sourceWarehouseId, -baseQty);
        } else if (tx.type === 'TRANSFER') {
            StorageService.updateStock(item.itemId, tx.sourceWarehouseId, -baseQty);
            if (tx.targetWarehouseId) StorageService.updateStock(item.itemId, tx.targetWarehouseId, baseQty);
        }
    });
  },

  updateTransaction: (tx: Transaction) => {
    if (!isBrowser) return;
    const transactions = StorageService.getTransactions();
    const idx = transactions.findIndex(t => t.id === tx.id);
    if (idx >= 0) {
        transactions[idx] = tx;
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    }
  },

  getPartners: (): Partner[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTNERS) || '[]') as Partner[];
  },
  savePartner: (p: Partner) => {
      if (!isBrowser) return;
      const list = StorageService.getPartners();
      const idx = list.findIndex(x => x.id === p.id);
      if (idx >= 0) list[idx] = p; else list.push(p);
      localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify(list));
  },
  deletePartner: (id: string) => {
      if (!isBrowser) return;
      const list = StorageService.getPartners().filter(x => x.id !== id);
      localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify(list));
  },

  getUsers: (): AppUser[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]') as AppUser[];
  },
  saveUser: (u: AppUser) => {
      if (!isBrowser) return;
      const list = StorageService.getUsers();
      const idx = list.findIndex(x => x.id === u.id);
      if (idx >= 0) list[idx] = u; else list.push(u);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list));
  },
  deleteUser: (id: string) => {
      if (!isBrowser) return;
      const list = StorageService.getUsers();
      const user = list.find(u => u.id === id);
      const admins = list.filter(u => u.role === 'ADMIN');
      if (user?.role === 'ADMIN' && admins.length <= 1) {
          alert("Cannot delete the last Administrator.");
          return;
      }
      const newList = list.filter(x => x.id !== id);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(newList));
  },

  getStockQty: (itemId: string, warehouseId: string): number => {
    if (!isBrowser) return 0;
    const stocks = StorageService.getStocks();
    const stock = stocks.find(s => s.itemId === itemId && s.warehouseId === warehouseId);
    return stock ? stock.qty : 0;
  },

  getRejectBatches: (): RejectBatch[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.REJECTS) || '[]') as RejectBatch[];
  },
  saveRejectBatch: (batch: RejectBatch) => {
      if (!isBrowser) return;
      const batches = StorageService.getRejectBatches();
      batches.unshift(batch);
      localStorage.setItem(STORAGE_KEYS.REJECTS, JSON.stringify(batches));
  },
  getRejectOutlets: (): string[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.REJECT_OUTLETS) || '[]') as string[];
  },
  saveRejectOutlet: (name: string) => {
      if (!isBrowser) return;
      const outlets = StorageService.getRejectOutlets();
      if (!outlets.includes(name)) {
          outlets.push(name);
          localStorage.setItem(STORAGE_KEYS.REJECT_OUTLETS, JSON.stringify(outlets));
      }
  },
  deleteRejectBatch: (id: string) => {
      if (!isBrowser) return;
      const batches = StorageService.getRejectBatches().filter(b => b.id !== id);
      localStorage.setItem(STORAGE_KEYS.REJECTS, JSON.stringify(batches));
  }
};
