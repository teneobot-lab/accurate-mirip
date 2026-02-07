
import React, { useMemo, useState, useEffect } from 'react';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { StorageService } from '../services/storage';
import { ArrowLeft, Package, TrendingUp, History, MapPin, Box, Calendar, RefreshCw, FileText } from 'lucide-react';

interface Props {
  item: Item;
  onBack: () => void;
}

export const StockCardView: React.FC<Props> = ({ item, onBack }) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Date Filter State - Fixed to Local Time 1st of Month
  const [startDate, setStartDate] = useState(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [item.id]); // Reload if item changes

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
                id: tx.id,
                date: tx.date,
                ref: tx.referenceNo,
                type: tx.type,
                qty: line ? line.qty : 0,
                unit: line ? line.unit : '',
                wh: warehouses.find(w => w.id === tx.sourceWarehouseId)?.name,
                note: tx.notes || line?.note || '-'
            };
        });
  }, [item, transactions, warehouses, startDate, endDate]);

  return (
    <div className="flex flex-col h-full p-4 gap-4 animate-in fade-in slide-in-from-right duration-300">
        
        {/* Header Navigation Bar */}
        <div className="bg-gable p-4 rounded-2xl border border-spectra flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg shrink-0">
            <div className="flex items-center gap-4">
                 <button onClick={onBack} className="p-2.5 rounded-xl bg-daintree text-slate-400 hover:text-white hover:bg-spectra/20 border border-spectra transition-all group">
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                 </button>
                 <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-black text-white leading-none uppercase">{item.name}</h2>
                        <span className="px-2 py-0.5 rounded bg-daintree border border-spectra text-[10px] font-mono font-bold text-emerald-400">{item.code}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-cutty font-bold uppercase tracking-widest">
                         <span className="flex items-center gap-1"><Package size={12}/> {item.category}</span>
                         <span>•</span>
                         <span>Base: {item.baseUnit}</span>
                    </div>
                 </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-daintree p-1 rounded-xl border border-spectra/50 flex-1 sm:flex-none">
                    <Calendar size={14} className="text-spectra ml-2"/>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-xs text-white font-bold outline-none border-none w-24 p-1.5" />
                    <span className="text-cutty text-xs">-</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-xs text-white font-bold outline-none border-none w-24 p-1.5" />
                </div>
                <button onClick={loadData} className="p-2.5 bg-spectra text-white rounded-xl hover:bg-white hover:text-spectra transition-all shadow-lg active:scale-95 border border-spectra/50">
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
            
            {/* Left Column: KPI & Distribution */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4 overflow-y-auto scrollbar-thin pr-1">
                {/* Total Stock KPI */}
                <div className="bg-gable p-6 rounded-2xl border border-spectra shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Box size={120} className="text-spectra"/>
                    </div>
                    <div className="relative z-10">
                        <div className="text-xs font-black text-cutty uppercase mb-2 tracking-widest flex items-center gap-2">
                             <TrendingUp size={16}/> Total Inventory
                        </div>
                        <div className={`text-5xl font-mono font-black tracking-tighter ${stockData.total <= item.minStock ? 'text-red-400' : 'text-white'}`}>
                            {stockData.total.toLocaleString()}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-500">{item.baseUnit}</span>
                            {stockData.total <= item.minStock && (
                                <span className="bg-red-900/30 text-red-400 px-2 py-1 rounded text-[10px] font-black border border-red-900/50 animate-pulse">
                                    ⚠️ BELOW MIN ({item.minStock})
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Warehouse Distribution */}
                <div className="bg-gable border border-spectra rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
                    <div className="p-4 bg-daintree/50 border-b border-spectra">
                        <h3 className="text-xs font-black text-cutty uppercase tracking-widest flex items-center gap-2">
                            <MapPin size={14} /> Lokasi Penyimpanan
                        </h3>
                    </div>
                    <div className="p-2 overflow-y-auto">
                        <table className="w-full text-xs text-left">
                            <tbody className="divide-y divide-spectra/20">
                                {stockData.breakdown.map((wh, idx) => (
                                    <tr key={idx} className="hover:bg-daintree transition-colors group">
                                        <td className="px-4 py-3 font-bold text-slate-300">{wh.name}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="font-mono font-black text-white">{wh.qty.toLocaleString()}</div>
                                        </td>
                                        <td className="px-4 py-3 w-1/3">
                                            <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${wh.qty > 0 ? 'bg-emerald-500' : 'bg-slate-700'}`} 
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

                {/* Conversions */}
                <div className="bg-gable p-5 rounded-2xl border border-spectra shadow-sm">
                    <div className="text-xs font-black text-cutty uppercase mb-3 tracking-widest">Konversi Satuan</div>
                    <div className="space-y-2">
                        {item.conversions.length > 0 ? item.conversions.map((c, i) => (
                            <div key={i} className="text-xs flex justify-between items-center bg-daintree p-2 rounded-lg border border-spectra/30">
                                <span className="font-bold text-slate-300">1 {c.name}</span>
                                <span className="font-mono font-black text-emerald-400">= {c.ratio} {item.baseUnit}</span>
                            </div>
                        )) : <div className="text-[10px] text-slate-500 italic p-2 bg-black/20 rounded border border-white/5">Tidak ada konversi unit tambahan</div>}
                    </div>
                </div>
            </div>

            {/* Right Column: Transaction History Table */}
            <div className="flex-1 bg-gable border border-spectra rounded-2xl shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 bg-daintree/50 border-b border-spectra flex justify-between items-center">
                    <h3 className="text-xs font-black text-cutty uppercase tracking-widest flex items-center gap-2">
                        <History size={14} /> Riwayat Transaksi
                    </h3>
                    <div className="text-[10px] font-bold text-slate-500">
                        Menampilkan {history.length} data
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto scrollbar-thin">
                     <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-daintree text-slate-400 uppercase font-black border-b border-spectra sticky top-0 z-10 text-[10px] tracking-wider">
                            <tr>
                                <th className="px-4 py-3">Tanggal</th>
                                <th className="px-4 py-3">Ref No</th>
                                <th className="px-4 py-3 text-center">Tipe</th>
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3 text-center">Unit</th>
                                <th className="px-4 py-3">Gudang</th>
                                <th className="px-4 py-3">Ket</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-spectra/20 text-slate-300">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center flex flex-col items-center justify-center opacity-50 gap-2">
                                        <FileText size={32} className="text-slate-600"/>
                                        <span className="text-slate-500 font-bold uppercase tracking-widest">Tidak ada riwayat pada periode ini</span>
                                    </td>
                                </tr>
                            ) : history.map((h) => (
                                <tr key={h.id} className="hover:bg-daintree/50 transition-colors group">
                                    <td className="px-4 py-3 font-mono text-emerald-500 font-bold">{h.date}</td>
                                    <td className="px-4 py-3 font-mono font-bold text-white group-hover:text-spectra transition-colors">{h.ref}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight border ${
                                            h.type === 'IN' || h.type === 'ADJUSTMENT' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' :
                                            h.type === 'OUT' ? 'bg-red-900/20 text-red-400 border-red-900/50' : 'bg-blue-900/20 text-blue-400 border-blue-900/50'
                                        }`}>{h.type}</span>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-black text-sm ${h.type === 'OUT' || h.type === 'TRANSFER' ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {h.qty.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-500 font-bold uppercase text-[10px]">{h.unit}</td>
                                    <td className="px-4 py-3 text-slate-400 truncate max-w-[120px] font-bold text-[10px] uppercase">{h.wh}</td>
                                    <td className="px-4 py-3 text-slate-500 italic truncate max-w-[150px]">{h.note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
  );
};
