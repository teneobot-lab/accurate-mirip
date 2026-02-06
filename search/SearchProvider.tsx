
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Item, Warehouse, Partner } from '../types';

interface SearchContextType {
  masterItems: Item[];
  warehouses: Warehouse[];
  partners: Partner[];
  isLoading: boolean;
  refreshAll: () => Promise<void>;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [masterItems, setMasterItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAll = async () => {
    setIsLoading(true);
    try {
      const [items, whs, pts] = await Promise.all([
        StorageService.fetchItems().catch(() => []),
        StorageService.fetchWarehouses().catch(() => []),
        StorageService.fetchPartners().catch(() => [])
      ]);
      setMasterItems(items);
      setWarehouses(whs);
      setPartners(pts);
    } catch (e) {
      console.error("SearchProvider: Failed to load master data", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const value = useMemo(() => ({
    masterItems,
    warehouses,
    partners,
    isLoading,
    refreshAll
  }), [masterItems, warehouses, partners, isLoading]);

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
};

export const useGlobalData = () => {
  const context = useContext(SearchContext);
  if (!context) throw new Error("useGlobalData must be used within SearchProvider");
  return context;
};
