
import { useMemo } from 'react';
import Fuse from 'fuse.js';

interface UseFuseOptions<T> {
  keys: string[];
  threshold?: number;
  limit?: number;
}

export function useFuseSearch<T>(data: T[], options: UseFuseOptions<T>) {
  const fuse = useMemo(() => {
    return new Fuse(data, {
      keys: options.keys,
      threshold: options.threshold ?? 0.35,
      shouldSort: true,
      includeMatches: true,
      minMatchCharLength: 1,
      distance: 100,
      location: 0,
    });
  }, [data, options.keys, options.threshold]);

  const search = (query: string) => {
    if (!query.trim()) return data.slice(0, options.limit ?? 15);
    
    const results = fuse.search(query);
    if (options.limit) {
      return results.slice(0, options.limit).map(r => r.item);
    }
    return results.map(r => r.item);
  };

  // Helper untuk mendapatkan match result dengan metadata fuse
  const searchWithMetadata = (query: string) => {
    if (!query.trim()) return [];
    return fuse.search(query);
  };

  return { search, searchWithMetadata, fuse };
}
