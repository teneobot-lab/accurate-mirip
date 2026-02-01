
import { Item, Warehouse, Stock, Transaction, TransactionType, Partner, AppUser, RejectBatch } from '../types';

// Initial Mock Data
const INITIAL_WAREHOUSES: Warehouse[] = [
  { id: 'wh-1', name: 'Gudang Pusat (JKT)', location: 'Jakarta', phone: '021-555555', pic: 'Budi Santoso' },
  { id: 'wh-2', name: 'Gudang Cabang (SBY)', location: 'Surabaya', phone: '031-444444', pic: 'Siti Aminah' },
];

const INITIAL_PARTNERS: Partner[] = [
  { id: 'p-1', type: 'SUPPLIER', name: 'PT. Sumber Makmur', phone: '0812345678', email: 'sales@sumbermakmur.com', address: 'Jl. Industri No. 1, Jakarta', term: 30 },
  { id: 'p-2', type: 'CUSTOMER', name: 'Toko Jaya Abadi', phone: '0898765432', email: 'jaya@abadi.com', address: 'Pasar Baru Blok A, Bandung', term: 0 },
  { id: 'p-3', type: 'SUPPLIER', name: 'CV. Elektronik Maju', phone: '021-998877', email: 'info@elektronikmaju.com', address: 'Glodok Plaza, Jakarta', term: 14 },
];

const INITIAL_USERS: AppUser[] = [
  { id: 'u-1', name: 'Administrator', email: 'admin@gudangpro.com', role: 'ADMIN', status: 'ACTIVE' },
  { id: 'u-2', name: 'Staff Gudang', email: 'staff@gudangpro.com', role: 'STAFF', status: 'ACTIVE' },
];

const INITIAL_ITEMS: Item[] = [
  { 
    id: 'it-1', code: 'A001', name: 'Kopi Arabica Premium', category: 'Beverage', baseUnit: 'Pcs', minStock: 50,
    conversions: [{ name: 'Box', ratio: 10, operator: '*' }, { name: 'Carton', ratio: 100, operator: '*' }]
  },
  { 
    id: 'it-2', code: 'E005', name: 'Wireless Mouse Silent', category: 'Electronics', baseUnit: 'Unit', minStock: 20,
    conversions: [{ name: 'Box', ratio: 5, operator: '*' }]
  },
  { 
    id: 'it-3', code: 'P010', name: 'Kertas HVS A4 80gr', category: 'Stationery', baseUnit: 'Rim', minStock: 100,
    conversions: [{ name: 'Box', ratio: 5, operator: '*' }]
  },
  { 
    id: 'it-4', code: 'F001', name: 'Chicken Breast Fillet', category: 'Fresh', baseUnit: 'KG', minStock: 5,
    conversions: [{ name: 'GRM', ratio: 1000, operator: '/' }] // Example of Divide Logic
  },
];

const INITIAL_STOCKS: Stock[] = [
  { itemId: 'it-1', warehouseId: 'wh-1', qty: 500 },
  { itemId: 'it-1', warehouseId: 'wh-2', qty: 120 },
  { itemId: 'it-2', warehouseId: 'wh-1', qty: 45 },
  { itemId: 'it-4', warehouseId: 'wh-1', qty: 20 },
];

// Helper to simulate local storage DB
const STORAGE_KEYS = {
  ITEMS: 'gp_items',
  WAREHOUSES: 'gp_warehouses',
  STOCKS: 'gp_stocks',
  TRANSACTIONS: 'gp_transactions',
  PARTNERS: 'gp_partners',
  USERS: 'gp_users',
  REJECTS: 'gp_rejects', // Isolated
  REJECT_OUTLETS: 'gp_reject_outlets'
};

// Helper function to calculate stock impact
const calculateStockImpact = (stocks: Stock[], tx: Transaction, isReversal: boolean) => {
    const multiplier = isReversal ? -1 : 1;
    const newStocks = [...stocks];

    tx.items.forEach(item => {
        const totalBaseQty = item.qty * item.ratio;

        const updateStock = (whId: string, qtyChange: number) => {
            const index = newStocks.findIndex(s => s.itemId === item.itemId && s.warehouseId === whId);
            if (index >= 0) {
                newStocks[index].qty += qtyChange;
            } else {
                newStocks.push({ itemId: item.itemId, warehouseId: whId, qty: qtyChange });
            }
        };

        if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
            // IN: Add to Source
            // Reversal: Subtract from Source
            updateStock(tx.sourceWarehouseId, totalBaseQty * multiplier);
        } else if (tx.type === 'OUT') {
            // OUT: Subtract from Source
            // Reversal: Add to Source
            updateStock(tx.sourceWarehouseId, -totalBaseQty * multiplier);
        } else if (tx.type === 'TRANSFER') {
            // TRANSFER: Subtract from Source, Add to Target
            // Reversal: Add to Source, Subtract from Target
            updateStock(tx.sourceWarehouseId, -totalBaseQty * multiplier);
            if (tx.targetWarehouseId) {
                updateStock(tx.targetWarehouseId, totalBaseQty * multiplier);
            }
        }
    });

    return newStocks;
};

