import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, UnitConversion } from '../types';
import { Search, Trash2, RefreshCw, Plus, Edit3, Eye, Package, X, Save, AlertCircle, Layers, ArrowRight, Settings2, CheckSquare, Square, Minus } from 'lucide-react';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';

// ─── Accurate 5 Design System ────────────────────────────────────────────────
const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return createPortal(children, document.body);
};

interface InventoryViewProps {
    onViewItem?: (item: Item) => void;
}

// ─── Gmail-style Bulk Action Bar ─────────────────────────────────────────────
interface BulkActionBarProps {
    selectedCount: number;
    totalCount: number;
    onDeleteSelected: () => void;
    onClearSelection: () => void;
    visible: boolean;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
    selectedCount, totalCount, onDeleteSelected, onClearSelection, visible
}) => {
    return createPortal(
        <div style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: `translateX(-50%) translateY(${visible ? '0' : '80px'})`,
            opacity: visible ? 1 : 0,
            transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
            zIndex: 99999,
            pointerEvents: visible ? 'auto' : 'none',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                background: '#202124',
                borderRadius: 6,
                boxShadow: '0 4px 24px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.3)',
                overflow: 'hidden',
                fontFamily: "'Tahoma','Segoe UI',sans-serif",
                fontSize: 12,
                minWidth: 380,
            }}>
                {/* Selection info */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '0 16px',
                    height: 48,
                    color: '#e8eaed',
                    borderRight: '1px solid #3c4043',
                }}>
                    <div style={{
                        width: 22, height: 22,
                        background: '#1a5fa8',
                        borderRadius: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 'bold', color: '#fff',
                        flexShrink: 0,
                    }}>
                        {selectedCount}
                    </div>
                    <span style={{ whiteSpace: 'nowrap' }}>
                        barang dipilih
                        <span style={{ color: '#9aa0a6', marginLeft: 6 }}>dari {totalCount}</span>
                    </span>
                </div>

                {/* Delete action */}
                <button
                    onClick={onDeleteSelected}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '0 20px',
                        height: 48,
                        background: 'transparent',
                        border: 'none',
                        color: '#f28b82',
                        fontSize: 12,
                        fontFamily: "'Tahoma','Segoe UI',sans-serif",
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'background 0.15s',
                        borderRight: '1px solid #3c4043',
                        whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#3c2422')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <Trash2 size={14} />
                    Hapus Semua Yang Dipilih
                </button>

                {/* Clear selection */}
                <button
                    onClick={onClearSelection}
                    title="Batalkan pilihan"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48, height: 48,
                        background: 'transparent',
                        border: 'none',
                        color: '#9aa0a6',
                        cursor: 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#3c4043'; e.currentTarget.style.color = '#e8eaed'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9aa0a6'; }}
                >
                    <X size={16} />
                </button>
            </div>
        </div>,
        document.body
    );
};

// ─── Indeterminate Checkbox ───────────────────────────────────────────────────
const TriStateCheckbox: React.FC<{
    checked: boolean;
    indeterminate: boolean;
    onChange: () => void;
    style?: React.CSSProperties;
}> = ({ checked, indeterminate, onChange, style }) => {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate;
    }, [indeterminate]);
    return (
        <input
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#1a5fa8', ...style }}
        />
    );
};

