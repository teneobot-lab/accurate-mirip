import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storage';
import { Transaction, Item, Warehouse } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Filter, Download, Edit3, Search, Calendar, RefreshCw, ChevronDown, Package, User, Truck, FileSpreadsheet, FileText, X, TrendingDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Props {
    onEditTransaction: (tx: Transaction) => void;
}

export const ReportsView: React.FC<Props> = ({ onEditTransaction }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

    // Filter States
    const [filterWh, setFilterWh] = useState('ALL');
    const [filterType, setFilterType] = useState('ALL');
    
    // -- Autocomplete State for Item Filter --
    const [filterItem, setFilterItem] = useState('ALL'); // The actual selected ID
    const [itemSearchQuery, setItemSearchQuery] = useState(''); // What user types
    const [showItemSuggestions, setShowItemSuggestions] = useState(false);
    const [highlightedItemIndex, setHighlightedItemIndex] = useState(0);
    const itemInputRef = useRef<HTMLInputElement>(null);
    // ----------------------------------------

    const [filterSupplier, setFilterSupplier] = useState('');
    const [filterDo, setFilterDo] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const refreshData = () => {
        setTransactions(StorageService.getTransactions());
        setItems(StorageService.getItems());
        setWarehouses(StorageService.getWarehouses());
    };

    useEffect(() => {
        refreshData();
        
        // Close suggestions on outside click
        const handleClickOutside = (e: MouseEvent) => {
            if (itemInputRef.current && !itemInputRef.current.contains(e.target as Node)) {
                setShowItemSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const setDateRange = (range: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL') => {
        const end = new Date();
        const start = new Date();
        
        if (range === 'TODAY') {
            // start is today
        } else if (range === 'WEEK') {
            start.setDate(end.getDate() - 7);
        } else if (range === 'MONTH') {
            start.setDate(end.getDate() - 30);
        } else if (range === 'ALL') {
             start.setFullYear(2020); 
        }

        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };

    // --- Item Autocomplete Logic ---
    const itemSuggestions = useMemo(() => {
        if (!itemSearchQuery) return items.slice(0, 10);
        const lower = itemSearchQuery.toLowerCase();
        // Fuzzy-ish matching
        return items.filter(i => 
            i.code.toLowerCase().includes(lower) || 
            i.name.toLowerCase().includes(lower)
        ).slice(0, 10);
    }, [items, itemSearchQuery]);

    const handleItemKeyDown = (e: React.KeyboardEvent) => {
        if (!showItemSuggestions) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedItemIndex(prev => (prev + 1) % itemSuggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedItemIndex(prev => (prev - 1 + itemSuggestions.length) % itemSuggestions.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (itemSuggestions.length > 0) {
                selectItemFilter(itemSuggestions[highlightedItemIndex]);
            }
        } else if (e.key === 'Escape') {
            setShowItemSuggestions(false);
        }
    };

    const selectItemFilter = (item: Item) => {
        setFilterItem(item.id);
        setItemSearchQuery(item.name);
        setShowItemSuggestions(false);
    };

    const clearItemFilter = () => {
        setFilterItem('ALL');
        setItemSearchQuery('');
        setHighlightedItemIndex(0);
        itemInputRef.current?.focus();
    };
    // -------------------------------

    const flattenedMutations = useMemo(() => {
        const mutations: any[] = [];
        const lowerSearch = searchQuery.toLowerCase().trim();
        const lowerSupplier = filterSupplier.toLowerCase().trim();
        const lowerDo = filterDo.toLowerCase().trim();
        
        transactions.forEach(tx => {
            // Filter by date
            if (tx.date < startDate || tx.date > endDate) return;
            if (filterType !== 'ALL' && tx.type !== filterType) return;
            if (filterWh !== 'ALL' && tx.sourceWarehouseId !== filterWh && tx.targetWarehouseId !== filterWh) return;

            // Filter by Supplier/Customer
            if (lowerSupplier && !(tx.supplier || '').toLowerCase().includes(lowerSupplier)) return;

            // Filter by DO No
            if (lowerDo && !(tx.deliveryOrderNo || '').toLowerCase().includes(lowerDo)) return;

            // Search Check at Transaction Level (Ref No)
            const refMatch = tx.referenceNo.toLowerCase().includes(lowerSearch);
            const noteMatch = (tx.notes || '').toLowerCase().includes(lowerSearch);

            tx.items.forEach(item => {
                // Filter by Specific Item (New)
                if (filterItem !== 'ALL' && item.itemId !== filterItem) return;

                const itemDef = items.find(i => i.id === item.itemId);
                
                // Search Check at Item Level
                const itemMatch = 
                    (itemDef?.code.toLowerCase().includes(lowerSearch) || false) ||
                    (itemDef?.name.toLowerCase().includes(lowerSearch) || false) ||
                    (item.note || '').toLowerCase().includes(lowerSearch);
                
                // If search query exists, match either Ref, Note, Item Code, Item Name, or Item Note
                if (lowerSearch && !refMatch && !noteMatch && !itemMatch) return;

                const whSource = warehouses.find(w => w.id === tx.sourceWarehouseId)?.name || 'Unknown';
                const whTarget = tx.targetWarehouseId ? warehouses.find(w => w.id === tx.targetWarehouseId)?.name : null;

                const baseEntry = {
                    txId: tx.id,
                    date: tx.date,
                    ref: tx.referenceNo,
                    doNo: tx.deliveryOrderNo || '-',
                    supplier: tx.supplier || '-',
                    itemCode: itemDef?.code || '?',
                    itemName: itemDef?.name || '?',
                    unit: item.unit,
                    qty: item.qty,
                    ratio: item.ratio,
                    note: item.note
                };

                // Add Source Log (OUT or IN depending on type)
                if (filterWh === 'ALL' || filterWh === tx.sourceWarehouseId) {
                    let typeLabel = '';
                    let inQty = 0;
                    let outQty = 0;

                    if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
                        typeLabel = tx.type;
                        inQty = item.qty;
                    } else {
                        typeLabel = tx.type;
                        outQty = item.qty;
                    }

                    mutations.push({
                        ...baseEntry,
                        wh: whSource,
                        type: typeLabel,
                        in: inQty,
                        out: outQty
                    });
                }

                // Add Target Log (only for Transfer)
                if (tx.type === 'TRANSFER' && (filterWh === 'ALL' || filterWh === tx.targetWarehouseId)) {
                    mutations.push({
                        ...baseEntry,
                        wh: whTarget || '?',
                        type: 'TRANSFER IN',
                        in: item.qty,
                        out: 0
                    });
                }
            });
        });
        
        return mutations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, items, warehouses, startDate, endDate, filterWh, filterType, searchQuery, filterItem, filterSupplier, filterDo]);

    // --- Updated Chart Logic: Top 3 Outbound Items ---
    const topOutboundChartData = useMemo(() => {
        const itemMap = new Map<string, number>();

        transactions.forEach(tx => {
             // Date Filter is already handled partially by ensuring we use relevant range
             if (tx.date < startDate || tx.date > endDate) return;
             
             // Logic: Only count OUT transactions
             if (tx.type === 'OUT') {
                 // Warehouse filter
                 if (filterWh !== 'ALL' && tx.sourceWarehouseId !== filterWh) return;

                 tx.items.forEach(line => {
                     const baseQty = line.qty * line.ratio;
                     const current = itemMap.get(line.itemId) || 0;
                     itemMap.set(line.itemId, current + baseQty);
                 });
             }
        });

        // Convert to array, sort desc, take top 3
        const sorted = Array.from(itemMap.entries())
            .map(([itemId, qty]) => {
                const item = items.find(i => i.id === itemId);
                return {
                    name: item ? item.name : 'Unknown',
                    code: item ? item.code : '?',
                    qty: qty
                };
            })
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 3);

        return sorted;
    }, [transactions, items, startDate, endDate, filterWh]);

    const summary = useMemo(() => {
        let totalIn = 0;
        let totalOut = 0;
        flattenedMutations.forEach(m => {
            totalIn += m.in;
            totalOut += m.out;
        });
        return { totalIn, totalOut };
    }, [flattenedMutations]);

    const handleEditClick = (txId: string) => {
        const tx = transactions.find(t => t.id === txId);
        if (tx) {
            onEditTransaction(tx);
        }
    };

    // --- Export Functions ---
    const handleExportExcel = () => {
        const wsData = flattenedMutations.map(m => ({
            Date: m.date,
            'Ref No': m.ref,
            'DO No': m.doNo,
            'Supplier/Customer': m.supplier,
            Type: m.type,
            Warehouse: m.wh,
            'Item Code': m.itemCode,
            'Item Name': m.itemName,
            'Qty In': m.in > 0 ? m.in : '',
            'Qty Out': m.out > 0 ? m.out : '',
            Unit: m.unit,
            Note: m.note
        }));

        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Mutations");
        XLSX.writeFile(wb, `Stock_Mutation_${startDate}_to_${endDate}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc: any = new jsPDF();
        
        // --- Enterprise Header Design ---
        const primaryColor = [30, 41, 59]; // Slate 800
        const accentColor = [37, 99, 235]; // Blue 600

        // Company Title
        doc.setFontSize(22);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.text("GudangPro Inventory", 14, 20);

        // Report Title
        doc.setFontSize(14);
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text("Stock Mutation Report", 14, 28);

        // Line Divider
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(14, 32, 196, 32);

        // Metadata Info Block
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        
        const rightX = 140;
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);
        doc.text(`Period: ${startDate} to ${endDate}`, 14, 45);
        
        doc.text(`Filter WH: ${warehouses.find(w => w.id === filterWh)?.name || 'All Warehouses'}`, rightX, 40);
        doc.text(`Filter Type: ${filterType}`, rightX, 45);

        // --- Table ---
        const tableColumn = ["Date", "Ref / DO", "Type", "Item", "In", "Out", "Unit", "Party"];
        const tableRows: any[] = [];

        flattenedMutations.forEach(m => {
            const row = [
                m.date,
                `${m.ref}\n${m.doNo !== '-' ? m.doNo : ''}`,
                m.type,
                `${m.itemName}\n(${m.itemCode})`,
                m.in > 0 ? m.in : '-',
                m.out > 0 ? m.out : '-',
                m.unit,
                m.supplier !== '-' ? m.supplier : ''
            ];
            tableRows.push(row);
        });

        doc.autoTable({
            startY: 50,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: primaryColor,
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 8,
                textColor: [51, 65, 85], // Slate 700
                cellPadding: 3
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252] // Slate 50
            },
            columnStyles: {
                0: { cellWidth: 20 }, // Date
                1: { cellWidth: 30 }, // Ref
                2: { cellWidth: 20 }, // Type
                3: { cellWidth: 'auto' }, // Item
                4: { cellWidth: 15, halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }, // In
                5: { cellWidth: 15, halign: 'right', fontStyle: 'bold', textColor: [239, 68, 68] }, // Out
                6: { cellWidth: 15, halign: 'center' }, // Unit
                7: { cellWidth: 25 }, // Party
            },
            didDrawPage: (data: any) => {
                // Footer
                const pageCount = doc.internal.getNumberOfPages();
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text('Page ' + pageCount, data.settings.margin.left, doc.internal.pageSize.height - 10);
            }
        });

        doc.save(`Report_${startDate}_${endDate}.pdf`);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-4 gap-4 overflow-hidden">
            {/* Advanced Filters Bar */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col gap-4">
                {/* Row 1: Search, Refresh, Quick Dates */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search Ref No, Item Code, Name, or Notes..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                            />
                        </div>
                        <button onClick={refreshData} className="p-2 text-slate-500 hover:bg-slate-100 rounded-md border border-slate-200 bg-white shadow-sm" title="Refresh Data">
                            <RefreshCw size={18} />
                        </button>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
                         <button onClick={() => setDateRange('TODAY')} className="whitespace-nowrap px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 rounded text-slate-600 transition-all">Today</button>
                         <button onClick={() => setDateRange('WEEK')} className="whitespace-nowrap px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 rounded text-slate-600 transition-all">Last 7 Days</button>
                         <button onClick={() => setDateRange('MONTH')} className="whitespace-nowrap px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 rounded text-slate-600 transition-all">Last 30 Days</button>
                         <button onClick={() => setDateRange('ALL')} className="whitespace-nowrap px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 rounded text-slate-600 transition-all">All Time</button>
                    </div>
                </div>

                {/* Row 2: Detailed Filters */}
                <div className="flex flex-wrap gap-4 items-end pt-2 border-t border-slate-100">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Calendar size={12}/> Date Range</label>
                        <div className="flex items-center bg-slate-50 p-0.5 rounded border border-slate-200">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-0 text-sm outline-none px-2 py-1 text-slate-600 focus:ring-0" />
                            <span className="text-slate-400 text-xs px-1">to</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-0 text-sm outline-none px-2 py-1 text-slate-600 focus:ring-0" />
                        </div>
                    </div>
                    
                    {/* Autocomplete Item Filter */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]" ref={itemInputRef}>
                         <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Package size={12}/> Specific Item</label>
                         <div className="relative">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    className={`w-full border pl-3 pr-8 py-1.5 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white ${filterItem !== 'ALL' ? 'bg-blue-50 border-blue-200 text-blue-800 font-semibold' : ''}`}
                                    placeholder="Type to filter item..."
                                    value={itemSearchQuery}
                                    onChange={e => {
                                        setItemSearchQuery(e.target.value);
                                        setShowItemSuggestions(true);
                                        if (e.target.value === '') setFilterItem('ALL');
                                    }}
                                    onFocus={() => setShowItemSuggestions(true)}
                                    onKeyDown={handleItemKeyDown}
                                />
                                {filterItem !== 'ALL' ? (
                                    <button onClick={clearItemFilter} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700">
                                        <X size={14} />
                                    </button>
                                ) : (
                                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                )}
                            </div>
                            
                            {/* Autocomplete Dropdown */}
                            {showItemSuggestions && (
                                <ul className="absolute z-50 left-0 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    <li 
                                        className="px-3 py-2 hover:bg-slate-50 text-xs text-slate-500 italic cursor-pointer border-b border-slate-50"
                                        onClick={clearItemFilter}
                                    >
                                        -- All Items --
                                    </li>
                                    {itemSuggestions.length === 0 && (
                                        <li className="px-3 py-2 text-xs text-slate-400 italic">No matches found</li>
                                    )}
                                    {itemSuggestions.map((item, idx) => (
                                        <li 
                                            key={item.id}
                                            className={`px-3 py-2 cursor-pointer flex justify-between items-center ${idx === highlightedItemIndex ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                                            onClick={() => selectItemFilter(item)}
                                        >
                                            <span className="text-sm">{item.name}</span>
                                            <span className={`text-xs font-mono ${idx === highlightedItemIndex ? 'text-blue-200' : 'text-slate-400'}`}>{item.code}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                         </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                         <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><User size={12}/> Supplier/Cust</label>
                         <input 
                            type="text" 
                            value={filterSupplier}
                            onChange={e => setFilterSupplier(e.target.value)}
                            placeholder="Name..."
                            className="border px-3 py-1.5 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 w-32"
                         />
                    </div>

                    <div className="flex flex-col gap-1.5">
                         <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Truck size={12}/> DO No.</label>
                         <input 
                            type="text" 
                            value={filterDo}
                            onChange={e => setFilterDo(e.target.value)}
                            placeholder="DO-..."
                            className="border px-3 py-1.5 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 w-32"
                         />
                    </div>

                    <div className="flex flex-col gap-1.5">
                         <label className="text-[10px] font-bold text-slate-500 uppercase">Warehouse</label>
                         <div className="relative">
                            <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="appearance-none border pl-3 pr-8 py-1.5 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white w-32">
                                <option value="ALL">All WH</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                         </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                         <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
                         <div className="relative">
                            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="appearance-none border pl-3 pr-8 py-1.5 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white w-32">
                                <option value="ALL">All Types</option>
                                <option value="IN">Inbound</option>
                                <option value="OUT">Outbound</option>
                                <option value="TRANSFER">Transfer</option>
                                <option value="ADJUSTMENT">Adjustment</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                         </div>
                    </div>

                    <div className="flex-grow"></div>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 transition-colors shadow-sm h-[34px]"
                            title="Download Excel"
                        >
                            <FileSpreadsheet size={16} /> <span className="hidden sm:inline">XLSX</span>
                        </button>
                        <button 
                            onClick={handleExportPDF}
                            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors shadow-sm h-[34px]"
                            title="Download PDF"
                        >
                            <FileText size={16} /> <span className="hidden sm:inline">PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-col md:flex-row gap-4 flex-1 overflow-hidden">
                
                {/* Chart & Summary - Left Side */}
                <div className="w-full md:w-1/3 flex flex-col gap-4 overflow-hidden">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4 flex-shrink-0">
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-emerald-100 flex flex-col items-center justify-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total IN</span>
                            <span className="text-2xl font-bold text-emerald-600 font-mono mt-1">+{summary.totalIn}</span>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-red-100 flex flex-col items-center justify-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total OUT</span>
                            <span className="text-2xl font-bold text-red-600 font-mono mt-1">-{summary.totalOut}</span>
                        </div>
                    </div>

                    {/* Top 3 Outbound Chart */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col flex-1 min-h-[200px]">
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                            <TrendingDown size={14} className="text-red-500"/> Top 3 Outbound Items
                        </h3>
                        <div className="flex-1 min-h-0">
                            {topOutboundChartData.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic">
                                    No outbound data in this period
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={topOutboundChartData} margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{fontSize: 10}} stroke="#cbd5e1" axisLine={false} tickLine={false} />
                                        <YAxis dataKey="code" type="category" tick={{fontSize: 10}} stroke="#cbd5e1" axisLine={false} tickLine={false} width={40} />
                                        <Tooltip 
                                            contentStyle={{ fontSize: '12px', borderRadius: '4px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                                            cursor={{fill: '#f8fafc'}}
                                        />
                                        <Bar dataKey="qty" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20}>
                                            {topOutboundChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#ef4444', '#f87171', '#fca5a5'][index % 3]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        <div className="text-[10px] text-slate-400 text-center mt-2">Based on Total Qty (Base Unit)</div>
                    </div>
                </div>

                {/* Dense Mutation Table - Right Side */}
                <div className="w-full md:w-2/3 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="text-xs font-bold text-slate-600 uppercase">
                             {filterItem !== 'ALL' 
                                ? `Mutation History: ${items.find(i => i.id === filterItem)?.name}`
                                : 'All Transactions Log'
                             }
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400">{flattenedMutations.length} Records</span>
                    </div>
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white text-xs font-bold text-slate-600 uppercase tracking-wide sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 border-b border-slate-200 whitespace-nowrap bg-slate-50">Date</th>
                                    <th className="p-3 border-b border-slate-200 whitespace-nowrap bg-slate-50">Ref No.</th>
                                    <th className="p-3 border-b border-slate-200 bg-slate-50">Type</th>
                                    <th className="p-3 border-b border-slate-200 bg-slate-50">Warehouse</th>
                                    <th className="p-3 border-b border-slate-200 bg-slate-50">Item</th>
                                    <th className="p-3 border-b border-slate-200 text-right bg-slate-50">In</th>
                                    <th className="p-3 border-b border-slate-200 text-right bg-slate-50">Out</th>
                                    <th className="p-3 border-b border-slate-200 text-center bg-slate-50">Unit</th>
                                    <th className="p-3 border-b border-slate-200 bg-slate-50">Info</th>
                                    <th className="p-3 border-b border-slate-200 text-center w-10 bg-slate-50">Act</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs divide-y divide-slate-50">
                                {flattenedMutations.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="p-12 text-center text-slate-400 italic bg-slate-50/50">
                                            <div className="flex flex-col items-center gap-2">
                                                <Search size={32} className="opacity-20" />
                                                <span>No records found matching your criteria.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : flattenedMutations.map((m, i) => (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="p-3 whitespace-nowrap text-slate-500 font-medium">{m.date}</td>
                                        <td className="p-3 font-mono text-slate-600">{m.ref}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                                                m.type === 'IN' || m.type === 'TRANSFER IN' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                m.type === 'OUT' ? 'bg-red-50 text-red-700 border-red-100' :
                                                'bg-blue-50 text-blue-700 border-blue-100'
                                            }`}>
                                                {m.type}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-600">{m.wh}</td>
                                        <td className="p-3 font-medium text-slate-700">
                                            <div className="flex flex-col">
                                                <span>{m.itemCode}</span>
                                                {filterItem === 'ALL' && <span className="text-slate-400 font-normal text-[10px]">{m.itemName}</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right font-mono font-medium text-emerald-600 bg-emerald-50/30">{m.in > 0 ? `+${m.in}` : ''}</td>
                                        <td className="p-3 text-right font-mono font-medium text-red-600 bg-red-50/30">{m.out > 0 ? `-${m.out}` : ''}</td>
                                        <td className="p-3 text-center text-slate-500">{m.unit}</td>
                                        <td className="p-3 text-slate-500 max-w-[150px]">
                                            <div className="flex flex-col gap-0.5">
                                                {(m.supplier && m.supplier !== '-') && (
                                                    <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                                        <User size={8} /> {m.supplier}
                                                    </span>
                                                )}
                                                {(m.doNo && m.doNo !== '-') && (
                                                    <span className="text-[10px] font-mono bg-slate-100 px-1 rounded w-fit flex items-center gap-1">
                                                        <Truck size={8} /> {m.doNo}
                                                    </span>
                                                )}
                                                {m.note && <span className="italic truncate" title={m.note}>{m.note}</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center">
                                            <button 
                                                onClick={() => handleEditClick(m.txId)}
                                                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors"
                                                title="Edit Transaction"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}