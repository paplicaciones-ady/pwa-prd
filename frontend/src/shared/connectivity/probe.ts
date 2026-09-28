import { API_BASE_URL } from '../api/config';

export type ConnectivityState = 'unknown' | 'online' | 'degraded' | 'offline';

/** Por qué la conexión no es plena. `null` cuando no hay nada que reportar. */
export type ConnectivityFault = 'slow' | 'backend' | 'database' | 'redis' | null;

export interface DependencyReport {
  database: boolean;
  redis: boolean;
}

export interface HealthReport {
  state: ConnectivityState;
  fault: ConnectivityFault;
  /** Hubo respuesta HTTP del gateway, sea 2xx o 5xx. */
  gatewayReachable: boolean;
  /** El proceso del backend respondió 2xx en su liveness. */
  backendAlive: boolean;
  httpStatus: number | null;
  latencyMs: number | null;
  dependencies: DependencyReport | null;
  effectiveType: string | null;
  saveData: boolean;
  checkedAt: number;
}

/**
 * 6s. Por encima del connect_timeout de Kong (5s) para no declarar "sin red"
 * en un enlace lento, y por debajo de una espera que se vuelvanotice. Un fallo
 * de DNS, un TCP refused o un captive portal fallan en milisegundos, así que un
 * timeout real a 6s significa gateway inalcanzable, no lentitud.
 */
export const PROBE_TIMEOUT_MS = 6_000;

/** Latencia a partir de la cual la conexión se considera degradada, no caída. */
export const SLOW_THRESHOLD_MS = 2_000;

export const DEGRADED_LABEL = 'Conexión débil';

export function emptyReport(): HealthReport {
  return {
    state: 'unknown',
    fault: null,
    gatewayReachable: false,
    backendAlive: false,
    httpStatus: null,
    latencyMs: null,
    dependencies: null,
    effectiveType: null,
    saveData: false,
    checkedAt: 0,
  };
}

export interface ProbeResponse {
  status: number | null;
  failure: 'network' | 'timeout' | null;
  latencyMs: number | null;
  body: unknown;
}

async function rawGet(url: string, timeoutMs: number): Promise<ProbeResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const startedAt = performance.now();

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      // Sin credenciales a propósito: /api/health es ruta pública en Kong
      // (health-public-route, sin plugin JWT). Así el veredicto mide solo el
      // transporte y una sesión expirada no se confunde con "sin red".
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return {
      status: res.status,
      failure: null,
      latencyMs: Math.round(performance.now() - startedAt),
      body,
    };
  } catch {
    return {
      status: null,
      failure: timedOut ? 'timeout' : 'network',
      latencyMs: null,
      body: null,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * El liveness del backend no toca dependencias (`health.controller.ts`), así que
 * un 200 aquí con la base caída es posible: por eso se sondea `/ready` aparte.
 */
export async function probeLiveness(timeoutMs = PROBE_TIMEOUT_MS): Promise<ProbeResponse> {
  return rawGet(`${API_BASE_URL}/health`, timeoutMs);
}

/**
 * `/health/ready` responde 503 con `{ checks: { db, redis } }` cuando una
 * dependencia caió. Es la única señal que permite distinguir "sin base de
 * datos" de "sin cache", que de otro modo son el mismo 500 para el usuario.
 */
export async function probeReadiness(timeoutMs = PROBE_TIMEOUT_MS): Promise<ProbeResponse> {
  return rawGet(`${API_BASE_URL}/health/ready`, timeoutMs);
}

function readDependencies(body: unknown): DependencyReport | null {
  if (!body || typeof body !== 'object') return null;
  const checks = (body as { checks?: unknown }).checks;
  if (!checks || typeof checks !== 'object') return null;
  const { db, redis } = checks as { db?: unknown; redis?: unknown };
  if (typeof db !== 'boolean' || typeof redis !== 'boolean') return null;
  return { database: db, redis };
}

interface ConnectionInfo {
  effectiveType: string | null;
  saveData: boolean;
}

/** Network Information API: solo Chromium, y solo informa de la red local. */
function readConnectionInfo(): ConnectionInfo {
  if (typeof navigator === 'undefined') return { effectiveType: null, saveData: false };
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  return {
    effectiveType: nav.connection?.effectiveType ?? null,
    saveData: nav.connection?.saveData === true,
  };
}

export function buildReport(
  liveness: ProbeResponse,
  readiness: ProbeResponse | null,
  now: number = Date.now(),
): HealthReport {
  const connection = readConnectionInfo();

  const base: HealthReport = {
    ...emptyReport(),
    httpStatus: liveness.status,
    latencyMs: liveness.latencyMs,
    effectiveType: connection.effectiveType,
    saveData: connection.saveData,
    checkedAt: now,
  };

  // No hubo respuesta HTTP: no hay transporte hasta el gateway.
  if (liveness.failure) {
    return { ...base, state: 'offline' };
  }

  base.gatewayReachable = true;
  base.backendAlive = liveness.status !== null && liveness.status >= 200 && liveness.status < 300;

  const dependencies = readiness ? readDependencies(readiness.body) : null;
  base.dependencies = dependencies;

  if (!base.backendAlive) {
    // El gateway respondió: la red funciona, el backend no (503 sin upstream
    // sano tras el healthcheck, o el proceso colgado. No es "sin conexión".
    return { ...base, state: 'degraded', fault: 'backend' };
  }

  if (dependencies && !dependencies.database) {
    return { ...base, state: 'degraded', fault: 'database' };
  }
  if (dependencies && !dependencies.redis) {
    return { ...base, state: 'degraded', fault: 'redis' };
  }
  if (liveness.latencyMs !== null && liveness.latencyMs >= SLOW_THRESHOLD_MS) {
    return { ...base, state: 'degraded', fault: 'slow' };
  }

  return { ...base, state: 'online', fault: null };
}

/** Texto de una línea para el banner, con el detalle de la dependencia caída. */
export function describeReport(report: HealthReport): string {
  switch (report.fault) {
    case 'backend':
      return 'El servidor no responde. Puede estar reiniciando o saturado.';
    case 'database':
      return 'El servidor responde, pero la base de datos no está disponible.';
    case 'redis':
      return 'El servidor responde, pero la caché de sesión (Redis) no está disponible.';
    case 'slow':
      return 'La conexión con el servidor es lenta.';
    default:
      return DEGRADED_LABEL;
  }
}
