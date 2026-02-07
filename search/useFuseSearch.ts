
import { useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';

interface UseFuseOptions<T> {
  keys: string[];
  threshold?: number;
  limit?: number;
}

export function useFuseSearch<T>(data: T[], options: UseFuseOptions<T>) {
  // Stabilisasi dependensi keys menggunakan JSON.stringify agar Fuse tidak di-recreate
  // jika array keys baru dikirim dengan isi yang sama.
  const keysKey = JSON.stringify(options.keys);

  const fuse = useMemo(() => {
    return new Fuse(data, {
      keys: options.keys,
      threshold: options.threshold ?? 0.35, // 0.0 = exact match, 1.0 = match anything. 0.35 is a balanced typo tolerance.
      shouldSort: true,
      includeMatches: true,
      minMatchCharLength: 1,
      distance: 100,
      location: 0,
      ignoreLocation: false, 
    });
  }, [data, keysKey, options.threshold]);

  const search = useCallback((query: string) => {
    if (!query || !query.trim()) {
      return data.slice(0, options.limit ?? 15);
    }
    
    const results = fuse.search(query);
    
    // Extract item dari hasil Fuse
    const items = results.map(r => r.item);

    if (options.limit) {
      return items.slice(0, options.limit);
    }
    return items;
  }, [fuse, data, options.limit]);

  // Expose fuse instance dan fungsi searchWithMetadata jika butuh score/matches detail
  const searchWithMetadata = useCallback((query: string) => {
    if (!query.trim()) return [];
    return fuse.search(query);
  }, [fuse]);

  return { search, searchWithMetadata, fuse };
}