export const InventoryView: React.FC<InventoryViewProps> = ({ onViewItem }) => {
    const { showToast } = useToast();
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

    // ── Bulk selection state ──────────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<Item>>({
        code: '', name: '', category: '', baseUnit: 'PCS', minStock: 0, isActive: true, conversions: []
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedItems, fetchedStocks] = await Promise.all([
                StorageService.fetchItems(),
                StorageService.fetchStocks()
            ]);
            setItems(fetchedItems || []);
            setStocks(fetchedStocks || []);
        } catch (error) {
            showToast("Gagal memuat database.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const inventoryData = useMemo(() => {
        return items.map(item => {
            const itemStocks = stocks.filter(s => s.itemId === item.id);
            return { ...item, totalStock: itemStocks.reduce((acc, s) => acc + Number(s.qty), 0) };
        }).filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.code.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [items, stocks, searchTerm]);

    // ── Bulk selection helpers ────────────────────────────────────────────────
    const visibleIds = useMemo(() => inventoryData.map(i => i.id), [inventoryData]);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
    const someSelected = visibleIds.some(id => selectedIds.has(id)) && !allSelected;
    const selectedCount = [...selectedIds].filter(id => visibleIds.includes(id)).length;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                visibleIds.forEach(id => next.delete(id));
                return next;
            });
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev);
                visibleIds.forEach(id => next.add(id));
                return next;
            });
        }
    };

    const toggleSelectRow = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());

    // ── Bulk delete ───────────────────────────────────────────────────────────
    const handleBulkDelete = async () => {
        const toDelete = [...selectedIds].filter(id => visibleIds.includes(id));
        if (toDelete.length === 0) return;
        setIsBulkDeleting(true);
        try {
            await StorageService.deleteItems(toDelete);
            showToast(`${toDelete.length} barang berhasil dihapus`, "success");
            clearSelection();
            loadData();
        } catch (error: any) {
            showToast(error.message || "Gagal menghapus barang", "error");
        } finally {
            setIsBulkDeleting(false);
            setShowBulkDeleteConfirm(false);
        }
    };

    const handleOpenModal = (item?: Item) => {
        if (item) {
            setEditingId(item.id);
            setFormData({ ...item, conversions: item.conversions ? [...item.conversions] : [] });
        } else {
            setEditingId(null);
            setFormData({ code: '', name: '', category: '', baseUnit: 'PCS', minStock: 0, isActive: true, conversions: [] });
        }
        setIsModalOpen(true);
    };

    const handleAddConversion = () => {
        const currentConversions = formData.conversions || [];
        setFormData({ ...formData, conversions: [...currentConversions, { name: '', ratio: 1, operator: '*' }] });
    };

    const handleRemoveConversion = (index: number) => {
        const currentConversions = formData.conversions || [];
        setFormData({ ...formData, conversions: currentConversions.filter((_, i) => i !== index) });
    };

    const updateConversion = (index: number, field: keyof UnitConversion, value: any) => {
        const currentConversions = [...(formData.conversions || [])];
        (currentConversions[index] as any)[field] = value;
        setFormData({ ...formData, conversions: currentConversions });
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code || !formData.name || !formData.baseUnit) {
            return showToast("Kode, Nama, dan Satuan Dasar wajib diisi", "warning");
        }
        setIsSaving(true);
        try {
            const payload = { ...formData, id: editingId || undefined } as Item;
            await StorageService.saveItem(payload);
            showToast(editingId ? "Data barang diperbarui" : "Barang baru ditambahkan", "success");
            setIsModalOpen(false);
            loadData();
        } catch (error: any) {
            showToast(error.message || "Gagal menyimpan data", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteItem = async () => {
        if (!itemToDelete) return;
        try {
            await StorageService.deleteItems([itemToDelete]);
            showToast("Barang berhasil dihapus", "success");
            loadData();
        } catch (error: any) {
            showToast(error.message || "Gagal menghapus barang", "error");
        } finally {
            setItemToDelete(null);
        }
    };

    // ─── Accurate 5 styles ────────────────────────────────────────────────────
    const acc: Record<string, React.CSSProperties> = {
        root: {
            display: 'flex', flexDirection: 'column', height: '100%',
            fontFamily: "'Tahoma', 'Segoe UI', sans-serif",
            fontSize: 11, background: '#f0f0f0', color: '#1a1a1a',
        },
        titleBar: {
            height: 26,
            background: 'linear-gradient(180deg, #4a90d9 0%, #1a5fa8 100%)',
            display: 'flex', alignItems: 'center', padding: '0 8px',
            color: '#fff', fontWeight: 'bold', fontSize: 11,
            letterSpacing: 0.3, flexShrink: 0,
            borderBottom: '1px solid #0d4a8a',
        },
        toolbar: {
            height: 30, background: '#e8e8e8',
            borderBottom: '1px solid #a0a8b4',
            display: 'flex', alignItems: 'center',
            padding: '0 6px', gap: 2, flexShrink: 0,
        },
        toolBtn: {
            height: 22, padding: '0 8px',
            background: 'linear-gradient(180deg, #f5f5f5 0%, #dcdcdc 100%)',
            border: '1px solid #a0a0a0', borderRadius: 2,
            color: '#1a1a1a', fontSize: 11, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: "'Tahoma','Segoe UI',sans-serif",
            whiteSpace: 'nowrap' as const,
        },
        toolBtnPrimary: {
            height: 22, padding: '0 10px',
            background: 'linear-gradient(180deg, #4a90d9 0%, #1a5fa8 100%)',
            border: '1px solid #0d4a8a', borderRadius: 2,
            color: '#fff', fontSize: 11, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: "'Tahoma','Segoe UI',sans-serif",
            whiteSpace: 'nowrap' as const,
            fontWeight: 'bold',
        },
        toolBtnDanger: {
            height: 22, padding: '0 10px',
            background: 'linear-gradient(180deg, #f88 0%, #c0392b 100%)',
            border: '1px solid #a93226', borderRadius: 2,
            color: '#fff', fontSize: 11, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: "'Tahoma','Segoe UI',sans-serif",
            whiteSpace: 'nowrap' as const,
            fontWeight: 'bold',
        },
        separator: { width: 1, height: 18, background: '#a0a0a0', margin: '0 4px' },
        searchWrap: { display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 },
        searchLabel: { fontSize: 11, color: '#444' },
        searchInput: {
            height: 20, padding: '0 6px',
            border: '1px solid #7a90a8',
            borderRadius: 2, fontSize: 11,
            fontFamily: "'Tahoma','Segoe UI',sans-serif",
            background: '#fff', outline: 'none', width: 200,
        },
        tableWrap: {
            flex: 1, overflow: 'auto',
            background: '#fff',
            borderTop: '1px solid #b0b8c4',
        },
        table: {
            width: '100%', borderCollapse: 'collapse',
            tableLayout: 'fixed' as const,
        },
        th: {
            height: 22, padding: '0 4px',
            background: 'linear-gradient(180deg, #e8edf4 0%, #d4dbe8 100%)',
            borderRight: '1px solid #b0b8c4',
            borderBottom: '2px solid #8aa0bc',
            fontSize: 11, fontWeight: 'bold', color: '#1a3a5c',
            textAlign: 'left' as const,
            position: 'sticky' as const, top: 0, zIndex: 10,
            userSelect: 'none' as const, whiteSpace: 'nowrap',
        },
        thCenter: { textAlign: 'center' as const },
        thRight: { textAlign: 'right' as const },
        tr: { height: 20, cursor: 'default' },
        td: {
            height: 20, padding: '0 4px',
            borderRight: '1px solid #dde3ed',
            borderBottom: '1px solid #e8ecf2',
            fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis',
        },
        tdCenter: { textAlign: 'center' as const },
        tdRight: { textAlign: 'right' as const },
        statusBar: {
            height: 22, background: '#e0e4ec',
            borderTop: '1px solid #a8b4c4',
            display: 'flex', alignItems: 'center',
            padding: '0 8px', gap: 12,
            fontSize: 11, color: '#3a4a5a', flexShrink: 0,
        },
        overlay: {
            position: 'fixed' as const, inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        },
        dialog: {
            background: '#f0f0f0',
            border: '1px solid #7a8898',
            borderRadius: 4, width: 560,
            maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '4px 4px 16px rgba(0,0,0,0.4)',
            fontFamily: "'Tahoma','Segoe UI',sans-serif",
            overflow: 'hidden',
        },
        dialogTitle: {
            height: 28,
            background: 'linear-gradient(180deg, #4a90d9 0%, #1a5fa8 100%)',
            color: '#fff', fontSize: 12, fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 10px', flexShrink: 0,
        },
        dialogCloseBtn: {
            width: 18, height: 18, background: '#d44',
            border: '1px solid #a00', borderRadius: 2,
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 'bold',
        },
        dialogBody: {
            flex: 1, overflowY: 'auto' as const,
            padding: '12px 14px', background: '#f8f8f8',
        },
        dialogFooter: {
            height: 34, background: '#e8e8e8',
            borderTop: '1px solid #b0b0b0',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            padding: '0 10px', gap: 6, flexShrink: 0,
        },
        fieldGroup: { marginBottom: 10 },
        fieldGroupGrid2: {
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px', marginBottom: 10
        },
        label: { display: 'block', fontSize: 11, color: '#333', marginBottom: 2 },
        input: {
            width: '100%', height: 22, padding: '0 5px',
            border: '1px solid #7a90a8', borderRadius: 2,
            fontSize: 11, fontFamily: "'Tahoma','Segoe UI',sans-serif",
            background: '#fff', outline: 'none', boxSizing: 'border-box' as const,
        },
        fieldBorder: {
            border: '1px solid #b0bcc8',
            borderRadius: 3, padding: '8px 10px',
            background: '#fff', marginBottom: 10,
        },
        fieldBorderTitle: {
            fontSize: 11, fontWeight: 'bold', color: '#1a3a5c',
            marginBottom: 6, paddingBottom: 4,
            borderBottom: '1px solid #dde3ed',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        },
        btnPrimary: {
            height: 24, padding: '0 16px',
            background: 'linear-gradient(180deg, #4a90d9 0%, #1a5fa8 100%)',
            border: '1px solid #0d4a8a', borderRadius: 2,
            color: '#fff', fontSize: 11, cursor: 'pointer',
            fontFamily: "'Tahoma','Segoe UI',sans-serif", fontWeight: 'bold',
            display: 'inline-flex', alignItems: 'center', gap: 4,
        },
        btnDefault: {
            height: 24, padding: '0 14px',
            background: 'linear-gradient(180deg, #f5f5f5 0%, #dcdcdc 100%)',
            border: '1px solid #a0a0a0', borderRadius: 2,
            color: '#1a1a1a', fontSize: 11, cursor: 'pointer',
            fontFamily: "'Tahoma','Segoe UI',sans-serif",
            display: 'inline-flex', alignItems: 'center', gap: 4,
        },
        btnSmall: {
            height: 20, padding: '0 8px',
            background: 'linear-gradient(180deg, #f5f5f5 0%, #dcdcdc 100%)',
            border: '1px solid #a0a0a0', borderRadius: 2,
            color: '#1a1a1a', fontSize: 10, cursor: 'pointer',
            fontFamily: "'Tahoma','Segoe UI',sans-serif",
            display: 'inline-flex', alignItems: 'center', gap: 3,
        },
        btnDanger: {
            height: 20, padding: '0 8px',
            background: 'linear-gradient(180deg, #f88 0%, #d44 100%)',
            border: '1px solid #a00', borderRadius: 2,
            color: '#fff', fontSize: 10, cursor: 'pointer',
            fontFamily: "'Tahoma','Segoe UI',sans-serif",
            display: 'inline-flex', alignItems: 'center',
        },
    };

    return (
        <div style={acc.root}>
            {/* Title Bar */}
            <div style={acc.titleBar}>
                <Package size={13} style={{ marginRight: 6 }} />
                Master Barang — Accurate 5
            </div>

            {/* Toolbar */}
            <div style={acc.toolbar}>
                <button style={acc.toolBtnPrimary} onClick={() => handleOpenModal()}>
                    <Plus size={12} /> Baru (F2)
                </button>
                <button style={acc.toolBtn} onClick={() => {
                    const sel = inventoryData.find(i => i.id === selectedRowId);
                    if (sel) handleOpenModal(sel);
                }}>
                    <Edit3 size={12} /> Edit (F3)
                </button>
                <button style={acc.toolBtn} onClick={() => { if (selectedRowId) setItemToDelete(selectedRowId); }}>
                    <Trash2 size={12} /> Hapus (Del)
                </button>
                <div style={acc.separator} />

                {/* ── Bulk delete toolbar button (shows when any selected) ── */}
                {selectedCount > 0 && (
                    <>
                        <button
                            style={acc.toolBtnDanger}
                            onClick={() => setShowBulkDeleteConfirm(true)}
                        >
                            <Trash2 size={12} />
                            Hapus {selectedCount} Terpilih
                        </button>
                        <button
                            style={acc.toolBtn}
                            onClick={clearSelection}
                        >
                            <X size={12} /> Batal Pilih
                        </button>
                        <div style={acc.separator} />
                    </>
                )}

                {onViewItem && (
                    <>
                        <button style={acc.toolBtn} onClick={() => {
                            const sel = inventoryData.find(i => i.id === selectedRowId);
                            if (sel) onViewItem(sel);
                        }}>
                            <Eye size={12} /> Kartu Stok
                        </button>
                        <div style={acc.separator} />
                    </>
                )}
                <button style={acc.toolBtn} onClick={loadData}>
                    <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} /> Refresh
                </button>

                {/* Search */}
                <div style={{ ...acc.searchWrap, marginLeft: 'auto' }}>
                    <span style={acc.searchLabel}>Cari:</span>
                    <div style={{ position: 'relative' }}>
                        <Search size={11} style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                        <input
                            type="text"
                            style={{ ...acc.searchInput, paddingLeft: 20 }}
                            placeholder="Nama / Kode SKU..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div style={acc.tableWrap}>
                <table style={acc.table}>
                    <colgroup>
                        {/* Checkbox col */}
                        <col style={{ width: 32 }} />
                        <col style={{ width: 36 }} />
                        <col style={{ width: 110 }} />
                        <col />
                        <col style={{ width: 110 }} />
                        <col style={{ width: 80 }} />
                        <col style={{ width: 60 }} />
                        <col style={{ width: 180 }} />
                        <col style={{ width: 60 }} />
                        <col style={{ width: 76 }} />
                    </colgroup>
                    <thead>
                        <tr>
                            {/* Select-all checkbox header */}
                            <th style={{ ...acc.th, ...acc.thCenter, padding: '0 6px' }}>
                                <TriStateCheckbox
                                    checked={allSelected}
                                    indeterminate={someSelected}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th style={{ ...acc.th, ...acc.thCenter }}>No</th>
                            <th style={acc.th}>Kode SKU</th>
                            <th style={acc.th}>Nama Barang</th>
                            <th style={acc.th}>Kategori</th>
                            <th style={{ ...acc.th, ...acc.thRight }}>Stok</th>
                            <th style={{ ...acc.th, ...acc.thCenter }}>Satuan</th>
                            <th style={acc.th}>Konversi Satuan</th>
                            <th style={{ ...acc.th, ...acc.thCenter }}>Status</th>
                            <th style={{ ...acc.th, ...acc.thCenter }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventoryData.length === 0 && (
                            <tr>
                                <td colSpan={10} style={{ ...acc.td, textAlign: 'center', color: '#888', padding: '16px 0' }}>
                                    {isLoading ? 'Memuat data...' : 'Tidak ada data barang'}
                                </td>
                            </tr>
                        )}
                        {inventoryData.map((item, index) => {
                            const isSelected = selectedRowId === item.id;
                            const isBulkSelected = selectedIds.has(item.id);
                            const isHovered = hoveredRowId === item.id;
                            const isLowStock = item.isActive && item.totalStock <= item.minStock;

                            // Row background: bulk selected = light blue tint (Gmail style),
                            // single selected = Accurate blue, hover = light grey
                            let rowBg: string;
                            if (isBulkSelected) {
                                rowBg = isSelected ? '#c8dff8' : '#e8f0fe';
                            } else if (isSelected) {
                                rowBg = '#1a5fa8';
                            } else if (isHovered) {
                                rowBg = '#f1f5ff';
                            } else {
                                rowBg = index % 2 === 0 ? '#fff' : '#f0f5fc';
                            }

                            const cellColor = isSelected && !isBulkSelected ? '#fff' : '#1a1a1a';
                            const lowColor = (isSelected && !isBulkSelected) ? '#ffd0d0' : '#cc0000';

                            // Checkbox: visible when hovered, bulk-selected, or any item selected
                            const showCheckbox = isHovered || isBulkSelected || selectedCount > 0;

                            return (
                                <tr
                                    key={item.id}
                                    style={{
                                        height: 20,
                                        cursor: 'default',
                                        background: rowBg,
                                        opacity: item.isActive ? 1 : 0.55,
                                        transition: 'background 0.12s ease',
                                    }}
                                    onClick={() => setSelectedRowId(item.id)}
                                    onDoubleClick={() => handleOpenModal(item)}
                                    onMouseEnter={() => setHoveredRowId(item.id)}
                                    onMouseLeave={() => setHoveredRowId(null)}
                                >
                                    {/* ── Checkbox cell ─────────────────────────────────── */}
                                    <td style={{ ...acc.td, ...acc.tdCenter, padding: '0 6px', borderRight: '1px solid #dde3ed' }}>
                                        <div style={{
                                            opacity: showCheckbox ? 1 : 0,
                                            transition: 'opacity 0.15s ease',
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={isBulkSelected}
                                                onChange={() => {}}
                                                onClick={e => toggleSelectRow(item.id, e)}
                                                style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#1a5fa8' }}
                                            />
                                        </div>
                                    </td>

                                    <td style={{ ...acc.td, ...acc.tdCenter, color: (isSelected && !isBulkSelected) ? '#cce' : '#888', fontSize: 10 }}>{index + 1}</td>
                                    <td style={{ ...acc.td, color: (isSelected && !isBulkSelected) ? '#adf' : '#1a3a8a', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold' }}>{item.code}</td>
                                    <td style={{ ...acc.td, color: cellColor, fontWeight: (isSelected && !isBulkSelected) ? 'bold' : 'normal' }}>{item.name}</td>
                                    <td style={{ ...acc.td, color: (isSelected && !isBulkSelected) ? '#ddf' : '#555' }}>{item.category}</td>
                                    <td style={{ ...acc.td, ...acc.tdRight, color: isLowStock ? lowColor : cellColor, fontWeight: 'bold' }}>
                                        {item.totalStock.toLocaleString('id-ID')}
                                    </td>
                                    <td style={{ ...acc.td, ...acc.tdCenter, color: (isSelected && !isBulkSelected) ? '#cce' : '#444', fontWeight: 'bold', fontSize: 10 }}>{item.baseUnit}</td>
                                    <td style={{ ...acc.td, color: (isSelected && !isBulkSelected) ? '#ddf' : '#555' }}>
                                        {item.conversions && item.conversions.length > 0
                                            ? item.conversions.map((conv, idx) => {
                                                const cv = conv.operator === '*' ? item.totalStock / conv.ratio : item.totalStock * conv.ratio;
                                                return (
                                                    <span key={idx}>
                                                        <span style={{ fontWeight: 'bold', color: (isSelected && !isBulkSelected) ? '#fff' : '#1a3a8a' }}>
                                                            {cv % 1 === 0 ? cv.toLocaleString('id-ID') : cv.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                                                        </span>
                                                        {' '}<span style={{ fontSize: 10, color: (isSelected && !isBulkSelected) ? '#cce' : '#666' }}>{conv.name}</span>
                                                        {idx < item.conversions!.length - 1 && <span style={{ color: '#b0b8c4', margin: '0 4px' }}>|</span>}
                                                    </span>
                                                );
                                            })
                                            : <span style={{ color: (isSelected && !isBulkSelected) ? '#aac' : '#bbb' }}>-</span>
                                        }
                                    </td>
                                    <td style={{ ...acc.td, ...acc.tdCenter }}>
                                        {item.isActive
                                            ? <span style={{ background: '#d4edda', color: '#1a6a2a', border: '1px solid #8bc', borderRadius: 2, padding: '1px 5px', fontSize: 10, fontWeight: 'bold' }}>Aktif</span>
                                            : <span style={{ background: '#e8e8e8', color: '#777', border: '1px solid #bbb', borderRadius: 2, padding: '1px 5px', fontSize: 10 }}>Non-aktif</span>
                                        }
                                    </td>
                                    <td style={{ ...acc.td, ...acc.tdCenter }}>
                                        <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                                            {onViewItem && (
                                                <button
                                                    title="Kartu Stok"
                                                    onClick={e => { e.stopPropagation(); onViewItem(item); }}
                                                    style={{ ...acc.btnSmall, padding: '0 4px', color: '#1a5fa8', background: 'transparent', border: '1px solid transparent' }}
                                                ><Eye size={12} /></button>
                                            )}
                                            <button
                                                title="Edit"
                                                onClick={e => { e.stopPropagation(); handleOpenModal(item); }}
                                                style={{ ...acc.btnSmall, padding: '0 4px', color: '#a87000', background: 'transparent', border: '1px solid transparent' }}
                                            ><Edit3 size={12} /></button>
                                            <button
                                                title="Hapus"
                                                onClick={e => { e.stopPropagation(); setItemToDelete(item.id); }}
                                                style={{ ...acc.btnSmall, padding: '0 4px', color: '#cc0000', background: 'transparent', border: '1px solid transparent' }}
                                            ><Trash2 size={12} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Status Bar */}
            <div style={acc.statusBar}>
                <span>Total: <strong>{inventoryData.length}</strong> barang</span>
                {selectedCount > 0 && (
                    <span style={{ color: '#1a5fa8', fontWeight: 'bold' }}>
                        ✓ {selectedCount} dipilih
                        <button
                            onClick={clearSelection}
                            style={{ marginLeft: 6, background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 11, padding: 0, textDecoration: 'underline' }}
                        >batal</button>
                    </span>
                )}
                {selectedRowId && selectedCount === 0 && (
                    <span style={{ color: '#1a5fa8' }}>
                        Dipilih: <strong>{inventoryData.find(i => i.id === selectedRowId)?.name}</strong>
                    </span>
                )}
                <span style={{ marginLeft: 'auto', color: '#888' }}>
                    {isLoading ? '⟳ Memuat...' : 'Siap'}
                </span>
            </div>

            {/* ─── Gmail-style Floating Bulk Action Bar ───────────────────── */}
            <BulkActionBar
                visible={selectedCount > 0}
                selectedCount={selectedCount}
                totalCount={inventoryData.length}
                onDeleteSelected={() => setShowBulkDeleteConfirm(true)}
                onClearSelection={clearSelection}
            />

            {/* ─── MODAL TAMBAH / EDIT ─────────────────────────────────────── */}
            {isModalOpen && (
                <ModalPortal>
                    <div style={acc.overlay} onClick={() => setIsModalOpen(false)}>
                        <div style={acc.dialog} onClick={e => e.stopPropagation()}>
                            <div style={acc.dialogTitle}>
                                <span><Package size={12} style={{ marginRight: 6 }} />{editingId ? 'Edit Master Barang' : 'Tambah Master Barang Baru'}</span>
                                <button style={acc.dialogCloseBtn} onClick={() => setIsModalOpen(false)}>✕</button>
                            </div>
                            <form onSubmit={handleSaveItem}>
                                <div style={acc.dialogBody}>
                                    <div style={{ ...acc.fieldBorder, marginBottom: 10 }}>
                                        <div style={acc.fieldBorderTitle}><span>Identitas Barang</span></div>
                                        <div style={acc.fieldGroupGrid2}>
                                            <div>
                                                <label style={acc.label}>Kode SKU <span style={{ color: 'red' }}>*</span></label>
                                                <input required type="text" value={formData.code}
                                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                                    style={{ ...acc.input, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 1 }}
                                                    placeholder="CTH: BRG-001" />
                                            </div>
                                            <div>
                                                <label style={acc.label}>Kategori</label>
                                                <input type="text" value={formData.category}
                                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                    style={acc.input} placeholder="Umum" />
                                            </div>
                                        </div>
                                        <div style={acc.fieldGroup}>
                                            <label style={acc.label}>Nama Barang <span style={{ color: 'red' }}>*</span></label>
                                            <input required type="text" value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                style={{ ...acc.input, fontWeight: 'bold' }}
                                                placeholder="Nama lengkap produk..." />
                                        </div>
                                        <div style={acc.fieldGroupGrid2}>
                                            <div>
                                                <label style={acc.label}>Satuan Dasar <span style={{ color: 'red' }}>*</span></label>
                                                <input required type="text" value={formData.baseUnit}
                                                    onChange={e => setFormData({ ...formData, baseUnit: e.target.value.toUpperCase() })}
                                                    style={{ ...acc.input, textTransform: 'uppercase', textAlign: 'center', fontWeight: 'bold' }}
                                                    placeholder="PCS" />
                                            </div>
                                            <div>
                                                <label style={acc.label}>Min. Stok Alert</label>
                                                <input type="number" value={formData.minStock}
                                                    onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })}
                                                    style={{ ...acc.input, textAlign: 'right' }} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', background: '#eef4ff', border: '1px solid #c0cce8', borderRadius: 2 }}>
                                            <input type="checkbox" id="isActive" checked={formData.isActive}
                                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                                style={{ width: 13, height: 13 }} />
                                            <label htmlFor="isActive" style={{ fontSize: 11, cursor: 'pointer', color: '#1a3a5c', fontWeight: 'bold' }}>Barang Aktif</label>
                                            <span style={{ fontSize: 10, color: '#7a8898' }}>— nonaktifkan jika sudah tidak digunakan</span>
                                        </div>
                                    </div>
                                    <div style={acc.fieldBorder}>
                                        <div style={acc.fieldBorderTitle}>
                                            <span><Settings2 size={11} style={{ marginRight: 4 }} />Konversi Satuan</span>
                                            <button type="button" onClick={handleAddConversion} style={acc.btnSmall}>
                                                <Plus size={10} /> Tambah Satuan
                                            </button>
                                        </div>
                                        {(!formData.conversions || formData.conversions.length === 0) ? (
                                            <div style={{ textAlign: 'center', padding: '10px 0', color: '#999', fontSize: 11, fontStyle: 'italic', border: '1px dashed #c0c8d4', borderRadius: 2, background: '#fafafa' }}>
                                                Tidak ada konversi — barang hanya menggunakan satuan <strong>{formData.baseUnit || '...'}</strong>
                                            </div>
                                        ) : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                                <thead>
                                                    <tr style={{ background: '#e8edf4' }}>
                                                        <th style={{ padding: '2px 6px', border: '1px solid #c8d0dc', textAlign: 'center', width: 28, color: '#555' }}></th>
                                                        <th style={{ padding: '2px 6px', border: '1px solid #c8d0dc', color: '#333' }}>Nama Satuan</th>
                                                        <th style={{ padding: '2px 6px', border: '1px solid #c8d0dc', textAlign: 'center', color: '#333' }}>Op</th>
                                                        <th style={{ padding: '2px 6px', border: '1px solid #c8d0dc', textAlign: 'right', color: '#333' }}>Rasio</th>
                                                        <th style={{ padding: '2px 6px', border: '1px solid #c8d0dc', color: '#333' }}>Satuan Dasar</th>
                                                        <th style={{ padding: '2px 4px', border: '1px solid #c8d0dc', width: 24 }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {formData.conversions?.map((conv, idx) => (
                                                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f4f7fc' }}>
                                                            <td style={{ padding: '2px 6px', border: '1px solid #dde3ed', textAlign: 'center', color: '#999', fontSize: 10 }}>1</td>
                                                            <td style={{ padding: '2px 4px', border: '1px solid #dde3ed' }}>
                                                                <input type="text" placeholder="SATUAN" value={conv.name}
                                                                    onChange={e => updateConversion(idx, 'name', e.target.value.toUpperCase())}
                                                                    style={{ ...acc.input, height: 18, fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center' }} />
                                                            </td>
                                                            <td style={{ padding: '2px 4px', border: '1px solid #dde3ed', textAlign: 'center' }}>
                                                                <select value={conv.operator}
                                                                    onChange={e => updateConversion(idx, 'operator', e.target.value)}
                                                                    style={{ ...acc.input, height: 18, width: 40, textAlign: 'center', fontWeight: 'bold' }}>
                                                                    <option value="*">×</option>
                                                                    <option value="/">÷</option>
                                                                </select>
                                                            </td>
                                                            <td style={{ padding: '2px 4px', border: '1px solid #dde3ed' }}>
                                                                <input type="number" value={conv.ratio}
                                                                    onChange={e => updateConversion(idx, 'ratio', Number(e.target.value))}
                                                                    style={{ ...acc.input, height: 18, textAlign: 'right', fontWeight: 'bold' }} />
                                                            </td>
                                                            <td style={{ padding: '2px 6px', border: '1px solid #dde3ed', fontWeight: 'bold', color: '#1a3a8a', fontSize: 10 }}>
                                                                {formData.baseUnit || 'UNIT'}
                                                            </td>
                                                            <td style={{ padding: '2px 4px', border: '1px solid #dde3ed', textAlign: 'center' }}>
                                                                <button type="button" onClick={() => handleRemoveConversion(idx)} style={acc.btnDanger} title="Hapus baris">×</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                                <div style={acc.dialogFooter}>
                                    <button type="button" onClick={() => setIsModalOpen(false)} style={acc.btnDefault}>Batal</button>
                                    <button type="submit" disabled={isSaving} style={{ ...acc.btnPrimary, opacity: isSaving ? 0.7 : 1 }}>
                                        {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                                        {isSaving ? 'Menyimpan...' : 'Simpan (F10)'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* Single delete confirm */}
            <ConfirmDialog
                isOpen={!!itemToDelete}
                title="Hapus Master Barang"
                message="Apakah Anda yakin ingin menghapus barang ini? Stok dan riwayat yang terkait dengan barang ini mungkin akan terpengaruh."
                onConfirm={handleDeleteItem}
                onCancel={() => setItemToDelete(null)}
            />

            {/* Bulk delete confirm */}
            <ConfirmDialog
                isOpen={showBulkDeleteConfirm}
                title="Hapus Semua Data Terpilih"
                message={`Anda akan menghapus ${selectedCount} barang sekaligus. Tindakan ini tidak dapat dibatalkan dan akan mempengaruhi seluruh stok serta riwayat transaksi terkait. Lanjutkan?`}
                onConfirm={handleBulkDelete}
                onCancel={() => setShowBulkDeleteConfirm(false)}
            />
        </div>
    );
};
