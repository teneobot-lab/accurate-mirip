
export interface UnitConversion {
  name: string;
  ratio: number; // How many base units in this unit (e.g., Box = 12 Pcs, ratio = 12)
  operator?: '*' | '/'; // Default is '*'
}

export interface Item {
  id: string;
  code: string;
  name: string;
  category: string;
  baseUnit: string;
  conversions: UnitConversion[];
  minStock: number;
}

export interface Stock {
  itemId: string;
  warehouseId: string;
  qty: number; // Always stored in base unit
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
  npwp?: string; // Tax ID
  term?: number; // Payment terms (days)
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  status: 'ACTIVE' | 'INACTIVE';
}

export type TransactionType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';

export interface TransactionItem {
  itemId: string;
  unit: string; // The unit used in the transaction
  qty: number;  // The quantity in the selected unit
  ratio: number; // Snapshot of ratio at time of transaction
  note?: string; // Keeping strictly for backward compatibility in types, though removed from UI
}

export interface Transaction {
  id: string;
  date: string;
  referenceNo: string; // e.g., INV-2023-001
  deliveryOrderNo?: string; // Surat Jalan
  supplier?: string; // Supplier or Recipient
  type: TransactionType;
  sourceWarehouseId: string;
  targetWarehouseId?: string; // Only for TRANSFER
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
    baseQty: number; // Calculated
    reason: string;
}

export interface RejectBatch {
    id: string;
    date: string;
    outlet: string;
    createdAt: number;
    items: RejectItem[];
}
