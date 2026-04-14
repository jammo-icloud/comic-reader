import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMe, updatePreferences } from './api';
import { applyTheme, isDarkTheme, THEME_PAIRS } from './themes';

const ThemeContext = createContext<{
  theme: string;
  isDark: boolean;
  setTheme: (id: string) => void;
  toggleDarkLight: () => void;
  username: string;
}>({
  theme: 'midnight',
  isDark: true,
  setTheme: () => {},
  toggleDarkLight: () => {},
  username: '',
});

/**
 * Find the paired theme (dark<->light) for a given theme.
 */
function getPairedTheme(themeId: string): string {
  for (const [dark, light] of THEME_PAIRS) {
    if (dark.id === themeId) return light.id;
    if (light.id === themeId) return dark.id;
  }
  return isDarkTheme(themeId) ? 'latte' : 'midnight';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('comic-reader-theme') || 'midnight';
  });
  const [username, setUsername] = useState('');

  // Sync with server on mount
  useEffect(() => {
    getMe().then(({ username: user, preferences }) => {
      setUsername(user);
      const serverTheme = preferences.theme || 'midnight';
      setThemeState(serverTheme);
      applyTheme(serverTheme);
      localStorage.setItem('comic-reader-theme', serverTheme);
    }).catch(() => {
      // Use localStorage fallback
      applyTheme(theme);
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('comic-reader-theme', theme);
  }, [theme]);

  const setTheme = (id: string) => {
    setThemeState(id);
    updatePreferences({ theme: id }).catch(() => {});
  };

  const toggleDarkLight = () => {
    const paired = getPairedTheme(theme);
    setTheme(paired);
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      isDark: isDarkTheme(theme),
      setTheme,
      toggleDarkLight,
      username,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
