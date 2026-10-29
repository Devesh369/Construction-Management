import { create } from 'zustand';

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('constructpm-theme') || localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
};

const applyThemeToDOM = (theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  let effectiveTheme = theme;
  if (theme === 'system') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  if (effectiveTheme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
};

const getInitialCompact = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('constructpm-compact') === 'true';
};

export const useUIStore = create((set, get) => {
  const initialTheme = getInitialTheme();
  applyThemeToDOM(initialTheme);
  const initialCompact = getInitialCompact();
  if (typeof document !== 'undefined' && initialCompact) {
    document.body.classList.add('compact-mode');
  }

  return {
    theme: initialTheme,
    compactMode: initialCompact,
    sidebarCollapsed: false,
    mobileMenuOpen: false,

    // Backward-compatible aliases
    isSidebarOpen: true,
    toggleSidebar: () => {
      set((s) => ({
        isSidebarOpen: !s.isSidebarOpen,
        sidebarCollapsed: !s.sidebarCollapsed,
        mobileMenuOpen: !s.mobileMenuOpen,
      }));
    },

    setTheme: (theme) => {
      localStorage.setItem('constructpm-theme', theme);
      localStorage.setItem('theme', theme);
      applyThemeToDOM(theme);
      set({ theme });
    },

    toggleTheme: () => {
      const current = get().theme;
      const next = current === 'dark' ? 'light' : 'dark';
      get().setTheme(next);
    },

    setCompactMode: (compactMode) => {
      localStorage.setItem('constructpm-compact', String(compactMode));
      if (typeof document !== 'undefined') {
        if (compactMode) {
          document.body.classList.add('compact-mode');
        } else {
          document.body.classList.remove('compact-mode');
        }
      }
      set({ compactMode });
    },

    toggleCompactMode: () => {
      const next = !get().compactMode;
      get().setCompactMode(next);
    },

    setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

    setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
    toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  };
});
