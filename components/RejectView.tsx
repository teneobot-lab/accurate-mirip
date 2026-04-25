import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { StorageService } from '../services/storage';
import { Item, RejectBatch, RejectItem, Stock } from '../types';
import {
  Trash2, Plus, CornerDownLeft, Loader2, History, MapPin, Search,
  X, Eye, Save, Database, Edit3, Copy, FileSpreadsheet,
  ChevronRight, Filter, AlertCircle, PackageX, Upload, Download,
  CheckCircle2, XCircle, AlertTriangle, FileDown
} from 'lucide-react';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import ExcelJS from 'exceljs';
import { Decimal } from 'decimal.js';
import { highlightMatch } from '../search/highlightMatch';

// ModalPortal — render modal langsung ke document.body
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

// ─── Tipe untuk bulk import ───────────────────────────────────────────────────
interface ImportRowParsed {
  rowNum: number;
  code: string;
  name: string;
  baseUnit: string;
  isActive: boolean;
  conversions: { name: string; operator: '*' | '/'; ratio: number }[];
  // hasil validasi
  status: 'ok' | 'duplicate' | 'update' | 'error';
  errorMsg?: string;
  // existing item jika duplikat/update
  existingItem?: Item;
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
  tbBtnAmber:     { background:'linear-gradient(180deg,#f8d060 0%,#e8a820 100%)', borderColor:'#b07818', color:'#5a3800' },
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
  modalWinLg:     { background:'#f0f0f0', border:'2px solid #1e3a6e', borderRadius:4, width:860, boxShadow:'4px 4px 20px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column', maxHeight:'calc(100vh - 60px)' },
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
            <button onClick={handleAdd} style={{ ...a.tbBtn, ...a.tbBtnPrimary }}>TAMBAH</button>
          </div>
          <div style={{ borderTop:'1px solid #e0e8f0', paddingTop:4 }}>
            {outlets.length === 0 && (
              <p style={{ textAlign:'center', color:'#bbb', fontSize:10, padding:'12px 0', fontStyle:'italic' }}>Belum ada outlet</p>
            )}
            {outlets.map(o => (
              <div key={o} style={a.outletRow}>
                <span style={{ textTransform:'uppercase', fontSize:11 }}>{o}</span>
                <button onClick={() => onDelete(o)} style={{ ...a.actionBtn, ...a.actionBtnRed }}>
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

/* ─── BulkImportModal ───────────────────────────────────────────────────────── */
interface BulkImportModalProps {
  existingItems: Item[];
  onClose: () => void;
  onImportDone: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({
  existingItems, onClose, onImportDone, showToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState<ImportRowParsed[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importMode, setImportMode] = useState<'skip' | 'overwrite'>('skip');
  const [importResult, setImportResult] = useState<{ added: number; updated: number; skipped: number; errors: number } | null>(null);

  // Filter rows
  const okRows     = parsedRows.filter(r => r.status === 'ok');
  const updateRows = parsedRows.filter(r => r.status === 'update');
  const dupRows    = parsedRows.filter(r => r.status === 'duplicate');
  const errRows    = parsedRows.filter(r => r.status === 'error');

  // ── Download Template ──────────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'GudangPro';
      wb.created = new Date();

      // ── Sheet 1: Template Data ─────────────────────────────────────────────
      const ws = wb.addWorksheet('Katalog Barang', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
      });

      // Judul
      ws.mergeCells('A1:P1');
      const titleCell = ws.getCell('A1');
      titleCell.value = 'TEMPLATE BULK IMPORT — KATALOG BARANG';
      titleCell.font = { bold: true, size: 13, name: 'Calibri', color: { argb: 'FFFFFFFF' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A6E' } };
      ws.getRow(1).height = 24;

      // Header kolom
      const headers = [
        { col: 'A', label: 'KODE SKU *',        note: 'Wajib. Unik, huruf kapital otomatis. Contoh: BRG-001' },
        { col: 'B', label: 'NAMA BARANG *',      note: 'Wajib. Nama lengkap produk.' },
        { col: 'C', label: 'SATUAN DASAR *',     note: 'Wajib. Contoh: Pcs, Kg, Liter, Botol' },
        { col: 'D', label: 'STATUS',             note: 'Opsional. Isi "Aktif" atau "Nonaktif". Default: Aktif' },
        { col: 'E', label: 'UNIT 1 NAMA',        note: 'Nama unit konversi ke-1. Contoh: Lusin, Box, Krat' },
        { col: 'F', label: 'UNIT 1 OPERATOR',    note: 'Operator: * (kali) atau / (bagi)' },
        { col: 'G', label: 'UNIT 1 RASIO',       note: 'Angka rasio konversi. Contoh: 12 (1 Lusin = 12 Pcs)' },
        { col: 'H', label: 'UNIT 2 NAMA',        note: 'Nama unit konversi ke-2 (opsional)' },
        { col: 'I', label: 'UNIT 2 OPERATOR',    note: 'Operator: * atau /' },
        { col: 'J', label: 'UNIT 2 RASIO',       note: 'Angka rasio konversi' },
        { col: 'K', label: 'UNIT 3 NAMA',        note: 'Nama unit konversi ke-3 (opsional)' },
        { col: 'L', label: 'UNIT 3 OPERATOR',    note: 'Operator: * atau /' },
        { col: 'M', label: 'UNIT 3 RASIO',       note: 'Angka rasio konversi' },
        { col: 'N', label: 'UNIT 4 NAMA',        note: 'Nama unit konversi ke-4 (opsional)' },
        { col: 'O', label: 'UNIT 4 OPERATOR',    note: 'Operator: * atau /' },
        { col: 'P', label: 'UNIT 4 RASIO',       note: 'Angka rasio konversi' },
      ];

      headers.forEach(({ col, label, note }) => {
        const cell = ws.getCell(`${col}2`);
        cell.value = label;
        cell.font = { bold: true, size: 9, name: 'Calibri', color: { argb: 'FF1A3060' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE8F8' } };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FFA8B8CC' } }, right: { style: 'thin', color: { argb: 'FFA8B8CC' } } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.note = { texts: [{ text: note }] };
      });
      ws.getRow(2).height = 36;

      // ── Data contoh ────────────────────────────────────────────────────────
      const sampleData = [
        // [SKU, Nama, BaseUnit, Status, U1Nama, U1Op, U1Rasio, U2Nama, U2Op, U2Rasio, U3Nama, U3Op, U3Rasio, U4Nama, U4Op, U4Rasio]
        ['BRG-001', 'Kopi Arabica Bubuk',        'Gram',  'Aktif',    'Kilogram', '*', 1000, 'Ons',    '*', 100,  '',        '', '', '', '', ''],
        ['BRG-002', 'Gula Pasir Putih',           'Kg',    'Aktif',    'Gram',     '/', 1000, 'Kwintal','*', 100,  '',        '', '', '', '', ''],
        ['BRG-003', 'Botol Kaca 250ml',           'Pcs',   'Aktif',    'Lusin',    '*', 12,   'Krat',   '*', 144,  '',        '', '', '', '', ''],
        ['BRG-004', 'Susu UHT Full Cream',        'Karton','Aktif',    'Liter',    '/', 8,    'Pcs',    '/', 48,   '',        '', '', '', '', ''],
        ['BRG-005', 'Teh Celup Premium',          'Box',   'Aktif',    'Pcs',      '/', 25,   '',       '', '',   '',        '', '', '', '', ''],
        ['BRG-006', 'Minyak Goreng Kemasan',      'Karton','Aktif',    'Botol',    '/', 12,   'Liter',  '/', 24,  '',        '', '', '', '', ''],
        ['BRG-007', 'Tepung Terigu Protein Tinggi','Sak',  'Aktif',    'Kilogram', '/', 25,   'Gram',   '/', 25000,'',       '', '', '', '', ''],
        ['BRG-008', 'Saos Sambal Botol Kecil',    'Karton','Aktif',    'Lusin',    '/', 4,    'Pcs',    '/', 48,  '',        '', '', '', '', ''],
        ['BRG-009', 'Plastik Wrap Gulung',        'Roll',  'Aktif',    '',         '', '',   '',       '', '',   '',        '', '', '', '', ''],
        ['BRG-010', 'Produk Discontinued',        'Pcs',   'Nonaktif', 'Lusin',    '*', 12,  '',       '', '',   '',        '', '', '', '', ''],
      ];

      sampleData.forEach((row, i) => {
        const excelRow = ws.getRow(3 + i);
        row.forEach((val, ci) => {
          const cell = excelRow.getCell(ci + 1);
          cell.value = val === '' ? null : val;
          cell.font = { name: 'Calibri', size: 10 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD8E0E8' } },
            bottom: { style: 'thin', color: { argb: 'FFD8E0E8' } },
            left: { style: 'thin', color: { argb: 'FFD8E0E8' } },
            right: { style: 'thin', color: { argb: 'FFD8E0E8' } },
          };
          // Warnai kolom wajib
          if (ci < 3) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFF8E8' : 'FFFFF0D0' } };
            cell.font = { bold: ci === 0, name: 'Calibri', size: 10, color: { argb: ci === 0 ? 'FF1A5090' : 'FF1A1A1A' } };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FBFF' } };
          }
          // Kolom operator — rata tengah
          if ([5, 8, 11, 14].includes(ci)) {
            cell.alignment = { horizontal: 'center' };
            cell.font = { bold: true, name: 'Calibri', size: 11 };
          }
          // Kolom rasio — angka
          if ([6, 9, 12, 15].includes(ci)) {
            cell.alignment = { horizontal: 'right' };
            cell.numFmt = '#,##0.####';
          }
          // Status
          if (ci === 3) {
            cell.alignment = { horizontal: 'center' };
            const isAktif = String(val).toLowerCase() === 'aktif';
            cell.font = { bold: true, name: 'Calibri', size: 10, color: { argb: isAktif ? 'FF1A6A1A' : 'FF888888' } };
          }
        });
        excelRow.height = 18;
      });

      // ── Lebar kolom ───────────────────────────────────────────────────────
      ws.getColumn(1).width = 14;  // SKU
      ws.getColumn(2).width = 30;  // Nama
      ws.getColumn(3).width = 12;  // Base Unit
      ws.getColumn(4).width = 10;  // Status
      ws.getColumn(5).width = 12;  ws.getColumn(6).width = 8;  ws.getColumn(7).width = 9;
      ws.getColumn(8).width = 12;  ws.getColumn(9).width = 8;  ws.getColumn(10).width = 9;
      ws.getColumn(11).width = 12; ws.getColumn(12).width = 8; ws.getColumn(13).width = 9;
      ws.getColumn(14).width = 12; ws.getColumn(15).width = 8; ws.getColumn(16).width = 9;

      // Data validation untuk kolom Operator
      for (const col of [6, 9, 12, 15]) {
        for (let r = 3; r <= 1000; r++) {
          ws.getCell(r, col).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: ['"*,/"'],
            showErrorMessage: true,
            errorStyle: 'warning',
            errorTitle: 'Nilai tidak valid',
            error: 'Gunakan * (kali) atau / (bagi)',
          };
        }
      }
      // Data validation untuk Status
      for (let r = 3; r <= 1000; r++) {
        ws.getCell(r, 4).dataValidation = {
          type: 'list', allowBlank: true,
          formulae: ['"Aktif,Nonaktif"'],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Nilai tidak valid',
          error: 'Pilih Aktif atau Nonaktif',
        };
      }

      // ── Sheet 2: Panduan ───────────────────────────────────────────────────
      const wsPanduan = wb.addWorksheet('Panduan Konversi');
      wsPanduan.mergeCells('A1:D1');
      const ph = wsPanduan.getCell('A1');
      ph.value = 'PANDUAN RASIO KONVERSI MULTI-UNIT';
      ph.font = { bold: true, size: 13, name: 'Calibri', color: { argb: 'FFFFFFFF' } };
      ph.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A6E' } };
      ph.alignment = { horizontal: 'center', vertical: 'middle' };
      wsPanduan.getRow(1).height = 24;

      const panduanHeaders = ['Nama Unit', 'Operator', 'Rasio', 'Penjelasan'];
      const ph2 = wsPanduan.getRow(2);
      panduanHeaders.forEach((h, i) => {
        const c = ph2.getCell(i + 1);
        c.value = h;
        c.font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF1A3060' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE8F8' } };
        c.border = { bottom: { style: 'medium', color: { argb: 'FFA8B8CC' } } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      wsPanduan.getRow(2).height = 20;

      const panduanRows = [
        ['', '', '', '── SATUAN DASAR: Pcs ──'],
        ['Lusin',     '*', 12,    '1 Lusin = 12 Pcs → qty input × 12 = qty base (Pcs)'],
        ['Kodi',      '*', 20,    '1 Kodi = 20 Pcs → qty input × 20 = qty base (Pcs)'],
        ['Gros',      '*', 144,   '1 Gros = 144 Pcs → qty input × 144 = qty base (Pcs)'],
        ['Box (12)',  '*', 12,    '1 Box isi 12 Pcs → qty input × 12 = qty base (Pcs)'],
        ['', '', '', '── SATUAN DASAR: Kg ──'],
        ['Gram',      '/', 1000,  '1 Gram = 1/1000 Kg → qty input / 1000 = qty base (Kg)'],
        ['Ons',       '/', 10,    '1 Ons = 0.1 Kg → qty input / 10 = qty base (Kg)'],
        ['Kwintal',   '*', 100,   '1 Kwintal = 100 Kg → qty input × 100 = qty base (Kg)'],
        ['Ton',       '*', 1000,  '1 Ton = 1000 Kg → qty input × 1000 = qty base (Kg)'],
        ['', '', '', '── SATUAN DASAR: Liter ──'],
        ['mL',        '/', 1000,  '1 mL = 1/1000 Liter → qty input / 1000 = qty base (Liter)'],
        ['Galon',     '*', 19,    '1 Galon = 19 Liter → qty input × 19 = qty base (Liter)'],
        ['', '', '', '── SATUAN DASAR: Karton ──'],
        ['Pcs',       '/', 48,    '1 Karton isi 48 Pcs → misal 1 Pcs = 1/48 Karton'],
        ['Lusin',     '/', 4,     '1 Karton isi 4 Lusin → misal 1 Lusin = 1/4 Karton'],
        ['', '', '', '── RUMUS KONVERSI ──'],
        ['', '', '', 'Operator * (kali): qty_base = qty_input × rasio'],
        ['', '', '', 'Operator / (bagi): qty_base = qty_input / rasio'],
        ['', '', '', 'Contoh: 2 Lusin × 12 = 24 Pcs (base)'],
        ['', '', '', 'Contoh: 500 Gram / 1000 = 0.5 Kg (base)'],
      ];

      panduanRows.forEach((row, i) => {
        const exRow = wsPanduan.getRow(3 + i);
        row.forEach((val, ci) => {
          const c = exRow.getCell(ci + 1);
          c.value = val === '' ? null : val;
          c.font = { name: 'Calibri', size: 10 };
          c.border = { bottom: { style: 'thin', color: { argb: 'FFE0E8F0' } } };
          if (ci === 1) { c.alignment = { horizontal: 'center' }; c.font = { bold: true, name: 'Calibri', size: 11 }; }
          if (ci === 2) { c.alignment = { horizontal: 'right' }; c.numFmt = '#,##0.####'; }
          if (ci === 3 && String(val).startsWith('──')) {
            c.font = { bold: true, name: 'Calibri', size: 10, color: { argb: 'FF1A3060' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF3F8' } };
          }
          if (i % 2 === 0 && !String(val).startsWith('──') && val !== '') {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FBFF' } };
          }
        });
        exRow.height = 16;
      });

      wsPanduan.getColumn(1).width = 14;
      wsPanduan.getColumn(2).width = 10;
      wsPanduan.getColumn(3).width = 10;
      wsPanduan.getColumn(4).width = 60;

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Template_Katalog_Barang_GudangPro.xlsx';
      link.click();
      URL.revokeObjectURL(url);
      showToast('Template berhasil diunduh', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat template', 'error');
    }
  };

  // ── Parse Excel ────────────────────────────────────────────────────────────
  const parseExcel = async (file: File) => {
    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);

      // Cari worksheet — prioritaskan sheet bernama "Katalog Barang", fallback ke sheet pertama
      let ws = wb.getWorksheet('Katalog Barang');
      if (!ws) ws = wb.worksheets[0];
      if (!ws) throw new Error('Sheet tidak ditemukan');

      const rows: ImportRowParsed[] = [];
      const seenCodes = new Set<string>();

      ws.eachRow((row, rowNum) => {
        if (rowNum <= 2) return; // skip header rows

        const getStr = (colIdx: number): string => {
          const val = row.getCell(colIdx).value;
          if (val === null || val === undefined) return '';
          return String(val).trim();
        };
        const getNum = (colIdx: number): number => {
          const val = row.getCell(colIdx).value;
          if (val === null || val === undefined || val === '') return 0;
          const n = Number(val);
          return isNaN(n) ? 0 : n;
        };
        const getOp = (colIdx: number): '*' | '/' => {
          const v = getStr(colIdx);
          return v === '/' ? '/' : '*';
        };

        const code     = getStr(1).toUpperCase();
        const name     = getStr(2);
        const baseUnit = getStr(3) || 'Pcs';
        const statusStr= getStr(4).toLowerCase();
        const isActive = statusStr === 'nonaktif' ? false : true;

        // Skip baris kosong total
        if (!code && !name) return;

        // Bangun konversi
        const conversions: { name: string; operator: '*' | '/'; ratio: number }[] = [];
        for (let slot = 0; slot < 4; slot++) {
          const base = 5 + slot * 3;
          const uName = getStr(base).toUpperCase();
          const uOp   = getOp(base + 1);
          const uRatio= getNum(base + 2);
          if (uName && uRatio > 0) {
            conversions.push({ name: uName, operator: uOp, ratio: uRatio });
          }
        }

        // Validasi
        let status: ImportRowParsed['status'] = 'ok';
        let errorMsg: string | undefined;
        let existingItem: Item | undefined;

        if (!code) {
          status = 'error'; errorMsg = 'Kode SKU kosong';
        } else if (!name) {
          status = 'error'; errorMsg = 'Nama barang kosong';
        } else if (seenCodes.has(code)) {
          status = 'error'; errorMsg = 'SKU duplikat dalam file';
        } else {
          // Cek terhadap data existing
          const existing = existingItems.find(it => it.code.toUpperCase() === code);
          if (existing) {
            existingItem = existing;
            status = 'update'; // akan di-overwrite atau di-skip tergantung importMode
          }
        }

        seenCodes.add(code);
        rows.push({ rowNum, code, name, baseUnit, isActive, conversions, status, errorMsg, existingItem });
      });

      if (rows.length === 0) {
        showToast('File tidak memiliki data. Pastikan data dimulai dari baris 3.', 'warning');
        return;
      }

      setParsedRows(rows);
      setStep('preview');
    } catch (err) {
      console.error(err);
      showToast('Gagal membaca file Excel. Pastikan menggunakan template yang benar.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseExcel(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      parseExcel(file);
    } else {
      showToast('Hanya file .xlsx atau .xls yang didukung', 'warning');
    }
  };

  // ── Lakukan import ─────────────────────────────────────────────────────────
  const handleConfirmImport = async () => {
    setIsProcessing(true);
    let added = 0, updated = 0, skipped = 0, errors = 0;
    try {
      for (const row of parsedRows) {
        if (row.status === 'error') { errors++; continue; }

        if (row.status === 'update') {
          if (importMode === 'skip') { skipped++; continue; }
          // overwrite
          try {
            await StorageService.saveRejectMasterItem({
              ...row.existingItem!,
              name: row.name,
              baseUnit: row.baseUnit,
              isActive: row.isActive,
              conversions: row.conversions,
            });
            updated++;
          } catch { errors++; }
          continue;
        }

        // status === 'ok' — tambah baru
        try {
          await StorageService.saveRejectMasterItem({
            id: undefined as any,
            code: row.code,
            name: row.name,
            baseUnit: row.baseUnit,
            isActive: row.isActive,
            conversions: row.conversions,
          });
          added++;
        } catch { errors++; }
      }

      setImportResult({ added, updated, skipped, errors });
      setStep('done');
      onImportDone();
    } catch (err) {
      console.error(err);
      showToast('Terjadi kesalahan saat import', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Helpers UI ─────────────────────────────────────────────────────────────
  const statusBadge = (status: ImportRowParsed['status']) => {
    const cfg: Record<string, { bg: string; color: string; border: string; label: string }> = {
      ok:        { bg: '#e0f5e0', color: '#1a6a1a', border: '#88cc88', label: 'BARU' },
      update:    { bg: '#fff8e0', color: '#8a5000', border: '#e8c060', label: 'UPDATE' },
      duplicate: { bg: '#fff0f0', color: '#aa1a1a', border: '#e09090', label: 'DUPLIKAT' },
      error:     { bg: '#ffe8e8', color: '#cc1a1a', border: '#cc8080', label: 'ERROR' },
    };
    const c = cfg[status] || cfg.error;
    return (
      <span style={{ display:'inline-block', padding:'1px 5px', borderRadius:2, fontSize:9, fontWeight:700,
        background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
        {c.label}
      </span>
    );
  };

  const importableCount = parsedRows.filter(r =>
    r.status === 'ok' || (r.status === 'update' && importMode === 'overwrite')
  ).length;

  return (
    <ModalPortal>
      <div style={a.overlay}>
        <div style={a.modalWinLg}>
          {/* Title */}
          <div style={a.modalTitle}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Upload size={15} />
              <span>Bulk Import Katalog Barang</span>
              {step === 'preview' && (
                <span style={{ fontSize:10, background:'rgba(255,255,255,0.2)', padding:'1px 8px', borderRadius:10, marginLeft:4 }}>
                  {parsedRows.length} baris ditemukan
                </span>
              )}
            </div>
            <button style={a.modalClose} onClick={onClose}>✕</button>
          </div>

          <div style={a.modalBody}>
            {/* STEP: Upload */}
            {step === 'upload' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {/* Instruksi singkat */}
                <div style={{ background:'#eef5ff', border:'1px solid #b8d0f0', borderRadius:3, padding:'10px 14px', fontSize:11 }}>
                  <div style={{ fontWeight:700, color:'#1a3a6e', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                    <AlertCircle size={13} color="#2a68cc" />
                    Cara Penggunaan
                  </div>
                  <ol style={{ margin:0, paddingLeft:16, color:'#2a4a6a', lineHeight:'20px' }}>
                    <li>Download template Excel terlebih dahulu (klik tombol di bawah)</li>
                    <li>Isi data barang sesuai format di sheet <strong>Katalog Barang</strong></li>
                    <li>Kolom wajib: <strong>Kode SKU</strong>, <strong>Nama Barang</strong>, <strong>Satuan Dasar</strong></li>
                    <li>Kolom konversi multi-unit: isi Nama Unit, Operator (* atau /), dan Rasio</li>
                    <li>Lihat sheet <strong>Panduan Konversi</strong> untuk referensi rasio</li>
                    <li>Upload file yang sudah diisi untuk preview sebelum disimpan</li>
                  </ol>
                </div>

                {/* Download template */}
                <div style={{ display:'flex', justifyContent:'center' }}>
                  <button
                    onClick={handleDownloadTemplate}
                    style={{ ...a.tbBtn, ...a.tbBtnGreen, padding:'7px 20px', fontSize:12 }}
                  >
                    <FileDown size={15} /> Download Template Excel
                  </button>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? '#2a68cc' : '#b8c8d8'}`,
                    borderRadius: 6,
                    padding: '36px 24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: isDragging ? '#eaf3ff' : '#f8fbff',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  }}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={32} color="#2a68cc" style={{ animation:'spin 1s linear infinite' }} />
                      <span style={{ fontSize:12, color:'#2a68cc', fontWeight:600 }}>Membaca file...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={36} color={isDragging ? '#2a68cc' : '#b0b8c8'} />
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color: isDragging ? '#2a68cc' : '#5a6a7a' }}>
                          {isDragging ? 'Lepaskan file di sini' : 'Drag & drop file Excel, atau klik untuk pilih'}
                        </div>
                        <div style={{ fontSize:10, color:'#aaa', marginTop:4 }}>
                          Format didukung: .xlsx, .xls
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* STEP: Preview */}
            {step === 'preview' && (
              <div style={{ display:'flex', flexDirection:'column', gap:10, minHeight:0, flex:1 }}>
                {/* Summary bar */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
                  {[
                    { label:'Baru', count: okRows.length,   bg:'#e0f5e0', color:'#1a6a1a', border:'#88cc88', icon: <CheckCircle2 size={16} color="#1a8a1a" /> },
                    { label:'Akan Update', count: updateRows.length, bg:'#fff8e0', color:'#8a5000', border:'#e8c060', icon: <Edit3 size={16} color="#a06000" /> },
                    { label:'Error', count: errRows.length, bg:'#ffe8e8', color:'#cc1a1a', border:'#cc8080', icon: <XCircle size={16} color="#cc1a1a" /> },
                    { label:'Total Baris', count: parsedRows.length, bg:'#eef3f8', color:'#1a3a6a', border:'#b8c8d8', icon: <Database size={16} color="#2a5a9a" /> },
                  ].map(({ label, count, bg, color, border, icon }) => (
                    <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius:4, padding:'8px 12px', display:'flex', alignItems:'center', gap:8 }}>
                      {icon}
                      <div>
                        <div style={{ fontSize:18, fontWeight:700, color, fontFamily:"'Courier New',monospace" }}>{count}</div>
                        <div style={{ fontSize:9, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mode pilihan untuk duplikat */}
                {updateRows.length > 0 && (
                  <div style={{ background:'#fffbe8', border:'1px solid #e8d080', borderRadius:3, padding:'8px 12px', display:'flex', alignItems:'center', gap:12, fontSize:11 }}>
                    <AlertTriangle size={14} color="#c08000" style={{ flexShrink:0 }} />
                    <span style={{ color:'#8a5000', fontWeight:600 }}>
                      {updateRows.length} SKU sudah ada. Pilih tindakan:
                    </span>
                    <label style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', fontWeight:600, color: importMode === 'skip' ? '#1a5090' : '#888' }}>
                      <input type="radio" name="importMode" value="skip" checked={importMode === 'skip'}
                        onChange={() => setImportMode('skip')} />
                      Lewati (Skip)
                    </label>
                    <label style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', fontWeight:600, color: importMode === 'overwrite' ? '#1a5090' : '#888' }}>
                      <input type="radio" name="importMode" value="overwrite" checked={importMode === 'overwrite'}
                        onChange={() => setImportMode('overwrite')} />
                      Timpa (Overwrite)
                    </label>
                  </div>
                )}

                {/* Tabel preview */}
                <div style={{ flex:1, overflow:'auto', border:'1px solid #c8d0d8', borderRadius:3 }}>
                  <table style={{ ...a.table, tableLayout:'auto' }}>
                    <thead>
                      <tr style={{ height:26 }}>
                        <th style={{ ...a.th, ...a.thCenter, width:40 }}>Baris</th>
                        <th style={{ ...a.th, ...a.thCenter, width:70 }}>Status</th>
                        <th style={{ ...a.th, width:120 }}>Kode SKU</th>
                        <th style={a.th}>Nama Barang</th>
                        <th style={{ ...a.th, ...a.thCenter, width:80 }}>Unit Dasar</th>
                        <th style={{ ...a.th, ...a.thCenter, width:70 }}>Status Item</th>
                        <th style={a.th}>Konversi Multi-Unit</th>
                        <th style={{ ...a.th, width:180 }}>Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, idx) => (
                        <tr
                          key={row.rowNum}
                          style={{
                            ...(idx % 2 === 0 ? a.trOdd : a.trEven),
                            opacity: row.status === 'error' ? 0.7 : 1,
                          }}
                        >
                          <td style={{ ...a.tdBase, ...a.tdCenter, fontFamily:"'Courier New',monospace", fontSize:10, color:'#888' }}>
                            {row.rowNum}
                          </td>
                          <td style={{ ...a.tdBase, ...a.tdCenter }}>
                            {statusBadge(row.status)}
                          </td>
                          <td style={{ ...a.tdBase, fontFamily:"'Courier New',monospace", fontSize:10, fontWeight:700, color:'#1a4080' }}>
                            {row.code || <span style={{ color:'#cc0000', fontStyle:'italic' }}>kosong</span>}
                          </td>
                          <td style={{ ...a.tdBase, fontWeight:600, whiteSpace:'normal' as const }}>
                            {row.name || <span style={{ color:'#cc0000', fontStyle:'italic' }}>kosong</span>}
                          </td>
                          <td style={{ ...a.tdBase, ...a.tdCenter, fontWeight:700, color:'#5a7090', textTransform:'uppercase', fontSize:10 }}>
                            {row.baseUnit}
                          </td>
                          <td style={{ ...a.tdBase, ...a.tdCenter }}>
                            <span style={row.isActive ? a.badgeAktif : a.badgeNonaktif}>
                              {row.isActive ? 'AKTIF' : 'NONAKTIF'}
                            </span>
                          </td>
                          <td style={{ ...a.tdBase, fontSize:10, color:'#555', whiteSpace:'normal' as const }}>
                            {row.conversions.length === 0 ? (
                              <span style={{ color:'#bbb', fontStyle:'italic' }}>—</span>
                            ) : (
                              <div style={{ display:'flex', flexWrap:'wrap' as const, gap:3 }}>
                                {row.conversions.map((c, i) => (
                                  <span key={i} style={{
                                    background:'#eef3f8', border:'1px solid #b8c8d8', borderRadius:2,
                                    padding:'1px 5px', fontSize:9, fontFamily:"'Courier New',monospace",
                                    color:'#1a3a6a', fontWeight:700
                                  }}>
                                    {c.name} {c.operator} {c.ratio} {row.baseUnit}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ ...a.tdBase, fontSize:10 }}>
                            {row.status === 'error' && (
                              <span style={{ color:'#cc1a1a', display:'flex', alignItems:'center', gap:3 }}>
                                <XCircle size={10} /> {row.errorMsg}
                              </span>
                            )}
                            {row.status === 'update' && (
                              <span style={{ color:'#8a5000' }}>
                                SKU ada → {importMode === 'overwrite' ? 'akan ditimpa' : 'akan dilewati'}
                              </span>
                            )}
                            {row.status === 'ok' && (
                              <span style={{ color:'#1a6a1a' }}>Siap disimpan</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* STEP: Done */}
            {step === 'done' && importResult && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'24px 0' }}>
                <CheckCircle2 size={48} color="#1a8a1a" />
                <div style={{ fontSize:15, fontWeight:700, color:'#1a3060' }}>Import Selesai!</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, width:'100%', maxWidth:480 }}>
                  {[
                    { label: 'Ditambahkan', value: importResult.added,   color: '#1a6a1a', bg: '#e0f5e0', border: '#88cc88' },
                    { label: 'Diupdate',    value: importResult.updated,  color: '#8a5000', bg: '#fff8e0', border: '#e8c060' },
                    { label: 'Dilewati',    value: importResult.skipped,  color: '#555',    bg: '#f0f0f0', border: '#ccc' },
                    { label: 'Error',       value: importResult.errors,   color: '#cc1a1a', bg: '#ffe8e8', border: '#cc8080' },
                  ].map(({ label, value, color, bg, border }) => (
                    <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius:4, padding:'10px 8px', textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:700, color, fontFamily:"'Courier New',monospace" }}>{value}</div>
                      <div style={{ fontSize:9, fontWeight:700, color, textTransform:'uppercase' }}>{label}</div>
                    </div>
                  ))}
                </div>
                {importResult.errors > 0 && (
                  <div style={{ fontSize:11, color:'#888', fontStyle:'italic' }}>
                    Beberapa baris gagal diimpor. Periksa kembali file dan ulangi untuk baris yang error.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={a.modalFooter}>
            {step === 'upload' && (
              <button style={a.modalBtnCancel} onClick={onClose}>Tutup</button>
            )}
            {step === 'preview' && (
              <>
                <button style={a.modalBtnCancel} onClick={() => { setStep('upload'); setParsedRows([]); }}>
                  ← Kembali
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={isProcessing || importableCount === 0}
                  style={{
                    ...a.modalBtnOk,
                    opacity: (isProcessing || importableCount === 0) ? 0.5 : 1,
                    cursor: (isProcessing || importableCount === 0) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isProcessing ? (
                    <><Loader2 size={13} style={{ animation:'spin 1s linear infinite' }} /> Menyimpan...</>
                  ) : (
                    <><Save size={13} /> Import {importableCount} Barang</>
                  )}
                </button>
              </>
            )}
            {step === 'done' && (
              <button style={a.modalBtnOk} onClick={onClose}>
                <CheckCircle2 size={13} /> Selesai
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
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

  // ── State Bulk Import ──────────────────────────────────────────────────────
  const [showBulkImport, setShowBulkImport] = useState(false);

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
    { id: 'NEW',          label: 'Input Reject',  icon: Plus },
    { id: 'HISTORY',      label: 'Riwayat',        icon: History },
    { id: 'MASTER_ITEMS', label: 'Katalog Barang', icon: Database },
    { id: 'MASTER',       label: 'Master Outlet',  icon: MapPin },
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

          {/* Tombol Bulk Import — hanya di MASTER_ITEMS */}
          {activeTab === 'MASTER_ITEMS' && (
            <button
              onClick={() => setShowBulkImport(true)}
              style={{ ...a.tbBtn, ...a.tbBtnAmber }}
            >
              <Upload size={13} /> Import Excel
            </button>
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
              @keyframes spin {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
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
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:10, color:'#888' }}>{filteredMasterItems.length} barang</span>
                <button
                  onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', baseUnit: 'Pcs', conversions: [] }); setShowItemModal(true); }}
                  style={{ ...a.tbBtn, ...a.tbBtnPrimary }}
                >
                  <Plus size={13} /> Barang Baru
                </button>
              </div>
            </div>

            <div style={a.tableWrap}>
              <table style={a.table}>
                <thead>
                  <tr style={{ height:28 }}>
                    <th style={{ ...a.th, width:130 }}>Kode SKU</th>
                    <th style={a.th}>Nama Produk</th>
                    <th style={{ ...a.th, ...a.thCenter, width:80 }}>Unit</th>
                    <th style={{ ...a.th, width:200 }}>Multi-Unit (Konversi)</th>
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
                      <td style={{ ...a.tdBase, fontSize:10 }}>
                        {item.conversions?.length ? (
                          <div style={{ display:'flex', flexWrap:'wrap' as const, gap:3 }}>
                            {item.conversions.map((c, ci) => (
                              <span key={ci} style={{
                                background:'#eef3f8', border:'1px solid #b8c8d8', borderRadius:2,
                                padding:'1px 5px', fontSize:9, fontFamily:"'Courier New',monospace",
                                color:'#1a3a6a', fontWeight:700, whiteSpace:'nowrap' as const
                              }}>
                                {c.name} {c.operator} {c.ratio} {item.baseUnit}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color:'#ccc', fontStyle:'italic' }}>—</span>
                        )}
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
                          <Database size={28} color="#ccc" />
                          <span style={{ fontSize:11, color:'#aaa' }}>
                            {masterSearch ? 'Tidak ada barang ditemukan' : 'Belum ada katalog barang. Tambah manual atau import Excel.'}
                          </span>
                          {!masterSearch && (
                            <button
                              onClick={() => setShowBulkImport(true)}
                              style={{ ...a.tbBtn, ...a.tbBtnAmber, marginTop:4 }}
                            >
                              <Upload size={12} /> Import dari Excel
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
                    {(itemForm.conversions || []).length === 0 && (
                      <div style={{ fontSize:10, color:'#aaa', fontStyle:'italic', textAlign:'center', padding:'8px 0' }}>
                        Belum ada konversi unit. Klik "+ Tambah Unit" untuk menambahkan.
                      </div>
                    )}
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

      {/* ── MODAL: BULK IMPORT ───────────────────────────────────────────────── */}
      {showBulkImport && (
        <BulkImportModal
          existingItems={rejectMasterItems}
          onClose={() => setShowBulkImport(false)}
          onImportDone={() => { loadData(); }}
          showToast={showToast}
        />
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
