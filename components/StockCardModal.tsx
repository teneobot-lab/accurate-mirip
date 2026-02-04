
import React, { useMemo, useState, useEffect } from 'react';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { StorageService } from '../services/storage';
import { X, Package, TrendingUp, History, MapPin, Box, Calendar } from 'lucide-react';

interface Props {
  item: Item;
  onClose: () => void;
}

export const StockCardModal: React.FC<Props> = ({ item, onClose }) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Date Filter State
  const [startDate, setStartDate] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

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

  // Get recent history for this item with Date Filtering
  const history = useMemo(() => {
    const relevantTx = transactions.filter(tx => 
        tx.items.some(ti => ti.itemId === item.id) &&
        tx.date >= startDate &&
        tx.date <= endDate
    );
    
    // Sort desc
    return relevantTx
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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
  }, [item, transactions, warehouses, startDate, endDate]);

  return (
    <div className="fixed inset-0 bg-daintree/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gable rounded-[24px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-spectra" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-daintree px-6 py-4 flex justify-between items-center border-b border-spectra">
            <div className="flex items-center gap-4">
                 <div className="p-3 bg-gable rounded-2xl shadow-sm border border-spectra text-white">
                    <Box size={24}/>
                 </div>
                 <div>
                    <h2 className="text-lg font-bold text-white leading-none mb-1">Kartu Stok Barang</h2>
                    <div className="flex items-center gap-2 text-[10px] text-cutty font-bold uppercase tracking-widest">
                         <span>{item.code}</span>
                         <span>•</span>
                         <span>{item.name}</span>
                    </div>
                 </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-spectra/20 transition-colors">
                <X size={24} />
            </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6 bg-gable scrollbar-thin flex-1">
            
            {/* KPI Section */}
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-daintree/50 border border-spectra rounded-2xl">
                    <div className="text-[10px] font-black text-cutty uppercase mb-1 tracking-wider">Total Inventory</div>
                    <div className={`text-3xl font-mono font-bold ${stockData.total <= item.minStock ? 'text-red-400' : 'text-white'}`}>
                        {stockData.total.toLocaleString()} <span className="text-sm font-sans font-bold text-slate-500">{item.baseUnit}</span>
                    </div>
                    {stockData.total <= item.minStock && (
                        <div className="text-[10px] text-red-400 font-bold mt-2 flex items-center bg-red-900/20 px-2 py-1 rounded w-fit border border-red-900/50">
                            ⚠️ Below Min Stock ({item.minStock})
                        </div>
                    )}
                </div>
                 <div className="p-4 bg-daintree/50 border border-spectra rounded-2xl">
                    <div className="text-[10px] font-black text-cutty uppercase mb-2 tracking-wider">Unit Conversions</div>
                    <div className="space-y-1">
                        {item.conversions.length > 0 ? item.conversions.map((c, i) => (
                            <div key={i} className="text-xs text-slate-300 flex justify-between border-b border-dashed border-spectra pb-1 mb-1 last:border-0 last:pb-0 last:mb-0">
                                <span className="font-medium">1 {c.name}</span>
                                <span className="font-mono font-bold text-white">= {c.ratio} {item.baseUnit}</span>
                            </div>
                        )) : <span className="text-xs text-slate-500 italic">No conversions defined</span>}
                    </div>
                </div>
            </div>

            {/* Warehouse Breakdown */}
            <div>
                <h3 className="text-xs font-black text-cutty uppercase tracking-widest mb-3 flex items-center gap-2">
                    <MapPin size={14} /> Warehouse Distribution
                </h3>
                <div className="bg-daintree border border-spectra rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-gable text-slate-400 uppercase font-bold border-b border-spectra">
                            <tr>
                                <th className="px-4 py-2 w-1/2">Location</th>
                                <th className="px-4 py-2 text-right">Quantity</th>
                                <th className="px-4 py-2 w-1/3 text-center">Visual</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-spectra/30">
                            {stockData.breakdown.map(wh => (
                                <tr key={wh.name} className="hover:bg-gable/50 transition-colors">
                                    <td className="px-4 py-2 font-bold text-slate-200">{wh.name}</td>
                                    <td className="px-4 py-2 text-right font-mono font-bold text-white">{wh.qty.toLocaleString()}</td>
                                    <td className="px-4 py-2">
                                        <div className="h-1.5 w-full bg-gable rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full ${wh.qty > 0 ? 'bg-spectra' : 'bg-slate-700'}`} 
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

            {/* Recent History with Filter */}
            <div>
                <div className="flex justify-between items-end mb-3">
                    <h3 className="text-xs font-black text-cutty uppercase tracking-widest flex items-center gap-2">
                        <History size={14} /> Transaction History
                    </h3>
                    <div className="flex items-center gap-2 bg-daintree p-1 rounded-lg border border-spectra/50">
                        <Calendar size={12} className="text-spectra ml-1"/>
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-[10px] text-white font-bold outline-none border-none w-20 p-0"
                        />
                        <span className="text-cutty text-[10px]">-</span>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-[10px] text-white font-bold outline-none border-none w-20 p-0"
                        />
                    </div>
                </div>
                
                <div className="bg-daintree border border-spectra rounded-xl overflow-hidden shadow-inner">
                     <table className="w-full text-xs text-left">
                        <thead className="bg-gable text-slate-400 uppercase font-bold border-b border-spectra sticky top-0">
                            <tr>
                                <th className="px-4 py-2.5">Date</th>
                                <th className="px-4 py-2.5">Ref</th>
                                <th className="px-4 py-2.5">Type</th>
                                <th className="px-4 py-2.5 text-right">Qty</th>
                                <th className="px-4 py-2.5 text-center">Unit</th>
                                <th className="px-4 py-2.5">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-spectra/30 text-slate-300">
                            {history.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-500 italic font-bold">No transactions in selected period.</td></tr>
                            ) : history.map((h, idx) => (
                                <tr key={idx} className="hover:bg-gable/50 transition-colors">
                                    <td className="px-4 py-2 font-mono text-slate-400">{h.date}</td>
                                    <td className="px-4 py-2 font-mono font-bold text-white">{h.ref}</td>
                                    <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight ${
                                            h.type === 'IN' || h.type === 'ADJUSTMENT' ? 'bg-emerald-900/30 text-emerald-400' :
                                            h.type === 'OUT' ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'
                                        }`}>{h.type}</span>
                                    </td>
                                    <td className={`px-4 py-2 text-right font-black ${h.type === 'OUT' || h.type === 'TRANSFER' ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {h.qty.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-center text-slate-500 font-bold">{h.unit}</td>
                                    <td className="px-4 py-2 text-slate-400 truncate max-w-[100px]">{h.wh}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="text-right text-[9px] text-cutty font-bold mt-2 italic">
                    Showing {history.length} transactions
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};
