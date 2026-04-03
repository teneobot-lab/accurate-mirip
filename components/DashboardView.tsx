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
  <div className="flex items-center gap-2 px-3 border-r border-[#6a8cbc] last:border-0">
    <Icon size={13} className={colorClass} />
    <div>
      <p style={{ fontFamily: 'Tahoma, Arial, sans-serif', fontSize: '10px', color: '#c8daf0', letterSpacing: '0.02em' }}>{label}</p>
      <p style={{ fontFamily: 'Consolas, "Courier New", monospace', fontSize: '13px', color: '#ffffff', fontWeight: 700, lineHeight: 1 }}>{value.toLocaleString()}</p>
    </div>
  </div>
);

const SkeletonStat = () => (
  <div className="flex items-center gap-2 px-3 border-r border-[#6a8cbc]">
    <div className="w-6 h-6 rounded bg-[#3a6ea0] animate-pulse" />
    <div>
      <div className="h-2 w-16 bg-[#3a6ea0] rounded animate-pulse mb-1.5" />
      <div className="h-3 w-12 bg-[#3a6ea0] rounded animate-pulse" />
    </div>
  </div>
);

// TX type badge — classic raised pill style
const TX_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  IN:         { bg: '#e6f4ea', color: '#1e7e34', label: 'IN'   },
  OUT:        { bg: '#fde8e8', color: '#b91c1c', label: 'OUT'  },
  TRANSFER:   { bg: '#dbeafe', color: '#1d4ed8', label: 'TRF'  },
  ADJUSTMENT: { bg: '#fef3c7', color: '#92400e', label: 'ADJ'  },
};

// Raised Windows-style button
const WinButton: React.FC<{ onClick?: () => void; title?: string; children: React.ReactNode; disabled?: boolean }> = ({
  onClick, title, children, disabled
}) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    style={{
      fontFamily: 'Tahoma, Arial, sans-serif',
      fontSize: '11px',
      padding: '2px 8px',
      background: 'linear-gradient(to bottom, #f0f0f0 0%, #d8d8d8 100%)',
      border: '1px solid #888',
      borderTopColor: '#fff',
      borderLeftColor: '#fff',
      borderBottomColor: '#444',
      borderRightColor: '#444',
      cursor: disabled ? 'default' : 'pointer',
      color: '#000',
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      minWidth: '24px',
      justifyContent: 'center',
      userSelect: 'none',
    }}
    onMouseDown={e => {
      const el = e.currentTarget as HTMLButtonElement;
      el.style.borderTopColor = '#444';
      el.style.borderLeftColor = '#444';
      el.style.borderBottomColor = '#fff';
      el.style.borderRightColor = '#fff';
      el.style.background = 'linear-gradient(to bottom, #d0d0d0 0%, #e8e8e8 100%)';
    }}
    onMouseUp={e => {
      const el = e.currentTarget as HTMLButtonElement;
      el.style.borderTopColor = '#fff';
      el.style.borderLeftColor = '#fff';
      el.style.borderBottomColor = '#444';
      el.style.borderRightColor = '#444';
      el.style.background = 'linear-gradient(to bottom, #f0f0f0 0%, #d8d8d8 100%)';
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLButtonElement;
      el.style.borderTopColor = '#fff';
      el.style.borderLeftColor = '#fff';
      el.style.borderBottomColor = '#444';
      el.style.borderRightColor = '#444';
      el.style.background = 'linear-gradient(to bottom, #f0f0f0 0%, #d8d8d8 100%)';
    }}
  >
    {children}
  </button>
);

