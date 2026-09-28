import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface TopBarState {
  /** Ruta a la que vuelve el ícono de la topbar, o null si esta vista no tiene a dónde volver. */
  backTo: string | null;
  setBackTo: (path: string | null) => void;
}

const TopBarContext = createContext<TopBarState | null>(null);

export function TopBarProvider({ children }: { children: ReactNode }) {
  const [backTo, setBackTo] = useState<string | null>(null);
  const value = useMemo(() => ({ backTo, setBackTo }), [backTo]);
  return <TopBarContext.Provider value={value}>{children}</TopBarContext.Provider>;
}

export function useTopBar() {
  const ctx = useContext(TopBarContext);
  if (!ctx) throw new Error('useTopBar debe usarse dentro de TopBarProvider');
  return ctx;
}

/**
 * Registra el destino del ícono "volver" de la topbar mientras la vista esté
 * montada. Sustituye al `<div className="cback">` que cada página repetía dentro
 * de su hero: el destino ya estaba hardcodeado en cada una, así que se preserva
 * tal cual en lugar de deducirlo de `history` (que incluye entradas ajenas a la
 * app y no distingue navegación interna de externa).
 *
 * Pasarlo sin argumento (o null) deja la vista sin ícono de volver. El orden de
 * los efectos de React garantiza que el cleanup de la vista que sale no pise el
 * destino de la que entra, y que bajo StrictMode (doble invocación en dev) el
 * valor final sea el correcto.
 */
export function useBackTarget(path?: string | null) {
  const { setBackTo } = useTopBar();
  useEffect(() => {
    setBackTo(path ?? null);
    return () => setBackTo(null);
  }, [path, setBackTo]);
}
