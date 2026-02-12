
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
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className={`h-5 w-5 transition-colors ${isOpen ? 'text-brand' : 'text-slate-400'}`} />
        </div>
        <input
          ref={inputRef} type="text"
          className="block w-full pl-12 pr-4 py-3 border border-slate-200 bg-slate-50 text-slate-900 rounded-2xl placeholder:text-slate-400 focus:ring-4 focus:ring-brand/5 focus:bg-white focus:border-brand text-sm font-semibold transition-all shadow-sm outline-none"
          placeholder="Cari Master Barang (SKU, Nama)..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setSelectedIndex(0); }}
          onFocus={() => { if(query) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-4 flex items-center gap-2">
            {isLoading && <Loader2 size={16} className="animate-spin text-brand"/>}
            {!query && (
                <kbd className="hidden sm:inline-block border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] font-bold text-slate-400 bg-white">
                    /
                </kbd>
            )}
        </div>
      </div>

      {isOpen && query && filteredItems.length > 0 && (
        <div className="absolute z-[100] mt-3 left-0 w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="text-[10px] uppercase font-black text-slate-400 px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center tracking-[0.2em]">
                <span className="flex items-center gap-2"><Tag size={12}/> Sugesti Barang</span>
                <span className="flex items-center gap-1 opacity-50">Tekan Enter <CornerDownLeft size={12}/></span>
            </div>
            <ul className="max-h-80 overflow-y-auto">
                {filteredItems.map((item, index) => (
                <li
                    key={item.id} onClick={() => handleSelect(item)} onMouseEnter={() => setSelectedIndex(index)}
                    className={`cursor-pointer px-5 py-4 border-b border-slate-50 last:border-0 flex justify-between items-center transition-colors ${
                        index === selectedIndex ? 'bg-brand/[0.03]' : 'hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center gap-4 min-w-0">
                        <div className={`p-2.5 rounded-xl transition-all ${index === selectedIndex ? 'bg-brand text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                            <Package size={18} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className={`text-sm font-extrabold truncate ${index === selectedIndex ? 'text-brand' : 'text-slate-800'}`}>
                                 {highlightMatch(item.name, query)}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-mono font-black uppercase tracking-widest ${index === selectedIndex ? 'text-brand/70' : 'text-slate-400'}`}>
                                    {highlightMatch(item.code, query)}
                                </span>
                                <span className="text-slate-200">•</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                    {item.category}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[9px] font-black px-2 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase">
                            {item.baseUnit}
                        </span>
                        {index === selectedIndex && <ArrowRight size={18} className="text-brand animate-in slide-in-from-left-2" />}
                    </div>
                </li>
                ))}
            </ul>
        </div>
      )}
    </div>
  );
};
