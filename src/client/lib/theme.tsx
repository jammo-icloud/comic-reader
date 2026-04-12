import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMe, updatePreferences } from './api';

type Theme = 'dark' | 'light';

const ThemeContext = createContext<{ theme: Theme; toggle: () => void; username: string }>({
  theme: 'dark',
  toggle: () => {},
  username: '',
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('comic-reader-theme');
    return (saved === 'light' ? 'light' : 'dark') as Theme;
  });
  const [username, setUsername] = useState('');

  // Sync with server on mount
  useEffect(() => {
    getMe().then(({ username: user, preferences }) => {
      setUsername(user);
      if (preferences.theme !== theme) {
        setTheme(preferences.theme);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('comic-reader-theme', theme);
  }, [theme]);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    updatePreferences({ theme: next }).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, username }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
