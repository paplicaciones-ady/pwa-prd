import { createContext, useCallback, useContext, useRef, useState, useEffect, ReactNode } from 'react';
import { httpClient } from '../../shared/api/httpClient';
import { getApiError, isSessionInvalidating, type ApiError } from '../../shared/api/apiError';
import {
  clearAuthCache,
  readCachedBootstrap,
  readCachedContexts,
  writeCachedBootstrap,
  writeCachedContext,
} from '../../shared/api/authCache';

export interface ModulePlacement {
  id: string;
  key: string;
  module: string;
  label: string;
  placement: 'grid' | 'fab';
  position: number;
  path: string;
  perm: string;
  flag: string | null;
  logoUrl: string | null;
  icon: string | null;
  enabled: boolean;
  /** Empresa dueña del módulo (null = módulo global). */
  companyId: string | null;
  /** Tema de la empresa dueña del módulo (null para módulos globales). */
  theme: { primaryColor: string; logoUrl: string | null } | null;
  /** Variante por empresa: configuración libre que adapta el comportamiento del módulo. */
  config?: Record<string, unknown>;
  /** Operaciones activas del módulo en esta empresa ([] = todas). */
  enabledOperations?: string[];
}

export interface ModuleVariant {
  id: string;
  moduleId: string;
  companyId: string;
  companyName: string | null;
  label: string | null;
  icon: string | null;
  path: string | null;
  config: Record<string, unknown>;
  enabledOperations: string[];
}

export interface CompanySummary {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
}

export interface ModuleView {
  id: string;
  scope: 'company' | 'global';
  companyId: string | null;
  companyName: string | null;
  key: string;
  module: string;
  label: string;
  icon: string | null;
  path: string;
  operations: { action: string; name: string }[];
  enabled: boolean;
  flag: string | null;
  ownerAssignment: { companyId: string; placement: 'grid' | 'fab'; position: number; enabled: boolean } | null;
  published: {
    companyId: string;
    companyName: string | null;
    placement: 'grid' | 'fab';
    position: number;
    enabled: boolean;
  }[];
  variants: ModuleVariant[];
  /** true cuando el admin ve un módulo compartido (de otra empresa) asignado a la suya. */
  isShared?: boolean;
}

interface BootstrapData {
  user: { id: string; name: string; email: string; profileId?: string };
  scope: 'company' | 'superadmin';
  company: { id: string; name: string; theme: { primaryColor: string; logoUrl: string } } | null;
  companies: CompanySummary[];
  featureFlags: Record<string, boolean>;
  modulePlacements: ModulePlacement[];
}

interface ModuleContext {
  permissions: string[];
  featureFlags: Record<string, boolean>;
}

