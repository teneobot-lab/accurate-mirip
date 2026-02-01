
import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { StorageService } from '../services/storage';

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(StorageService.getTheme());

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    StorageService.saveTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative p-2.5 rounded-xl transition-all duration-300 ease-in-out border overflow-hidden
        ${theme === 'light' 
          ? 'bg-white text-orange-500 border-slate-200 hover:bg-orange-50 hover:border-orange-200' 
          : 'bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700 hover:border-slate-600'}
        shadow-sm active:scale-95
      `}
      title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
    >
      <div className="relative w-5 h-5">
        <Sun 
          size={20} 
          className={`absolute inset-0 transition-all duration-500 ease-spring ${
            theme === 'dark' ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`} 
        />
        <Moon 
          size={20} 
          className={`absolute inset-0 transition-all duration-500 ease-spring ${
            theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          }`} 
        />
      </div>
    </button>
  );
};
