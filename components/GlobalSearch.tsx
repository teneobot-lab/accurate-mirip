
import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, Package, Tag, CornerDownLeft, Loader2 } from 'lucide-react';
import { Item } from '../types';
import { useGlobalData } from '../search/SearchProvider';
import { useFuseSearch } from '../search/useFuseSearch';
import { highlightMatch } from '../search/highlightMatch';

interface Props {
  onSelectItem: (item: Item) => void;
}

const SEARCH_OPTIONS = { 
  keys: ['code', 'name', 'category'], 
  limit: 8 
};

export const GlobalSearch: React.FC<Props> = ({ onSelectItem }) => {
  const { masterItems, isLoading } = useGlobalData();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { search } = useFuseSearch(masterItems, SEARCH_OPTIONS);
  const filteredItems = search(query);

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
      if (filteredItems[selectedIndex]) handleSelect(filteredItems[selectedIndex]);
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
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className={`h-4 w-4 transition-colors ${isOpen ? 'text-white' : 'text-slate-500'}`} />
        </div>
        <input
          ref={inputRef} type="text"
          className="block w-full pl-10 pr-4 py-1.5 border border-white/10 bg-white/5 text-white rounded-lg placeholder:text-slate-500 focus:ring-2 focus:ring-white/5 focus:bg-white/10 focus:border-white/20 text-[11px] font-bold transition-all shadow-inner outline-none"
          placeholder="Cari Master Barang (SKU, Nama)..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setSelectedIndex(0); }}
          onFocus={() => { if(query) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-3 flex items-center gap-2">
            {isLoading && <Loader2 size={14} className="animate-spin text-slate-400"/>}
            {!query && (
                <kbd className="hidden sm:inline-block border border-white/10 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-slate-500 bg-white/5">
                    /
                </kbd>
            )}
        </div>
      </div>

      {isOpen && query && filteredItems.length > 0 && (
        <div className="absolute z-[100] mt-2 left-0 w-full bg-slate-800 rounded-xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="text-[9px] uppercase font-black text-slate-500 px-4 py-2 bg-slate-900/50 border-b border-white/5 flex justify-between items-center tracking-widest">
                <span className="flex items-center gap-2"><Tag size={10}/> Sugesti Barang</span>
                <span className="flex items-center gap-1 opacity-50 font-bold">ENTER <CornerDownLeft size={10}/></span>
            </div>
            <ul className="max-h-64 overflow-y-auto">
                {filteredItems.map((item, index) => (
                <li
                    key={item.id} onClick={() => handleSelect(item)} onMouseEnter={() => setSelectedIndex(index)}
                    className={`cursor-pointer px-4 py-3 border-b border-white/5 last:border-0 flex justify-between items-center transition-colors ${
                        index === selectedIndex ? 'bg-white/5' : 'hover:bg-white/[0.02]'
                    }`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg transition-all ${index === selectedIndex ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-500'}`}>
                            <Package size={14} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className={`text-[12px] font-bold truncate ${index === selectedIndex ? 'text-white' : 'text-slate-300'}`}>
                                 {highlightMatch(item.name, query)}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${index === selectedIndex ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {highlightMatch(item.code, query)}
                                </span>
                                <span className="text-white/10">•</span>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                    {item.category}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10 uppercase">
                            {item.baseUnit}
                        </span>
                        {index === selectedIndex && <ArrowRight size={14} className="text-white animate-in slide-in-from-left-1" />}
                    </div>
                </li>
                ))}
            </ul>
        </div>
      )}
    </div>
  );
};
