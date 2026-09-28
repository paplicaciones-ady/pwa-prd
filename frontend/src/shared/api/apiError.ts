import axios from 'axios';
import type { AxiosError } from 'axios';

/**
 * Clasificación única de fallos de red/HTTP.
 *
 * Antes, cada página repetía `err?.response?.data?.message?.message || 'texto'`
 * con 4 variantes de extracción distintas. Eso colapsaba "se cayó la wifi" y
 * "te equivocaste el NIT" en el mismo texto rojo, porque sin respuesta
 * `err.response` es `undefined` y la cadena se caía al fallback.
 *
 * `kind` no reemplaza los mensajes del backend: los normaliza en un solo tipo
 * para que la UI pueda decidir qué mostrar y qué acción ofrecer.
 */
export type ApiErrorKind =
  | 'offline'
  | 'timeout'
  | 'auth'
  | 'forbidden'
  | 'ratelimit'
  | 'conflict'
  | 'validation'
  | 'server'
  | 'unknown';

export interface ApiError {
  kind: ApiErrorKind;
  /** Mensaje legible, tomado del backend cuando existe y normalizado si no. */
  message: string;
  status: number | null;
  /** `X-Correlation-ID`: el identificador que soporte necesita para trazar. */
  correlationId: string | null;
  /** Reintentar tiene sentido sin intervención del usuario. */
  retryable: boolean;
}

const RETRYABLE: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>(['timeout', 'ratelimit', 'server']);

/** Fallas de transporte: no hubo respuesta HTTP, no hubo decisión del servidor. */
const TRANSPORT_FAULTS: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>(['offline', 'timeout']);

const FALLBACK_BY_KIND: Record<ApiErrorKind, string> = {
  offline: 'No hay conexión con el servidor.',
  timeout: 'El servidor tardó demasiado en responder.',
  auth: 'Tu sesión expiró. Volvé a iniciar sesión.',
  forbidden: 'No tenés permiso para esta operación.',
  ratelimit: 'Demasiados intentos. Esperá un momento.',
  conflict: 'Esta operación ya fue aplicada o entra en conflicto con el estado actual.',
  validation: 'Revisá los datos ingresados.',
  server: 'El servidor tuvo un error. Intentá de nuevo en un momento.',
  unknown: 'No se pudo completar la operación.',
};

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 409) return 'conflict';
  if (status === 429) return 'ratelimit';
  if (status >= 500) return 'server';
  if (status >= 400) return 'validation';
  return 'unknown';
}

function joinParts(value: unknown[]): string | null {
  const parts = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return parts.length ? parts.join('; ') : null;
}

/**
 * El filtro de excepciones del backend responde
 * `{ statusCode, path, correlationId, message, timestamp }`, donde `message`
 * puede ser un string plano o el objeto anidado de Nest
 * (`{ message: string | string[], error, statusCode }`) en errores de
 * validación. Se cubren ambas formas y, dentro de ellas, el caso de array.
 */
function extractMessage(body: unknown, kind: ApiErrorKind): string {
  const raw = body && typeof body === 'object' ? (body as { message?: unknown }).message : undefined;

  if (typeof raw === 'string' && raw.trim()) return raw;
  if (Array.isArray(raw)) {
    const joined = joinParts(raw);
    if (joined) return joined;
  }
  if (raw && typeof raw === 'object') {
    const nested = (raw as { message?: unknown }).message;
    if (typeof nested === 'string' && nested.trim()) return nested;
    if (Array.isArray(nested)) {
      const joined = joinParts(nested);
      if (joined) return joined;
    }
  }
  return FALLBACK_BY_KIND[kind];
}

/**
 * Kong genera el correlation-id y lo hace eco (`echo_downstream`), y el backend
 * lo repite en el body. Se prefiere el body y se cae al header porque un 502 o
 * 504 lo emite el gateway sin llegar a Nest: no hay body, pero sí hay header.
 * Sin esto, los 5xx del gateway llegan al usuario sin ningún identificador.
 */
function extractCorrelationId(response: AxiosError['response']): string | null {
  const fromBody =
    response?.data && typeof response.data === 'object'
      ? (response.data as { correlationId?: unknown }).correlationId
      : undefined;
  if (typeof fromBody === 'string' && fromBody) return fromBody;

  const fromHeader = response?.headers?.['x-correlation-id'];
  if (typeof fromHeader === 'string' && fromHeader) return fromHeader;

  return null;
}

/** true si el request se canceló a propósito (desmontaje, navegación, timeout del caller). */
export function isCanceled(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  return error.code === 'ERR_CANCELED' || error.name === 'CanceledError' || error.name === 'AbortError';
}

function isTimeout(error: AxiosError): boolean {
  return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ERR_REQUEST_TIMEOUT';
}

export function isNetworkFault(kind: ApiErrorKind): boolean {
  return TRANSPORT_FAULTS.has(kind);
}

/**
 * Únicos resultados que prueban que la sesión dejó de servir: un 401 o un 403.
 * Todo lo demás — red caída, timeout, 500, 429 — es indistinguible de "no
 * arrive a preguntarlo", y tratar eso como cierre de sesión expulsaba al
 * usuario del flujo en curso por un hueco de señal.
 */
export function isSessionInvalidating(kind: ApiErrorKind | null | undefined): boolean {
  return kind === 'auth' || kind === 'forbidden';
}

/**
 * Devuelve `null` para cancelaciones: un request abortado al navegar no es una
 * falla de red y no debe marcar la app como desconectada.
 */
export function classifyError(error: unknown): ApiError | null {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && error.name === 'AbortError') return null;
    return {
      kind: 'unknown',
      message: FALLBACK_BY_KIND.unknown,
      status: null,
      correlationId: null,
      retryable: false,
    };
  }

  const status = error.response?.status ?? null;
  // Sin respuesta no hubo decisión del servidor: es la red, no la validación.
  // Esta es la distinción que antes se perdía.
  const kind: ApiErrorKind = status === null ? (isTimeout(error) ? 'timeout' : 'offline') : kindForStatus(status);

  return {
    kind,
    message: extractMessage(error.response?.data, kind),
    status,
    correlationId: extractCorrelationId(error.response),
    retryable: RETRYABLE.has(kind),
  };
}

export function describeApiError(error: ApiError): string {
  return error.correlationId ? `${error.message} (ref: ${error.correlationId})` : error.message;
}

/**
 * Lee la clasificación que el interceptor de `httpClient` adjuntó al error
 * original. Devuelve `null` si el error no viene de axios o si fue cancelado,
 * de modo que un `catch` sobre un throw propio nunca se malinterprete como una
 * falla de red.
 */
export function getApiError(error: unknown): ApiError | null {
  if (!error || typeof error !== 'object') return null;
  const annotated = (error as { apiError?: ApiError }).apiError;
  return annotated && typeof annotated.kind === 'string' ? annotated : null;
}
