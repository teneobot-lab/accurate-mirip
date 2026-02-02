
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
      let errorMessage = 'API Call Failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        if (response.status === 404) errorMessage = `Route not found: ${endpoint}. Pastikan Backend Server sudah di-restart.`;
        else if (response.status === 500) errorMessage = 'Server Error: Periksa koneksi database MySQL.';
        else errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    return response.json();
  },

  // --- MASTER DATA ---
  async fetchItems(): Promise<Item[]> {
    return this.apiCall('/api/inventory/items');
  },
  async saveItem(item: Item) {
    return this.apiCall('/api/inventory/items', { method: 'POST', body: JSON.stringify(item) });
  },
  async bulkSaveItems(items: Item[]) {
    return this.apiCall('/api/inventory/items/bulk-upsert', { 
      method: 'POST', 
      body: JSON.stringify({ items }) 
    });
  },
  async deleteItems(ids: string[]) {
    return this.apiCall('/api/inventory/items/bulk-delete', { 
      method: 'POST', 
      body: JSON.stringify({ ids }) 
    });
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

  // --- TRANSACTIONS ---
  async fetchStocks(): Promise<Stock[]> {
    return this.apiCall('/api/inventory/stocks');
  },
  async fetchTransactions(filters?: { start?: string; end?: string; warehouse?: string; type?: string }): Promise<Transaction[]> {
    let url = '/api/transactions';
    if (filters) {
        const params = new URLSearchParams();
        if (filters.start) params.append('start', filters.start);
        if (filters.end) params.append('end', filters.end);
        if (filters.warehouse) params.append('warehouse', filters.warehouse);
        if (filters.type) params.append('type', filters.type);
        url += `?${params.toString()}`;
    }
    return this.apiCall(url);
  },
  async commitTransaction(tx: Transaction) {
    return this.apiCall('/api/transactions', { method: 'POST', body: JSON.stringify(tx) });
  },
  async updateTransaction(id: string, tx: Transaction) {
    return this.apiCall(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(tx) });
  },
  async deleteTransaction(id: string) {
    return this.apiCall(`/api/transactions/${id}`, { method: 'DELETE' });
  },

  // --- REJECT MODULE ---
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

  // --- MUSIC ---
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
  },

  getSession: () => isBrowser ? JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION) || 'null') : null,
  saveSession: (user: any) => isBrowser && localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user)),
  clearSession: () => isBrowser && localStorage.removeItem(STORAGE_KEYS.SESSION),
  getTheme: (): 'light' | 'dark' => isBrowser ? (localStorage.getItem(STORAGE_KEYS.THEME) as any || 'light') : 'light',
  saveTheme: (theme: string) => isBrowser && localStorage.setItem(STORAGE_KEYS.THEME, theme),

  async syncToGoogleSheets(scriptUrl: string, startDate: string, endDate: string) {
    const transactions: Transaction[] = await this.fetchTransactions({ start: startDate, end: endDate });
    const items: Item[] = await this.fetchItems();
    const rows = transactions.flatMap(tx => tx.items.map(line => ([
        tx.date, tx.referenceNo, tx.type,
        items.find(i => i.id === line.itemId)?.code || '?',
        items.find(i => i.id === line.itemId)?.name || '?',
        line.qty, line.unit, line.note || tx.notes || '-'
    ])));
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: 'APPEND_ROWS', rows: rows })
    });
    return { status: 'success' };
  }
};
