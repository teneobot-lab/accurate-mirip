import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, Transaction } from '../types';
import { 
    TrendingUp, TrendingDown, AlertTriangle, Package, 
    ArrowRight, MapPin, Clock, Activity, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend 
} from 'recharts';

export const DashboardView: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    useEffect(() => {
        setItems(StorageService.getItems());
        setStocks(StorageService.getStocks());
        setWarehouses(StorageService.getWarehouses());
        setTransactions(StorageService.getTransactions());
    }, []);

    // --- Derived Data Calculations ---

    const stockStatus = useMemo(() => {
        const lowStockItems: { item: Item, current: number, min: number, gap: number }[] = [];
        let totalStockCount = 0;

        items.forEach(item => {
            const itemStocks = stocks.filter(s => s.itemId === item.id);
            const currentTotal = itemStocks.reduce((acc, s) => acc + s.qty, 0);
            totalStockCount += currentTotal;

            if (currentTotal <= item.minStock) {
                lowStockItems.push({
                    item,
                    current: currentTotal,
                    min: item.minStock,
                    gap: item.minStock - currentTotal
                });
            }
        });

        // Sort by gap (severity)
        lowStockItems.sort((a, b) => (b.min - b.current) - (a.min - a.current));

        return { lowStockItems, totalStockCount };
    }, [items, stocks]);

    const movementStats = useMemo(() => {
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        
        let monthIn = 0;
        let monthOut = 0;

        // Group by Date for Chart
        const dailyData: Record<string, { date: string, in: number, out: number }> = {};
        
        // Initialize last 14 days with 0 to ensure continuous chart
        for(let i=13; i>=0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dailyData[dateStr] = { date: dateStr.slice(5), in: 0, out: 0 }; // MM-DD
        }

        transactions.forEach(tx => {
            const txDate = new Date(tx.date);
            if (txDate >= thirtyDaysAgo) {
                const isRecent = tx.date >= thirtyDaysAgo.toISOString().split('T')[0];
                
                let qty = 0;
                tx.items.forEach(line => { qty += (line.qty * line.ratio); });

                if (isRecent) {
                    if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') monthIn += qty;
                    if (tx.type === 'OUT') monthOut += qty;
                }

                // Chart Data (Last 14 days focused)
                if (dailyData[tx.date.slice(5)]) { // Match MM-DD key
                    if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') dailyData[tx.date.slice(5)].in += qty;
                    if (tx.type === 'OUT') dailyData[tx.date.slice(5)].out += qty;
                }
            }
        });

        return { 
            monthIn, 
            monthOut, 
            chartData: Object.values(dailyData).sort((a,b) => a.date.localeCompare(b.date))
        };
    }, [transactions]);

    const warehouseDistribution = useMemo(() => {
        const data = warehouses.map(wh => {
            const qty = stocks.filter(s => s.warehouseId === wh.id).reduce((acc, s) => acc + s.qty, 0);
            return { name: wh.name, value: qty };
        });
        return data.filter(d => d.value > 0);
    }, [warehouses, stocks]);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-blue-300 transition-colors">
                    <div className="flex justify-between items-start z-10">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Items</p>
                            <h3 className="text-3xl font-bold text-slate-800 mt-1">{items.length}</h3>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Package size={20} />
                        </div>
                    </div>
                    <div className="z-10">
                         <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                             <span className="text-slate-700 font-bold">{stockStatus.totalStockCount.toLocaleString()}</span> units across all WH
                         </p>
                    </div>
                    <div className="absolute -bottom-4 -right-4 text-slate-50 opacity-50 group-hover:scale-110 transition-transform duration-500">
                        <Package size={100} />
                    </div>
                </div>

                <div className={`bg-white p-4 rounded-xl shadow-sm border flex flex-col justify-between h-32 relative overflow-hidden group transition-colors ${stockStatus.lowStockItems.length > 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-start z-10">
                        <div>
                            <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Low Stock Alerts</p>
                            <h3 className="text-3xl font-bold text-slate-800 mt-1">{stockStatus.lowStockItems.length}</h3>
                        </div>
                        <div className={`p-2 rounded-lg ${stockStatus.lowStockItems.length > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                            <AlertTriangle size={20} />
                        </div>
                    </div>
                    <div className="z-10">
                         <p className="text-xs text-slate-500 font-medium">
                            Requires immediate attention
                         </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-32">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Inbound (30d)</p>
                            <h3 className="text-3xl font-bold text-slate-800 mt-1">+{movementStats.monthIn.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div>
                         <p className="text-xs text-slate-500 font-medium">Base units received</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-32">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Outbound (30d)</p>
                            <h3 className="text-3xl font-bold text-slate-800 mt-1">-{movementStats.monthOut.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                            <TrendingDown size={20} />
                        </div>
                    </div>
                     <div>
                         <p className="text-xs text-slate-500 font-medium">Base units distributed</p>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Movement Trend */}
                <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Activity size={16} className="text-blue-500" />
                            Stock Movement Trends (Last 14 Days)
                        </h3>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={movementStats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" tick={{fontSize: 10}} stroke="#cbd5e1" axisLine={false} tickLine={false} dy={5}/>
                                <YAxis tick={{fontSize: 10}} stroke="#cbd5e1" axisLine={false} tickLine={false} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area type="monotone" dataKey="in" name="Inbound" stroke="#10b981" fillOpacity={1} fill="url(#colorIn)" strokeWidth={2} />
                                <Area type="monotone" dataKey="out" name="Outbound" stroke="#ef4444" fillOpacity={1} fill="url(#colorOut)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Warehouse Distribution */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <MapPin size={16} className="text-blue-500" />
                        Stock by Location
                    </h3>
                    <div className="flex-1 flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={warehouseDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {warehouseDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend iconSize={8} wrapperStyle={{fontSize: '11px'}} />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-2xl font-bold text-slate-300 opacity-20"><Package size={40}/></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Critical Low Stock */}
                <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden flex flex-col h-[400px]">
                    <div className="p-4 bg-red-50/50 border-b border-red-100 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-red-700 flex items-center gap-2">
                            <AlertTriangle size={16} />
                            Critical Low Stock
                        </h3>
                        <span className="text-xs font-bold bg-white px-2 py-1 rounded text-red-500 border border-red-100">
                            {stockStatus.lowStockItems.length} Items
                        </span>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase sticky top-0">
                                <tr>
                                    <th className="p-3">Item Info</th>
                                    <th className="p-3 text-right">Current</th>
                                    <th className="p-3 text-right">Min</th>
                                    <th className="p-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-50">
                                {stockStatus.lowStockItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center"><Package size={20}/></div>
                                                <span>Stock levels are healthy. Great job!</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    stockStatus.lowStockItems.map((entry, idx) => (
                                        <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                                            <td className="p-3">
                                                <div className="font-medium text-slate-700">{entry.item.name}</div>
                                                <div className="text-xs text-slate-400 font-mono">{entry.item.code}</div>
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-red-600">
                                                {entry.current}
                                            </td>
                                            <td className="p-3 text-right font-mono text-slate-500">
                                                {entry.min}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                    Restock
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[400px]">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                         <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Clock size={16} className="text-blue-500" />
                            Recent Activity
                        </h3>
                         <button className="text-xs text-blue-600 hover:underline flex items-center gap-1">View All <ArrowRight size={10}/></button>
                    </div>
                    <div className="flex-1 overflow-auto p-0">
                         {transactions.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 italic">No transactions recorded yet.</div>
                         ) : (
                             <div className="divide-y divide-slate-50">
                                 {transactions.slice(0, 8).map(tx => (
                                     <div key={tx.id} className="p-3 hover:bg-slate-50 flex items-center justify-between group cursor-default">
                                         <div className="flex items-center gap-3">
                                             <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                                                 tx.type === 'IN' || tx.type === 'ADJUSTMENT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                 tx.type === 'OUT' ? 'bg-red-50 text-red-600 border-red-100' :
                                                 'bg-blue-50 text-blue-600 border-blue-100'
                                             }`}>
                                                 {tx.type === 'IN' ? <ArrowDownRight size={14}/> : 
                                                  tx.type === 'OUT' ? <ArrowUpRight size={14}/> : 'TR'}
                                             </div>
                                             <div>
                                                 <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                                     {tx.referenceNo}
                                                     {tx.deliveryOrderNo && <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded font-normal">DO: {tx.deliveryOrderNo}</span>}
                                                 </div>
                                                 <div className="text-xs text-slate-500">
                                                    {new Date(tx.date).toLocaleDateString()} • {warehouses.find(w => w.id === tx.sourceWarehouseId)?.name}
                                                 </div>
                                             </div>
                                         </div>
                                         <div className="text-right">
                                             <div className="text-sm font-mono font-bold text-slate-700">
                                                 {tx.items.length} Lines
                                             </div>
                                             <div className="text-[10px] text-slate-400 uppercase font-bold">{tx.type}</div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
};