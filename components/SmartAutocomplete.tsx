
import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Search, Loader2, Package, Tag, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useFuseSearch } from '../search/useFuseSearch';
import { highlightMatch } from '../search/highlightMatch';

interface SmartAutocompleteProps<T> {
  data: T[];
  searchKeys: string[];
  placeholder?: string;
  onSelect: (item: T) => void;
  renderItem?: (item: T, isSelected: boolean, query: string) => React.ReactNode;
  className?: string;
  isLoading?: boolean;
}

export const SmartAutocomplete = forwardRef(<T extends { id: string | number }>(
  {
    data,
    searchKeys,
    placeholder = "Cari...",
    onSelect,
    renderItem,
    className = "",
    isLoading = false
  }: SmartAutocompleteProps<T>,
  ref: React.Ref<any>
) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => setQuery('')
  }));

  const { search } = useFuseSearch(data, { keys: searchKeys, limit: 10 });
  const results = search(query);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
        if (e.key === 'ArrowDown') setIsOpen(true);
        return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (item: T) => {
    onSelect(item);
    setQuery((item as any).name || (item as any).code || '');
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative group">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isOpen ? 'text-spectra' : 'text-slate-500'}`} size={16} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-daintree border border-spectra rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-spectra/30 transition-all placeholder:text-slate-600"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-spectra" size={16} />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 bg-gable border border-spectra rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {results.map((item, index) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`px-4 py-3 cursor-pointer flex items-center justify-between border-b border-spectra/20 last:border-0 transition-colors ${
                  index === selectedIndex ? 'bg-spectra/40' : 'hover:bg-spectra/10'
                }`}
              >
                <div className="flex-1 min-w-0">
                  {renderItem ? renderItem(item, index === selectedIndex, query) : (
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-200">{(item as any).name || (item as any).code}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-tighter">{(item as any).id}</span>
                    </div>
                  )}
                </div>
                {index === selectedIndex && (
                  <div className="flex items-center gap-2 text-[10px] font-black text-spectra animate-in slide-in-from-right-1">
                    <span>ENTER</span>
                    <CornerDownLeft size={12} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
