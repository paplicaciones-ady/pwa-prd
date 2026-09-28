import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import {
  buildReport,
  emptyReport,
  probeLiveness,
  probeReadiness,
  type ConnectivityState,
  type HealthReport,
} from './probe';
import { onTransportFault } from './reportBus';

/** Verificación pronta: 60s. Lenta: 5s, para detectar la vuelta rápido. */
const POLL_OK_MS = 60_000;
const POLL_DOWN_MS = 5_000;

/**
 * `/ready` consulta Postgres y Redis, así que no se dispara en cada poll de
 * liveness: 1 vez por minuto como máximo por pestaña, o al instante si el
 * gateway acaba de responder mal.
 */
const READINESS_MAX_AGE_MS = 60_000;

/**
 * Foco y visibilidad disparan verificación, pero sin dejar que un usuario que
 * alterna tabs genere tráfico. El intervalo del poll no pasa por este gap.
 */
const EVENT_MIN_GAP_MS = 30_000;

/**
 * Ventana para colapsar una ráfaga de requests caídos (una pantalla con varias
 * llamadas en paralelo) en una sola verificación.
 */
const FAULT_DEBOUNCE_MS = 2_000;

interface ConnectivityValue {
  state: ConnectivityState;
  report: HealthReport;
  isProbing: boolean;
  lastCheckedAt: number | null;
  refresh: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityValue | undefined>(undefined);

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<HealthReport>(emptyReport);
  const [isProbing, setIsProbing] = useState(false);

  const inFlight = useRef(false);
  const lastRunAt = useRef(0);
  const lastReadinessAt = useRef(0);
  const lastFaultAt = useRef(0);
  const mounted = useRef(true);

  const run = useCallback(async (options: { force?: boolean } = {}) => {
    if (inFlight.current) return;
    if (!options.force && Date.now() - lastRunAt.current < EVENT_MIN_GAP_MS) return;

    inFlight.current = true;
    lastRunAt.current = Date.now();
    if (mounted.current) setIsProbing(true);

    try {
      const liveness = await probeLiveness();
      let readiness = null;
      const now = Date.now();
      if (liveness.failure === null && now - lastReadinessAt.current >= READINESS_MAX_AGE_MS) {
        readiness = await probeReadiness();
        lastReadinessAt.current = Date.now();
      }
      const next = buildReport(liveness, readiness, Date.now());
      if (mounted.current) setReport(next);
    } finally {
      inFlight.current = false;
      if (mounted.current) setIsProbing(false);
    }
  }, []);

  useEffect(() => {
    // StrictMode monta, desmonta y vuelve a montar en desarrollo: sin reiniciar
    // este flag, la segunda montaje quedaría bloqueada por el vuelo de la
    // primera y nunca se sondaría.
    mounted.current = true;
    inFlight.current = false;

    const onReachableEvent = () => {
      void run();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void run();
    };

    void run({ force: true });

    window.addEventListener('online', onReachableEvent);
    window.addEventListener('focus', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted.current = false;
      inFlight.current = false;
      window.removeEventListener('online', onReachableEvent);
      window.removeEventListener('focus', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [run]);

  // El periodo depende del estado: se insiste más estando caído que estando bien.
  useEffect(() => {
    const period = report.state === 'offline' ? POLL_DOWN_MS : POLL_OK_MS;
    const id = window.setInterval(() => {
      void run({ force: true });
    }, period);
    return () => window.clearInterval(id);
  }, [report.state, run]);

  // Un request que falló en transporte es evidencia directa: no se espera al
  // próximo poll, que con la app en línea puede tardar hasta un minuto.
  useEffect(() => {
    return onTransportFault(() => {
      const now = Date.now();
      if (now - lastFaultAt.current < FAULT_DEBOUNCE_MS) return;
      lastFaultAt.current = now;
      void run({ force: true });
    });
  }, [run]);

  const refresh = useCallback(() => run({ force: true }), [run]);

  const value = useMemo<ConnectivityValue>(
    () => ({
      state: report.state,
      report,
      isProbing,
      lastCheckedAt: report.checkedAt || null,
      refresh,
    }),
    [report, isProbing, refresh],
  );

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity(): ConnectivityValue {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) throw new Error('useConnectivity debe usarse dentro de ConnectivityProvider');
  return ctx;
}
