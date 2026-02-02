
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Item, Stock, Warehouse, UnitConversion } from '../types';
import { Search, Upload, Download, Trash2, Box, RefreshCw, Plus, X, ArrowRight } from 'lucide-react';
import { useToast } from './Toast';

export const InventoryView: React.FC = () => {
    const { showToast } = useToast();
    const [items, setItems] = useState<Item[]>([]);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showImportModal, setShowImportModal] = useState(false);
    const [importText, setImportText] = useState('');

    // Editing State
    const [editingCell, setEditingCell] = useState<{ itemId: string, field: 'minStock' | 'baseUnit' } | null>(null);
    const [editValue, setEditValue] = useState<string | number>('');

    // Conversion Editing State
    const [editingConversions, setEditingConversions] = useState<{ itemId: string, itemCode: string, itemName: string, baseUnit: string, data: UnitConversion[] } | null>(null);

    // New Item State
    const [showNewItemModal, setShowNewItemModal] = useState(false);
    const [newItemForm, setNewItemForm] = useState({
        code: '',
        name: '',
        category: '',
        baseUnit: 'Pcs',
        minStock: 10
    });

    const loadData = () => {
        setItems(StorageService.getItems());
        setStocks(StorageService.getStocks());
        setWarehouses(StorageService.getWarehouses());
        setSelectedIds(new Set());
    };

    useEffect(() => {
        loadData();
    }, []);

    // Derived state for table view
    const inventoryData = useMemo(() => {
        return items.map(item => {
            const itemStocks = stocks.filter(s => s.itemId === item.id);
            const totalStock = itemStocks.reduce((acc, s) => acc + s.qty, 0);
            
            const whBreakdown = warehouses.map(wh => {
                const s = itemStocks.find(stk => stk.warehouseId === wh.id);
                return { whId: wh.id, qty: s ? s.qty : 0 };
            });

            return { ...item, totalStock, whBreakdown };
        }).filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.code.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [items, stocks, warehouses, searchTerm]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(inventoryData.map(i => i.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkDelete = () => {
        if (window.confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) {
            StorageService.deleteItems(Array.from(selectedIds));
            loadData();
            showToast(`Deleted ${selectedIds.size} items`, 'success');
        }
    };

    const handleImport = () => {
        try {
            // Very simple JSON import
            const parsed = JSON.parse(importText);
            if (Array.isArray(parsed)) {
                // In real app, extensive validation here
                StorageService.importItems(parsed);
                setShowImportModal(false);
                setImportText('');
                loadData();
                showToast(`Successfully imported ${parsed.length} items.`, 'success');
            } else {
                showToast("Invalid format. Expected JSON Array.", 'error');
            }
        } catch (e) {
            showToast("JSON Parse Error.", 'error');
        }
    };

    // Inline Editing Handlers
    const handleStartEdit = (itemId: string, field: 'minStock' | 'baseUnit', value: string | number) => {
        setEditingCell({ itemId, field });
        setEditValue(value);
    };

    const handleSaveEdit = () => {
        if (!editingCell) return;

        const { itemId, field } = editingCell;
        const item = items.find(i => i.id === itemId);
        if (item) {
            const newItem = { ...item };
            if (field === 'minStock') {
                newItem.minStock = Number(editValue);
            } else if (field === 'baseUnit') {
                newItem.baseUnit = String(editValue);
            }
            StorageService.saveItem(newItem);
            loadData();
            showToast("Item updated", 'success');
        }
        setEditingCell(null);
        setEditValue('');
    };

    const handleSaveConversions = () => {
        if (!editingConversions) return;
        const item = items.find(i => i.id === editingConversions.itemId);
        if (item) {
            // Filter out empty names or invalid ratios
            const validConversions = editingConversions.data.filter(c => c.name.trim() !== '' && c.ratio > 0);
            const newItem = { ...item, conversions: validConversions };
            StorageService.saveItem(newItem);
            loadData();
            showToast("Conversions saved", 'success');
        }
        setEditingConversions(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
            setEditValue('');
        }
    };

    const handleCreateItem = () => {
        // Validation
        if (!newItemForm.code || !newItemForm.name || !newItemForm.baseUnit) {
            showToast("Please fill in Code, Name, and Base Unit.", 'warning');
            return;
        }

        // Check for duplicate code
        const existing = items.find(i => i.code === newItemForm.code);
        if (existing) {
             showToast("Item code already exists!", 'error');
             return;
        }

        const newItem: Item = {
            id: crypto.randomUUID(),
            code: newItemForm.code,
            name: newItemForm.name,
            category: newItemForm.category,
            baseUnit: newItemForm.baseUnit,
            minStock: Number(newItemForm.minStock),
            conversions: []
        };
        
        StorageService.saveItem(newItem);
        loadData();
        setShowNewItemModal(false);
        setNewItemForm({ code: '', name: '', category: '', baseUnit: 'Pcs', minStock: 10 });
        showToast("Item created successfully", 'success');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 gap-4 transition-colors">
            {/* Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search code or name..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 w-64 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                        />
                    </div>
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{selectedIds.size} Selected</span>
                            <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                            <button onClick={handleBulkDelete} className="text-red-600 hover:text-red-700 text-xs font-semibold flex items-center gap-1">
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadData} className="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-md"><RefreshCw size={18} /></button>
                    <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">
                        <Upload size={16} /> Import
                    </button>
                    <button 
                        onClick={() => setShowNewItemModal(true)} 
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 shadow-sm"
                    >
                        <Box size={16} /> New Item
                    </button>
                </div>
            </div>

            {/* Dense Table */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-colors">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide sticky top-0 z-10">
                            <tr>
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700 w-10 text-center">
                                    <input type="checkbox" onChange={handleSelectAll} checked={inventoryData.length > 0 && selectedIds.size === inventoryData.length} />
                                </th>
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Code</th>
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Item Name</th>
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Category</th>
                                {warehouses.map(wh => (
                                    <th key={wh.id} className="p-3 border-b border-slate-200 dark:border-slate-700 text-right text-blue-600 dark:text-blue-400">{wh.name}</th>
                                ))}
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right bg-slate-200 dark:bg-slate-800/50">Total</th>
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right text-orange-600 dark:text-orange-400">Min Stock</th>
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-center">Base Unit</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {inventoryData.map((item, idx) => (
                                <tr key={item.id} className={`hover:bg-blue-50 dark:hover:bg-slate-800/50 border-b border-slate-50 dark:border-slate-800 ${selectedIds.has(item.id) ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                                    <td className="p-2 text-center">
                                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleSelectRow(item.id)} />
                                    </td>
                                    <td className="p-2 font-mono text-slate-500 dark:text-slate-400 text-xs">{item.code}</td>
                                    <td className="p-2 font-medium text-slate-700 dark:text-slate-200">
                                        {item.name}
                                        <div 
                                            className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-1 -ml-1 w-fit transition-colors select-none"
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                setEditingConversions({
                                                    itemId: item.id,
                                                    itemCode: item.code,
                                                    itemName: item.name,
                                                    baseUnit: item.baseUnit,
                                                    data: JSON.parse(JSON.stringify(item.conversions))
                                                });
                                            }}
                                            title="Double click to edit conversions"
                                        >
                                            {item.conversions.length > 0 
                                                ? `Conversions: ${item.conversions.map(c => `${c.name} (${c.ratio})`).join(', ')}`
                                                : 'No conversions (Double click to add)'}
                                        </div>
                                    </td>
                                    <td className="p-2 text-slate-500 dark:text-slate-400">{item.category}</td>
                                    {item.whBreakdown.map(bd => (
                                        <td key={bd.whId} className="p-2 text-right font-mono text-slate-600 dark:text-slate-300">{bd.qty}</td>
                                    ))}
                                    <td className={`p-2 text-right font-bold font-mono bg-slate-50/50 dark:bg-slate-800/30 ${item.totalStock <= item.minStock ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                        {item.totalStock}
                                    </td>
                                    <td 
                                        className="p-2 text-right font-mono text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border-l border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                        onDoubleClick={() => handleStartEdit(item.id, 'minStock', item.minStock)}
                                        title="Double click to edit Min Stock"
                                    >
                                        {editingCell?.itemId === item.id && editingCell?.field === 'minStock' ? (
                                            <input 
                                                type="number"
                                                autoFocus
                                                className="w-16 border rounded px-1 text-right outline-none ring-2 ring-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={handleSaveEdit}
                                                onKeyDown={handleKeyDown}
                                            />
                                        ) : (
                                            item.minStock
                                        )}
                                    </td>
                                    <td 
                                        className="p-2 text-center text-xs text-slate-500 dark:text-slate-400 badge cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                        onDoubleClick={() => handleStartEdit(item.id, 'baseUnit', item.baseUnit)}
                                        title="Double click to edit Base Unit"
                                    >
                                        {editingCell?.itemId === item.id && editingCell?.field === 'baseUnit' ? (
                                            <input 
                                                type="text"
                                                autoFocus
                                                className="w-16 border rounded px-1 text-center outline-none ring-2 ring-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={handleSaveEdit}
                                                onKeyDown={handleKeyDown}
                                            />
                                        ) : (
                                            item.baseUnit
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                     <span>Showing {inventoryData.length} items</span>
                     <span>Double-click Min Stock, Unit or Conversions to edit. Low Stock items highlighted in red.</span>
                </div>
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-1/2 shadow-xl border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-100">Bulk Import Items (JSON)</h3>
                        <textarea 
                            className="w-full h-64 border p-2 font-mono text-xs rounded mb-4 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                            value={importText}
                            onChange={e => setImportText(e.target.value)}
                            placeholder='[{"id": "new-1", "code": "X1", "name": "Item", "baseUnit": "Pcs", "conversions": [], "minStock": 10}]'
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded">Cancel</button>
                            <button onClick={handleImport} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Import Data</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Conversion Editor Modal */}
            {editingConversions && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 dark:text-slate-200">Edit Conversions</h3>
                            <button onClick={() => setEditingConversions(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={18} /></button>
                        </div>
                        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="mb-4 text-sm text-slate-600 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-100 dark:border-blue-900/30">
                                <p><strong className="text-slate-800 dark:text-slate-200">Item:</strong> {editingConversions.itemCode} - {editingConversions.itemName}</p>
                                <p className="mt-1"><strong className="text-slate-800 dark:text-slate-200">Base Unit:</strong> {editingConversions.baseUnit}</p>
                            </div>
                            
                            <div className="space-y-3 max-h-[350px] overflow-auto mb-4 pr-1">
                                {editingConversions.data.map((conv, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unit Name</label>
                                            <input 
                                                type="text" 
                                                value={conv.name}
                                                onChange={(e) => {
                                                    const newData = [...editingConversions.data];
                                                    newData[idx].name = e.target.value;
                                                    setEditingConversions({...editingConversions, data: newData});
                                                }}
                                                className="w-full border rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                                placeholder="e.g. Box"
                                            />
                                        </div>
                                        <div className="flex items-end justify-center pb-2 text-slate-400">
                                            <ArrowRight size={16} />
                                        </div>
                                        <div className="flex-1 relative">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ratio (to Base)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    value={conv.ratio}
                                                    min="0.0001"
                                                    onChange={(e) => {
                                                        const newData = [...editingConversions.data];
                                                        newData[idx].ratio = parseFloat(e.target.value) || 0;
                                                        setEditingConversions({...editingConversions, data: newData});
                                                    }}
                                                    className="w-full border rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 pr-12 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                                    placeholder="12"
                                                />
                                                <span className="absolute right-2 top-1.5 text-xs text-slate-400 pointer-events-none">{editingConversions.baseUnit}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-end justify-center pb-1">
                                            <button 
                                                onClick={() => {
                                                    const newData = editingConversions.data.filter((_, i) => i !== idx);
                                                    setEditingConversions({...editingConversions, data: newData});
                                                }}
                                                className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                title="Remove Conversion"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {editingConversions.data.length === 0 && (
                                    <div className="text-center text-slate-400 italic text-sm py-8 bg-white dark:bg-slate-800 rounded border border-dashed border-slate-200 dark:border-slate-700">
                                        No conversions defined for this item.
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => {
                                    setEditingConversions({
                                        ...editingConversions,
                                        data: [...editingConversions.data, { name: '', ratio: 1 }]
                                    });
                                }}
                                className="w-full py-2.5 border-2 border-dashed border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 transition-all flex items-center justify-center font-bold text-sm"
                            >
                                <Plus size={16} className="mr-2" /> Add New Conversion
                            </button>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button onClick={() => setEditingConversions(null)} className="px-4 py-2 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-medium">Cancel</button>
                            <button onClick={handleSaveConversions} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium shadow-sm">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Item Modal */}
            {showNewItemModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-md shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 dark:text-slate-200">Create New Item</h3>
                            <button onClick={() => setShowNewItemModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Item Code</label>
                                <input 
                                    type="text" 
                                    autoFocus
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    placeholder="e.g. A-001"
                                    value={newItemForm.code}
                                    onChange={e => setNewItemForm({...newItemForm, code: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Item Name</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    placeholder="e.g. Coffee Beans"
                                    value={newItemForm.name}
                                    onChange={e => setNewItemForm({...newItemForm, name: e.target.value})}
                                />
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Category</label>
                                    <input 
                                        type="text" 
                                        className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        placeholder="e.g. Beverage"
                                        value={newItemForm.category}
                                        onChange={e => setNewItemForm({...newItemForm, category: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Base Unit</label>
                                    <input 
                                        type="text" 
                                        className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        placeholder="e.g. Pcs"
                                        value={newItemForm.baseUnit}
                                        onChange={e => setNewItemForm({...newItemForm, baseUnit: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Minimum Stock Alert</label>
                                <input 
                                    type="number" 
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    placeholder="10"
                                    value={newItemForm.minStock}
                                    onChange={e => setNewItemForm({...newItemForm, minStock: parseFloat(e.target.value)})}
                                />
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button onClick={() => setShowNewItemModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-medium text-sm">Cancel</button>
                            <button onClick={handleCreateItem} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm shadow-sm">Create Item</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