export const StorageService = {
  init: () => {
    if (!localStorage.getItem(STORAGE_KEYS.ITEMS)) {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(INITIAL_ITEMS));
      localStorage.setItem(STORAGE_KEYS.WAREHOUSES, JSON.stringify(INITIAL_WAREHOUSES));
      localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(INITIAL_STOCKS));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify(INITIAL_PARTNERS));
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
      localStorage.setItem(STORAGE_KEYS.REJECTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.REJECT_OUTLETS, JSON.stringify(['Outlet Pusat', 'Outlet Cabang A']));
    }
  },

  getItems: (): Item[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.ITEMS) || '[]'),
  
  getWarehouses: (): Warehouse[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.WAREHOUSES) || '[]'),
  saveWarehouse: (wh: Warehouse) => {
      const list = StorageService.getWarehouses();
      const idx = list.findIndex(w => w.id === wh.id);
      if (idx >= 0) list[idx] = wh; else list.push(wh);
      localStorage.setItem(STORAGE_KEYS.WAREHOUSES, JSON.stringify(list));
  },
  deleteWarehouse: (id: string) => {
      const list = StorageService.getWarehouses().filter(w => w.id !== id);
      localStorage.setItem(STORAGE_KEYS.WAREHOUSES, JSON.stringify(list));
  },
  
  getStocks: (): Stock[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCKS) || '[]'),
  
  getTransactions: (): Transaction[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]'),

  // Partners
  getPartners: (): Partner[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTNERS) || '[]'),
  savePartner: (p: Partner) => {
      const list = StorageService.getPartners();
      const idx = list.findIndex(x => x.id === p.id);
      if (idx >= 0) list[idx] = p; else list.push(p);
      localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify(list));
  },
  deletePartner: (id: string) => {
      const list = StorageService.getPartners().filter(x => x.id !== id);
      localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify(list));
  },

  // Users
  getUsers: (): AppUser[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]'),
  saveUser: (u: AppUser) => {
      const list = StorageService.getUsers();
      const idx = list.findIndex(x => x.id === u.id);
      if (idx >= 0) list[idx] = u; else list.push(u);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list));
  },
  deleteUser: (id: string) => {
      const list = StorageService.getUsers().filter(x => x.id !== id);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list));
  },

  // Save Item
  saveItem: (item: Item) => {
    const items = StorageService.getItems();
    const index = items.findIndex(i => i.id === item.id);
    if (index >= 0) items[index] = item;
    else items.push(item);
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
  },

  // Bulk Import Items
  importItems: (newItems: Item[]) => {
    const items = StorageService.getItems();
    const merged = [...items, ...newItems];
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(merged));
  },

  // Delete Items
  deleteItems: (ids: string[]) => {
    const items = StorageService.getItems().filter(i => !ids.includes(i.id));
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
  },

  // Commit Transaction
  commitTransaction: (tx: Transaction) => {
    const transactions = StorageService.getTransactions();
    transactions.unshift(tx); // Add to top
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));

    // Update Stocks
    let stocks = StorageService.getStocks();
    stocks = calculateStockImpact(stocks, tx, false); // false = Apply
    localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(stocks));
  },

  // Update Transaction (Edit History)
  updateTransaction: (updatedTx: Transaction) => {
      const transactions = StorageService.getTransactions();
      const index = transactions.findIndex(t => t.id === updatedTx.id);
      
      if (index === -1) return;

      const oldTx = transactions[index];
      let stocks = StorageService.getStocks();

      // 1. Revert Old Transaction Stock
      stocks = calculateStockImpact(stocks, oldTx, true); // true = Reversal

      // 2. Apply New Transaction Stock
      stocks = calculateStockImpact(stocks, updatedTx, false); // false = Apply

      // 3. Update Transaction Record
      transactions[index] = updatedTx;

      // 4. Save Everything
      localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(stocks));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },

  getStockQty: (itemId: string, warehouseId: string): number => {
    const stocks = StorageService.getStocks();
    const stock = stocks.find(s => s.itemId === itemId && s.warehouseId === warehouseId);
    return stock ? stock.qty : 0;
  },

  // --- REJECT MODULE SERVICES (Isolated) ---
  
  getRejectBatches: (): RejectBatch[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.REJECTS) || '[]'),
  
  saveRejectBatch: (batch: RejectBatch) => {
      const batches = StorageService.getRejectBatches();
      batches.unshift(batch);
      localStorage.setItem(STORAGE_KEYS.REJECTS, JSON.stringify(batches));
  },

  getRejectOutlets: (): string[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.REJECT_OUTLETS) || '[]'),
  
  saveRejectOutlet: (name: string) => {
      const outlets = StorageService.getRejectOutlets();
      if (!outlets.includes(name)) {
          outlets.push(name);
          localStorage.setItem(STORAGE_KEYS.REJECT_OUTLETS, JSON.stringify(outlets));
      }
  },

  deleteRejectBatch: (id: string) => {
      const batches = StorageService.getRejectBatches().filter(b => b.id !== id);
      localStorage.setItem(STORAGE_KEYS.REJECTS, JSON.stringify(batches));
  }
};
