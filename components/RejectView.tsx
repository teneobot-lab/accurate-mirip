import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { StorageService } from '../services/storage';
import { Item, RejectBatch, RejectItem, Stock } from '../types';
import {
  Trash2, Plus, CornerDownLeft, Loader2, History, MapPin, Search,
  X, Eye, Save, Database, Edit3, Copy, FileSpreadsheet,
  ChevronRight, Filter, AlertCircle, PackageX
} from 'lucide-react';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import ExcelJS from 'exceljs';
import { Decimal } from 'decimal.js';
import { highlightMatch } from '../search/highlightMatch';

// FIX: ModalPortal — render modal langsung ke document.body
const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return createPortal(children, document.body);
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

interface RejectItemExtended extends RejectItem {
  inputQty: number;
  inputUnit: string;
  lineId: string;
}

interface OutletManagerProps {
  outlets: string[];
  onAdd: (name: string) => void;
  onDelete: (name: string) => void;
  outletToDelete: string | null;
  setOutletToDelete: (v: string | null) => void;
  onConfirmDelete: () => void;
}

/* ─── Accurate-5 style map ──────────────────────────────────────────────────── */
const a: Record<string, React.CSSProperties> = {
  /* layout */
  shell:          { display:'flex', flexDirection:'column', height:'100%', fontFamily:"'Tahoma','Segoe UI',sans-serif", fontSize:12, background:'white', overflow:'hidden' },
  /* toolbar */
  toolbar:        { height:34, borderBottom:'1px solid #b0b0b0', background:'linear-gradient(180deg,#f5f5f5 0%,#e2e2e2 100%)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  tabList:        { display:'flex', alignItems:'flex-end', height:'100%', paddingLeft:6 },
  tab:            { display:'flex', alignItems:'center', gap:5, padding:'0 14px', height:'100%', fontSize:11, fontFamily:"'Tahoma',sans-serif", cursor:'pointer', border:'none', borderRight:'1px solid #c8c8c8', background:'#d5dde8', color:'#3a4a5a', fontWeight:600 },
  tabActive:      { background:'white', color:'#1e3a6e', fontWeight:700, borderBottom:'2px solid white', marginBottom:-1 },
  toolbarRight:   { display:'flex', alignItems:'center', gap:6, paddingRight:8, height:'100%' },
  tbSelect:       { display:'flex', alignItems:'center', gap:5, padding:'2px 8px', background:'#eaf0f8', border:'1px solid #a8b8cc', borderRadius:2, fontSize:10 },
  tbSelectEl:     { border:'none', background:'transparent', fontSize:11, fontFamily:"'Tahoma',sans-serif", fontWeight:700, color:'#1e3a6e', outline:'none', cursor:'pointer' },
  tbInput:        { border:'1px solid #a8b8cc', borderRadius:2, padding:'2px 6px', fontSize:11, fontFamily:"'Tahoma',sans-serif", fontWeight:700, color:'#333', background:'white', outline:'none' },
  tbBtn:          { display:'flex', alignItems:'center', gap:5, padding:'3px 10px', fontSize:11, fontFamily:"'Tahoma',sans-serif", cursor:'pointer', border:'1px solid transparent', borderRadius:2, background:'transparent', color:'#1a1a1a', fontWeight:600 },
  tbBtnPrimary:   { background:'linear-gradient(180deg,#4a8de8 0%,#2a68cc 100%)', borderColor:'#1a56aa', color:'white' },
  tbBtnDanger:    { background:'linear-gradient(180deg,#f8f8f8 0%,#e8e8e8 100%)', borderColor:'#c09090', color:'#cc2200' },
  tbBtnGreen:     { background:'linear-gradient(180deg,#4ab870 0%,#2a9850 100%)', borderColor:'#1a7840', color:'white' },
  /* sub-toolbar */
  subToolbar:     { height:32, padding:'0 8px', borderBottom:'1px solid #c8d0d8', background:'linear-gradient(180deg,#eef3f8 0%,#e2eaf2 100%)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  searchWrap:     { display:'flex', alignItems:'center', gap:4, background:'white', border:'1px solid #9aa8b4', borderRadius:2, padding:'2px 6px' },
  searchInput:    { border:'none', outline:'none', fontSize:11, fontFamily:"'Tahoma',sans-serif", width:160, color:'#333' },
  /* content */
  content:        { flex:1, overflow:'hidden', position:'relative' as const },
  /* table */
  tableWrap:      { flex:1, overflow:'auto' },
  table:          { width:'100%', borderCollapse:'collapse' as const, tableLayout:'fixed' as const },
  th:             { background:'linear-gradient(180deg,#dce8f8 0%,#c6d8ed 100%)', border:'1px solid #a8b8cc', padding:'4px 8px', fontSize:10, fontWeight:700, color:'#1a3060', position:'sticky' as const, top:0, zIndex:2, whiteSpace:'nowrap' as const, textAlign:'left' as const },
  thCenter:       { textAlign:'center' as const },
  thRight:        { textAlign:'right' as const },
  tdBase:         { border:'1px solid #d8e0e8', padding:'3px 8px', fontSize:11, color:'#1a1a1a', whiteSpace:'nowrap' as const, overflow:'hidden' as const, textOverflow:'ellipsis' as const },
  tdCenter:       { textAlign:'center' as const },
  tdRight:        { textAlign:'right' as const },
  tdMono:         { fontFamily:"'Courier New',monospace", fontSize:10 },
  trOdd:          { background:'white' },
  trEven:         { background:'#f0f5fb' },
  /* entry row */
  entryRow:       { background:'#f0fff4', borderTop:'2px solid #88cc88' },
  entryInput:     { width:'100%', height:'100%', background:'transparent', border:'none', outline:'none', padding:'0 8px', fontSize:11, fontFamily:"'Tahoma',sans-serif", fontWeight:600, color:'#1a5a1a' },
  /* badges */
  badgeAktif:     { display:'inline-block', padding:'1px 6px', borderRadius:2, fontSize:9, fontWeight:700, background:'#e0f5e0', color:'#1a6a1a', border:'1px solid #88cc88' },
  badgeNonaktif:  { display:'inline-block', padding:'1px 6px', borderRadius:2, fontSize:9, fontWeight:700, background:'#f5f5f5', color:'#888', border:'1px solid #ccc' },
  badgeOutlet:    { display:'inline-block', padding:'1px 6px', borderRadius:2, fontSize:10, fontWeight:700, background:'#e8f0f8', color:'#1a3a6a', border:'1px solid #b8c8d8' },
  actionBtn:      { padding:'1px 6px', fontSize:10, cursor:'pointer', border:'1px solid #a0b4c4', borderRadius:2, background:'linear-gradient(180deg,#f8fbff 0%,#e6f0f8 100%)', color:'#1a4080', fontFamily:"'Tahoma',sans-serif", display:'inline-flex', alignItems:'center', gap:3, marginRight:2 },
  actionBtnAmber: { color:'#a05000', borderColor:'#c8a060', background:'linear-gradient(180deg,#fffbf0 0%,#f8ecd8 100%)' },
  actionBtnRed:   { color:'#cc2200', borderColor:'#c09090', background:'linear-gradient(180deg,#fff8f8 0%,#f0e8e8 100%)' },
  actionBtnGreen: { color:'#1a6a1a', borderColor:'#88cc88', background:'linear-gradient(180deg,#f0fff0 0%,#e0f0e0 100%)' },
  /* loading */
  loading:        { height:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8, color:'#888', fontSize:11 },
  /* empty */
  empty:          { padding:'48px 0', textAlign:'center' as const, color:'#bbb', display:'flex', flexDirection:'column', alignItems:'center', gap:8 },
  /* dropdown */
  dropdown:       { position:'fixed' as const, background:'white', border:'1px solid #b8c8d8', boxShadow:'0 4px 16px rgba(0,0,0,0.15)', borderRadius:3, zIndex:999, overflow:'hidden' },
  dropItem:       { padding:'5px 10px', cursor:'pointer', fontSize:11, display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #f0f0f0' },
  dropItemActive: { background:'#2a68cc', color:'white' },
  /* status bar */
  statusBar:      { display:'flex', alignItems:'center', gap:10, padding:'2px 10px', background:'linear-gradient(180deg,#e5e5e5 0%,#d5d5d5 100%)', borderTop:'1px solid #b0b0b0', height:20, flexShrink:0, fontSize:10, color:'#555' },
  statusPanel:    { border:'1px solid #b8b8b8', padding:'0 8px', background:'white', borderRadius:1, lineHeight:'16px' },
  /* outlet manager */
  outletWrap:     { padding:16, maxWidth:480, margin:'0 auto', height:'100%', overflow:'auto' },
  outletCard:     { background:'white', border:'1px solid #b8c8d8', borderRadius:3, overflow:'hidden' },
  outletCardHdr:  { padding:'6px 12px', background:'linear-gradient(180deg,#dce8f8 0%,#c6d8ed 100%)', borderBottom:'1px solid #a8b8cc', display:'flex', alignItems:'center', gap:8, fontSize:11, fontWeight:700, color:'#1a3060' },
  outletCardBody: { padding:12, display:'flex', flexDirection:'column', gap:8 },
  outletAddRow:   { display:'flex', gap:6 },
  outletInput:    { flex:1, border:'1px solid #a8b8cc', borderRadius:2, padding:'4px 8px', fontSize:11, fontFamily:"'Tahoma',sans-serif", outline:'none' },
  outletRow:      { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom:'1px solid #e8eef4', fontSize:11, fontWeight:600, color:'#333' },
  /* modal */
  overlay:        { position:'fixed' as const, inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 },
  modalWin:       { background:'#f0f0f0', border:'2px solid #1e3a6e', borderRadius:4, width:540, boxShadow:'4px 4px 20px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column', maxHeight:'calc(100vh - 80px)' },
  modalWinSm:     { background:'white', border:'2px solid #1e3a6e', borderRadius:4, width:640, boxShadow:'4px 4px 20px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column', maxHeight:'80vh' },
  modalTitle:     { background:'linear-gradient(180deg,#2a52a0 0%,#1e3a6e 100%)', color:'white', padding:'6px 12px', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:'2px 2px 0 0', flexShrink:0 },
  modalClose:     { width:18, height:18, borderRadius:2, background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.4)', color:'white', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' },
  modalBody:      { padding:'12px 14px', display:'flex', flexDirection:'column', gap:10, overflowY:'auto' as const, flex:1 },
  modalFooter:    { padding:'8px 14px', borderTop:'1px solid #c0c0c0', display:'flex', justifyContent:'flex-end', gap:6, background:'#e8e8e8', flexShrink:0 },
  modalBtnOk:     { padding:'4px 18px', fontSize:11, fontWeight:700, borderRadius:3, cursor:'pointer', fontFamily:"'Tahoma',sans-serif", border:'1px solid #1a56aa', background:'linear-gradient(180deg,#4a8de8 0%,#2a68cc 100%)', color:'white', display:'flex', alignItems:'center', gap:5 },
  modalBtnCancel: { padding:'4px 14px', fontSize:11, fontWeight:700, borderRadius:3, cursor:'pointer', fontFamily:"'Tahoma',sans-serif", border:'1px solid #a0a0a0', background:'linear-gradient(180deg,#f8f8f8 0%,#e0e0e0 100%)', color:'#333' },
  fieldGroup:     { display:'flex', flexDirection:'column', gap:3 },
  fieldLabel:     { fontSize:10, fontWeight:700, color:'#5a6a7a', textTransform:'uppercase' as const, letterSpacing:'0.06em' },
  fieldInput:     { border:'1px solid #8090a0', borderRadius:2, padding:'4px 6px', fontSize:11, fontFamily:"'Tahoma',sans-serif", color:'#1a1a1a', background:'white', outline:'none', width:'100%' },
  gridCols3:      { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 },
  convRow:        { display:'flex', gap:6, alignItems:'center', background:'#f0f5fb', padding:'6px 8px', border:'1px solid #d0dcea', borderRadius:2 },
};

/* ─── OutletManager ─────────────────────────────────────────────────────────── */
const OutletManager: React.FC<OutletManagerProps> = ({
  outlets, onAdd, onDelete, outletToDelete, setOutletToDelete, onConfirmDelete,
}) => {
  const [newOutletName, setNewOutletName] = useState('');
  const handleAdd = () => {
    const trimmed = newOutletName.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewOutletName('');
  };

  return (
    <div style={a.outletWrap}>
      <div style={a.outletCard}>
        <div style={a.outletCardHdr}>
          <MapPin size={14} color="#5a7090" />
          MASTER OUTLET
        </div>
        <div style={a.outletCardBody}>
          <div style={a.outletAddRow}>
            <input
              type="text"
              placeholder="Nama outlet baru..."
              value={newOutletName}
              onChange={e => setNewOutletName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              style={a.outletInput}
            />
            <button onClick={handleAdd} style={{ ...a.tbBtn, ...a.tbBtnPrimary }}>
              TAMBAH
            </button>
          </div>
          <div style={{ borderTop:'1px solid #e0e8f0', paddingTop:4 }}>
            {outlets.length === 0 && (
              <p style={{ textAlign:'center', color:'#bbb', fontSize:10, padding:'12px 0', fontStyle:'italic' }}>Belum ada outlet</p>
            )}
            {outlets.map(o => (
              <div key={o} style={a.outletRow}>
                <span style={{ textTransform:'uppercase', fontSize:11 }}>{o}</span>
                <button
                  onClick={() => onDelete(o)}
                  style={{ ...a.actionBtn, ...a.actionBtnRed }}
                >
                  <Trash2 size={11} /> Hapus
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={!!outletToDelete}
        title="Hapus Outlet"
        message={`Hapus outlet "${outletToDelete}"? Riwayat reject outlet ini tidak akan terhapus.`}
        onConfirm={onConfirmDelete}
        onCancel={() => setOutletToDelete(null)}
      />
    </div>
  );
};

/* ─── RejectView ────────────────────────────────────────────────────────────── */
export const RejectView: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY' | 'MASTER_ITEMS' | 'MASTER'>('NEW');
  const [rejectMasterItems, setRejectMasterItems] = useState<Item[]>([]);
  const [outlets, setOutlets] = useState<string[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState<Partial<Item>>({ code: '', name: '', baseUnit: 'Pcs', conversions: [] });
  const [masterSearch, setMasterSearch] = useState('');
  const debouncedMasterSearch = useDebounce(masterSearch, 300);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [inputOutlet, setInputOutlet] = useState('');
  const [filterOutlet, setFilterOutlet] = useState('ALL');

  const [rejectLines, setRejectLines] = useState<RejectItemExtended[]>([]);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingUnit, setPendingUnit] = useState('');
  const [pendingQty, setPendingQty] = useState<string>('');
  const [pendingReason, setPendingReason] = useState('');

  const itemInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const reasonInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [batches, setBatches] = useState<RejectBatch[]>([]);
  const [viewingBatch, setViewingBatch] = useState<RejectBatch | null>(null);
  const [historySearch, setHistorySearch] = useState('');

  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [masterItemToDelete, setMasterItemToDelete] = useState<string | null>(null);
  const [outletToDelete, setOutletToDelete] = useState<string | null>(null);
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false);

  const [exportStart, setExportStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [exportEnd, setExportEnd] = useState(new Date().toISOString().split('T')[0]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rmits, ols, bts, stks] = await Promise.all([
        StorageService.fetchRejectMasterItems(),
        StorageService.fetchRejectOutlets(),
        StorageService.fetchRejectBatches(),
        StorageService.fetchStocks(),
      ]);
      setRejectMasterItems(rmits);
      setOutlets(ols);
      setBatches(bts);
      setStocks(stks);
      setInputOutlet(prev => (ols.length > 0 && !prev) ? ols[0] : prev);
    } catch (e) {
      showToast('Gagal memuat data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        itemInputRef.current && !itemInputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  useEffect(() => {
    if (!isDropdownOpen || !itemInputRef.current) return;
    const updatePos = () => {
      const rect = itemInputRef.current!.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 320) });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [isDropdownOpen]);

  const conversionResult = useMemo(() => {
    if (!pendingItem || !pendingQty || isNaN(Number(pendingQty))) return null;
    try {
      const qty = new Decimal(pendingQty);
      if (qty.lte(0)) return null;
      let ratio = new Decimal(1);
      if (pendingUnit !== pendingItem.baseUnit) {
        const conv = pendingItem.conversions?.find(c => c.name === pendingUnit);
        if (conv) {
          const convRatio = new Decimal(conv.ratio);
          ratio = conv.operator === '/' ? new Decimal(1).dividedBy(convRatio) : convRatio;
        } else {
          return { error: 'Unit Invalid' };
        }
      }
      const baseQty = qty.times(ratio).toNumber();
      return { baseQty, unit: pendingItem.baseUnit };
    } catch { return { error: 'Error' }; }
  }, [pendingItem, pendingQty, pendingUnit]);

  const filteredItems = useMemo(() => {
    if (!query || pendingItem) return [];
    const lower = query.toLowerCase();
    return rejectMasterItems.filter(it =>
      (it.isActive !== false) &&
      (it.code.toLowerCase().includes(lower) || it.name.toLowerCase().includes(lower))
    ).slice(0, 10);
  }, [query, rejectMasterItems, pendingItem]);

  const filteredMasterItems = useMemo(() => {
    if (!debouncedMasterSearch) return rejectMasterItems;
    const lower = debouncedMasterSearch.toLowerCase();
    return rejectMasterItems.filter(it =>
      it.code.toLowerCase().includes(lower) || it.name.toLowerCase().includes(lower)
    );
  }, [debouncedMasterSearch, rejectMasterItems]);

  const filteredBatches = useMemo(() => {
    const lower = historySearch.toLowerCase().trim();
    return batches.filter(b => {
      const matchOutlet = filterOutlet === 'ALL' || b.outlet === filterOutlet;
      const matchDate = b.date >= exportStart && b.date <= exportEnd;
      const matchSearch = !lower ||
        b.id.toLowerCase().includes(lower) ||
        b.outlet.toLowerCase().includes(lower) ||
        b.items.some(it => it.name.toLowerCase().includes(lower));
      return matchOutlet && matchDate && matchSearch;
    });
  }, [batches, filterOutlet, exportStart, exportEnd, historySearch]);

  const selectItem = (item: Item) => {
    setPendingItem(item);
    setQuery(item.name);
    const savedUnit = localStorage.getItem(`reject_unit_pref_${item.id}`);
    setPendingUnit(savedUnit || item.baseUnit);
    setIsDropdownOpen(false);
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const handleAddLine = () => {
    if (!pendingItem || !conversionResult || 'error' in conversionResult) return;
    if (conversionResult.baseQty <= 0) return showToast('Qty harus > 0', 'warning');
    const newLine: RejectItemExtended = {
      lineId: `line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      itemId: pendingItem.id,
      sku: pendingItem.code,
      name: pendingItem.name,
      qty: conversionResult.baseQty,
      unit: pendingItem.baseUnit,
      baseQty: conversionResult.baseQty,
      inputQty: Number(pendingQty),
      inputUnit: pendingUnit,
      reason: pendingReason || '',
    };
    localStorage.setItem(`reject_unit_pref_${pendingItem.id}`, pendingUnit);
    setRejectLines(prev => [...prev, newLine]);
    setQuery(''); setPendingItem(null); setPendingQty(''); setPendingReason(''); setPendingUnit('');
    setTimeout(() => itemInputRef.current?.focus(), 50);
  };

  const handleSaveBatch = async () => {
    if (!inputOutlet) return showToast('Pilih outlet', 'warning');
    if (rejectLines.length === 0) return showToast('Item kosong', 'warning');
    try {
      await StorageService.saveRejectBatch({
        id: editingBatchId || `REJ-${Date.now().toString().slice(-6)}`,
        date, outlet: inputOutlet, createdAt: Date.now(), items: rejectLines,
      });
      showToast(editingBatchId ? 'Data Reject Diperbarui' : 'Data Reject Tersimpan', 'success');
      setRejectLines([]);
      setEditingBatchId(null);
      loadData();
      setActiveTab('HISTORY');
    } catch { showToast('Gagal simpan', 'error'); }
  };

  const handleEditBatch = (batch: RejectBatch) => {
    setEditingBatchId(batch.id);
    setDate(batch.date);
    setInputOutlet(batch.outlet);
    setRejectLines((batch.items as RejectItemExtended[]).map((it, i) => ({
      ...it,
      lineId: it.lineId || `legacy_${i}_${it.itemId}`,
      inputQty: it.inputQty ?? it.qty,
      inputUnit: it.inputUnit ?? it.unit,
    })));
    setActiveTab('NEW');
  };

  const handleSaveMasterItem = async () => {
    if (!itemForm.code || !itemForm.name || !itemForm.baseUnit)
      return showToast('Kode, Nama, dan Satuan Dasar wajib diisi', 'warning');
    const isDuplicate = rejectMasterItems.some(it =>
      it.code.toLowerCase() === itemForm.code!.toLowerCase() && it.id !== editingItem?.id
    );
    if (isDuplicate) return showToast(`SKU "${itemForm.code}" sudah ada`, 'warning');
    try {
      const payload = { ...itemForm, id: editingItem?.id || undefined } as Item;
      await StorageService.saveRejectMasterItem(payload);
      showToast(editingItem ? 'Data barang diperbarui' : 'Barang baru ditambahkan', 'success');
      setShowItemModal(false);
      loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menyimpan data', 'error');
    }
  };

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    try {
      await StorageService.deleteRejectBatch(batchToDelete);
      showToast('Riwayat reject dihapus', 'success');
      loadData();
    } catch { showToast('Gagal menghapus riwayat', 'error'); }
    finally { setBatchToDelete(null); }
  };

  const handleDeleteSelected = async () => {
    try {
      await Promise.all([...selectedBatches].map(id => StorageService.deleteRejectBatch(id)));
      showToast(`${selectedBatches.size} batch dihapus`, 'success');
      setSelectedBatches(new Set());
      loadData();
    } catch { showToast('Gagal menghapus batch', 'error'); }
    finally { setShowDeleteSelectedConfirm(false); }
  };

  const handleDeleteMasterItem = async () => {
    if (!masterItemToDelete) return;
    try {
      await StorageService.deleteRejectMasterItem(masterItemToDelete);
      showToast('Master item dihapus', 'success');
      loadData();
    } catch { showToast('Gagal menghapus master item', 'error'); }
    finally { setMasterItemToDelete(null); }
  };

  const handleDeleteOutlet = async () => {
    if (!outletToDelete) return;
    try {
      await StorageService.deleteRejectOutlet(outletToDelete);
      showToast('Outlet dihapus', 'success');
      if (inputOutlet === outletToDelete) setInputOutlet('');
      if (filterOutlet === outletToDelete) setFilterOutlet('ALL');
      loadData();
    } catch { showToast('Gagal menghapus outlet', 'error'); }
    finally { setOutletToDelete(null); }
  };

  const handleCopyToClipboard = (batch: RejectBatch) => {
    if (!batch.items?.length) return;
    const d = new Date(batch.date);
    const formattedDate = `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getFullYear()).slice(-2)}`;
    let text = `Data Reject ${batch.outlet} ${formattedDate}\n`;
    batch.items.forEach(it => {
      const ext = it as RejectItemExtended;
      const displayQty  = ext.inputQty  != null ? ext.inputQty  : it.qty;
      const displayUnit = ext.inputUnit != null ? ext.inputUnit : it.unit;
      const reason = it.reason?.trim().toLowerCase() || '';
      text += `- ${it.name.toLowerCase()} ${displayQty} ${displayUnit.toLowerCase()}${reason ? ` ${reason}` : ''}\n`;
    });
    navigator.clipboard.writeText(text.trim())
      .then(() => showToast('Disalin ke clipboard', 'success'))
      .catch(() => showToast('Gagal menyalin', 'error'));
  };

  const handleExportMatrix = async () => {
    if (filteredBatches.length === 0) return showToast('Tidak ada data untuk periode ini', 'warning');
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Matrix Reject');
      const dateList: string[] = [];
      let curr = new Date(exportStart);
      const end = new Date(exportEnd);
      while (curr <= end) {
        dateList.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }
      const itemMap = new Map<string, any>();
      filteredBatches.forEach(batch => {
        batch.items.forEach(it => {
          const masterItem = rejectMasterItems.find(mi => mi.id === it.itemId);
          if (masterItem && masterItem.isActive === false) return;
          if (!itemMap.has(it.itemId))
            itemMap.set(it.itemId, { code: it.sku, name: it.name, unit: it.unit, dateValues: new Map() });
          const data = itemMap.get(it.itemId)!;
          const currentVal = data.dateValues.get(batch.date) || new Decimal(0);
          data.dateValues.set(batch.date, currentVal.plus(new Decimal(it.baseQty ?? it.qty)));
        });
      });
      const titleRow = sheet.addRow(['LAPORAN REJECT MINGGUAN']);
      titleRow.font = { bold: true, size: 12, name: 'Calibri' };
      titleRow.alignment = { horizontal: 'center' };
      sheet.mergeCells(1, 1, 1, 5 + dateList.length);
      const headers = ['NO','KODE','NAMA BARANG','SATUAN',
        ...dateList.map(d => { const dt = d.split('-'); return `${dt[2]}/${dt[1]}`; }), 'TOTAL'];
      const headerRow = sheet.addRow(headers);
      sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } };
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };
        cell.font = { bold: true, size: 10, name: 'Calibri' };
        cell.border = { bottom: { style: 'medium' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      let rowCounter = 1;
      const itemsArray = Array.from(itemMap.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
      itemsArray.forEach((item, index) => {
        const rowData: any[] = [rowCounter++, item.code, item.name, item.unit];
        let total = new Decimal(0);
        dateList.forEach(d => {
          const qty = item.dateValues.get(d) || new Decimal(0);
          rowData.push(qty.equals(0) ? null : qty.toNumber());
          total = total.plus(qty);
        });
        rowData.push(total.toNumber() || null);
        const row = sheet.addRow(rowData);
        const isLastRow = index === itemsArray.length - 1;
        row.eachCell((cell, colNumber) => {
          if (isLastRow) cell.border = { bottom: { style: 'medium' } };
          cell.font = { name: 'Calibri', size: 10 };
          if (colNumber === 1) cell.alignment = { horizontal: 'center' };
          if (colNumber > 4) {
            cell.alignment = { horizontal: 'right' };
            cell.numFmt = '#,##0.0';
            if (colNumber === rowData.length) {
              cell.font = { bold: true, name: 'Calibri', size: 10 };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
            }
          }
        });
      });
      sheet.columns.forEach((col, idx) => {
        col.width = idx === 0 ? 5 : idx === 1 ? 15 : idx === 2 ? 35 : idx === 3 ? 10 : 8;
      });
      const monthNames = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'];
      const formatD = (dStr: string) => { const d = new Date(dStr); return `${String(d.getDate()).padStart(2,'0')} ${monthNames[d.getMonth()]}`; };
      const startF = formatD(exportStart), endF = formatD(exportEnd), yearF = new Date(exportEnd).getFullYear();
      let outletName = 'SEMUA OUTLET';
      if (filterOutlet && filterOutlet !== 'ALL') outletName = filterOutlet.toUpperCase();
      const fileName = `Laporan Reject Mingguan ${outletName} ${startF} - ${endF} ${yearF}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = fileName; link.click();
      window.URL.revokeObjectURL(url);
      showToast('Laporan Berhasil Diekspor', 'success');
    } catch (e) {
      console.error(e);
      showToast('Gagal Export', 'error');
    }
  };

  /* ── TABS CONFIG ── */
  const tabs = [
    { id: 'NEW',          label: 'Input Reject', icon: Plus },
    { id: 'HISTORY',      label: 'Riwayat',      icon: History },
    { id: 'MASTER_ITEMS', label: 'Katalog Barang',icon: Database },
    { id: 'MASTER',       label: 'Master Outlet', icon: MapPin },
  ] as const;

  return (
    <div style={a.shell}>

      {/* ── TOOLBAR + TABS ───────────────────────────────────────────────── */}
      <div style={a.toolbar}>
        <div style={a.tabList}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{ ...a.tab, ...(activeTab === tab.id ? a.tabActive : {}) }}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        <div style={a.toolbarRight}>
          {/* Filter outlet — HISTORY */}
          {activeTab === 'HISTORY' && (
            <div style={a.tbSelect}>
              <Filter size={10} color="#5a7090" />
              <select
                value={filterOutlet}
                onChange={e => setFilterOutlet(e.target.value)}
                style={a.tbSelectEl}
              >
                <option value="ALL">SEMUA OUTLET</option>
                {outlets.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
              </select>
            </div>
          )}

          {/* Outlet + Date + Save — NEW */}
          {activeTab === 'NEW' && (
            <>
              <div style={a.tbSelect}>
                <MapPin size={10} color="#5a7090" />
                <select
                  value={inputOutlet}
                  onChange={e => setInputOutlet(e.target.value)}
                  style={a.tbSelectEl}
                >
                  <option value="">— Pilih Outlet —</option>
                  {outlets.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                </select>
              </div>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={a.tbInput}
              />
              {editingBatchId && (
                <button
                  onClick={() => { setEditingBatchId(null); setRejectLines([]); }}
                  style={{ ...a.tbBtn, ...a.tbBtnDanger }}
                >
                  <X size={13} /> Batal Edit
                </button>
              )}
              <button onClick={handleSaveBatch} style={{ ...a.tbBtn, ...a.tbBtnPrimary }}>
                <Save size={13} /> {editingBatchId ? 'Update' : 'Simpan'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── CONTENT AREA ─────────────────────────────────────────────────── */}
      <div style={a.content}>
        {isLoading ? (
          <div style={a.loading}>
            <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} /> Memuat data...
          </div>

        ) : activeTab === 'NEW' ? (
          /* ── INPUT TAB ──────────────────────────────────────────────────── */
          <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
            <div style={a.tableWrap}>
              <table style={a.table}>
                <thead>
                  <tr style={{ height:28 }}>
                    <th style={{ ...a.th, ...a.thCenter, width:40 }}>#</th>
                    <th style={a.th}>Barang &amp; SKU</th>
                    <th style={{ ...a.th, ...a.thRight, width:110 }}>Qty Input</th>
                    <th style={{ ...a.th, ...a.thRight, width:90, background:'linear-gradient(180deg,#f8dce0 0%,#f0c8cc 100%)', color:'#8a1a20' }}>Qty Base</th>
                    <th style={{ ...a.th, ...a.thCenter, width:80 }}>Satuan</th>
                    <th style={a.th}>Catatan / Alasan</th>
                    <th style={{ ...a.th, width:36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rejectLines.map((line, idx) => (
                    <tr
                      key={line.lineId}
                      style={idx % 2 === 0 ? a.trOdd : a.trEven}
                      onMouseEnter={e => (e.currentTarget.style.background = '#cce0ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f0f5fb')}
                    >
                      <td style={{ ...a.tdBase, ...a.tdCenter, color:'#999', fontFamily:"'Courier New',monospace", fontSize:10 }}>{idx + 1}</td>
                      <td style={a.tdBase}>
                        <span style={{ fontWeight:600, color:'#1a1a1a', fontSize:11 }}>{line.name}</span>
                        <span style={{ marginLeft:8, fontSize:10, color:'#999', fontFamily:"'Courier New',monospace", fontStyle:'italic' }}>{line.sku}</span>
                      </td>
                      <td style={{ ...a.tdBase, ...a.tdRight, fontFamily:"'Courier New',monospace", fontSize:11, color:'#555' }}>
                        {line.inputQty} <span style={{ fontSize:9, textTransform:'uppercase' }}>{line.inputUnit}</span>
                      </td>
                      <td style={{ ...a.tdBase, ...a.tdRight, fontFamily:"'Courier New',monospace", fontWeight:700, color:'#cc2200', fontSize:11 }}>
                        {line.qty.toLocaleString()}
                      </td>
                      <td style={{ ...a.tdBase, ...a.tdCenter }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{line.unit}</span>
                      </td>
                      <td style={{ ...a.tdBase, color:'#666', fontStyle:'italic', fontSize:11 }}>{line.reason}</td>
                      <td style={{ ...a.tdBase, ...a.tdCenter, padding:0 }}>
                        <button
                          onClick={() => setRejectLines(prev => prev.filter(l => l.lineId !== line.lineId))}
                          style={{ width:'100%', height:'100%', background:'transparent', border:'none', cursor:'pointer', color:'#cc2200', display:'flex', alignItems:'center', justifyContent:'center', padding:4 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* ENTRY ROW */}
                  <tr style={{ ...a.entryRow, height:32 }}>
                    <td style={{ ...a.tdBase, ...a.tdCenter, padding:0 }}>
                      <Plus size={13} color="#2a9850" style={{ margin:'0 auto', display:'block' }} />
                    </td>
                    <td style={{ ...a.tdBase, padding:0, position:'relative' }}>
                      <input
                        ref={itemInputRef}
                        type="text"
                        placeholder="Cari barang..."
                        value={query}
                        onChange={e => { setQuery(e.target.value); if (pendingItem) setPendingItem(null); setIsDropdownOpen(true); setSelectedIndex(0); }}
                        onFocus={() => { if (query) setIsDropdownOpen(true); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && filteredItems[selectedIndex]) selectItem(filteredItems[selectedIndex]);
                          if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(p => Math.min(p + 1, filteredItems.length - 1)); }
                          if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(p => Math.max(p - 1, 0)); }
                          if (e.key === 'Escape') setIsDropdownOpen(false);
                        }}
                        style={a.entryInput}
                        autoComplete="off"
                      />
                      {isDropdownOpen && query && filteredItems.length > 0 && dropdownPos && (
                        <div
                          ref={dropdownRef}
                          style={{ ...a.dropdown, top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
                        >
                          {filteredItems.map((it, idx) => (
                            <div
                              key={it.id}
                              onMouseDown={() => selectItem(it)}
                              onMouseEnter={() => setSelectedIndex(idx)}
                              style={{ ...a.dropItem, ...(idx === selectedIndex ? a.dropItemActive : {}) }}
                            >
                              <div style={{ minWidth:0 }}>
                                <div style={{ fontWeight:600, fontSize:11, color: idx === selectedIndex ? 'white' : '#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {highlightMatch(it.name, query)}
                                </div>
                                <div style={{ fontSize:10, fontFamily:"'Courier New',monospace", marginTop:1, color: idx === selectedIndex ? '#c0d8ff' : '#999' }}>
                                  {highlightMatch(it.code, query)}
                                </div>
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, marginLeft:8 }}>
                                <span style={{ padding:'1px 6px', borderRadius:2, fontSize:9, fontWeight:700, background: idx === selectedIndex ? 'rgba(255,255,255,0.25)' : '#e8f0f8', color: idx === selectedIndex ? 'white' : '#1a3a6a', border:'1px solid rgba(255,255,255,0.2)' }}>
                                  {it.baseUnit}
                                </span>
                                {idx === selectedIndex && <ChevronRight size={12} color="rgba(255,255,255,0.6)" />}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ ...a.tdBase, padding:0 }}>
                      <input
                        ref={qtyInputRef}
                        type="number"
                        placeholder="0"
                        value={pendingQty}
                        onChange={e => setPendingQty(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && reasonInputRef.current?.focus()}
                        disabled={!pendingItem}
                        style={{ ...a.entryInput, textAlign:'right', color:'#1a6a1a' }}
                      />
                    </td>
                    <td style={{ ...a.tdBase, ...a.tdRight, fontFamily:"'Courier New',monospace", fontSize:11 }}>
                      {conversionResult && !('error' in conversionResult) ? (
                        <span style={{ fontWeight:700, color:'#cc2200' }}>
                          {conversionResult.baseQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </span>
                      ) : conversionResult && 'error' in conversionResult ? (
                        <span style={{ color:'#cc2200', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:3, fontSize:10 }}>
                          <AlertCircle size={9} /> {conversionResult.error}
                        </span>
                      ) : <span style={{ color:'#ccc' }}>-</span>}
                    </td>
                    <td style={{ ...a.tdBase, padding:0 }}>
                      <select
                        value={pendingUnit}
                        onChange={e => setPendingUnit(e.target.value)}
                        disabled={!pendingItem}
                        style={{ width:'100%', height:'100%', background:'transparent', border:'none', outline:'none', textAlign:'center', fontSize:10, fontFamily:"'Tahoma',sans-serif", fontWeight:700, cursor:'pointer', opacity: pendingItem ? 1 : 0.3 }}
                      >
                        {pendingItem ? (
                          <>
                            <option value={pendingItem.baseUnit}>{pendingItem.baseUnit}</option>
                            {pendingItem.conversions?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </>
                        ) : <option>-</option>}
                      </select>
                    </td>
                    <td style={{ ...a.tdBase, padding:0 }}>
                      <input
                        ref={reasonInputRef}
                        type="text"
                        placeholder="Tulis alasan..."
                        value={pendingReason}
                        onChange={e => setPendingReason(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddLine()}
                        disabled={!pendingItem}
                        style={{ ...a.entryInput, fontStyle:'italic', color:'#555' }}
                      />
                    </td>
                    <td style={{ ...a.tdBase, padding:0 }}>
                      <button
                        onClick={handleAddLine}
                        disabled={!pendingItem}
                        style={{ width:'100%', height:'100%', background:'transparent', border:'none', cursor: pendingItem ? 'pointer' : 'default', display:'flex', alignItems:'center', justifyContent:'center', color:'#2a9850', opacity: pendingItem ? 1 : 0.3 }}
                      >
                        <CornerDownLeft size={14} />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              {rejectLines.length === 0 && (
                <div style={a.empty}>
                  <PackageX size={32} color="#ccc" />
                  <span style={{ fontSize:11, color:'#aaa' }}>Cari dan tambahkan barang reject di baris bawah</span>
                </div>
              )}
            </div>
          </div>

        ) : activeTab === 'HISTORY' ? (
          /* ── HISTORY TAB ────────────────────────────────────────────────── */
          <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
            <div style={a.subToolbar}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:10, fontWeight:700, color:'#5a6a7a', textTransform:'uppercase' }}>Periode:</span>
                <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} style={{ ...a.tbInput, width:120 }} />
                <span style={{ color:'#aaa' }}>—</span>
                <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} style={{ ...a.tbInput, width:120 }} />
                <div style={a.searchWrap}>
                  <Search size={11} color="#999" />
                  <input
                    type="text"
                    placeholder="Cari batch/outlet/barang..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    style={a.searchInput}
                  />
                  {historySearch && (
                    <button onClick={() => setHistorySearch('')} style={{ border:'none', background:'transparent', cursor:'pointer', color:'#999', padding:0, display:'flex' }}>
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:10, color:'#888' }}>{filteredBatches.length} batch</span>
                {selectedBatches.size > 0 && (
                  <button onClick={() => setShowDeleteSelectedConfirm(true)} style={{ ...a.tbBtn, ...a.tbBtnDanger }}>
                    <Trash2 size={12} /> Hapus {selectedBatches.size} Terpilih
                  </button>
                )}
                <button onClick={handleExportMatrix} style={{ ...a.tbBtn, ...a.tbBtnGreen }}>
                  <FileSpreadsheet size={12} /> Export Matrix
                </button>
              </div>
            </div>

            <style>{`
              @keyframes circleIn {
                from { transform: scale(0.4); opacity: 0; }
                to   { transform: scale(1);   opacity: 1; }
              }
              .batch-row .circle-check {
                opacity: 0;
                transform: scale(0.4);
                transition: opacity 0.15s ease, transform 0.15s ease;
              }
              .batch-row:hover .circle-check,
              .batch-row.selected .circle-check {
                opacity: 1;
                transform: scale(1);
              }
              .batch-row.selected {
                background: #e8f0fe !important;
              }
            `}</style>
            <div style={a.tableWrap}>
              <table style={a.table}>
                <thead>
                  <tr style={{ height:28 }}>
                    <th style={{ ...a.th, ...a.thCenter, width:40 }}>
                      {/* Select-all circle */}
                      <div
                        onClick={() => {
                          const allSelected = filteredBatches.length > 0 && filteredBatches.every(b => selectedBatches.has(b.id));
                          if (allSelected) setSelectedBatches(new Set());
                          else setSelectedBatches(new Set(filteredBatches.map(b => b.id)));
                        }}
                        style={{
                          width: 20, height: 20, borderRadius: '50%', border: '2px solid #5f6368',
                          background: filteredBatches.length > 0 && filteredBatches.every(b => selectedBatches.has(b.id)) ? '#1a73e8' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', margin: '0 auto', transition: 'background 0.15s, border-color 0.15s',
                          borderColor: filteredBatches.length > 0 && filteredBatches.every(b => selectedBatches.has(b.id)) ? '#1a73e8' : '#5f6368',
                        }}
                      >
                        {filteredBatches.length > 0 && filteredBatches.every(b => selectedBatches.has(b.id)) && (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </th>
                    <th style={{ ...a.th, width:130 }}>ID Batch</th>
                    <th style={{ ...a.th, width:100 }}>Tanggal</th>
                    <th style={a.th}>Outlet</th>
                    <th style={{ ...a.th, ...a.thCenter, width:80 }}>Items</th>
                    <th style={{ ...a.th, ...a.thCenter, width:110 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((b, idx) => {
                    const isSelected = selectedBatches.has(b.id);
                    return (
                    <tr
                      key={b.id}
                      className={`batch-row${isSelected ? ' selected' : ''}`}
                      style={isSelected ? {} : (idx % 2 === 0 ? a.trOdd : a.trEven)}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#dce8ff'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f0f5fb'; }}
                    >
                      <td style={{ ...a.tdBase, ...a.tdCenter, padding:'3px 4px' }}>
                        {/* Gmail-style circular checkbox */}
                        <div
                          className="circle-check"
                          onClick={() => {
                            const next = new Set(selectedBatches);
                            if (isSelected) next.delete(b.id); else next.add(b.id);
                            setSelectedBatches(next);
                          }}
                          style={{
                            width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                            border: `2px solid ${isSelected ? '#1a73e8' : '#5f6368'}`,
                            background: isSelected ? '#1a73e8' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto', transition: 'background 0.15s, border-color 0.15s',
                            flexShrink: 0,
                          }}
                        >
                          {isSelected && (
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                      </td>
                      <td style={{ ...a.tdBase, fontFamily:"'Courier New',monospace", fontSize:10, color:'#1a50aa', fontWeight:700 }}>{b.id}</td>
                      <td style={{ ...a.tdBase, fontSize:11 }}>{b.date}</td>
                      <td style={a.tdBase}>
                        <span style={a.badgeOutlet}>{b.outlet}</span>
                      </td>
                      <td style={{ ...a.tdBase, ...a.tdCenter, fontSize:11, fontWeight:600 }}>{b.items.length}</td>
                      <td style={{ ...a.tdBase, ...a.tdCenter }}>
                        <button onClick={() => setViewingBatch(b)} style={{ ...a.actionBtn }} title="Lihat Detail"><Eye size={11} /> Detail</button>
                        <button onClick={() => handleEditBatch(b)} style={{ ...a.actionBtn, ...a.actionBtnAmber }} title="Edit"><Edit3 size={11} /></button>
                        <button onClick={() => handleCopyToClipboard(b)} style={{ ...a.actionBtn }} title="Copy Teks"><Copy size={11} /></button>
                        <button onClick={() => setBatchToDelete(b.id)} style={{ ...a.actionBtn, ...a.actionBtnRed }} title="Hapus"><Trash2 size={11} /></button>
                      </td>
                    </tr>
                  )})}
                  {filteredBatches.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding:'48px 0' }}>
                        <div style={a.empty}>
                          <History size={28} color="#ccc" />
                          <span style={{ fontSize:11, color:'#aaa' }}>
                            {historySearch ? 'Tidak ada batch yang cocok' : 'Tidak ada riwayat pada periode ini'}
                          </span>
                          {historySearch && (
                            <button onClick={() => setHistorySearch('')} style={{ fontSize:10, color:'#2a68cc', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
                              Reset pencarian
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        ) : activeTab === 'MASTER_ITEMS' ? (
          /* ── MASTER ITEMS TAB ───────────────────────────────────────────── */
          <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
            <div style={a.subToolbar}>
              <div style={a.searchWrap}>
                <Search size={11} color="#999" />
                <input
                  type="text"
                  placeholder="Cari master barang..."
                  value={masterSearch}
                  onChange={e => setMasterSearch(e.target.value)}
                  style={a.searchInput}
                />
              </div>
              <button
                onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', baseUnit: 'Pcs', conversions: [] }); setShowItemModal(true); }}
                style={{ ...a.tbBtn, ...a.tbBtnPrimary }}
              >
                <Plus size={13} /> Barang Baru
              </button>
            </div>

            <div style={a.tableWrap}>
              <table style={a.table}>
                <thead>
                  <tr style={{ height:28 }}>
                    <th style={{ ...a.th, width:130 }}>Kode SKU</th>
                    <th style={a.th}>Nama Produk</th>
                    <th style={{ ...a.th, ...a.thCenter, width:80 }}>Unit</th>
                    <th style={{ ...a.th, width:140 }}>Multi-Unit</th>
                    <th style={{ ...a.th, ...a.thCenter, width:80 }}>Status</th>
                    <th style={{ ...a.th, ...a.thCenter, width:80 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMasterItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      style={{ ...(idx % 2 === 0 ? a.trOdd : a.trEven), opacity: item.isActive === false ? 0.6 : 1 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#dce8ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f0f5fb')}
                    >
                      <td style={{ ...a.tdBase, ...a.tdMono, color:'#555' }}>{item.code}</td>
                      <td style={a.tdBase}>
                        <span style={{ fontWeight:600, fontSize:11, color: item.isActive === false ? '#aaa' : '#1a1a1a', textDecoration: item.isActive === false ? 'line-through' : 'none' }}>
                          {item.name}
                        </span>
                      </td>
                      <td style={{ ...a.tdBase, ...a.tdCenter }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#5a7090', textTransform:'uppercase' }}>{item.baseUnit}</span>
                      </td>
                      <td style={{ ...a.tdBase, fontSize:10, color:'#888', fontStyle:'italic' }}>
                        {item.conversions?.length ? item.conversions.map(c => c.name).join(', ') : '—'}
                      </td>
                      <td style={{ ...a.tdBase, ...a.tdCenter }}>
                        <span style={item.isActive === false ? a.badgeNonaktif : a.badgeAktif}>
                          {item.isActive === false ? 'NONAKTIF' : 'AKTIF'}
                        </span>
                      </td>
                      <td style={{ ...a.tdBase, ...a.tdCenter }}>
                        <button
                          onClick={() => { setEditingItem(item); setItemForm({ ...item, conversions: item.conversions ? [...item.conversions] : [] }); setShowItemModal(true); }}
                          style={{ ...a.actionBtn, ...a.actionBtnAmber }} title="Edit"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          onClick={() => setMasterItemToDelete(item.id)}
                          style={{ ...a.actionBtn, ...a.actionBtnRed }} title="Hapus"
                        >
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredMasterItems.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding:'48px 0' }}>
                        <div style={a.empty}>
                          <span style={{ fontSize:11, color:'#aaa' }}>Tidak ada barang ditemukan</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        ) : (
          /* ── OUTLET MASTER TAB ──────────────────────────────────────────── */
          <OutletManager
            outlets={outlets}
            onAdd={async (name) => {
              try { await StorageService.saveRejectOutlet(name); loadData(); }
              catch { showToast('Gagal menambah outlet', 'error'); }
            }}
            onDelete={setOutletToDelete}
            outletToDelete={outletToDelete}
            setOutletToDelete={setOutletToDelete}
            onConfirmDelete={handleDeleteOutlet}
          />
        )}
      </div>

      {/* ── STATUS BAR ──────────────────────────────────────────────────────── */}
      <div style={a.statusBar}>
        <span style={a.statusPanel}>
          {activeTab === 'NEW' && `${rejectLines.length} item`}
          {activeTab === 'HISTORY' && `${filteredBatches.length} batch`}
          {activeTab === 'MASTER_ITEMS' && `${filteredMasterItems.length} barang`}
          {activeTab === 'MASTER' && `${outlets.length} outlet`}
        </span>
        <span style={{ marginLeft:'auto', color:'#888' }}>GudangPro — Modul Reject</span>
      </div>

      {/* ── MODAL: MASTER ITEM ──────────────────────────────────────────────── */}
      {showItemModal && (
        <ModalPortal>
          <div style={a.overlay} onClick={e => e.target === e.currentTarget && setShowItemModal(false)}>
            <div style={a.modalWin}>
              <div style={a.modalTitle}>
                <span>{editingItem ? `Edit Barang — SKU: ${editingItem.code}` : 'Tambah Barang Baru'}</span>
                <button style={a.modalClose} onClick={() => setShowItemModal(false)}>✕</button>
              </div>

              <div style={a.modalBody}>
                <div style={a.gridCols3}>
                  <div style={a.fieldGroup}>
                    <label style={a.fieldLabel}>Kode SKU</label>
                    <input
                      type="text"
                      style={{ ...a.fieldInput, fontFamily:"'Courier New',monospace", textTransform:'uppercase' }}
                      value={itemForm.code}
                      onChange={e => setItemForm({ ...itemForm, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div style={a.fieldGroup}>
                    <label style={a.fieldLabel}>Unit Dasar</label>
                    <input
                      type="text"
                      style={{ ...a.fieldInput, textTransform:'uppercase', textAlign:'center' }}
                      value={itemForm.baseUnit}
                      onChange={e => setItemForm({ ...itemForm, baseUnit: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div style={a.fieldGroup}>
                    <label style={a.fieldLabel}>Status</label>
                    <select
                      style={{ ...a.fieldInput, background:'white' }}
                      value={itemForm.isActive === false ? 'false' : 'true'}
                      onChange={e => setItemForm({ ...itemForm, isActive: e.target.value === 'true' })}
                    >
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                  </div>
                  <div style={{ ...a.fieldGroup, gridColumn:'1 / -1' }}>
                    <label style={a.fieldLabel}>Nama Lengkap Barang</label>
                    <input
                      type="text"
                      style={a.fieldInput}
                      value={itemForm.name}
                      onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ borderTop:'1px solid #d0d8e0', paddingTop:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'#5a6a7a', textTransform:'uppercase', letterSpacing:'0.06em' }}>Konversi Multi-Unit</span>
                    <button
                      onClick={() => setItemForm({ ...itemForm, conversions: [...(itemForm.conversions || []), { name: '', ratio: 1, operator: '*' }] })}
                      style={{ fontSize:11, fontWeight:700, color:'#2a68cc', background:'none', border:'none', cursor:'pointer' }}
                    >
                      + Tambah Unit
                    </button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {(itemForm.conversions || []).map((c, i) => (
                      <div key={i} style={a.convRow}>
                        <input
                          type="text" placeholder="BOX"
                          style={{ ...a.fieldInput, width:60, textTransform:'uppercase', fontWeight:700, textAlign:'center' }}
                          value={c.name}
                          onChange={e => { const next = [...(itemForm.conversions || [])]; next[i] = { ...next[i], name: e.target.value.toUpperCase() }; setItemForm({ ...itemForm, conversions: next }); }}
                        />
                        <select
                          style={{ ...a.fieldInput, width:50, textAlign:'center', fontWeight:700 }}
                          value={c.operator}
                          onChange={e => { const next = [...(itemForm.conversions || [])]; next[i] = { ...next[i], operator: e.target.value as any }; setItemForm({ ...itemForm, conversions: next }); }}
                        >
                          <option value="*">×</option>
                          <option value="/">/</option>
                        </select>
                        <input
                          type="number" placeholder="Rasio"
                          style={{ ...a.fieldInput, width:70, textAlign:'right', fontFamily:"'Courier New',monospace" }}
                          value={c.ratio}
                          onChange={e => { const next = [...(itemForm.conversions || [])]; next[i] = { ...next[i], ratio: Number(e.target.value) }; setItemForm({ ...itemForm, conversions: next }); }}
                        />
                        <span style={{ fontSize:10, fontWeight:700, color:'#5a7090', textTransform:'uppercase' }}>{itemForm.baseUnit}</span>
                        <button
                          onClick={() => setItemForm({ ...itemForm, conversions: itemForm.conversions?.filter((_, idx) => idx !== i) })}
                          style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#cc2200', display:'flex' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={a.modalFooter}>
                <button style={a.modalBtnCancel} onClick={() => setShowItemModal(false)}>Batal</button>
                <button style={a.modalBtnOk} onClick={handleSaveMasterItem}>
                  <Save size={13} /> Simpan
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── MODAL: DETAIL RIWAYAT ───────────────────────────────────────────── */}
      {viewingBatch && (
        <ModalPortal>
          <div style={a.overlay} onClick={e => e.target === e.currentTarget && setViewingBatch(null)}>
            <div style={{ ...a.modalWinSm }}>
              <div style={a.modalTitle}>
                <div>
                  <div>Detail Batch Reject</div>
                  <div style={{ fontSize:10, fontFamily:"'Courier New',monospace", color:'rgba(255,255,255,0.7)', marginTop:2 }}>
                    {viewingBatch.id} · {viewingBatch.outlet} · {viewingBatch.date}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <button
                    onClick={() => handleCopyToClipboard(viewingBatch)}
                    style={{ ...a.tbBtn, ...a.tbBtnPrimary, fontSize:10 }}
                  >
                    <Copy size={12} /> Copy Teks
                  </button>
                  <button style={a.modalClose} onClick={() => setViewingBatch(null)}>✕</button>
                </div>
              </div>

              <div style={{ overflow:'auto', flex:1 }}>
                <table style={{ ...a.table, tableLayout:'auto' }}>
                  <thead>
                    <tr style={{ height:26 }}>
                      <th style={{ ...a.th, ...a.thCenter, width:36 }}>#</th>
                      <th style={a.th}>Nama Barang</th>
                      <th style={{ ...a.th, ...a.thRight, width:100 }}>Input</th>
                      <th style={{ ...a.th, ...a.thRight, width:90 }}>Qty Base</th>
                      <th style={{ ...a.th, ...a.thCenter, width:70 }}>Unit</th>
                      <th style={a.th}>Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingBatch.items.map((it, i) => {
                      const ext = it as RejectItemExtended;
                      return (
                        <tr
                          key={i}
                          style={i % 2 === 0 ? a.trOdd : a.trEven}
                          onMouseEnter={e => (e.currentTarget.style.background = '#dce8ff')}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#ffffff' : '#f0f5fb')}
                        >
                          <td style={{ ...a.tdBase, ...a.tdCenter, color:'#999', fontFamily:"'Courier New',monospace", fontSize:10 }}>{i + 1}</td>
                          <td style={a.tdBase}>
                            <div style={{ fontWeight:600, color:'#1a1a1a', fontSize:11 }}>{it.name}</div>
                            <div style={{ fontSize:9, color:'#999', fontFamily:"'Courier New',monospace", textTransform:'uppercase' }}>{it.sku}</div>
                          </td>
                          <td style={{ ...a.tdBase, ...a.tdRight, fontFamily:"'Courier New',monospace", fontSize:10, color:'#555' }}>
                            {ext.inputQty != null ? `${ext.inputQty} ${ext.inputUnit}` : '—'}
                          </td>
                          <td style={{ ...a.tdBase, ...a.tdRight, fontFamily:"'Courier New',monospace", fontWeight:700, color:'#cc2200', fontSize:11 }}>
                            {it.qty.toLocaleString()}
                          </td>
                          <td style={{ ...a.tdBase, ...a.tdCenter, fontSize:10, fontWeight:700, textTransform:'uppercase', color:'#5a7090' }}>
                            {it.unit}
                          </td>
                          <td style={{ ...a.tdBase, fontStyle:'italic', fontSize:10, color:'#666' }}>
                            {it.reason || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      <ConfirmDialog
        isOpen={showDeleteSelectedConfirm}
        title="Hapus Batch Terpilih"
        message={`Apakah Anda yakin ingin menghapus ${selectedBatches.size} batch yang dipilih? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={handleDeleteSelected}
        onCancel={() => setShowDeleteSelectedConfirm(false)}
      />
      <ConfirmDialog
        isOpen={!!batchToDelete}
        title="Hapus Riwayat Reject"
        message="Apakah Anda yakin ingin menghapus riwayat reject ini?"
        onConfirm={handleDeleteBatch}
        onCancel={() => setBatchToDelete(null)}
      />
      <ConfirmDialog
        isOpen={!!masterItemToDelete}
        title="Hapus Master Item"
        message="Apakah Anda yakin ingin menghapus master item ini?"
        onConfirm={handleDeleteMasterItem}
        onCancel={() => setMasterItemToDelete(null)}
      />
    </div>
  );
};
