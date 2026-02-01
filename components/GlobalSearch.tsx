import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, ArrowRight, Package, Tag } from 'lucide-react';
import { Item } from '../types';
import { StorageService } from '../services/storage';

interface Props {
  onSelectItem: (item: Item) => void;
}

export const GlobalSearch: React.FC<Props> = ({ onSelectItem }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load items on mount
  useEffect(() => {
    setItems(StorageService.getItems());
  }, []);

  // Filter Logic (Fuzzy-ish)
  useEffect(() => {
    if (!query) {
      setFilteredItems([]);
      setIsOpen(false);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const terms = lowerQuery.split(' ').filter(t => t.length > 0);

    const results = items.filter(item => {
      const searchString = `${item.code} ${item.name} ${item.category}`.toLowerCase();
      return terms.every(term => searchString.includes(term));
    }).slice(0, 8);

    setFilteredItems(results);
    setIsOpen(results.length > 0);
    setSelectedIndex(0);
  }, [query, items]);

  // Click Outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (item: Item) => {
    onSelectItem(item);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          className="block w-full pl-10 pr-4 py-2.5 border-0 bg-slate-100/80 text-slate-900 rounded-xl ring-1 ring-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all shadow-sm"
          placeholder="Cari Barang (Kode, Nama, atau Kategori)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if(query) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <kbd className="hidden sm:inline-block border border-slate-300 rounded px-1.5 text-[10px] font-mono text-slate-400 bg-white shadow-sm">
            /
          </kbd>
        </div>
      </div>

      {/* Dropdown Results - Posisi Tepat di Bawah Search Bar */}
      {isOpen && (
        <div className="absolute z-[100] mt-2 left-0 w-full bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="text-[10px] uppercase font-bold text-slate-400 px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <span className="flex items-center gap-1.5"><Tag size={10}/> Hasil Pencarian</span>
                <span>Pilih dengan <ArrowRight size={10} className="inline mx-1"/> atau Enter</span>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto">
                {filteredItems.map((item, index) => (
                <li
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={`cursor-pointer px-4 py-3 border-b border-slate-50 last:border-0 flex justify-between items-center transition-colors ${
                        index === selectedIndex ? 'bg-blue-600 text-white' : 'hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${index === selectedIndex ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
                            <Package size={18} />
                        </div>
                        <div className="flex flex-col">
                            <span className={`text-sm font-bold ${index === selectedIndex ? 'text-white' : 'text-slate-800'}`}>
                                 {item.name}
                            </span>
                            <span className={`text-xs font-mono ${index === selectedIndex ? 'text-blue-100' : 'text-slate-500'}`}>
                                {item.code} • {item.category}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                            index === selectedIndex ? 'bg-blue-500 border-blue-400 text-white' : 'bg-slate-100 border-slate-200 text-slate-500'
                        }`}>
                            {item.baseUnit}
                        </span>
                        {index === selectedIndex && <ArrowRight size={16} className="text-white animate-pulse" />}
                    </div>
                </li>
                ))}
            </ul>
        </div>
      )}
    </div>
  );
};
