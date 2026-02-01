import { Item, Warehouse, Stock, Transaction, TransactionType } from '../types';

// Initial Mock Data
const INITIAL_WAREHOUSES: Warehouse[] = [
  { id: 'wh-1', name: 'Gudang Pusat (JKT)', location: 'Jakarta' },
  { id: 'wh-2', name: 'Gudang Cabang (SBY)', location: 'Surabaya' },
];

const INITIAL_ITEMS: Item[] = [
  { 
    id: 'it-1', code: 'A001', name: 'Kopi Arabica Premium', category: 'Beverage', baseUnit: 'Pcs', minStock: 50,
    conversions: [{ name: 'Box', ratio: 10 }, { name: 'Carton', ratio: 100 }]
  },
  { 
    id: 'it-2', code: 'E005', name: 'Wireless Mouse Silent', category: 'Electronics', baseUnit: 'Unit', minStock: 20,
    conversions: [{ name: 'Box', ratio: 5 }]
  },
  { 
    id: 'it-3', code: 'P010', name: 'Kertas HVS A4 80gr', category: 'Stationery', baseUnit: 'Rim', minStock: 100,
    conversions: [{ name: 'Box', ratio: 5 }]
  },
];

const INITIAL_STOCKS: Stock[] = [
  { itemId: 'it-1', warehouseId: 'wh-1', qty: 500 },
  { itemId: 'it-1', warehouseId: 'wh-2', qty: 120 },
  { itemId: 'it-2', warehouseId: 'wh-1', qty: 45 },
];

// Helper to simulate local storage DB
const STORAGE_KEYS = {
  ITEMS: 'gp_items',
  WAREHOUSES: 'gp_warehouses',
  STOCKS: 'gp_stocks',
  TRANSACTIONS: 'gp_transactions'
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
    }
  },

  getItems: (): Item[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.ITEMS) || '[]'),
  
  getWarehouses: (): Warehouse[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.WAREHOUSES) || '[]'),
  
  getStocks: (): Stock[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCKS) || '[]'),
  
  getTransactions: (): Transaction[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]'),

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
  }
};