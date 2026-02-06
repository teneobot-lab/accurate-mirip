
import React from 'react';

export const highlightMatch = (text: string, query: string) => {
  if (!query.trim()) return <span>{text}</span>;

  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="search-highlight">{part}</span>
        ) : (
          part
        )
      )}
    </span>
  );
};
