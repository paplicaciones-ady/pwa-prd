import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import { classifyError, isCanceled, type ApiError } from './apiError';
import { reportTransportFault } from '../connectivity/reportBus';
import { clearAuthCache } from './authCache';

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  // Ver REQUEST_TIMEOUT_MS: es una red de contención para cuando el gateway no
  // responde, no un corte agresivo sobre los uploads de logo.
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    // Mitigación CSRF pragmática: un formulario cross-site no puede fijar este
    // header, así que el backend lo exige en toda mutación (ver CsrfMiddleware).
    'X-Requested-With': 'XMLHttpRequest',
  },
});

/** Lee una cookie (sin httpOnly — csrf_token NO lo es a propósito). */
function getCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

// Double-submit CSRF: toda mutación lleva X-CSRF-Token con el valor de la
// cookie csrf_token (emitida al iniciar sesión).
httpClient.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase();
  const isMutation = !['get', 'head', 'options'].includes(method);
  if (isMutation) {
    const csrf = getCookie('csrf_token');
    if (csrf) {
      config.headers = config.headers ?? {};
      config.headers['X-CSRF-Token'] = csrf;
    }

    // Idempotencia: una clave compartida por sesión de pestaña. La clave se
    // regenera tras cada mutación satisfactoria (ver response interceptor),
    // de modo que un doble-click / retry de red reúse la misma clave y el
    // backend deduplique, pero una operación nueva no choque con la anterior.
    const url = config.url ?? '';
    const isAuthRequest =
      url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');
    if (!isAuthRequest) {
      const key = idempotencyKey();
      (config as any).__idempotencyKey = key;
      config.headers['Idempotency-Key'] = key;
    }
  }
  return config;
});

// Idempotency-Key por sesión de pestaña: se reusa mientras una operación
// mutante esté en vuelo (retry/click repetido), y se regenera al completar.
function idempotencyKey(): string {
  const stored = sessionStorage.getItem('pwa_idempotency_key');
  if (stored) return stored;
  const key = crypto.randomUUID();
  sessionStorage.setItem('pwa_idempotency_key', key);
  return key;
}

function clearIdempotencyKey(): void {
  sessionStorage.removeItem('pwa_idempotency_key');
}

let isRefreshing = false;

/** Requests que esperan al refresh de token en curso. */
type PendingReplay = {
  request: InternalAxiosRequestConfig;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};
let refreshQueue: PendingReplay[] = [];

/**
 * Clasifica el error y lo deja anotado sobre el objeto original, en vez de
 * reemplazarlo por un tipo propio. Los ~22 call sites leen
 * `err.response.data.message.message`; cambiar la forma del rejection los
 * rompería a todos de golpe. Con esto, el código viejo sigue funcionando y el
 * nuevo puede consultar `getApiError(err).kind` para decidir qué mostrar.
 */
function annotate(error: unknown): ApiError | null {
  const classified = classifyError(error);
  if (!classified) return null;
  if (error && typeof error === 'object') {
    (error as { apiError?: ApiError }).apiError = classified;
    if (classified.kind === 'offline' || classified.kind === 'timeout') {
      reportTransportFault(classified.kind);
    }
  }
  return classified;
}

httpClient.interceptors.response.use(
  (response) => {
    const method = (response.config.method ?? 'get').toLowerCase();
    if (['post', 'patch', 'put', 'delete'].includes(method) && (response.config as any).__idempotencyKey) {
      clearIdempotencyKey();
    }
    return response;
  },
  async (error) => {
    // Una cancelación (desmontaje, cambio de navegación) no es una falla de
    // red: se propaga intacta para no marcar la app como desconectada.
    if (isCanceled(error)) return Promise.reject(error);

    const originalRequest = error.config;
    const status = error.response?.status;
    annotate(error);

    // No intervenir en login/refresh/logout — esos endpoints manejan sus propios errores
    const isAuthRequest =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/logout');

    if (status === 401 && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          await httpClient.post('/auth/refresh');
          const pending = refreshQueue;
          refreshQueue = [];
          pending.forEach(({ request, resolve }) => resolve(httpClient(request)));
        } catch (refreshError) {
          // Antes los requests encolados acá quedaban colgados para siempre:
          // se vaciaba la cola sin resolver ni rechazar sus promesas. Ahora se
          // rechazan con la causa real para que ninguna pantalla se quede
          // esperando un resultado que no va a llegar.
          annotate(refreshError);
          const pending = refreshQueue;
          refreshQueue = [];
          pending.forEach(({ reject }) => reject(refreshError));

          // Sin esto, al cargar /login la caché volvería a meter al usuario.
          clearAuthCache();
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        } finally {
          isRefreshing = false;
        }
      }

      return new Promise((resolve, reject) => {
        refreshQueue.push({ request: originalRequest, resolve, reject });
      });
    }
    return Promise.reject(error);
  },
);
