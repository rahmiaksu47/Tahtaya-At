import React, { createContext, useContext, useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = 'tahtaya-at-pro-theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to 'light' (Aydınlık Sınıf Modu) as confirmed by the user
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

interface ThemeToggleProps {
  compact?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={theme === 'light' ? 'Koyu Temaya (Gece Modu) Geç' : 'Açık Temaya (Aydınlık Sınıf Modu) Geç'}
      aria-label="Tema Değiştir"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#193654] bg-white dark:bg-[#10243b] hover:bg-slate-50 dark:hover:bg-[#15304f] text-slate-700 dark:text-slate-200 font-medium text-xs transition-all duration-150 active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
        compact ? 'p-2' : 'px-3 py-1.5'
      }`}
    >
      {theme === 'light' ? (
        <>
          <Moon className="w-3.5 h-3.5 text-slate-700" />
          {!compact && <span>Koyu Tema</span>}
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          {!compact && <span>Açık Tema</span>}
        </>
      )}
    </button>
  );
};
