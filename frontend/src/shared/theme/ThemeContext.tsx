import { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../modules/auth/AuthContext';

export interface ActiveTheme {
  primaryColor: string;
  logoUrl: string | null;
}

const DEFAULT_COLOR = '#0057B8';

/** Rutas de sistema que siempre usan el tema del usuario (empresa activa). */
const SYSTEM_ROUTES = new Set([
  '/home',
  '/profile',
  '/config',
  '/global-config',
  '/users',
  '/profiles',
  '/login',
  '/test',
]);

function hexToRgb(hex: string): string | null {
  const m = hex.replace('#', '');
  if (m.length !== 6) return null;
  const int = parseInt(m, 16);
  return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
}

function shade(color: string, factor: number): string {
  const m = color.replace('#', '');
  if (m.length !== 6) return color;
  const int = parseInt(m, 16);
  let r = (int >> 16) & 255;
  let g = (int >> 8) & 255;
  let b = int & 255;
  if (factor >= 0) {
    r = Math.round(r + (255 - r) * factor);
    g = Math.round(g + (255 - g) * factor);
    b = Math.round(b + (255 - b) * factor);
  } else {
    r = Math.round(r * (1 + factor));
    g = Math.round(g * (1 + factor));
    b = Math.round(b * (1 + factor));
  }
  return `rgb(${r}, ${g}, ${b})`;
}

interface ThemeContextValue {
  theme: ActiveTheme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { bootstrap } = useAuth();
  const { pathname } = useLocation();

  const theme = useMemo<ActiveTheme>(() => {
    const userTheme: ActiveTheme = {
      primaryColor: bootstrap?.company?.theme.primaryColor || DEFAULT_COLOR,
      logoUrl: bootstrap?.company?.theme.logoUrl || null,
    };
    if (!bootstrap || SYSTEM_ROUTES.has(pathname)) return userTheme;

    const placements = bootstrap.modulePlacements || [];
    const match = placements
      .filter((p) => p.theme && (pathname === p.path || pathname.startsWith(`${p.path}/`)))
      .sort((a, b) => b.path.length - a.path.length)[0];

    return match?.theme?.primaryColor
      ? { primaryColor: match.theme.primaryColor, logoUrl: match.theme.logoUrl || null }
      : userTheme;
  }, [bootstrap, pathname]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', theme.primaryColor);
    const rgb = hexToRgb(theme.primaryColor) || '0, 87, 184';
    root.style.setProperty('--accent-rgb', rgb);
    root.style.setProperty('--accent-deep', shade(theme.primaryColor, -0.35));
    root.style.setProperty('--accent-soft', shade(theme.primaryColor, 0.9));
  }, [theme]);

  return <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ActiveTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx.theme;
}