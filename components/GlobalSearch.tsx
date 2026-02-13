
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
          <Search className={`h-3.5 w-3.5 transition-colors ${isOpen ? 'text-slate-200' : 'text-slate-400'}`} />
        </div>
        <input
          ref={inputRef} type="text"
          className="block w-full pl-9 pr-4 py-1.5 border border-slate-700/50 bg-slate-800/50 text-slate-200 rounded-lg placeholder:text-slate-500 focus:ring-1 focus:ring-slate-700 focus:bg-slate-800 focus:border-slate-600 text-[11px] font-medium transition-all outline-none"
          placeholder="Cari Master Barang..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setSelectedIndex(0); }}
          onFocus={() => { if(query) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-3 flex items-center gap-2">
            {isLoading && <Loader2 size={12} className="animate-spin text-slate-500"/>}
            {!query && (
                <kbd className="hidden sm:inline-block border border-slate-700/50 rounded px-1.5 py-0.5 text-[9px] font-medium text-slate-500 bg-slate-800/30">
                    /
                </kbd>
            )}
        </div>
      </div>

      {isOpen && query && filteredItems.length > 0 && (
        <div className="absolute z-[100] mt-1.5 left-0 w-full bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="text-[9px] uppercase font-semibold text-slate-500 px-3 py-1.5 bg-slate-900/20 border-b border-slate-700/50 flex justify-between items-center tracking-wider">
                <span className="flex items-center gap-1.5"><Tag size={10}/> Hasil Pencarian</span>
            </div>
            <ul className="max-h-60 overflow-y-auto">
                {filteredItems.map((item, index) => (
                <li
                    key={item.id} onClick={() => handleSelect(item)} onMouseEnter={() => setSelectedIndex(index)}
                    className={`cursor-pointer px-3 py-2 border-b border-slate-700/30 last:border-0 flex justify-between items-center transition-colors ${
                        index === selectedIndex ? 'bg-slate-700/50' : 'hover:bg-slate-700/20'
                    }`}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded transition-all ${index === selectedIndex ? 'text-white' : 'text-slate-400'}`}>
                            <Package size={14} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className={`text-[11px] font-semibold truncate ${index === selectedIndex ? 'text-white' : 'text-slate-300'}`}>
                                 {highlightMatch(item.name, query)}
                            </span>
                            <span className={`text-[9px] font-mono tracking-tight ${index === selectedIndex ? 'text-slate-400' : 'text-slate-500'}`}>
                                {highlightMatch(item.code, query)}
                            </span>
                        </div>
                    </div>
                    {index === selectedIndex && <ArrowRight size={12} className="text-slate-400" />}
                </li>
                ))}
            </ul>
        </div>
      )}
    </div>
  );
};
