
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Warehouse, Partner, AppUser } from '../types';
import { Plus, Edit3, Trash2, Search, Building2, UserCircle, Save, X, Phone, Loader2, Share2, FileSpreadsheet, Calendar, Link as LinkIcon, Code, Copy, Check, Users, ToggleLeft, ToggleRight, Lock, MapPin, Mail, Key } from 'lucide-react';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';

type SettingsTab = 'WAREHOUSE' | 'SUPPLIER' | 'CUSTOMER' | 'USERS' | 'EXTERNAL_SYNC';

/* ─── Accurate-5 inline styles ─────────────────────────────────────────────── */
const acc: Record<string, React.CSSProperties> = {
    shell:          { display:'flex', flexDirection:'column', height:'100%', fontFamily:"'Tahoma','Segoe UI',sans-serif", fontSize:12, background:'#dce4ed' },
    /* toolbar strip */
    toolbar:        { display:'flex', alignItems:'center', gap:2, padding:'3px 6px', background:'linear-gradient(180deg,#f5f5f5 0%,#e2e2e2 100%)', borderBottom:'1px solid #b0b0b0', flexShrink:0, height:34 },
    tbBtn:          { display:'flex', alignItems:'center', gap:4, padding:'3px 10px', fontSize:11, fontFamily:"'Tahoma',sans-serif", cursor:'pointer', border:'1px solid transparent', borderRadius:2, background:'transparent', color:'#1a1a1a' },
    tbBtnPrimary:   { background:'linear-gradient(180deg,#4a8de8 0%,#2a68cc 100%)', borderColor:'#1a56aa', color:'white' },
    tbSep:          { width:1, height:20, background:'#c0c0c0', margin:'0 4px', flexShrink:0 },
    searchWrap:     { display:'flex', alignItems:'center', gap:5, background:'white', border:'1px solid #9aa0a6', borderRadius:2, padding:'2px 7px', marginLeft:'auto' },
    searchInput:    { border:'none', outline:'none', fontSize:11, fontFamily:"'Tahoma',sans-serif", width:180, color:'#333' },
    /* tab bar */
    tabBar:         { display:'flex', alignItems:'flex-end', background:'#dce4ed', borderBottom:'2px solid #1e3a6e', padding:'0 8px', gap:2, flexShrink:0 },
    tab:            { padding:'5px 14px 4px', fontSize:11, fontFamily:"'Tahoma',sans-serif", cursor:'pointer', border:'1px solid transparent', borderBottom:'none', borderRadius:'3px 3px 0 0', background:'#bfcfe0', color:'#3a4a5a', marginBottom:-2, display:'flex', alignItems:'center', gap:5 },
    tabActive:      { background:'white', color:'#1e3a6e', borderColor:'#1e3a6e', fontWeight:700, zIndex:1, position:'relative' as const },
    tabBadge:       { background:'#1e3a6e', color:'white', borderRadius:8, padding:'0 5px', fontSize:9, fontWeight:'bold', lineHeight:'14px' },
    tabBadgeActive: { background:'#dce8ff', color:'#1e3a6e' },
    /* sidebar */
    sidebar:        { width:192, background:'#eaf0f7', borderRight:'1px solid #b8c8d8', display:'flex', flexDirection:'column', padding:'8px 6px', flexShrink:0 },
    sideSection:    { fontSize:9, fontWeight:700, color:'#7a90a8', letterSpacing:'0.08em', textTransform:'uppercase' as const, padding:'6px 8px 4px' },
    sideBtn:        { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 8px', fontSize:11, fontFamily:"'Tahoma',sans-serif", cursor:'pointer', border:'1px solid transparent', borderRadius:2, background:'transparent', color:'#3a5070', width:'100%', textAlign:'left' as const, marginBottom:1 },
    sideBtnActive:  { background:'white', borderColor:'#a8c0d8', color:'#1e3a6e', fontWeight:700 },
    sideBadge:      { fontSize:9, fontWeight:'bold', padding:'1px 5px', borderRadius:8, background:'#d0dcea', color:'#5a7090' },
    sideBadgeActive:{ background:'#1e3a6e', color:'white' },
    /* main content */
    mainWrap:       { flex:1, display:'flex', overflow:'hidden', background:'white', border:'1px solid #b0b0b0', margin:'0 4px 4px 0', borderTop:'none' },
    contentArea:    { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
    /* table */
    tableWrap:      { flex:1, overflow:'auto' },
    table:          { width:'100%', borderCollapse:'collapse' as const },
    th:             { background:'linear-gradient(180deg,#dce8f8 0%,#c6d8ed 100%)', border:'1px solid #a8b8cc', padding:'4px 8px', fontSize:11, fontWeight:700, color:'#1a3060', position:'sticky' as const, top:0, zIndex:2, whiteSpace:'nowrap' as const, textAlign:'left' as const },
    thCenter:       { textAlign:'center' as const },
    tdBase:         { border:'1px solid #d0d8e2', padding:'3px 8px', fontSize:11, color:'#1a1a1a', whiteSpace:'nowrap' as const },
    tdCenter:       { textAlign:'center' as const },
    tdMono:         { fontFamily:"'Courier New',monospace", fontSize:10 },
    trOdd:          { background:'white' },
    trEven:         { background:'#f0f5fb' },
    trHover:        { background:'#cce0ff' },
    trInactive:     { opacity:0.65 },
    badgeAktif:     { display:'inline-block', padding:'1px 8px', borderRadius:2, fontSize:10, fontWeight:700, background:'#e0f5e0', color:'#1a6a1a', border:'1px solid #88cc88' },
    badgeNonaktif:  { display:'inline-block', padding:'1px 8px', borderRadius:2, fontSize:10, fontWeight:700, background:'#f8f2e0', color:'#887020', border:'1px solid #ccaa44' },
    actionBtn:      { padding:'1px 7px', fontSize:10, cursor:'pointer', border:'1px solid #a0b4c4', borderRadius:2, background:'linear-gradient(180deg,#f8fbff 0%,#e6f0f8 100%)', color:'#1a4080', fontFamily:"'Tahoma',sans-serif", marginRight:2, display:'inline-flex', alignItems:'center', gap:3 },
    actionBtnDel:   { color:'#cc2200', borderColor:'#c09090', background:'linear-gradient(180deg,#fff8f8 0%,#f0e8e8 100%)' },
    /* status bar */
    statusBar:      { display:'flex', alignItems:'center', gap:10, padding:'2px 10px', background:'linear-gradient(180deg,#e5e5e5 0%,#d5d5d5 100%)', borderTop:'1px solid #b0b0b0', height:20, flexShrink:0, fontSize:10, color:'#444' },
    statusPanel:    { border:'1px solid #b8b8b8', padding:'0 8px', background:'white', borderRadius:1, lineHeight:'16px' },
    /* modal */
    overlay:        { position:'fixed' as const, inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 },
    modalWin:       { background:'#f0f0f0', border:'2px solid #1e3a6e', borderRadius:4, width:380, boxShadow:'4px 4px 20px rgba(0,0,0,0.4)' },
    modalTitle:     { background:'linear-gradient(180deg,#2a52a0 0%,#1e3a6e 100%)', color:'white', padding:'6px 12px', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:'2px 2px 0 0' },
    modalClose:     { width:18, height:18, borderRadius:2, background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.4)', color:'white', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' },
    modalBody:      { padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 },
    fieldGroup:     { display:'flex', flexDirection:'column', gap:3 },
    fieldLabel:     { fontSize:11, fontWeight:700, color:'#1a1a1a' },
    fieldInput:     { border:'1px solid #8090a0', borderRadius:2, padding:'4px 6px', fontSize:12, fontFamily:"'Tahoma',sans-serif", color:'#1a1a1a', background:'white', outline:'none' },
    modalFooter:    { padding:'8px 16px', borderTop:'1px solid #c0c0c0', display:'flex', justifyContent:'flex-end', gap:6, background:'#e8e8e8', borderRadius:'0 0 2px 2px' },
    modalBtnOk:     { padding:'4px 18px', fontSize:11, fontWeight:700, borderRadius:3, cursor:'pointer', fontFamily:"'Tahoma',sans-serif", border:'1px solid #1a56aa', background:'linear-gradient(180deg,#4a8de8 0%,#2a68cc 100%)', color:'white' },
    modalBtnCancel: { padding:'4px 14px', fontSize:11, fontWeight:700, borderRadius:3, cursor:'pointer', fontFamily:"'Tahoma',sans-serif", border:'1px solid #a0a0a0', background:'linear-gradient(180deg,#f8f8f8 0%,#e0e0e0 100%)', color:'#333' },
    toggleRow:      { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 0' },
    /* sync page */
    syncPage:       { flex:1, overflow:'auto', padding:16, display:'flex', flexDirection:'column', gap:12 },
    sectionBox:     { border:'1px solid #a8b8cc', borderRadius:3, background:'white' },
    sectionHeader:  { background:'linear-gradient(180deg,#dce8f8 0%,#c6d8ed 100%)', borderBottom:'1px solid #a8b8cc', padding:'5px 10px', fontSize:11, fontWeight:700, color:'#1a3060', borderRadius:'2px 2px 0 0' },
    sectionBody:    { padding:12, display:'flex', flexDirection:'column', gap:10 },
    formRow:        { display:'flex', gap:8, alignItems:'flex-end' },
    syncBtn:        { padding:'5px 18px', fontSize:11, fontWeight:700, borderRadius:3, cursor:'pointer', border:'1px solid #1a56aa', fontFamily:"'Tahoma',sans-serif", background:'linear-gradient(180deg,#4a8de8 0%,#2a68cc 100%)', color:'white', display:'flex', alignItems:'center', gap:5, alignSelf:'flex-end' as const, flexShrink:0 },
    codeBox:        { background:'#1a1a2e', borderTop:'1px solid #a8b8cc' },
    codeHeader:     { background:'#252540', borderBottom:'1px solid #3a3a5a', padding:'5px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' },
    copyBtn:        { padding:'2px 10px', fontSize:10, fontWeight:700, border:'1px solid #4a4a6a', borderRadius:2, background:'#3a3a5a', color:'#aaa', cursor:'pointer', fontFamily:"'Tahoma',sans-serif", display:'flex', alignItems:'center', gap:4 },
    codePre:        { padding:'10px 12px', fontFamily:"'Courier New',monospace", fontSize:10, color:'#00cc88', lineHeight:1.6, maxHeight:320, overflow:'auto', margin:0 },
    emptyState:     { padding:40, textAlign:'center' as const, color:'#999', fontSize:11 },
    loadState:      { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#888', gap:6 },
};

export const SettingsView: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<SettingsTab>('WAREHOUSE');
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editData, setEditData] = useState<any>(null);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const [scriptUrl, setScriptUrl] = useState('');
    const [syncStart, setSyncStart] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [syncEnd, setSyncEnd] = useState(new Date().toISOString().split('T')[0]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [copied, setCopied] = useState(false);

    const GS_CODE_BOILERPLATE = `/**
 * GudangPro - Smart Sync v7.0
 * Mode: UPSERT — tambah baris baru, update baris yang sudah ada (by Ref No).
 * Data lama di luar kiriman TIDAK dihapus.
 */
function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    if (contents.action === 'SYNC_V2') {
      var results = [];
      if (contents.transactions) {
        // Key = "Ref No" → kolom index 1
        results.push(upsertSheetData("Mutasi GudangPro", contents.transactions,
          ["Tanggal","Ref No","Tipe","Gudang","Partner","Kode","Nama","Qty","Satuan","Keterangan"],
          1));
      }
      if (contents.rejects) {
        // Key = "ID Aggregasi" → kolom index 1
        results.push(upsertSheetData("Laporan Reject", contents.rejects,
          ["Tanggal","ID Aggregasi","SKU","Nama Barang","Total Base Qty","Base Unit","Alasan"],
          1));
      }
      return ContentService.createTextOutput(JSON.stringify({status:"success",details:results}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Invalid action"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status:"error",message:err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Upsert rows ke sheet berdasarkan kolom kunci (keyColIndex, 0-based).
 * - Jika key sudah ada di sheet  → UPDATE baris tersebut.
 * - Jika key belum ada           → APPEND baris baru di bawah.
 * - Baris lama yang tidak ada di newRows → DIBIARKAN (tidak dihapus).
 */
function upsertSheetData(sheetName, newRows, headers, keyColIndex) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) { sheet = ss.insertSheet(sheetName); formatHeader(sheet, headers); }

  // Baca semua nilai kunci yang sudah ada → Map {key: rowNumber (1-based)}
  var keyToRow = {};
  var lastRow  = sheet.getLastRow();
  if (lastRow > 1) {
    var existingKeys = sheet.getRange(2, keyColIndex + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < existingKeys.length; i++) {
      var k = String(existingKeys[i][0]).trim();
      if (k) keyToRow[k] = i + 2; // baris ke-N (1-based, baris 1 = header)
    }
  }

  var updated = 0, inserted = 0;
  for (var r = 0; r < newRows.length; r++) {
    var rowKey    = String(newRows[r][keyColIndex]).trim();
    var targetRow;

    if (keyToRow[rowKey]) {
      // ── UPDATE baris yang sudah ada ──
      targetRow = keyToRow[rowKey];
      sheet.getRange(targetRow, 1, 1, newRows[r].length).setValues([newRows[r]]);
      updated++;
    } else {
      // ── INSERT baris baru ──
      targetRow = sheet.getLastRow() + 1;
      sheet.getRange(targetRow, 1, 1, newRows[r].length).setValues([newRows[r]]);
      keyToRow[rowKey] = targetRow; // update map supaya key berikutnya tahu
      inserted++;
    }

    // Format tanggal & warna zebra
    sheet.getRange(targetRow, 1, 1, 1).setNumberFormat("DD/MM/YYYY");
    var bg = (targetRow % 2 === 0) ? "#f8fafb" : "#ffffff";
    sheet.getRange(targetRow, 1, 1, newRows[r].length).setBackground(bg);
  }

  return sheetName + ": " + updated + " diperbarui, " + inserted + " baris baru";
}

function formatHeader(sheet, headers) {
  sheet.appendRow(headers);
  sheet.getRange(1,1,1,headers.length)
    .setBackground("#1e3a5f").setFontColor("#ffffff")
    .setFontWeight("bold").setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function formatDateValue(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.getFullYear()+"-"+String(val.getMonth()+1).padStart(2,"0")+"-"+String(val.getDate()).padStart(2,"0");
  }
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { var p=s.split('/'); return p[2]+'-'+p[1]+'-'+p[0]; }
  return null;
}`;

    const refreshData = async () => {
        setIsLoading(true);
        try {
            const [whs, pts, usrs] = await Promise.all([
                StorageService.fetchWarehouses().catch(() => []),
                StorageService.fetchPartners().catch(() => []),
                StorageService.fetchUsers().catch(() => [])
            ]);
            const mappedUsers = (Array.isArray(usrs) ? usrs : []).map((u: any) => ({
                ...u, isActive: u.status === 'ACTIVE'
            }));
            setWarehouses(Array.isArray(whs) ? whs : []);
            setPartners(Array.isArray(pts) ? pts : []);
            setUsers(mappedUsers);
        } catch (e) {
            console.error("Fetch Settings Error", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'EXTERNAL_SYNC') {
            StorageService.fetchSystemConfig('gsheet_url').then(url => setScriptUrl(url));
        }
    }, [activeTab]);

    useEffect(() => { refreshData(); }, []);

    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            if (activeTab === 'WAREHOUSE') await StorageService.deleteWarehouse(itemToDelete);
            else if (activeTab === 'USERS') await StorageService.deleteUser(itemToDelete);
            else await StorageService.deletePartner(itemToDelete);
            showToast("Berhasil dihapus dari server", "success");
            refreshData();
        } catch (e) { showToast("Gagal menghapus data", "error"); }
        finally { setItemToDelete(null); }
    };

    const handleSave = async (data: any) => {
        try {
            const payload = { ...data, id: data.id || crypto.randomUUID() };
            if (activeTab === 'USERS') {
                payload.status = data.isActive ? 'ACTIVE' : 'INACTIVE';
                await StorageService.saveUser(payload);
            } 
            else if (activeTab === 'WAREHOUSE') {
                payload.isActive = data.isActive === undefined ? true : data.isActive;
                await StorageService.saveWarehouse(payload);
            }
            else {
                payload.isActive = data.isActive === undefined ? true : data.isActive;
                await StorageService.savePartner({ ...payload, type: activeTab as any });
            }
            showToast("Tersimpan ke MySQL Database", "success");
            setShowModal(false); refreshData();
        } catch (e) { showToast("Gagal menyimpan ke server", "error"); }
    };

    const handleSaveScriptUrl = async () => {
        if (!scriptUrl.trim()) return;
        try {
            await StorageService.saveSystemConfig('gsheet_url', scriptUrl.trim());
            showToast("URL Google Script disimpan ke Database", "success");
        } catch (e) { showToast("Gagal menyimpan URL", "error"); }
    };

    const handleStartSync = async () => {
        if (!scriptUrl) return showToast("Masukkan Script URL terlebih dahulu", "warning");
        setIsSyncing(true);
        try {
            await StorageService.saveSystemConfig('gsheet_url', scriptUrl.trim());
            const result = await StorageService.syncToGoogleSheets(scriptUrl, syncStart, syncEnd);
            if (result?.status === 'no_change') {
                showToast("ℹ Tidak ada perubahan data — sync dibatalkan", "warning");
            } else {
                const details = Array.isArray(result?.details) ? result.details.join(' · ') : 'Selesai';
                showToast(`✓ Sync v7.0 Selesai — ${details}`, "success");
            }
        } catch (e) {
            showToast("Gagal Sync. Pastikan Script v7.0 sudah di-deploy ulang.", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const filteredData = () => {
        const lower = searchTerm.toLowerCase();
        if (activeTab === 'WAREHOUSE') return warehouses.filter(w => w.name.toLowerCase().includes(lower));
        if (activeTab === 'SUPPLIER') return partners.filter(p => p.type === 'SUPPLIER' && p.name.toLowerCase().includes(lower));
        if (activeTab === 'CUSTOMER') return partners.filter(p => p.type === 'CUSTOMER' && p.name.toLowerCase().includes(lower));
        if (activeTab === 'USERS') return users.filter(u => u.name.toLowerCase().includes(lower));
        return [];
    };

    // ── TAB BAR ITEM ──────────────────────────────────────────────────────────
    const TabBtn = ({ tabKey, icon, label, count }: { tabKey: SettingsTab; icon: React.ReactNode; label: string; count?: number }) => {
        const isActive = activeTab === tabKey;
        return (
            <button
                onClick={() => setActiveTab(tabKey)}
                style={{ ...acc.tab, ...(isActive ? acc.tabActive : {}) }}
            >
                {icon}
                {label}
                {count !== undefined && (
                    <span style={{ ...acc.tabBadge, ...(isActive ? acc.tabBadgeActive : {}) }}>{count}</span>
                )}
            </button>
        );
    };

    // ── SIDEBAR NAV ITEM ──────────────────────────────────────────────────────
    const SideBtn = ({ tabKey, icon, label, count }: { tabKey: SettingsTab; icon: React.ReactNode; label: string; count?: number }) => {
        const isActive = activeTab === tabKey;
        return (
            <button
                onClick={() => setActiveTab(tabKey)}
                style={{ ...acc.sideBtn, ...(isActive ? acc.sideBtnActive : {}) }}
            >
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>{icon}{label}</span>
                {count !== undefined && (
                    <span style={{ ...acc.sideBadge, ...(isActive ? acc.sideBadgeActive : {}) }}>{count}</span>
                )}
            </button>
        );
    };

    return (
        <div style={acc.shell}>

            {/* ── TAB BAR ───────────────────────────────────────────────────── */}
            <div style={acc.tabBar}>
                <TabBtn tabKey="WAREHOUSE"     icon={<Building2 size={12}/>}   label="Gudang"      count={warehouses.length} />
                <TabBtn tabKey="SUPPLIER"      icon={<Users size={12}/>}       label="Supplier"    count={partners.filter(p=>p.type==='SUPPLIER').length} />
                <TabBtn tabKey="CUSTOMER"      icon={<Users size={12}/>}       label="Customer"    count={partners.filter(p=>p.type==='CUSTOMER').length} />
                <TabBtn tabKey="USERS"         icon={<UserCircle size={12}/>}  label="Pengguna"    count={users.length} />
                <TabBtn tabKey="EXTERNAL_SYNC" icon={<Share2 size={12}/>}      label="Google Sync" />
            </div>

            {/* ── TOOLBAR (only for data tabs) ───────────────────────────────── */}
            {activeTab !== 'EXTERNAL_SYNC' && (
                <div style={acc.toolbar}>
                    <button
                        style={{ ...acc.tbBtn, ...acc.tbBtnPrimary }}
                        onClick={() => { setEditData({ isActive: true }); setShowModal(true); }}
                    >
                        <Plus size={13}/> Tambah Baru
                    </button>
                    <div style={acc.tbSep}/>
                    <div style={acc.searchWrap}>
                        <Search size={12} color="#999"/>
                        <input
                            style={acc.searchInput}
                            type="text"
                            placeholder="Cari data..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* ── BODY: sidebar + main ────────────────────────────────────────── */}
            <div style={{ flex:1, display:'flex', overflow:'hidden', margin:'0 4px 4px 4px', background:'white', border:'1px solid #b0b0b0' }}>

                {/* SIDEBAR */}
                <div style={acc.sidebar}>
                    <div style={acc.sideSection}>Data Master</div>
                    <SideBtn tabKey="WAREHOUSE" icon={<Building2 size={14}/>} label="Gudang"   count={warehouses.length} />
                    <SideBtn tabKey="SUPPLIER"  icon={<Users size={14}/>}     label="Supplier" count={partners.filter(p=>p.type==='SUPPLIER').length} />
                    <SideBtn tabKey="CUSTOMER"  icon={<Users size={14}/>}     label="Customer" count={partners.filter(p=>p.type==='CUSTOMER').length} />

                    <div style={{ ...acc.sideSection, marginTop:10 }}>Keamanan</div>
                    <SideBtn tabKey="USERS" icon={<UserCircle size={14}/>} label="Pengguna" count={users.length} />

                    <div style={{ ...acc.sideSection, marginTop:10 }}>Integrasi</div>
                    <SideBtn tabKey="EXTERNAL_SYNC" icon={<Share2 size={14}/>} label="Google Sync" />
                </div>

                {/* MAIN CONTENT */}
                <div style={acc.contentArea}>
                    {activeTab !== 'EXTERNAL_SYNC' ? (
                        /* ── DATA TABLE ─────────────────────────────────────── */
                        <div style={acc.tableWrap}>
                            {isLoading ? (
                                <div style={acc.loadState}>
                                    <Loader2 size={22} style={{ color:'#2a68cc', animation:'spin 1s linear infinite' }}/>
                                    <span style={{ fontSize:11 }}>Memuat data...</span>
                                </div>
                            ) : (
                                <table style={acc.table}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...acc.th, ...acc.thCenter, width:40 }}>No</th>
                                            <th style={acc.th}>Informasi Utama</th>
                                            <th style={acc.th}>Kontak / Detail</th>
                                            <th style={{ ...acc.th, ...acc.thCenter, width:90 }}>Status</th>
                                            <th style={{ ...acc.th, ...acc.thCenter, width:90 }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredData().map((item: any, idx) => (
                                            <tr
                                                key={item.id}
                                                style={idx % 2 === 0 ? acc.trOdd : acc.trEven}
                                                onMouseEnter={e => (e.currentTarget.style.background = '#cce0ff')}
                                                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f0f5fb')}
                                            >
                                                <td style={{ ...acc.tdBase, ...acc.tdCenter, color:'#999', fontFamily:"'Courier New',monospace", fontSize:10 }}>{idx + 1}</td>
                                                <td style={acc.tdBase}>
                                                    <div style={{ fontWeight:600, color: item.isActive ? '#1a1a1a' : '#999' }}>{item.name}</div>
                                                    {(item.location || item.role || item.address) && (
                                                        <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, color:'#888', marginTop:1 }}>
                                                            {activeTab === 'WAREHOUSE' && <MapPin size={9}/>}
                                                            {activeTab === 'USERS' && <Key size={9}/>}
                                                            {item.location || item.role || item.address}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={acc.tdBase}>
                                                    {item.phone && (
                                                        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#555' }}>
                                                            <Phone size={10} color="#999"/> {item.phone}
                                                        </div>
                                                    )}
                                                    {item.username && (
                                                        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'#555', fontFamily:"'Courier New',monospace" }}>
                                                            <span style={{ color:'#bbb' }}>@</span>{item.username}
                                                        </div>
                                                    )}
                                                    {item.email && (
                                                        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#555' }}>
                                                            <Mail size={10} color="#999"/> {item.email}
                                                        </div>
                                                    )}
                                                    {!item.phone && !item.username && !item.email && (
                                                        <span style={{ color:'#ccc', fontSize:10 }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{ ...acc.tdBase, ...acc.tdCenter }}>
                                                    <span style={item.isActive ? acc.badgeAktif : acc.badgeNonaktif}>
                                                        {item.isActive ? 'Aktif' : 'Nonaktif'}
                                                    </span>
                                                </td>
                                                <td style={{ ...acc.tdBase, ...acc.tdCenter }}>
                                                    <button
                                                        style={acc.actionBtn}
                                                        onClick={() => { setEditData(item); setShowModal(true); }}
                                                    >
                                                        <Edit3 size={11}/> Edit
                                                    </button>
                                                    <button
                                                        style={{ ...acc.actionBtn, ...acc.actionBtnDel }}
                                                        onClick={() => setItemToDelete(item.id)}
                                                    >
                                                        <Trash2 size={11}/> Hapus
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredData().length === 0 && !isLoading && (
                                            <tr>
                                                <td colSpan={5} style={acc.emptyState}>
                                                    Tidak ada data. Klik <b>Tambah Baru</b> untuk menambahkan.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ) : (
                        /* ── GOOGLE SYNC TAB ─────────────────────────────────── */
                        <div style={acc.syncPage}>
                            {/* Config panel */}
                            <div style={acc.sectionBox}>
                                <div style={acc.sectionHeader}>
                                    <FileSpreadsheet size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
                                    Google Sync V7.0 — Smart Upsert Synchronization
                                </div>
                                <div style={acc.sectionBody}>
                                    {/* Script URL */}
                                    <div style={acc.fieldGroup}>
                                        <label style={acc.fieldLabel}>Web App Script URL</label>
                                        <div style={{ display:'flex', gap:6 }}>
                                            <input
                                                type="text"
                                                style={{ ...acc.fieldInput, flex:1, fontFamily:"'Courier New',monospace", fontSize:11 }}
                                                value={scriptUrl}
                                                onChange={e => setScriptUrl(e.target.value)}
                                                placeholder="https://script.google.com/macros/s/..."
                                            />
                                            <button onClick={handleSaveScriptUrl} style={{ ...acc.syncBtn, padding:'4px 12px' }}>
                                                <Save size={12}/> Simpan
                                            </button>
                                        </div>
                                    </div>
                                    {/* Date range + sync button */}
                                    <div style={acc.formRow}>
                                        <div style={acc.fieldGroup}>
                                            <label style={acc.fieldLabel}>Periode Awal</label>
                                            <input type="date" style={acc.fieldInput} value={syncStart} onChange={e => setSyncStart(e.target.value)} />
                                        </div>
                                        <div style={acc.fieldGroup}>
                                            <label style={acc.fieldLabel}>Periode Akhir</label>
                                            <input type="date" style={acc.fieldInput} value={syncEnd} onChange={e => setSyncEnd(e.target.value)} />
                                        </div>
                                        <button onClick={handleStartSync} disabled={isSyncing} style={{ ...acc.syncBtn, opacity: isSyncing ? 0.7 : 1 }}>
                                            {isSyncing
                                                ? <><Loader2 size={13} style={{ animation:'spin 1s linear infinite' }}/> Mengirim...</>
                                                : <><Share2 size={13}/> Mulai Sinkronisasi</>
                                            }
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Code viewer */}
                            <div style={acc.sectionBox}>
                                <div style={acc.sectionHeader}>
                                    <Code size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
                                    Apps Script Code (V7.0 — Smart Upsert by Ref No)
                                </div>
                                <div style={acc.codeBox}>
                                    <div style={acc.codeHeader}>
                                        <span style={{ fontSize:10, color:'#888', fontWeight:700, letterSpacing:'0.08em' }}>PASTE KE GOOGLE APPS SCRIPT</span>
                                        <button
                                            style={acc.copyBtn}
                                            onClick={() => { navigator.clipboard.writeText(GS_CODE_BOILERPLATE); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                                        >
                                            {copied ? <><Check size={11} style={{ color:'#00cc88' }}/> Copied!</> : <><Copy size={11}/> Copy Code</>}
                                        </button>
                                    </div>
                                    <pre style={acc.codePre}>{GS_CODE_BOILERPLATE}</pre>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── STATUS BAR ────────────────────────────────────────────────── */}
            <div style={acc.statusBar}>
                <span style={acc.statusPanel}>
                    {activeTab !== 'EXTERNAL_SYNC' ? `${filteredData().length} record` : 'Google Sync'} | {activeTab}
                </span>
                <span style={{ marginLeft:'auto', color:'#888' }}>GudangPro | MySQL Database</span>
            </div>

            {/* ── MODAL ─────────────────────────────────────────────────────── */}
            {showModal && (
                <div style={acc.overlay} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div style={acc.modalWin}>
                        <div style={acc.modalTitle}>
                            <span>
                                {editData.id ? 'Edit' : 'Tambah'}{' '}
                                {activeTab === 'USERS' ? 'Pengguna' : activeTab === 'WAREHOUSE' ? 'Gudang' : 'Partner'}
                            </span>
                            <button style={acc.modalClose} onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSave(editData); }}
                            style={acc.modalBody}
                        >
                            <div style={acc.fieldGroup}>
                                <label style={acc.fieldLabel}>Nama Lengkap / Instansi</label>
                                <input
                                    required
                                    style={acc.fieldInput}
                                    value={editData.name || ''}
                                    onChange={e => setEditData({ ...editData, name: e.target.value })}
                                />
                            </div>

                            {activeTab === 'USERS' && (
                                <>
                                    <div style={acc.fieldGroup}>
                                        <label style={acc.fieldLabel}>Username Login</label>
                                        <input
                                            required
                                            style={{ ...acc.fieldInput, fontFamily:"'Courier New',monospace" }}
                                            value={editData.username || ''}
                                            onChange={e => setEditData({ ...editData, username: e.target.value })}
                                        />
                                    </div>
                                    <div style={acc.fieldGroup}>
                                        <label style={acc.fieldLabel}>Password</label>
                                        <div style={{ position:'relative' }}>
                                            <input
                                                type="password"
                                                placeholder={editData.id ? "Kosongkan jika tetap" : "Password baru"}
                                                style={{ ...acc.fieldInput, width:'100%', paddingLeft:28 }}
                                                value={editData.password || ''}
                                                onChange={e => setEditData({ ...editData, password: e.target.value })}
                                            />
                                            <Lock size={13} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'#999' }}/>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div style={acc.fieldGroup}>
                                <label style={acc.fieldLabel}>{activeTab === 'WAREHOUSE' ? 'Lokasi' : 'No. Telepon'}</label>
                                <input
                                    style={acc.fieldInput}
                                    value={activeTab === 'WAREHOUSE' ? (editData.location || '') : (editData.phone || '')}
                                    onChange={e => setEditData({ ...editData, [activeTab === 'WAREHOUSE' ? 'location' : 'phone']: e.target.value })}
                                />
                            </div>

                            <div style={acc.toggleRow}>
                                <span style={acc.fieldLabel}>Status Aktif</span>
                                <div
                                    onClick={() => setEditData({ ...editData, isActive: !(editData.isActive !== false) })}
                                    style={{ cursor:'pointer', color: editData.isActive !== false ? '#1a8a1a' : '#bbb' }}
                                >
                                    {editData.isActive !== false
                                        ? <ToggleRight size={28}/>
                                        : <ToggleLeft size={28}/>
                                    }
                                </div>
                            </div>

                            <div style={{ display:'flex', justifyContent:'flex-end', gap:6, paddingTop:8, borderTop:'1px solid #d8d8d8', marginTop:4 }}>
                                <button type="button" style={acc.modalBtnCancel} onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" style={acc.modalBtnOk}>Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!itemToDelete}
                title="Konfirmasi Hapus"
                message="Apakah Anda yakin ingin menghapus data ini secara permanen dari Database?"
                onConfirm={handleDelete}
                onCancel={() => setItemToDelete(null)}
            />
        </div>
    );
};
