import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Item, Warehouse, Transaction, TransactionType, TransactionItem } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, Save, X, Edit3, Search, CornerDownLeft, Truck, FileText, User } from 'lucide-react';

interface Props {
  type: TransactionType;
  initialData?: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransactionForm: React.FC<Props> = ({ type, initialData, onClose, onSuccess }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  // Header State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(`TRX-${Date.now().toString().slice(-6)}`);
  const [deliveryOrderNo, setDeliveryOrderNo] = useState('');
  const [supplier, setSupplier] = useState('');
  const [sourceWh, setSourceWh] = useState('');
  const [targetWh, setTargetWh] = useState('');
  const [notes, setNotes] = useState('');

  // Lines State
  const [lines, setLines] = useState<TransactionItem[]>([]);
  
  // New Line Entry State
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Item[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingQty, setPendingQty] = useState<number | ''>(1);
  const [pendingUnit, setPendingUnit] = useState<string>('');

  // Refs for keyboard navigation
  const queryInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const unitInputRef = useRef<HTMLSelectElement>(null);
  
  useEffect(() => {
    setItems(StorageService.getItems());
    const whs = StorageService.getWarehouses();
    setWarehouses(whs);

    if (initialData) {
        // Edit Mode
        setDate(initialData.date);
        setRefNo(initialData.referenceNo);
        setDeliveryOrderNo(initialData.deliveryOrderNo || '');
        setSupplier(initialData.supplier || '');
        setSourceWh(initialData.sourceWarehouseId);
        setTargetWh(initialData.targetWarehouseId || '');
        setNotes(initialData.notes || '');
        setLines(JSON.parse(JSON.stringify(initialData.items)));
    } else {
        // New Mode
        if (whs.length > 0) {
            setSourceWh(whs[0].id);
            if (type === 'TRANSFER' && whs.length > 1) {
                setTargetWh(whs[1].id);
            }
        }
        // Focus item input on mount for new transactions
        setTimeout(() => queryInputRef.current?.focus(), 100);
    }
  }, [type, initialData]);

  // Search Logic
  useEffect(() => {
      if (!query.trim()) {
          setSuggestions([]);
          setShowSuggestions(false);
          return;
      }
      
      // If query matches current selected item name exactly, likely just selected. Don't show suggestions.
      if (pendingItem && query === pendingItem.name) return;

      const lower = query.toLowerCase();
      const matches = items.filter(i => 
          i.code.toLowerCase().includes(lower) || 
          i.name.toLowerCase().includes(lower)
      ).slice(0, 5); // Limit to 5
      
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
      setHighlightedIndex(0);
  }, [query, items, pendingItem]);


  const handleRemoveLine = (index: number) => {
    const newLines = [...lines];
    newLines.splice(index, 1);
    setLines(newLines);
  };

  const validateStock = (itemId: string, qty: number, unit: string, currentLines: TransactionItem[]) => {
      if (type !== 'OUT' && type !== 'TRANSFER') return true;

      const item = items.find(i => i.id === itemId);
      if (!item) return false;

      let ratio = 1;
      if (unit !== item.baseUnit) {
          const c = item.conversions.find(x => x.name === unit);
          if (c) ratio = c.ratio;
      }

      const requestedBase = qty * ratio;
      const currentStock = StorageService.getStockQty(itemId, sourceWh);
      
      // Sum up existing lines for this item
      const existingBase = currentLines
        .filter(l => l.itemId === itemId)
        .reduce((acc, l) => acc + (l.qty * l.ratio), 0);
      
      return (requestedBase + existingBase) <= currentStock;
  };

  // --- Keyboard Handlers ---

  const handleQueryKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightedIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter') {
          e.preventDefault();
          if (suggestions.length > 0) {
              selectItem(suggestions[highlightedIndex]);
          }
      } else if (e.key === 'Escape') {
          setShowSuggestions(false);
      }
  };

  const selectItem = (item: Item) => {
      setPendingItem(item);
      setQuery(item.name);
      setPendingUnit(item.baseUnit);
      setPendingQty(1);
      setShowSuggestions(false);
      // Focus Qty
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          commitPendingLine();
      }
  };
  
  const handleUnitKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          commitPendingLine();
      }
  };

  const commitPendingLine = () => {
      if (!pendingItem) {
          return;
      }
      const qty = typeof pendingQty === 'number' ? pendingQty : 1;
      if (qty <= 0) {
          alert("Quantity must be greater than 0");
          return;
      }

      // Check Stock
      if (!validateStock(pendingItem.id, qty, pendingUnit, lines)) {
          alert(`Insufficient stock in ${warehouses.find(w => w.id === sourceWh)?.name}`);
          qtyInputRef.current?.select();
          return;
      }

      // Calculate Ratio
      let ratio = 1;
      if (pendingUnit !== pendingItem.baseUnit) {
          const conv = pendingItem.conversions.find(c => c.name === pendingUnit);
          if (conv) ratio = conv.ratio;
      }

      const newLine: TransactionItem = {
          itemId: pendingItem.id,
          qty: qty,
          unit: pendingUnit,
          ratio: ratio
      };

      setLines([...lines, newLine]);
      
      // Reset
      setPendingItem(null);
      setQuery('');
      setPendingQty(1);
      setPendingUnit('');
      
      // Focus back to start
      queryInputRef.current?.focus();
  };

  const handleSubmit = () => {
    if (lines.length === 0) {
        alert("Please add at least one item.");
        return;
    }
    if (type === 'TRANSFER' && sourceWh === targetWh) {
        alert("Source and Target warehouse cannot be the same.");
        return;
    }

    const transaction: Transaction = {
        id: initialData ? initialData.id : crypto.randomUUID(),
        date,
        referenceNo: refNo,
        deliveryOrderNo,
        supplier,
        type,
        sourceWarehouseId: sourceWh,
        targetWarehouseId: type === 'TRANSFER' ? targetWh : undefined,
        items: lines,
        notes,
        createdAt: initialData ? initialData.createdAt : Date.now()
    };

    if (initialData) {
        StorageService.updateTransaction(transaction);
        alert("Transaction updated successfully.");
    } else {
        StorageService.commitTransaction(transaction);
    }
    onSuccess();
  };

  const getUnitsForItem = (item: Item | null) => {
    if (!item) return [];
    return [
        { name: item.baseUnit, ratio: 1 },
        ...item.conversions
    ];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[95vh] flex flex-col">
        {/* Header Title */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    {initialData ? <Edit3 size={20} /> : <Plus size={20} />}
                    {initialData ? 'Edit Transaction' : 'New Transaction'}
                    <span className="mx-2 text-slate-300">|</span>
                    {type === 'IN' && <span className="text-emerald-600">Inbound</span>}
                    {type === 'OUT' && <span className="text-red-600">Outbound</span>}
                    {type === 'TRANSFER' && <span className="text-blue-600">Transfer</span>}
                </h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>

        {/* Enhanced Form Header Fields */}
        <div className="p-6 bg-slate-100 border-b border-slate-200 flex flex-col gap-4 overflow-y-auto max-h-[35vh]">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-600 text-xs uppercase">Transaction Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-600 text-xs uppercase">Reference No.</label>
                    <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
                </div>
                <div className="flex flex-col gap-1">
                     <label className="font-semibold text-slate-600 text-xs uppercase flex items-center gap-1">
                        <Truck size={12}/> No. Surat Jalan (DO)
                     </label>
                    <input type="text" value={deliveryOrderNo} onChange={e => setDeliveryOrderNo(e.target.value)} placeholder="e.g. DO-12345" className="border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                 <div className="flex flex-col gap-1">
                     <label className="font-semibold text-slate-600 text-xs uppercase flex items-center gap-1">
                        <User size={12}/> Supplier / Customer
                     </label>
                    <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="PT. Vendor Name" className="border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-600 text-xs uppercase">Source Warehouse</label>
                    <select value={sourceWh} onChange={e => setSourceWh(e.target.value)} className="border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none">
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                {type === 'TRANSFER' && (
                     <div className="flex flex-col gap-1">
                        <label className="font-semibold text-slate-600 text-xs uppercase">Target Warehouse</label>
                        <select value={targetWh} onChange={e => setTargetWh(e.target.value)} className="border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none">
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                )}
                 <div className={`flex flex-col gap-1 ${type === 'TRANSFER' ? 'md:col-span-2' : 'md:col-span-3'}`}>
                    <label className="font-semibold text-slate-600 text-xs uppercase flex items-center gap-1">
                        <FileText size={12}/> Global Notes
                    </label>
                    <input 
                        type="text"
                        className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none"
                        placeholder="Description of the transaction..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                 </div>
            </div>
        </div>

        {/* Dense Table Grid */}
        <div className="flex-1 overflow-auto p-0 relative bg-white">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-200 sticky top-0 z-10 text-xs font-bold text-slate-700 uppercase tracking-wider shadow-sm">
                    <tr>
                        <th className="p-2 border-b border-r w-10 text-center">#</th>
                        <th className="p-2 border-b border-r w-[35%]">Item Description</th>
                        <th className="p-2 border-b border-r w-[15%] text-right bg-blue-50 text-blue-800">Qty (Input)</th>
                        <th className="p-2 border-b border-r w-[10%] bg-blue-50 text-blue-800">Unit</th>
                        <th className="p-2 border-b border-r w-[15%] text-right bg-slate-100">Qty (Base)</th>
                        <th className="p-2 border-b border-r w-[10%] bg-slate-100">Unit (Base)</th>
                        <th className="p-2 border-b w-10 text-center">Act</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {/* Existing Lines */}
                    {lines.map((line, idx) => {
                        const itemDef = items.find(i => i.id === line.itemId);
                        const baseQty = line.qty * line.ratio;
                        return (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                                <td className="p-2 border-r font-medium text-slate-700">
                                    {itemDef?.code} - {itemDef?.name}
                                </td>
                                <td className="p-2 border-r text-right font-mono font-bold text-blue-700 bg-blue-50/20">
                                    {line.qty}
                                </td>
                                <td className="p-2 border-r text-blue-700 bg-blue-50/20">
                                    {line.unit}
                                </td>
                                <td className="p-2 border-r text-right font-mono text-slate-600 bg-slate-50/50">
                                    {baseQty}
                                </td>
                                <td className="p-2 border-r text-slate-500 bg-slate-50/50">
                                    {itemDef?.baseUnit}
                                </td>
                                <td className="p-2 text-center">
                                    <button onClick={() => handleRemoveLine(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    
                    {/* INPUT ROW */}
                    <tr className="bg-emerald-50/30 border-t-2 border-emerald-100 shadow-inner">
                        <td className="p-2 text-center text-emerald-500"><Plus size={16} className="mx-auto"/></td>
                        <td className="p-2 border-r relative">
                            <div className="relative">
                                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    ref={queryInputRef}
                                    type="text" 
                                    className="w-full pl-8 pr-2 py-1.5 border border-emerald-200 rounded text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white shadow-sm"
                                    placeholder="Type code or name..."
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    onKeyDown={handleQueryKeyDown}
                                    onFocus={() => { if(query) setShowSuggestions(true); }}
                                />
                                {/* Autocomplete Dropdown */}
                                {showSuggestions && (
                                    <div className="absolute left-0 bottom-full mb-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                        <div className="text-[10px] bg-slate-50 px-2 py-1 text-slate-400 font-bold uppercase border-b border-slate-100">Select Item</div>
                                        {suggestions.map((item, idx) => (
                                            <div 
                                                key={item.id}
                                                className={`px-3 py-2 cursor-pointer flex justify-between items-center ${idx === highlightedIndex ? 'bg-blue-500 text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                                                onClick={() => selectItem(item)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{item.name}</span>
                                                    <span className={`text-xs ${idx === highlightedIndex ? 'text-blue-100' : 'text-slate-400'}`}>{item.code}</span>
                                                </div>
                                                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${idx === highlightedIndex ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{item.baseUnit}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </td>
                        <td className="p-2 border-r">
                            <input 
                                ref={qtyInputRef}
                                type="number" 
                                min="0.01"
                                step="any"
                                className="w-full text-right py-1.5 px-2 border border-emerald-200 rounded text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono bg-white"
                                placeholder="Qty"
                                value={pendingQty}
                                onChange={e => setPendingQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                onKeyDown={handleQtyKeyDown}
                            />
                        </td>
                        <td className="p-2 border-r">
                            <select 
                                ref={unitInputRef}
                                className="w-full py-1.5 px-2 border border-emerald-200 rounded text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                value={pendingUnit}
                                onChange={e => setPendingUnit(e.target.value)}
                                onKeyDown={handleUnitKeyDown}
                                disabled={!pendingItem}
                            >
                                {getUnitsForItem(pendingItem).map(u => (
                                    <option key={u.name} value={u.name}>{u.name}</option>
                                ))}
                            </select>
                        </td>
                        
                        {/* Calculated Previews (Read Only) */}
                        <td className="p-2 border-r text-right font-mono text-slate-400 italic bg-slate-50/30">
                            {pendingItem && typeof pendingQty === 'number' ? (() => {
                                let ratio = 1;
                                if (pendingUnit !== pendingItem.baseUnit) {
                                    const c = pendingItem.conversions.find(x => x.name === pendingUnit);
                                    if (c) ratio = c.ratio;
                                }
                                return pendingQty * ratio;
                            })() : '-'}
                        </td>
                        <td className="p-2 border-r text-slate-400 italic bg-slate-50/30">
                            {pendingItem ? pendingItem.baseUnit : '-'}
                        </td>

                        <td className="p-2 text-center">
                            <button 
                                onClick={commitPendingLine}
                                disabled={!pendingItem}
                                className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                title="Add Line (Enter)"
                            >
                                <CornerDownLeft size={16} />
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end items-center gap-3">
             <button onClick={onClose} className="px-6 py-2 rounded text-slate-600 hover:bg-slate-200 font-medium text-sm">Cancel</button>
             <button 
                onClick={handleSubmit} 
                className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center shadow-md shadow-blue-200"
             >
                <Save size={16} className="mr-2" /> 
                {initialData ? 'Update Transaction' : 'Save Transaction'}
             </button>
        </div>
      </div>
    </div>
  );
};