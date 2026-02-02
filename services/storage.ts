
import { Item, Warehouse, Stock, Transaction, Partner, AppUser, RejectBatch, Playlist } from '../types';

const STORAGE_KEYS = {
  THEME: 'gp_theme',
  SESSION: 'gp_session'
};

export const API_URL = ''; // Proxy via vercel.json / vite.config.ts

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

  // --- AUTH (Browser Local Only) ---
  getSession: () => isBrowser ? JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION) || 'null') : null,
  saveSession: (user: any) => isBrowser && localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user)),
  clearSession: () => isBrowser && localStorage.removeItem(STORAGE_KEYS.SESSION),
  getTheme: (): 'light' | 'dark' => isBrowser ? (localStorage.getItem(STORAGE_KEYS.THEME) as any || 'light') : 'light',
  saveTheme: (theme: string) => isBrowser && localStorage.setItem(STORAGE_KEYS.THEME, theme),

  // --- MASTER DATA (API - CENTRALIZED MYSQL) ---
  async fetchItems(): Promise<Item[]> {
    return this.apiCall('/api/inventory/items');
  },
  async saveItem(item: Item) {
    return this.apiCall('/api/inventory/items', { method: 'POST', body: JSON.stringify(item) });
  },
  async deleteItems(ids: string[]) {
    return this.apiCall('/api/inventory/items/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
  },

  async fetchWarehouses(): Promise<Warehouse[]> {
    return this.apiCall('/api/inventory/warehouses');
  },
  async saveWarehouse(wh: Warehouse) {
    return this.apiCall('/api/inventory/warehouses', { method: 'POST', body: JSON.stringify(wh) });
  },
  async deleteWarehouse(id: string) {
    return this.apiCall(`/api/inventory/warehouses/${id}`, { method: 'DELETE' });
  },

  async fetchPartners(): Promise<Partner[]> {
    return this.apiCall('/api/inventory/partners');
  },
  async savePartner(partner: Partner) {
    return this.apiCall('/api/inventory/partners', { method: 'POST', body: JSON.stringify(partner) });
  },
  async deletePartner(id: string) {
    return this.apiCall(`/api/inventory/partners/${id}`, { method: 'DELETE' });
  },

  async fetchUsers(): Promise<AppUser[]> {
    return this.apiCall('/api/inventory/users');
  },
  async saveUser(user: AppUser) {
    return this.apiCall('/api/inventory/users', { method: 'POST', body: JSON.stringify(user) });
  },
  async deleteUser(id: string) {
    return this.apiCall(`/api/inventory/users/${id}`, { method: 'DELETE' });
  },

  // --- TRANSACTIONS & STOCKS ---
  async fetchStocks(): Promise<Stock[]> {
    return this.apiCall('/api/inventory/stocks');
  },
  async fetchTransactions(): Promise<Transaction[]> {
    return this.apiCall('/api/transactions');
  },
  async commitTransaction(tx: Transaction) {
    return this.apiCall('/api/transactions', { method: 'POST', body: JSON.stringify(tx) });
  },

  // --- REJECT MODULE (CENTRALIZED) ---
  async fetchRejectOutlets(): Promise<string[]> {
    return this.apiCall('/api/reject/outlets');
  },
  async saveRejectOutlet(name: string) {
    return this.apiCall('/api/reject/outlets', { method: 'POST', body: JSON.stringify({ name }) });
  },
  async fetchRejectBatches(): Promise<RejectBatch[]> {
    return this.apiCall('/api/reject/batches');
  },
  async saveRejectBatch(batch: RejectBatch) {
    return this.apiCall('/api/reject/batches', { method: 'POST', body: JSON.stringify(batch) });
  },
  async deleteRejectBatch(id: string) {
    return this.apiCall(`/api/reject/batches/${id}`, { method: 'DELETE' });
  },

  // --- MUSIC PLAYER (MIGRATED TO MYSQL) ---
  async fetchPlaylists(): Promise<Playlist[]> {
    return this.apiCall('/api/music/playlists');
  },
  async createPlaylist(name: string) {
    return this.apiCall('/api/music/playlists', { method: 'POST', body: JSON.stringify({ name }) });
  },
  async deletePlaylist(id: string) {
    return this.apiCall(`/api/music/playlists/${id}`, { method: 'DELETE' });
  },
  async addSongToPlaylist(playlistId: string, title: string, youtubeUrl: string) {
    return this.apiCall(`/api/music/playlists/${playlistId}/songs`, { 
      method: 'POST', 
      body: JSON.stringify({ title, youtubeUrl }) 
    });
  },
  async deleteSong(songId: string) {
    return this.apiCall(`/api/music/songs/${songId}`, { method: 'DELETE' });
  }
};
