
export interface UnitConversion {
  name: string;
  ratio: number;
  operator?: '*' | '/';
}

export interface Item {
  id: string;
  code: string;
  name: string;
  category: string;
  baseUnit: string;
  conversions: UnitConversion[];
  minStock: number;
  initialStock?: number; // Ditambahkan sebagai dasar perhitungan
}

export interface Stock {
  itemId: string;
  warehouseId: string;
  qty: number;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  phone?: string;
  pic?: string;
}

export interface Partner {
  id: string;
  type: 'SUPPLIER' | 'CUSTOMER';
  name: string;
  phone: string;
  email: string;
  address: string;
  npwp?: string;
  term?: number;
}

export interface AppUser {
  id: string;
  name: string;
  username: string; // Changed/Added for login
  password?: string; // Added for login validation
  email?: string; // Optional now
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  status: 'ACTIVE' | 'INACTIVE';
}

export type TransactionType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';

export interface TransactionItem {
  itemId: string;
  unit: string;
  qty: number;
  ratio: number;
  note?: string;
}

export interface Transaction {
  id: string;
  date: string;
  referenceNo: string;
  deliveryOrderNo?: string;
  supplier?: string;
  type: TransactionType;
  sourceWarehouseId: string;
  targetWarehouseId?: string;
  items: TransactionItem[];
  notes?: string;
  createdAt: number;
}

export interface StockMutation {
  date: string;
  referenceNo: string;
  type: TransactionType;
  warehouseName: string;
  inQty: number;
  outQty: number;
  balanceQty: number;
  unit: string;
}

// --- REJECT MODULE TYPES ---
export interface RejectItem {
    itemId: string;
    sku: string;
    name: string;
    qty: number;
    unit: string;
    baseQty: number;
    reason: string;
}

export interface RejectBatch {
    id: string;
    date: string;
    outlet: string;
    createdAt: number;
    items: RejectItem[];
}

// --- MUSIC PLAYER TYPES ---
export interface Song {
  id: string;
  title: string;
  youtubeUrl: string;
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
}
