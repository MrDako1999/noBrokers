import { create } from 'zustand';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(theme) {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(theme) {
  const resolved = resolve(theme);
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  return resolved;
}

const stored = typeof window !== 'undefined'
  ? localStorage.getItem('nb-theme') || 'system'
  : 'system';

const useThemeStore = create((set) => ({
  theme: stored,
  resolvedTheme: typeof window !== 'undefined' ? resolve(stored) : 'light',

  setTheme: (theme) => {
    localStorage.setItem('nb-theme', theme);
    const resolvedTheme = applyTheme(theme);
    set({ theme, resolvedTheme });
  },

  initTheme: () => {
    const t = localStorage.getItem('nb-theme') || 'system';
    const resolvedTheme = applyTheme(t);
    set({ theme: t, resolvedTheme });
  },
}));

export default useThemeStore;
