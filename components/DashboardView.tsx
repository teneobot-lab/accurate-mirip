import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Transaction, Warehouse, TransactionType } from '../types';
import {
  Package, ArrowUpRight, ArrowDownRight, RefreshCw, Calendar,
  AlertCircle, Building2, ClipboardList, Activity, TrendingUp, Flame,
  MousePointerClick
} from 'lucide-react';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface DashboardProps {
  onEditTransaction?: (tx: Transaction) => void;
  onViewItem?: (item: Item) => void;
  onNavigate?: (tab: 'REPORTS' | 'REJECT') => void;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
interface StatMiniProps {
  label: string;
  value: number;
  icon: React.FC<{ size?: number; className?: string }>;
  colorClass: string;
}
const StatMini: React.FC<StatMiniProps> = ({ label, value, icon: Icon, colorClass }) => (
  <div className="flex items-center gap-3 px-4 border-r border-slate-700/50 last:border-0">
    <div className="p-1.5 rounded-lg bg-slate-800">
      <Icon size={14} className={colorClass} />
    </div>
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight leading-none">{label}</p>
      <p className="text-[13px] font-bold text-slate-200 mt-1 leading-none">{value.toLocaleString()}</p>
    </div>
  </div>
);

const SkeletonStat = () => (
  <div className="flex items-center gap-3 px-4 border-r border-slate-700/50">
    <div className="w-7 h-7 rounded-lg bg-slate-800 animate-pulse" />
    <div>
      <div className="h-2 w-16 bg-slate-800 rounded animate-pulse mb-1.5" />
      <div className="h-3 w-12 bg-slate-800 rounded animate-pulse" />
    </div>
  </div>
);

const TX_TYPE_STYLE: Record<string, string> = {
  IN:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  OUT:        'bg-rose-50 text-rose-700 border-rose-200',
  TRANSFER:   'bg-sky-50 text-sky-700 border-sky-200',
  ADJUSTMENT: 'bg-amber-50 text-amber-700 border-amber-200',
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export const DashboardView: React.FC<DashboardProps> = ({
  onEditTransaction,
  onViewItem,
  onNavigate,
}) => {
  const [items, setItems] = useState<Item[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Tooltip hint state
  const [hint, setHint] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [its, stk, txs, whs] = await Promise.all([
        StorageService.fetchItems(),
        StorageService.fetchStocks(),
        StorageService.fetchTransactions(),
        StorageService.fetchWarehouses(),
      ]);
      setItems(its);
      setStocks(stk);
      setTransactions(txs);
      setWarehouses(whs);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const data = useMemo(() => {
    const filteredTx = transactions.filter(tx => tx.date >= startDate && tx.date <= endDate);

    const recentTx = [...filteredTx]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 15);

    const lowStock = items
      .filter(it => it.isActive && it.minStock > 0)
      .map(it => ({
        ...it,
        current: stocks.filter(s => s.itemId === it.id).reduce((acc, s) => acc + Number(s.qty), 0),
      }))
      .filter(it => it.current <= it.minStock)
      .sort((a, b) => a.current - b.current)
      .slice(0, 10);

    const summary = {
      totalIn: filteredTx
        .filter(tx => tx.type === 'IN')
        .reduce((acc, tx) => acc + tx.items.reduce((iAcc, it) => iAcc + it.qty * (it.ratio || 1), 0), 0),
      totalOut: filteredTx
        .filter(tx => tx.type === 'OUT')
        .reduce((acc, tx) => acc + tx.items.reduce((iAcc, it) => iAcc + it.qty * (it.ratio || 1), 0), 0),
      totalStock: stocks.reduce((acc, s) => acc + Number(s.qty), 0),
    };

    // Top 5 — frekuensi transaksi OUT unik per item
    const outTx = filteredTx.filter(tx => tx.type === 'OUT');
    const freqMap = new Map<string, { itemId: string; name: string; code: string; count: number; txSet: Set<string> }>();
    outTx.forEach(tx => {
      tx.items.forEach(line => {
        const id = line.itemId;
        const master = items.find(i => i.id === id);
        const name = line.name || master?.name || id;
        const code = line.code || master?.code || '';
        if (!freqMap.has(id)) freqMap.set(id, { itemId: id, name, code, count: 0, txSet: new Set() });
        const entry = freqMap.get(id)!;
        if (!entry.txSet.has(tx.id)) { entry.txSet.add(tx.id); entry.count += 1; }
      });
    });
    const top5Out = Array.from(freqMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ txSet: _s, ...rest }) => rest);

    return { recentTx, lowStock, summary, top5Out, totalFilteredTx: filteredTx.length };
  }, [items, stocks, transactions, startDate, endDate]);

  const maxCount = data.top5Out[0]?.count || 1;

  return (
    <div className="flex flex-col h-full bg-white font-sans animate-in fade-in duration-300">

      {/* TOP STATS BAR */}
      <div className="h-12 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4 shrink-0 shadow-md">
        <div className="flex h-full items-center">
          {isLoading ? (
            <><SkeletonStat /><SkeletonStat /><SkeletonStat /></>
          ) : (
            <>
              <StatMini label="Stok Tersedia"    value={data.summary.totalStock} icon={Package}        colorClass="text-blue-400" />
              <StatMini label="Masuk (Periode)"  value={data.summary.totalIn}    icon={ArrowDownRight} colorClass="text-emerald-400" />
              <StatMini label="Keluar (Periode)" value={data.summary.totalOut}   icon={ArrowUpRight}   colorClass="text-rose-400" />
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1 shadow-inner">
            <Calendar size={12} className="text-slate-400" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="text-[10px] font-semibold outline-none bg-transparent w-24 text-slate-200 [color-scheme:dark]" />
            <span className="text-slate-500">-</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="text-[10px] font-semibold outline-none bg-transparent w-24 text-slate-200 [color-scheme:dark]" />
          </div>
          <button onClick={loadData} title="Refresh"
            className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* HINT BAR — muncul saat hover area interaktif */}
      <div className={`h-6 border-b border-mist-200 bg-mist-50 flex items-center px-4 gap-2 shrink-0 transition-opacity duration-200 ${hint ? 'opacity-100' : 'opacity-0'}`}>
        <MousePointerClick size={10} className="text-blue-400" />
        <span className="text-[10px] text-slate-500 font-medium">{hint || '...'}</span>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: LOW STOCK — double click buka stock card */}
        <div className="w-72 border-r border-mist-300 flex flex-col shrink-0 bg-mist-50/30">
          <div className="px-4 py-2 bg-mist-100/50 border-b border-mist-300 flex items-center justify-between shrink-0">
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle size={12} className="text-rose-500" /> Stok Menipis
            </h3>
            <span className="text-[9px] font-bold bg-rose-100 text-rose-600 px-1.5 rounded-full">{data.lowStock.length}</span>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 border-b border-mist-200">
                  <div className="flex justify-between mb-2">
                    <div className="h-3 w-32 bg-mist-200 rounded animate-pulse" />
                    <div className="h-2 w-12 bg-mist-200 rounded animate-pulse" />
                  </div>
                  <div className="flex justify-between mb-2">
                    <div className="h-4 w-16 bg-mist-200 rounded animate-pulse" />
                    <div className="h-3 w-10 bg-mist-200 rounded animate-pulse" />
                  </div>
                  <div className="h-1 w-full bg-mist-100 rounded-full" />
                </div>
              ))
            ) : data.lowStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <Package size={24} className="text-slate-300" />
                <span className="text-[10px] font-medium text-slate-400">Semua stok aman</span>
              </div>
            ) : (
              data.lowStock.map(it => (
                <div
                  key={it.id}
                  className="p-3 border-b border-mist-200 hover:bg-blue-50 transition-colors cursor-pointer select-none group"
                  onMouseEnter={() => setHint(`Double click untuk lihat kartu stok: ${it.name}`)}
                  onMouseLeave={() => setHint(null)}
                  onDoubleClick={() => onViewItem?.(it)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[11px] font-semibold text-slate-700 truncate w-40 group-hover:text-blue-700 transition-colors">{it.name}</span>
                    <span className="text-[9px] font-mono text-slate-400">{it.code}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase leading-none">Status Stok</span>
                      <div className="text-[12px] font-bold text-rose-600 mt-1">
                        {it.current.toLocaleString()} <span className="text-[10px] font-medium text-slate-400">{it.baseUnit}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block leading-none">Min. Stock</span>
                      <span className="text-[10px] font-semibold text-slate-500">{it.minStock}</span>
                    </div>
                  </div>
                  <div className="mt-2 h-1 w-full bg-mist-200 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 transition-all duration-500"
                      style={{ width: `${Math.min((it.current / it.minStock) * 100, 100)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CENTER: RECENT TRANSACTIONS — double click buka edit */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-2 bg-mist-100/50 border-b border-mist-300 flex items-center justify-between shrink-0">
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <ClipboardList size={12} className="text-brand" /> Transaksi Terkini
            </h3>
            <span className="text-[9px] text-slate-400 font-medium">{data.recentTx.length} transaksi</span>
          </div>
          <div className="flex-1 overflow-auto bg-white custom-scrollbar">
            <table className="w-full border-collapse text-left table-fixed">
              <thead className="bg-white sticky top-0 z-10 border-b border-mist-300 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                <tr className="h-8">
                  <th className="px-3 text-[10px] font-bold text-slate-500 uppercase w-28">No. Ref</th>
                  <th className="px-3 text-[10px] font-bold text-slate-500 uppercase w-20">Tanggal</th>
                  <th className="px-3 text-[10px] font-bold text-slate-500 uppercase w-16 text-center">Tipe</th>
                  <th className="px-3 text-[10px] font-bold text-slate-500 uppercase w-36">Partner</th>
                  <th className="px-3 text-[10px] font-bold text-slate-500 uppercase">Keterangan</th>
                  <th className="px-3 text-[10px] font-bold text-slate-500 uppercase w-12 text-center">Qty</th>
                  <th className="px-3 text-[10px] font-bold text-slate-500 uppercase w-28">Gudang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist-200">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="h-8">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-3"><div className="h-3 w-full bg-mist-200 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : data.recentTx.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-[11px] text-slate-400">
                      Tidak ada transaksi pada periode ini
                    </td>
                  </tr>
                ) : (
                  data.recentTx.map(tx => (
                    <tr
                      key={tx.id}
                      className="h-8 hover:bg-blue-50 transition-colors cursor-pointer select-none group"
                      onMouseEnter={() => setHint(`Double click untuk edit transaksi: ${tx.referenceNo}`)}
                      onMouseLeave={() => setHint(null)}
                      onDoubleClick={() => onEditTransaction?.(tx)}
                    >
                      <td className="px-3 text-[11px] font-mono text-blue-600 truncate font-semibold group-hover:text-blue-700">{tx.referenceNo}</td>
                      <td className="px-3 text-[11px] text-slate-600">{tx.date}</td>
                      <td className="px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${TX_TYPE_STYLE[tx.type] || 'bg-mist-100 text-slate-500 border-mist-200'}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-3 text-[11px] truncate">
                        {tx.partnerName
                          ? <span className="font-semibold text-slate-700 uppercase">{tx.partnerName}</span>
                          : <span className="text-slate-300 italic text-[10px]">—</span>}
                      </td>
                      <td className="px-3 text-[11px] text-slate-600 truncate">
                        {tx.notes || (tx.items.length > 0 ? tx.items[0].name : <span className="text-slate-300">—</span>)}
                      </td>
                      <td className="px-3 text-center text-[11px] font-bold text-slate-500">{tx.items.length}</td>
                      <td className="px-3 text-[11px] text-slate-500 truncate uppercase">
                        {warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: WIDGETS */}
        <div className="w-64 border-l border-mist-300 flex flex-col shrink-0 bg-mist-50/50 overflow-auto custom-scrollbar">

          {/* TOP 5 SERING KELUAR — double click buka Mutasi Stok */}
          <div className="shrink-0">
            <div className="px-4 py-2 bg-mist-100/50 border-b border-mist-300">
              <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <Flame size={12} className="text-orange-500" /> Top 5 Sering Keluar
              </h3>
              <p className="text-[9px] text-slate-400 mt-0.5">Frekuensi transaksi OUT per item</p>
            </div>
            <div className="p-3 space-y-2.5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-2.5 w-32 bg-mist-200 rounded animate-pulse" />
                    <div className="h-1.5 w-full bg-mist-100 rounded-full" />
                  </div>
                ))
              ) : data.top5Out.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-slate-400 italic">Tidak ada data OUT pada periode ini</p>
              ) : (
                data.top5Out.map((item, idx) => {
                  const barColors = ['bg-orange-500','bg-orange-400','bg-amber-400','bg-amber-300','bg-yellow-300'];
                  const medals = ['🥇','🥈','🥉'];
                  const masterItem = items.find(i => i.id === item.itemId);
                  return (
                    <div
                      key={item.code || idx}
                      className="cursor-pointer rounded-md px-1 py-0.5 hover:bg-orange-50 transition-colors group"
                      onMouseEnter={() => setHint(`Double click untuk lihat kartu stok: ${item.name}`)}
                      onMouseLeave={() => setHint(null)}
                      onDoubleClick={() => masterItem && onViewItem?.(masterItem)}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="shrink-0 text-[10px] w-4 text-center">
                            {idx < 3 ? medals[idx] : <span className="text-[9px] font-bold text-slate-400">{idx + 1}</span>}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-700 truncate group-hover:text-orange-700 transition-colors">{item.name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-orange-600 shrink-0 ml-1">{item.count}×</span>
                      </div>
                      <div className="h-1.5 w-full bg-mist-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${barColors[idx]}`}
                          style={{ width: `${Math.round((item.count / maxCount) * 100)}%` }} />
                      </div>
                      {item.code && <span className="text-[9px] font-mono text-slate-400">{item.code}</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SYSTEM MONITOR */}
          <div className="shrink-0 border-t border-mist-300">
            <div className="px-4 py-2 bg-mist-100/50 border-b border-mist-300">
              <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <Activity size={12} className="text-emerald-500" /> System Monitor
              </h3>
            </div>
            <div className="p-3 space-y-3">
              <div className="bg-white p-3 rounded-lg border border-mist-300 shadow-sm">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-2">Sinkronisasi Database</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-700">Terhubung ke MySQL</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1">Latency: 24ms • Realtime Active</p>
              </div>

              <div className="bg-white p-3 rounded-lg border border-mist-300 shadow-sm">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-2">Gudang Aktif</p>
                <div className="space-y-2">
                  {warehouses.filter(wh => wh.isActive).slice(0, 3).map(wh => (
                    <div key={wh.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 size={10} className="text-slate-400" />
                        <span className="text-[10px] font-semibold text-slate-600 truncate w-28">{wh.name}</span>
                      </div>
                      <span className="text-[8px] font-bold uppercase text-emerald-500">Online</span>
                    </div>
                  ))}
                  {warehouses.filter(wh => wh.isActive).length === 0 && (
                    <p className="text-[10px] text-slate-400 italic">Tidak ada gudang aktif</p>
                  )}
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-mist-300 shadow-sm">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                  <TrendingUp size={9} /> Ringkasan Periode
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Total Transaksi</span>
                    <span className="font-bold text-slate-700">{data.totalFilteredTx}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Stok Menipis</span>
                    <span className={`font-bold ${data.lowStock.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {data.lowStock.length} item
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Item Aktif</span>
                    <span className="font-bold text-slate-700">{items.filter(i => i.isActive).length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};
