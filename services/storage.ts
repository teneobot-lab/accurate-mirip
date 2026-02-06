
import { Item, Warehouse, Stock, Transaction, Partner, AppUser, RejectBatch, Playlist } from '../types';

const STORAGE_KEYS = {
  THEME: 'gp_theme',
  SESSION: 'gp_session'
};

export const API_URL = ''; // Proxy via vercel.json / vite.config.ts

const isBrowser = typeof window !== 'undefined';

// --- HELPER: Clean Number Formatter ---
// Menghapus trailing zeros yang tidak perlu (3.2000 -> 3.2, 5.0000 -> 5)
const cleanNum = (val: string | number): number => {
    const num = Number(val);
    if (isNaN(num)) return 0;
    return parseFloat(num.toFixed(4)); 
};

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

  // --- CONFIG ---
  async fetchSystemConfig(key: string): Promise<string> {
      try {
          const res = await this.apiCall(`/api/inventory/config/${key}`);
          return res.value || '';
      } catch (e) {
          return '';
      }
  },
  async saveSystemConfig(key: string, value: string) {
      return this.apiCall('/api/inventory/config', { 
          method: 'POST', 
          body: JSON.stringify({ key, value }) 
      });
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
  async fetchRejectMasterItems(): Promise<Item[]> {
    return this.apiCall('/api/reject/master-items');
  },
  async saveRejectMasterItem(item: Item) {
    return this.apiCall('/api/reject/master-items', { method: 'POST', body: JSON.stringify(item) });
  },
  async bulkSaveRejectMasterItems(items: Item[]) {
    return this.apiCall('/api/reject/master-items/bulk-upsert', { method: 'POST', body: JSON.stringify({ items }) });
  },
  async deleteRejectMasterItem(id: string) {
    return this.apiCall(`/api/reject/master-items/${id}`, { method: 'DELETE' });
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
    // 1. Fetch Data
    const transactions: Transaction[] = await this.fetchTransactions({ start: startDate, end: endDate });
    const items: Item[] = await this.fetchItems();
    
    // --- PROSES TRANSAKSI (IN/OUT) ---
    const txRows = transactions.flatMap(tx => tx.items.map(line => ([
        tx.date, 
        tx.referenceNo, 
        tx.type,
        items.find(i => i.id === line.itemId)?.code || '?',
        items.find(i => i.id === line.itemId)?.name || '?',
        cleanNum(line.qty), // Menggunakan Qty asli input user yang sudah dibersihkan
        line.unit, 
        line.note || tx.notes || '-'
    ])));

    // --- PROSES REJECT (Wajib Agregasi ke Satuan Dasar / Base) ---
    const rejectBatches: RejectBatch[] = await this.fetchRejectBatches();
    const rejectMasterItems: Item[] = await this.fetchRejectMasterItems();
    const filteredRejects = rejectBatches.filter(b => b.date >= startDate && b.date <= endDate);
    
    const rejectAggMap = new Map<string, {
        date: string,
        sku: string,
        name: string,
        baseUnit: string,
        totalBaseQty: number,
        reasons: Set<string>
    }>();

    filteredRejects.forEach(batch => {
        batch.items.forEach(it => {
            const master = rejectMasterItems.find(mi => mi.id === it.itemId);
            const baseUnitName = master ? master.baseUnit : it.unit; 
            
            const key = `${batch.date}_${it.sku}`;
            
            if (!rejectAggMap.has(key)) {
                rejectAggMap.set(key, {
                    date: batch.date,
                    sku: it.sku,
                    name: it.name,
                    baseUnit: baseUnitName,
                    totalBaseQty: 0,
                    reasons: new Set()
                });
            }

            const record = rejectAggMap.get(key)!;
            // Gunakan baseQty yang sudah dikalkulasi saat entry (Satuan Input * Rasio)
            record.totalBaseQty += Number(it.baseQty || 0);
            if (it.reason) record.reasons.add(it.reason);
        });
    });

    const rejectRows = Array.from(rejectAggMap.values()).map(rec => {
        const uniqueId = `REJ-${rec.date.replace(/-/g, '')}-${rec.sku}`;
        
        return [
            rec.date,
            uniqueId, 
            rec.sku, 
            rec.name, 
            cleanNum(rec.totalBaseQty), // Hasil agregasi dalam satuan utama (angka valid/bersih)
            rec.baseUnit,               // Wajib Satuan Utama
            Array.from(rec.reasons).join(', ') || '-'
        ];
    });

    // --- SEND TO GAS ---
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ 
          action: 'SYNC_V2',
          transactions: txRows,
          rejects: rejectRows
      })
    });

    return { 
        status: 'success', 
        txCount: txRows.length,
        rejectCount: rejectRows.length 
    };
  }
};
