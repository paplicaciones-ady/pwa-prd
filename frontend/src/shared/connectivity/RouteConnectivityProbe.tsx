import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useConnectivity } from './ConnectivityContext';

/**
 * Intervalo mínimo entre sondas disparadas por cambio de ruta. El
 * ConnectivityProvider ya tiene su propio throttling de eventos (30s), pero
 * `refresh()` lo fuerza; este gap evita una ráfaga de requests si el usuario
 * salta rápido entre módulos.
 */
const ROUTE_PROBE_MIN_GAP_MS = 8_000;

/**
 * Dispara una sonda de conectividad cada vez que cambia la ruta activa,
 * siempre que no haya otra en vuelo y haya pasado el gap mínimo. Así al entrar
 * a cualquier módulo se actualiza el estado de conexión sin depender solo del
 * poll periódico o del foco de ventana.
 */
export function RouteConnectivityProbe() {
  const { pathname } = useLocation();
  const { refresh, isProbing, lastCheckedAt } = useConnectivity();

  useEffect(() => {
    if (isProbing) return;
    if (lastCheckedAt && Date.now() - lastCheckedAt < ROUTE_PROBE_MIN_GAP_MS) return;
    void refresh();
  }, [pathname, refresh, isProbing, lastCheckedAt]);

  return null;
}
