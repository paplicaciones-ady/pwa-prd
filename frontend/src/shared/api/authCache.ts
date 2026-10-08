/**
 * Caché local del bootstrap de sesión y de los permisos por módulo.
 *
 * Permite pintar la app al instante (y seguir navegando si el backend no
 * responde) mientras se revalida por detrás. Solo afecta a lo que la UI
 * muestra: el backend sigue autorizando cada petición, así que un permiso
 * desactualizado a lo sumo enseña un botón que luego responde 403.
 *
 * Se borra al cerrar sesión o cuando el servidor prueba que la sesión ya no
 * sirve; si no, al volver a /login se entraría de nuevo con datos viejos.
 */

const BOOTSTRAP_KEY = 'pwa.auth.bootstrap.v1';
const CONTEXTS_KEY = 'pwa.auth.contexts.v1';

// localStorage puede no existir o lanzar (modo privado, almacenamiento lleno).
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin caché la app funciona igual, solo que depende de la red.
  }
}

export function readCachedBootstrap<T>(): T | null {
  return read<T>(BOOTSTRAP_KEY);
}

export function writeCachedBootstrap(data: unknown): void {
  write(BOOTSTRAP_KEY, data);
}

/** Permisos de los módulos guardados para un alcance (usuario + empresa). */
export function readCachedContexts<T>(scope: string): Record<string, T> {
  return read<Record<string, Record<string, T>>>(CONTEXTS_KEY)?.[scope] ?? {};
}

export function writeCachedContext(scope: string, moduleName: string, context: unknown | null): void {
  const all = read<Record<string, Record<string, unknown>>>(CONTEXTS_KEY) ?? {};
  const forScope = { ...(all[scope] ?? {}) };
  if (context === null) delete forScope[moduleName];
  else forScope[moduleName] = context;
  write(CONTEXTS_KEY, { ...all, [scope]: forScope });
}

export function clearAuthCache(): void {
  try {
    localStorage.removeItem(BOOTSTRAP_KEY);
    localStorage.removeItem(CONTEXTS_KEY);
  } catch {
    // nada que limpiar
  }
}
