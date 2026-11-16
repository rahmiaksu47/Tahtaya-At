import React, { createContext, useContext, useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = 'tahtaya-at-pro-theme-mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to 'dark' (Koyu Tema) as requested by the user
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const persistTheme = (mode: ThemeMode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore storage errors
    }
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      persistTheme(next);
      return next;
    });
  };

  const setTheme = (mode: ThemeMode) => {
    persistTheme(mode);
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#193654] bg-white dark:bg-[#10243b] hover:bg-slate-50 dark:hover:bg-[#15304f] text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all duration-150 active:scale-95 whitespace-nowrap shrink-0 cursor-pointer min-h-[42px] ${
        compact ? 'min-w-[42px] p-2.5' : 'px-3.5 py-2'
      }`}
    >
      {theme === 'light' ? (
        <>
          <Moon className="w-4 h-4 text-slate-700" />
          {!compact && <span>Koyu Tema</span>}
        </>
      ) : (
        <>
          <Sun className="w-4 h-4 text-amber-400" />
          {!compact && <span>Açık Tema</span>}
        </>
      )}
    </button>
  );
};

