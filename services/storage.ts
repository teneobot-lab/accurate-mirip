
import { Item, Warehouse, Stock, Transaction, Partner, AppUser, RejectBatch, Playlist } from '../types';

const STORAGE_KEYS = {
  THEME: 'gp_theme',
  SESSION: 'gp_session'
};

export const API_URL = ''; 

const isBrowser = typeof window !== 'undefined';

export const StorageService = {
  init: () => {
    if (!isBrowser) return;
    if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
      localStorage.setItem(STORAGE_KEYS.THEME, 'light');
    }
  },

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

  // --- AUTH ---
  getSession: () => isBrowser ? JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION) || 'null') : null,
  saveSession: (user: any) => isBrowser && localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user)),
  clearSession: () => isBrowser && localStorage.removeItem(STORAGE_KEYS.SESSION),
  getTheme: (): 'light' | 'dark' => isBrowser ? (localStorage.getItem(STORAGE_KEYS.THEME) as any || 'light') : 'light',
  saveTheme: (theme: string) => isBrowser && localStorage.setItem(STORAGE_KEYS.THEME, theme),

  // --- MASTER DATA (API) ---
  async fetchItems(): Promise<Item[]> {
    return this.apiCall('/api/inventory/items');
  },

  async saveItem(item: Item) {
    return this.apiCall('/api/inventory/items', {
      method: 'POST',
      body: JSON.stringify(item)
    });
  },

  async fetchWarehouses(): Promise<Warehouse[]> {
    return this.apiCall('/api/inventory/warehouses');
  },

  async fetchStocks(): Promise<Stock[]> {
    return this.apiCall('/api/inventory/stocks');
  },

  async fetchTransactions(): Promise<Transaction[]> {
    const data = await this.apiCall('/api/transactions');
    return Array.isArray(data) ? data : [];
  },

  async commitTransaction(tx: Transaction) {
    return this.apiCall('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(tx)
    });
  },

  // --- LEGACY FALLBACKS (Will be migrated if needed) ---
  // Fix: Improved legacy methods to use localStorage for persistence and added missing ones
  getItems: (): Item[] => JSON.parse(localStorage.getItem('gp_items') || '[]'),
  getWarehouses: (): Warehouse[] => JSON.parse(localStorage.getItem('gp_warehouses') || '[]'),
  getStocks: (): Stock[] => JSON.parse(localStorage.getItem('gp_stocks') || '[]'),
  getTransactions: (): Transaction[] => JSON.parse(localStorage.getItem('gp_transactions') || '[]'),
  
  // Method ini sekarang menghitung qty real-time dari fetchStocks
  getStockQty: (itemId: string, warehouseId: string, allStocks: Stock[]): number => {
    const stock = allStocks.find(s => s.itemId === itemId && s.warehouseId === warehouseId);
    return stock ? stock.qty : 0;
  },

  async fetchPartners(): Promise<Partner[]> {
    try { return await this.apiCall('/api/partners'); } catch { return []; }
  },

  async fetchUsers(): Promise<AppUser[]> {
    try { return await this.apiCall('/api/users'); } catch { return []; }
  },

  // Fix: Added missing sync methods for Partners and Users to resolve SettingsView errors
  getPartners: (): Partner[] => JSON.parse(localStorage.getItem('gp_partners') || '[]'),
  savePartner: (partner: Partner) => {
    const partners = StorageService.getPartners();
    const index = partners.findIndex(p => p.id === partner.id);
    if (index > -1) partners[index] = partner; else partners.push(partner);
    localStorage.setItem('gp_partners', JSON.stringify(partners));
  },
  deletePartner: (id: string) => {
    const partners = StorageService.getPartners();
    localStorage.setItem('gp_partners', JSON.stringify(partners.filter(p => p.id !== id)));
  },

  getUsers: (): AppUser[] => JSON.parse(localStorage.getItem('gp_users') || '[]'),
  saveUser: (user: AppUser) => {
    const users = StorageService.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index > -1) users[index] = user; else users.push(user);
    localStorage.setItem('gp_users', JSON.stringify(users));
  },
  deleteUser: (id: string) => {
    const users = StorageService.getUsers();
    localStorage.setItem('gp_users', JSON.stringify(users.filter(u => u.id !== id)));
  },

  // Fix: Added missing sync methods for Warehouses to resolve SettingsView errors
  saveWarehouse: (wh: Warehouse) => {
    const whs = StorageService.getWarehouses();
    const index = whs.findIndex(w => w.id === wh.id);
    if (index > -1) whs[index] = wh; else whs.push(wh);
    localStorage.setItem('gp_warehouses', JSON.stringify(whs));
  },
  deleteWarehouse: (id: string) => {
    const whs = StorageService.getWarehouses();
    localStorage.setItem('gp_warehouses', JSON.stringify(whs.filter(w => w.id !== id)));
  },

  // Fix: Added missing methods for Items manipulation used in RejectView
  importItems: (newItems: Item[]) => {
    const items = StorageService.getItems();
    localStorage.setItem('gp_items', JSON.stringify([...items, ...newItems]));
  },
  deleteItems: (ids: string[]) => {
    const items = StorageService.getItems();
    localStorage.setItem('gp_items', JSON.stringify(items.filter(i => !ids.includes(i.id))));
  },

  // Fix: Added missing methods for Reject Module to resolve RejectView errors
  getRejectOutlets: (): string[] => JSON.parse(localStorage.getItem('gp_reject_outlets') || '[]'),
  saveRejectOutlet: (name: string) => {
    const outlets = StorageService.getRejectOutlets();
    if (!outlets.includes(name)) {
      localStorage.setItem('gp_reject_outlets', JSON.stringify([...outlets, name]));
    }
  },
  getRejectBatches: (): RejectBatch[] => JSON.parse(localStorage.getItem('gp_reject_batches') || '[]'),
  saveRejectBatch: (batch: RejectBatch) => {
    const batches = StorageService.getRejectBatches();
    localStorage.setItem('gp_reject_batches', JSON.stringify([...batches, batch]));
  },
  deleteRejectBatch: (id: string) => {
    const batches = StorageService.getRejectBatches();
    localStorage.setItem('gp_reject_batches', JSON.stringify(batches.filter(b => b.id !== id)));
  },

  // Fix: Added missing methods for Music Player to resolve MusicPlayer errors
  getPlaylists: (): Playlist[] => JSON.parse(localStorage.getItem('gp_playlists') || '[]'),
  savePlaylists: (playlists: Playlist[]) => localStorage.setItem('gp_playlists', JSON.stringify(playlists))
};
