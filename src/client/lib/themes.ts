/**
 * Theme definitions and utilities.
 * 12 themes: 6 dark + 6 light, shown as 6 paired rows.
 */

export interface ThemeDef {
  id: string;
  name: string;
  isDark: boolean;
  description: string;
  // Preview swatch colors (for the picker UI)
  bg: string;
  surface: string;
  accent: string;
  text: string;
}

export const DARK_THEMES: ThemeDef[] = [
  { id: 'midnight', name: 'Midnight', isDark: true, description: 'Dracula — playful purple', bg: '#282A36', surface: '#44475A', accent: '#BD93F9', text: '#F8F8F2' },
  { id: 'nord-frost', name: 'Nord Frost', isDark: true, description: 'Cool arctic blues', bg: '#2E3440', surface: '#3B4252', accent: '#88C0D0', text: '#ECEFF4' },
  { id: 'mocha', name: 'Mocha', isDark: true, description: 'Catppuccin — warm pastels', bg: '#1E1E2E', surface: '#313244', accent: '#CBA6F7', text: '#CDD6F4' },
  { id: 'rosewood', name: 'Rosewood', isDark: true, description: 'Rose Pine — vintage', bg: '#191724', surface: '#1F1D2E', accent: '#C4A7E7', text: '#E0DEF4' },
  { id: 'tankobon-dark', name: 'Tankobon Dark', isDark: true, description: 'Manga cafe at night', bg: '#1A1816', surface: '#262320', accent: '#E63525', text: '#D5D0C3' },
  { id: 'newsprint-dark', name: 'Newsprint Dark', isDark: true, description: 'Comic shop after hours', bg: '#1C1A15', surface: '#282520', accent: '#E20025', text: '#E8DCC0' },
];

export const LIGHT_THEMES: ThemeDef[] = [
  { id: 'latte', name: 'Latte', isDark: false, description: 'Catppuccin — warm lavender', bg: '#EFF1F5', surface: '#CCD0DA', accent: '#8839EF', text: '#4C4F69' },
  { id: 'dawn', name: 'Dawn', isDark: false, description: 'Rose Pine — warm parchment', bg: '#FAF4ED', surface: '#FFFAF3', accent: '#907AA9', text: '#575279' },
  { id: 'alucard', name: 'Alucard', isDark: false, description: 'Dracula — aged ivory', bg: '#FFFBEB', surface: '#F5F0DE', accent: '#644AC9', text: '#1F1F1F' },
  { id: 'gruvbox-sand', name: 'Gruvbox Sand', isDark: false, description: 'Retro warm orange', bg: '#FBF1C7', surface: '#EBDBB2', accent: '#D65D0E', text: '#3C3836' },
  { id: 'tankobon', name: 'Tankobon', isDark: false, description: 'Authentic manga paper', bg: '#EDE8D5', surface: '#E3DCCA', accent: '#E63525', text: '#1A1714' },
  { id: 'newsprint', name: 'Newsprint', isDark: false, description: 'Classic comic paper', bg: '#F2E8C9', surface: '#E8D9B5', accent: '#E20025', text: '#0F0E0C' },
];

// Paired for the settings UI: [dark, light]
export const THEME_PAIRS: [ThemeDef, ThemeDef][] = [
  [DARK_THEMES[0], LIGHT_THEMES[0]],  // Midnight / Latte
  [DARK_THEMES[1], LIGHT_THEMES[1]],  // Nord Frost / Dawn
  [DARK_THEMES[2], LIGHT_THEMES[2]],  // Mocha / Alucard
  [DARK_THEMES[3], LIGHT_THEMES[3]],  // Rosewood / Gruvbox Sand
  [DARK_THEMES[4], LIGHT_THEMES[4]],  // Tankobon Dark / Tankobon
  [DARK_THEMES[5], LIGHT_THEMES[5]],  // Newsprint Dark / Newsprint
];

export const ALL_THEMES = [...DARK_THEMES, ...LIGHT_THEMES];

const DARK_IDS = new Set(DARK_THEMES.map((t) => t.id));

export function isDarkTheme(themeId: string): boolean {
  return DARK_IDS.has(themeId);
}

/**
 * Apply a theme to the document. Sets data-theme attribute and dark class.
 */
export function applyTheme(themeId: string) {
  const html = document.documentElement;
  html.setAttribute('data-theme', themeId);
  if (isDarkTheme(themeId)) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}
