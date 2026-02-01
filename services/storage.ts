
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
  PLAYLISTS: 'gp_playlists'
};

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
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.REJECTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.REJECT_OUTLETS, JSON.stringify(['Outlet Pusat']));
      localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify([]));
    }
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
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '[]');
  },
  savePlaylists: (playlists: Playlist[]) => {
    if (isBrowser) localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
  },

  // Items
  getItems: (): Item[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ITEMS) || '[]');
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
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify([...items, ...newItems]));
  },
  deleteItems: (ids: string[]) => {
    if (!isBrowser) return;
    const items = StorageService.getItems().filter(i => !ids.includes(i.id));
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
  },

  // Warehouses
  getWarehouses: (): Warehouse[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.WAREHOUSES) || '[]');
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
      const list = StorageService.getWarehouses().filter(w => w.id !== id);
      localStorage.setItem(STORAGE_KEYS.WAREHOUSES, JSON.stringify(list));
  },

  getStocks: (): Stock[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCKS) || '[]');
  },
  getTransactions: (): Transaction[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]');
  },

  // Partners
  getPartners: (): Partner[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTNERS) || '[]');
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

  // Users
  getUsers: (): AppUser[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
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
      const list = StorageService.getUsers().filter(x => x.id !== id);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list));
  },

  commitTransaction: (tx: Transaction) => {
    if (!isBrowser) return;
    const transactions = StorageService.getTransactions();
    transactions.unshift(tx);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    // Stock impact logic would go here in a full app
  },

  updateTransaction: (tx: Transaction) => {
    if (!isBrowser) return;
    const transactions = StorageService.getTransactions();
    const idx = transactions.findIndex(t => t.id === tx.id);
    if (idx >= 0) transactions[idx] = tx;
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },

  getStockQty: (itemId: string, warehouseId: string): number => {
    if (!isBrowser) return 0;
    const stocks = StorageService.getStocks();
    const stock = stocks.find(s => s.itemId === itemId && s.warehouseId === warehouseId);
    return stock ? stock.qty : 0;
  },

  // Reject Module
  getRejectBatches: (): RejectBatch[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.REJECTS) || '[]');
  },
  saveRejectBatch: (batch: RejectBatch) => {
      if (!isBrowser) return;
      const batches = StorageService.getRejectBatches();
      batches.unshift(batch);
      localStorage.setItem(STORAGE_KEYS.REJECTS, JSON.stringify(batches));
  },
  getRejectOutlets: (): string[] => {
    if (!isBrowser) return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.REJECT_OUTLETS) || '[]');
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