// Section panel header — dark navy gradient like Accurate 5
const PanelHeader: React.FC<{ icon?: React.ReactNode; title: string; badge?: React.ReactNode; right?: React.ReactNode }> = ({
  icon, title, badge, right
}) => (
  <div style={{
    background: 'linear-gradient(to bottom, #2b5797 0%, #1a3f7a 100%)',
    padding: '3px 8px',
    borderBottom: '1px solid #0f2a5a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    minHeight: '22px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      {icon}
      <span style={{ fontFamily: 'Tahoma, Arial, sans-serif', fontSize: '11px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
        {title}
      </span>
      {badge}
    </div>
    {right}
  </div>
);

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
  const [hint, setHint] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#f0f0f0',
      fontFamily: 'Tahoma, Arial, sans-serif',
      fontSize: '11px',
      color: '#000',
    }}>

      {/* ── TOOLBAR / TOP STATS BAR ── */}
      <div style={{
        background: 'linear-gradient(to bottom, #1e3f7a 0%, #153066 100%)',
        borderBottom: '2px solid #0a1f4a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        height: '40px',
        flexShrink: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
      }}>
        {/* Stats */}
        <div style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
          {isLoading ? (
            <><SkeletonStat /><SkeletonStat /><SkeletonStat /></>
          ) : (
            <>
              <StatMini label="Stok Tersedia"    value={data.summary.totalStock} icon={Package}        colorClass="text-[#7fb3f5]" />
              <StatMini label="Masuk (Periode)"  value={data.summary.totalIn}    icon={ArrowDownRight} colorClass="text-[#6fdfa3]" />
              <StatMini label="Keluar (Periode)" value={data.summary.totalOut}   icon={ArrowUpRight}   colorClass="text-[#f87171]" />
            </>
          )}
        </div>

        {/* Date range + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Date inputs — raised inset style */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: '#ffffff',
            border: '1px solid #888',
            borderTopColor: '#444',
            borderLeftColor: '#444',
            borderBottomColor: '#fff',
            borderRightColor: '#fff',
            padding: '1px 6px',
          }}>
            <Calendar size={11} style={{ color: '#555' }} />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{
                fontFamily: 'Consolas, monospace',
                fontSize: '10px',
                outline: 'none',
                border: 'none',
                background: 'transparent',
                color: '#000',
                width: '88px',
              }}
            />
            <span style={{ color: '#888' }}>–</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{
                fontFamily: 'Consolas, monospace',
                fontSize: '10px',
                outline: 'none',
                border: 'none',
                background: 'transparent',
                color: '#000',
                width: '88px',
              }}
            />
          </div>
          <WinButton onClick={loadData} title="Refresh Data">
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </WinButton>
        </div>
      </div>

      {/* ── HINT BAR ── */}
      <div style={{
        height: '18px',
        borderBottom: '1px solid #b0b8c8',
        background: '#e8ecf4',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '5px',
        flexShrink: 0,
        opacity: hint ? 1 : 0,
        transition: 'opacity 0.15s',
      }}>
        <MousePointerClick size={9} style={{ color: '#2b5797' }} />
        <span style={{ fontSize: '10px', color: '#2b5797', fontFamily: 'Tahoma, Arial, sans-serif' }}>
          {hint || '...'}
        </span>
      </div>

      {/* ── MAIN CONTENT GRID ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT: STOK MENIPIS ── */}
        <div style={{
          width: '240px',
          borderRight: '1px solid #a0a8b8',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          background: '#f5f5f5',
        }}>
          <PanelHeader
            icon={<AlertCircle size={11} style={{ color: '#ff9999' }} />}
            title="Stok Menipis"
            badge={
              data.lowStock.length > 0 && (
                <span style={{
                  background: '#cc0000',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '0 5px',
                  fontSize: '9px',
                  fontWeight: 700,
                  marginLeft: '4px',
                }}>
                  {data.lowStock.length}
                </span>
              )
            }
          />

          <div style={{ flex: 1, overflowY: 'auto' }} className="acc5-scrollbar">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ padding: '6px 8px', borderBottom: '1px solid #d8dce8' }}>
                  <div style={{ height: '10px', width: '80%', background: '#ddd', borderRadius: '2px', marginBottom: '4px' }} className="animate-pulse" />
                  <div style={{ height: '8px', width: '50%', background: '#e8e8e8', borderRadius: '2px' }} className="animate-pulse" />
                </div>
              ))
            ) : data.lowStock.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', gap: '6px' }}>
                <Package size={20} style={{ color: '#bbb' }} />
                <span style={{ fontSize: '10px', color: '#888' }}>Semua stok aman</span>
              </div>
            ) : (
              data.lowStock.map((it, idx) => (
                <div
                  key={it.id}
                  style={{
                    padding: '5px 8px',
                    borderBottom: '1px solid #d4d8e4',
                    background: idx % 2 === 0 ? '#ffffff' : '#eef2fb',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.background = '#c6d9f7';
                    setHint(`Double click untuk lihat kartu stok: ${it.name}`);
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = idx % 2 === 0 ? '#ffffff' : '#eef2fb';
                    setHint(null);
                  }}
                  onDoubleClick={() => onViewItem?.(it)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 700, fontSize: '11px', color: '#1a3a6e', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.name}
                    </span>
                    <span style={{ fontFamily: 'Consolas, monospace', fontSize: '9px', color: '#888' }}>{it.code}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase' }}>Status Stok</div>
                      <div style={{ fontFamily: 'Consolas, monospace', fontSize: '13px', fontWeight: 700, color: '#cc0000' }}>
                        {it.current.toLocaleString()} <span style={{ fontSize: '9px', color: '#888', fontFamily: 'Tahoma' }}>{it.baseUnit}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '9px', color: '#888', display: 'block' }}>Min.</span>
                      <span style={{ fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#555', fontWeight: 600 }}>{it.minStock}</span>
                    </div>
                  </div>
                  {/* progress bar */}
                  <div style={{ marginTop: '4px', height: '3px', background: '#d4d8e4', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      background: 'linear-gradient(to right, #cc0000, #ff4444)',
                      width: `${Math.min((it.current / it.minStock) * 100, 100)}%`,
                      transition: 'width 0.5s',
                    }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── CENTER: TRANSAKSI TERKINI ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <PanelHeader
            icon={<ClipboardList size={11} style={{ color: '#aad4ff' }} />}
            title="Transaksi Terkini"
            right={
              <span style={{ fontFamily: 'Consolas, monospace', fontSize: '10px', color: '#aad4ff' }}>
                {data.recentTx.length} transaksi
              </span>
            }
          />

          <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }} className="acc5-scrollbar">
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              {/* Blue spreadsheet header */}
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ height: '20px', background: 'linear-gradient(to bottom, #4472c4 0%, #2b5797 100%)' }}>
                  {[
                    { label: 'No. Ref',    w: '108px' },
                    { label: 'Tanggal',    w: '80px'  },
                    { label: 'Tipe',       w: '52px', center: true },
                    { label: 'Partner',    w: '130px' },
                    { label: 'Keterangan', w: undefined },
                    { label: 'Qty',        w: '40px', center: true },
                    { label: 'Gudang',     w: '100px' },
                  ].map(col => (
                    <th
                      key={col.label}
                      style={{
                        width: col.w,
                        padding: '0 6px',
                        fontFamily: 'Tahoma, Arial, sans-serif',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#ffffff',
                        textAlign: col.center ? 'center' : 'left',
                        borderRight: '1px solid #3a66b5',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        userSelect: 'none',
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} style={{ height: '20px', background: i % 2 === 0 ? '#fff' : '#eef2fb' }}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} style={{ padding: '0 6px', borderBottom: '1px solid #d8dce8', borderRight: '1px solid #e8edf8' }}>
                          <div style={{ height: '8px', background: '#e0e4f0', borderRadius: '2px' }} className="animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data.recentTx.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', fontSize: '11px', color: '#aaa' }}>
                      Tidak ada transaksi pada periode ini
                    </td>
                  </tr>
                ) : (
                  data.recentTx.map((tx, idx) => {
                    const badge = TX_BADGE[tx.type] || { bg: '#f0f0f0', color: '#555', label: tx.type };
                    const isHovered = hoveredRow === tx.id;
                    return (
                      <tr
                        key={tx.id}
                        style={{
                          height: '20px',
                          background: isHovered ? '#c6d9f7' : idx % 2 === 0 ? '#ffffff' : '#eef2fb',
                          cursor: 'default',
                          transition: 'background 0.05s',
                          userSelect: 'none',
                        }}
                        onMouseEnter={() => {
                          setHoveredRow(tx.id);
                          setHint(`Double click untuk edit transaksi: ${tx.referenceNo}`);
                        }}
                        onMouseLeave={() => {
                          setHoveredRow(null);
                          setHint(null);
                        }}
                        onDoubleClick={() => onEditTransaction?.(tx)}
                      >
                        {/* No. Ref */}
                        <td style={{
                          padding: '0 6px',
                          fontFamily: 'Consolas, "Courier New", monospace',
                          fontSize: '11px',
                          color: '#1a3a9e',
                          fontWeight: 700,
                          borderBottom: '1px solid #d8dce8',
                          borderRight: '1px solid #e0e4f0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {tx.referenceNo}
                        </td>

                        {/* Tanggal */}
                        <td style={{
                          padding: '0 6px',
                          fontFamily: 'Consolas, monospace',
                          fontSize: '11px',
                          color: '#333',
                          borderBottom: '1px solid #d8dce8',
                          borderRight: '1px solid #e0e4f0',
                          whiteSpace: 'nowrap',
                        }}>
                          {tx.date}
                        </td>

                        {/* Tipe badge */}
                        <td style={{
                          padding: '0 4px',
                          textAlign: 'center',
                          borderBottom: '1px solid #d8dce8',
                          borderRight: '1px solid #e0e4f0',
                        }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0 4px',
                            background: badge.bg,
                            color: badge.color,
                            fontFamily: 'Tahoma, Arial',
                            fontSize: '9px',
                            fontWeight: 700,
                            border: `1px solid ${badge.color}33`,
                            borderRadius: '2px',
                            letterSpacing: '0.05em',
                          }}>
                            {badge.label}
                          </span>
                        </td>

                        {/* Partner */}
                        <td style={{
                          padding: '0 6px',
                          fontSize: '11px',
                          fontWeight: tx.partnerName ? 600 : 400,
                          color: tx.partnerName ? '#1a1a1a' : '#bbb',
                          fontStyle: tx.partnerName ? 'normal' : 'italic',
                          borderBottom: '1px solid #d8dce8',
                          borderRight: '1px solid #e0e4f0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {tx.partnerName || '—'}
                        </td>

                        {/* Keterangan */}
                        <td style={{
                          padding: '0 6px',
                          fontSize: '11px',
                          color: '#444',
                          borderBottom: '1px solid #d8dce8',
                          borderRight: '1px solid #e0e4f0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {tx.notes || (tx.items.length > 0 ? tx.items[0].name : '—')}
                        </td>

                        {/* Qty */}
                        <td style={{
                          padding: '0 6px',
                          textAlign: 'center',
                          fontFamily: 'Consolas, monospace',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#555',
                          borderBottom: '1px solid #d8dce8',
                          borderRight: '1px solid #e0e4f0',
                        }}>
                          {tx.items.length}
                        </td>

                        {/* Gudang */}
                        <td style={{
                          padding: '0 6px',
                          fontSize: '11px',
                          color: '#555',
                          borderBottom: '1px solid #d8dce8',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textTransform: 'uppercase',
                        }}>
                          {warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── RIGHT: WIDGETS ── */}
        <div style={{
          width: '220px',
          borderLeft: '1px solid #a0a8b8',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          background: '#f5f5f5',
          overflowY: 'auto',
        }} className="acc5-scrollbar">

          {/* TOP 5 SERING KELUAR */}
          <div style={{ flexShrink: 0 }}>
            <PanelHeader
              icon={<Flame size={11} style={{ color: '#ffaa44' }} />}
              title="Top 5 Sering Keluar"
            />
            <div style={{ padding: '6px' }}>
              <p style={{ fontSize: '9px', color: '#888', marginBottom: '6px', fontStyle: 'italic' }}>
                Frekuensi transaksi OUT per item
              </p>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{ height: '9px', width: '70%', background: '#ddd', borderRadius: '2px', marginBottom: '3px' }} className="animate-pulse" />
                    <div style={{ height: '4px', width: '100%', background: '#e8e8e8', borderRadius: '2px' }} className="animate-pulse" />
                  </div>
                ))
              ) : data.top5Out.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '16px 0', fontSize: '10px', color: '#aaa', fontStyle: 'italic' }}>
                  Tidak ada data OUT
                </p>
              ) : (
                data.top5Out.map((item, idx) => {
                  const barColors = ['#e05c00', '#f07020', '#e8a030', '#d4b840', '#c8cc50'];
                  const medals = ['🥇', '🥈', '🥉'];
                  const masterItem = items.find(i => i.id === item.itemId);
                  return (
                    <div
                      key={item.code || idx}
                      style={{
                        marginBottom: '6px',
                        padding: '3px 4px',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        border: '1px solid transparent',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.background = '#dce8fa';
                        (e.currentTarget as HTMLDivElement).style.borderColor = '#7faad8';
                        setHint(`Double click untuk lihat kartu stok: ${item.name}`);
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
                        setHint(null);
                      }}
                      onDoubleClick={() => masterItem && onViewItem?.(masterItem)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                          <span style={{ fontSize: '11px', flexShrink: 0, width: '14px', textAlign: 'center' }}>
                            {idx < 3
                              ? medals[idx]
                              : <span style={{ fontSize: '9px', fontWeight: 700, color: '#888' }}>{idx + 1}</span>
                            }
                          </span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#1a3a6e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'Consolas, monospace', fontSize: '10px', fontWeight: 700, color: '#c05000', flexShrink: 0, marginLeft: '4px' }}>
                          {item.count}×
                        </span>
                      </div>
                      {/* bar */}
                      <div style={{ height: '4px', background: '#d8dce8', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          background: barColors[idx],
                          width: `${Math.round((item.count / maxCount) * 100)}%`,
                          transition: 'width 0.7s',
                          borderRadius: '2px',
                        }} />
                      </div>
                      {item.code && (
                        <span style={{ fontFamily: 'Consolas, monospace', fontSize: '9px', color: '#aaa' }}>{item.code}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SYSTEM MONITOR */}
          <div style={{ flexShrink: 0, borderTop: '1px solid #c0c8d8' }}>
            <PanelHeader
              icon={<Activity size={11} style={{ color: '#66ee88' }} />}
              title="System Monitor"
            />
            <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>

              {/* DB Status — sunken inset panel */}
              <div style={{
                background: '#fff',
                border: '1px solid #b0b8c8',
                borderTopColor: '#888',
                borderLeftColor: '#888',
                padding: '5px 7px',
              }}>
                <p style={{ fontSize: '9px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
                  Sinkronisasi Database
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22cc55', display: 'inline-block', flexShrink: 0 }} className="animate-pulse" />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a' }}>Terhubung ke MySQL</span>
                </div>
                <p style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>Latency: 24ms • Realtime Active</p>
              </div>

              {/* Gudang Aktif */}
              <div style={{
                background: '#fff',
                border: '1px solid #b0b8c8',
                borderTopColor: '#888',
                borderLeftColor: '#888',
                padding: '5px 7px',
              }}>
                <p style={{ fontSize: '9px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
                  Gudang Aktif
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {warehouses.filter(wh => wh.isActive).slice(0, 3).map(wh => (
                    <div key={wh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={9} style={{ color: '#888', flexShrink: 0 }} />
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                          {wh.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: '#22aa44', textTransform: 'uppercase' }}>Online</span>
                    </div>
                  ))}
                  {warehouses.filter(wh => wh.isActive).length === 0 && (
                    <p style={{ fontSize: '10px', color: '#aaa', fontStyle: 'italic' }}>Tidak ada gudang aktif</p>
                  )}
                </div>
              </div>

              {/* Ringkasan Periode */}
              <div style={{
                background: '#fff',
                border: '1px solid #b0b8c8',
                borderTopColor: '#888',
                borderLeftColor: '#888',
                padding: '5px 7px',
              }}>
                <p style={{ fontSize: '9px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <TrendingUp size={9} /> Ringkasan Periode
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      { label: 'Total Transaksi', val: data.totalFilteredTx, color: '#1a1a1a' },
                      { label: 'Stok Menipis',    val: `${data.lowStock.length} item`, color: data.lowStock.length > 0 ? '#cc0000' : '#22aa44' },
                      { label: 'Item Aktif',      val: items.filter(i => i.isActive).length, color: '#1a1a1a' },
                    ].map(row => (
                      <tr key={row.label} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '2px 0', fontSize: '10px', color: '#666' }}>{row.label}</td>
                        <td style={{ padding: '2px 0', textAlign: 'right', fontFamily: 'Consolas, monospace', fontSize: '10px', fontWeight: 700, color: row.color as string }}>
                          {row.val}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── STATUS BAR (Accurate 5 style — bottom gray bar) ── */}
      <div style={{
        height: '20px',
        flexShrink: 0,
        background: 'linear-gradient(to bottom, #d8d8d8 0%, #c8c8c8 100%)',
        borderTop: '1px solid #a0a0a0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '0',
      }}>
        {[
          { label: `Periode: ${startDate} s/d ${endDate}` },
          { label: `${data.totalFilteredTx} transaksi` },
          { label: `${data.lowStock.length} stok menipis` },
          { label: isLoading ? 'Memuat data...' : 'Siap' },
        ].map((seg, idx, arr) => (
          <div
            key={idx}
            style={{
              paddingRight: '12px',
              marginRight: '8px',
              borderRight: idx < arr.length - 1 ? '1px solid #a0a0a0' : 'none',
              fontSize: '10px',
              fontFamily: 'Tahoma, Arial, sans-serif',
              color: '#333',
              whiteSpace: 'nowrap',
            }}
          >
            {seg.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        {/* Size grip */}
        <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            {[[7,1],[5,3],[3,5],[1,7],[7,4],[5,6],[3,8],[7,7]].map(([x,y],i) =>
              i % 4 < 3
                ? <rect key={i} x={x} y={y} width="2" height="2" fill="#aaa" />
                : null
            )}
          </svg>
        </div>
      </div>

      <style>{`
        .acc5-scrollbar::-webkit-scrollbar { width: 14px; }
        .acc5-scrollbar::-webkit-scrollbar-track {
          background: #f0f0f0;
          border-left: 1px solid #c0c0c0;
        }
        .acc5-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to right, #e0e0e0, #d0d0d0);
          border: 1px solid #a0a0a0;
          border-top-color: #e8e8e8;
          border-left-color: #e8e8e8;
          min-height: 20px;
        }
        .acc5-scrollbar::-webkit-scrollbar-button {
          background: linear-gradient(to bottom, #f0f0f0, #d8d8d8);
          border: 1px solid #888;
          border-top-color: #fff;
          border-left-color: #fff;
          display: block;
          height: 14px;
        }
      `}</style>
    </div>
  );
};
