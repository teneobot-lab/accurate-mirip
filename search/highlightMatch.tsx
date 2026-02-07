
import React from 'react';

// Fungsi untuk escape karakter khusus regex agar pencarian aman (misal: "+", "*", "(", dll)
const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const highlightMatch = (text: string, query: string) => {
  if (!query || !query.trim() || !text) return <span>{text}</span>;

  const cleanQuery = escapeRegExp(query.trim());
  if (!cleanQuery) return <span>{text}</span>;

  // Split text berdasarkan query (case-insensitive)
  const parts = text.split(new RegExp(`(${cleanQuery})`, 'gi'));

  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === cleanQuery.toLowerCase() ? (
          <span key={i} className="search-highlight">{part}</span>
        ) : (
          part
        )
      )}
    </span>
  );
};
