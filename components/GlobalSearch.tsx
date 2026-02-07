
import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, Package, Tag, CornerDownLeft, Loader2 } from 'lucide-react';
import { Item } from '../types';
import { useGlobalData } from '../search/SearchProvider';
import { useFuseSearch } from '../search/useFuseSearch';
import { highlightMatch } from '../search/highlightMatch';

interface Props {
  onSelectItem: (item: Item) => void;
}

// Definisikan options di luar komponen agar referensi objek stabil (Performance Optimization)
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

  // Integrasi Fuse.js Hook
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
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className={`h-4 w-4 transition-colors ${isOpen ? 'text-spectra' : 'text-slate-500'}`} />
        </div>
        <input
          ref={inputRef}
          type="text"
          className="block w-full pl-10 pr-4 py-2.5 border border-spectra bg-black/40 text-white rounded-xl placeholder:text-slate-500 focus:ring-2 focus:ring-spectra/30 focus:bg-gable text-sm transition-all shadow-sm outline-none font-bold"
          placeholder="Cari Master Barang (SKU, Nama, Kategori)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => { if(query) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
        />
        <div className="absolute inset-y-0 right-3 flex items-center gap-2">
            {isLoading && <Loader2 size={14} className="animate-spin text-spectra"/>}
            {!query && (
                <kbd className="hidden sm:inline-block border border-spectra rounded px-1.5 text-[10px] font-mono text-cutty bg-gable shadow-sm">
                    /
                </kbd>
            )}
        </div>
      </div>

      {isOpen && query && filteredItems.length > 0 && (
        <div className="absolute z-[100] mt-2 left-0 w-full bg-gable rounded-xl shadow-2xl border border-spectra overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="text-[10px] uppercase font-black text-cutty px-4 py-2 bg-daintree border-b border-spectra flex justify-between items-center tracking-widest">
                <span className="flex items-center gap-1.5"><Tag size={10}/> Sugesti Pencarian</span>
                <span className="flex items-center gap-1">Pilih Item <CornerDownLeft size={10}/></span>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto scrollbar-thin">
                {filteredItems.map((item, index) => (
                <li
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`cursor-pointer px-4 py-3 border-b border-spectra/20 last:border-0 flex justify-between items-center transition-colors ${
                        index === selectedIndex ? 'bg-spectra/40' : 'hover:bg-spectra/10'
                    }`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg transition-colors ${index === selectedIndex ? 'bg-white text-spectra shadow-lg' : 'bg-daintree text-spectra'}`}>
                            <Package size={16} />
                        </div>
                        <div className="flex flex-col min-w-0 pr-4">
                            <span className={`text-xs font-bold truncate ${index === selectedIndex ? 'text-white' : 'text-slate-200'}`}>
                                 {highlightMatch(item.name, query)}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-mono font-black uppercase ${index === selectedIndex ? 'text-white/80' : 'text-emerald-500'}`}>
                                    {highlightMatch(item.code, query)}
                                </span>
                                <span className="text-[10px] text-slate-500">•</span>
                                <span className={`text-[10px] font-bold uppercase truncate ${index === selectedIndex ? 'text-white/60' : 'text-slate-600'}`}>
                                    {highlightMatch(item.category, query)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                            index === selectedIndex ? 'bg-white border-white text-spectra' : 'bg-daintree border-spectra text-slate-400'
                        }`}>
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