interface AuthContextValue {
  bootstrap: BootstrapData | null;
  /** Último fallo al recuperar la sesión. `null` si nunca falló o se recuperó. */
  bootstrapError: ApiError | null;
  moduleContexts: Record<string, ModuleContext>;
  loadModuleContext: (moduleName: string) => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  retryBootstrap: () => Promise<void>;
  resetModuleContexts: () => void;
  enterCompany: (companyId: string) => Promise<void>;
  exitCompany: () => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isSuperAccount: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Alcance de los permisos: cambian por usuario y por empresa activa. */
function scopeOf(data: BootstrapData | null): string | null {
  return data ? `${data.user.id}:${data.company?.id ?? '-'}` : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Stale-while-revalidate: se arranca con la última sesión y los permisos
  // guardados y se revalidan por detrás, así un backend caído o lento no
  // deja la app en "Cargando permisos…" ni la manda al login.
  const [initial] = useState(() => {
    const cached = readCachedBootstrap<BootstrapData>();
    const scope = scopeOf(cached);
    return { bootstrap: cached, contexts: scope ? readCachedContexts<ModuleContext>(scope) : {} };
  });
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(initial.bootstrap);
  const [bootstrapError, setBootstrapError] = useState<ApiError | null>(null);
  const [moduleContexts, setModuleContexts] = useState<Record<string, ModuleContext>>(initial.contexts);
  const [isLoading, setIsLoading] = useState(!initial.bootstrap);

  const scopeRef = useRef(scopeOf(initial.bootstrap));
  // Módulos ya confirmados con el servidor en esta carga; el resto viene de la caché.
  const freshContexts = useRef(new Set<string>());
  const pendingContexts = useRef(new Map<string, Promise<void>>());

  /** Aplica un bootstrap del servidor; si cambió el alcance, carga los permisos guardados de ese alcance. */
  const applyBootstrap = useCallback((data: BootstrapData) => {
    writeCachedBootstrap(data);
    setBootstrap(data);
    setBootstrapError(null);
    const scope = scopeOf(data);
    if (scope !== scopeRef.current) {
      scopeRef.current = scope;
      freshContexts.current = new Set();
      pendingContexts.current = new Map();
      setModuleContexts(scope ? readCachedContexts<ModuleContext>(scope) : {});
    }
  }, []);

  const dropSession = useCallback(() => {
    clearAuthCache();
    scopeRef.current = null;
    freshContexts.current = new Set();
    pendingContexts.current = new Map();
    setBootstrap(null);
    setModuleContexts({});
  }, []);

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await httpClient.get('/me/bootstrap');
      applyBootstrap(res.data);
    } catch (err: unknown) {
      const apiError = getApiError(err);
      setBootstrapError(apiError);
      // Solo un 401/403 prueba que la sesión no sirve; ante un 500 transitorio
      // o un hueco de señal se conserva lo que hubiera (incluida la caché) y
      // la UI de conexión explica el motivo.
      if (isSessionInvalidating(apiError?.kind)) {
        dropSession();
      }
    } finally {
      setIsLoading(false);
    }
  }, [applyBootstrap, dropSession]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  /** Reintenta la carga sin propagar el error, para la pantalla de espera. */
  const retryBootstrap = useCallback(async () => {
    setIsLoading(true);
    await loadBootstrap();
  }, [loadBootstrap]);

  // Estable (useCallback) y con caché leída por ref: si cambiara en cada render,
  // los efectos que dependen de ella (RequirePerm) se re-ejecutarían en cada
  // cambio de AuthProvider, desmontando la pantalla y repitiendo sus peticiones.
  const moduleContextsRef = useRef(moduleContexts);
  moduleContextsRef.current = moduleContexts;
  const fetchModuleContext = useCallback((moduleName: string) => {
    // Varias pantallas pidiendo el mismo contexto a la vez comparten la petición.
    const pending = pendingContexts.current.get(moduleName);
    if (pending) return pending;
    const scope = scopeRef.current;
    const pendingMap = pendingContexts.current;
    const request = httpClient
      .get(`/${moduleName}/context`)
      .then((res) => {
        if (scopeRef.current !== scope) return; // cambió de empresa mientras tanto
        freshContexts.current.add(moduleName);
        if (scope) writeCachedContext(scope, moduleName, res.data);
        setModuleContexts((prev) => ({ ...prev, [moduleName]: res.data }));
      })
      .catch((err: unknown) => {
        // Sin acceso al módulo: el permiso guardado ya no vale.
        if (scopeRef.current === scope && getApiError(err)?.kind === 'forbidden') {
          if (scope) writeCachedContext(scope, moduleName, null);
          setModuleContexts((prev) => {
            const next = { ...prev };
            delete next[moduleName];
            return next;
          });
        }
        throw err;
      })
      .finally(() => pendingMap.delete(moduleName));
    pendingMap.set(moduleName, request);
    return request;
  }, []);

  const loadModuleContext = useCallback(
    async (moduleName: string) => {
      if (freshContexts.current.has(moduleName)) return;
      if (moduleContextsRef.current[moduleName]) {
        // Ya hay permisos (de la caché): se usan y se actualizan por detrás.
        fetchModuleContext(moduleName).catch(() => undefined);
        return;
      }
      return fetchModuleContext(moduleName);
    },
    [fetchModuleContext],
  );

  // Al recuperar la conexión se revalida todo lo que se esté usando.
  useEffect(() => {
    const onOnline = () => {
      void loadBootstrap();
      freshContexts.current = new Set();
      Object.keys(moduleContextsRef.current).forEach((m) => fetchModuleContext(m).catch(() => undefined));
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [loadBootstrap, fetchModuleContext]);

  const refreshBootstrap = async () => {
    const res = await httpClient.get('/me/bootstrap');
    applyBootstrap(res.data);
  };

  const resetModuleContexts = () => {
    freshContexts.current = new Set();
    setModuleContexts({});
  };

  const enterCompany = async (companyId: string) => {
    await httpClient.post('/auth/company', { companyId });
    await refreshBootstrap();
  };

  const exitCompany = async () => {
    await httpClient.post('/auth/company', { companyId: null });
    await refreshBootstrap();
  };

  const logout = async () => {
    try {
      await httpClient.post('/auth/logout');
    } catch {
      // el cierre local de sesión no debe fallar aunque el servidor no responda
    }
    dropSession();
    setBootstrapError(null);
  };

  const isSuperAccount = !!bootstrap?.user.email?.toLowerCase().startsWith('superadmin@');

  return (
    <AuthContext.Provider
      value={{
        bootstrap,
        bootstrapError,
        moduleContexts,
        loadModuleContext,
        refreshBootstrap,
        retryBootstrap,
        resetModuleContexts,
        enterCompany,
        exitCompany,
        logout,
        isLoading,
        isSuperAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}