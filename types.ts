
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
  initialStock?: number;
  isActive: boolean; // Added Status
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
  isActive: boolean; // Added Status
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
  isActive: boolean; // Added Status
}

export interface AppUser {
  id: string;
  name: string;
  username: string; 
  password?: string; 
  email?: string; 
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
  name?: string;
  code?: string;
}

export interface Transaction {
  id: string;
  date: string;
  referenceNo: string;
  deliveryOrderNo?: string;
  supplier?: string;
  partnerId?: string;
  partnerName?: string;
  type: TransactionType;
  sourceWarehouseId: string;
  targetWarehouseId?: string;
  items: TransactionItem[];
  notes?: string;
  attachments?: string[]; // Array of Base64 strings for photos
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
