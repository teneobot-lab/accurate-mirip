
import React, { useMemo, useState, useEffect } from 'react';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { StorageService } from '../services/storage';
import { X, Package, TrendingUp, History, MapPin } from 'lucide-react';

interface Props {
  item: Item;
  onClose: () => void;
}

export const StockCardModal: React.FC<Props> = ({ item, onClose }) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Fetch necessary data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [fetchedStocks, fetchedWh, fetchedTx] = await Promise.all([
          StorageService.fetchStocks(),
          StorageService.fetchWarehouses(),
          StorageService.fetchTransactions()
        ]);
        setStocks(fetchedStocks);
        setWarehouses(fetchedWh);
        setTransactions(fetchedTx);
      } catch (error) {
        console.error("Failed to load stock data", error);
      }
    };
    loadData();
  }, []);

  // Calculate current stock breakdown
  const stockData = useMemo(() => {
    const itemStocks = stocks.filter(s => s.itemId === item.id);
    const total = itemStocks.reduce((acc, s) => acc + Number(s.qty), 0);
    const breakdown = warehouses.map(wh => {
        const s = itemStocks.find(stk => stk.warehouseId === wh.id);
        return { name: wh.name, qty: s ? Number(s.qty) : 0 };
    });
    return { total, breakdown };
  }, [item, stocks, warehouses]);

  // Get recent history for this item
  const history = useMemo(() => {
    const relevantTx = transactions.filter(tx => 
        tx.items.some(ti => ti.itemId === item.id)
    );
    // Sort desc, take top 5
    return relevantTx
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
        .map(tx => {
            const line = tx.items.find(ti => ti.itemId === item.id);
            return {
                date: tx.date,
                ref: tx.referenceNo,
                type: tx.type,
                qty: line ? line.qty : 0,
                unit: line ? line.unit : '',
                wh: warehouses.find(w => w.id === tx.sourceWarehouseId)?.name
            };
        });
  }, [item, transactions, warehouses]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-slate-800 dark:bg-slate-950 text-white p-4 flex justify-between items-start">
            <div>
                <div className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wider">Stock Card</div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Package className="text-blue-400" /> 
                    {item.name}
                </h2>
                <div className="font-mono text-sm text-slate-300 mt-1">CODE: {item.code} | Unit: {item.baseUnit}</div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors">
                <X size={24} />
            </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6 bg-white dark:bg-slate-900">
            
            {/* KPI Section */}
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Total Stock</div>
                    <div className={`text-3xl font-mono font-bold ${stockData.total <= item.minStock ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>
                        {stockData.total} <span className="text-sm font-sans font-normal text-slate-500 dark:text-slate-400">{item.baseUnit}</span>
                    </div>
                    {stockData.total <= item.minStock && (
                        <div className="text-xs text-red-500 dark:text-red-400 font-bold mt-1 flex items-center">
                            ⚠️ Below Min Stock ({item.minStock})
                        </div>
                    )}
                </div>
                 <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Conversions</div>
                    <div className="space-y-1">
                        {item.conversions.length > 0 ? item.conversions.map((c, i) => (
                            <div key={i} className="text-sm text-slate-700 dark:text-slate-300 flex justify-between border-b border-dashed border-slate-300 dark:border-slate-600 last:border-0 py-1">
                                <span>1 {c.name}</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">= {c.ratio} {item.baseUnit}</span>
                            </div>
                        )) : <span className="text-sm text-slate-400 italic">No conversions defined</span>}
                    </div>
                </div>
            </div>

            {/* Warehouse Breakdown */}
            <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <MapPin size={16} /> Warehouse Distribution
                </h3>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">
                            <tr>
                                <th className="p-3">Location</th>
                                <th className="p-3 text-right">Quantity</th>
                                <th className="p-3 w-1/3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {stockData.breakdown.map(wh => (
                                <tr key={wh.name}>
                                    <td className="p-3 font-medium text-slate-700 dark:text-slate-200">{wh.name}</td>
                                    <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{wh.qty}</td>
                                    <td className="p-3">
                                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full ${wh.qty > 0 ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} 
                                                style={{ width: `${Math.min((wh.qty / Math.max(stockData.total, 1)) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent History */}
            <div>
                 <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <History size={16} /> Recent Movements (Last 10)
                </h3>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                     <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 uppercase font-bold">
                            <tr>
                                <th className="p-2">Date</th>
                                <th className="p-2">Ref</th>
                                <th className="p-2">Type</th>
                                <th className="p-2 text-right">Qty</th>
                                <th className="p-2">Unit</th>
                                <th className="p-2">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {history.length === 0 ? (
                                <tr><td colSpan={6} className="p-4 text-center text-slate-400 italic">No transaction history.</td></tr>
                            ) : history.map((h, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="p-2 text-slate-500 dark:text-slate-400">{h.date}</td>
                                    <td className="p-2 font-mono text-slate-600 dark:text-slate-300">{h.ref}</td>
                                    <td className="p-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            h.type === 'IN' || h.type === 'ADJUSTMENT' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                                            h.type === 'OUT' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                        }`}>{h.type}</span>
                                    </td>
                                    <td className={`p-2 text-right font-bold ${h.type === 'OUT' || h.type === 'TRANSFER' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {h.qty}
                                    </td>
                                    <td className="p-2 text-slate-500 dark:text-slate-400">{h.unit}</td>
                                    <td className="p-2 text-slate-500 dark:text-slate-400 truncate max-w-[100px]">{h.wh}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};
