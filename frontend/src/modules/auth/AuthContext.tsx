import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react';
import { httpClient } from '../../shared/api/httpClient';
import { getApiError, isSessionInvalidating, type ApiError } from '../../shared/api/apiError';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [bootstrapError, setBootstrapError] = useState<ApiError | null>(null);
  const [moduleContexts, setModuleContexts] = useState<Record<string, ModuleContext>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await httpClient.get('/me/bootstrap');
      setBootstrap(res.data);
      setBootstrapError(null);
    } catch (err: unknown) {
      const apiError = getApiError(err);
      setBootstrapError(apiError);
      // Antes cualquier fallo —incluido un 500 transitorio o un hueco de
      // señal— ponía bootstrap en null, y ProtectedRoute traducía eso a
      // "sesión cerrada" mandando al login. Ahora solo un 401/403 prueba que
      // la sesión no sirve; el resto conserva lo que hubiera y la UI de
      // conexión explica el motivo.
      if (isSessionInvalidating(apiError?.kind)) {
        setBootstrap(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  /** Reintenta la carga sin propagar el error, para la pantalla de espera. */
  const retryBootstrap = useCallback(async () => {
    setIsLoading(true);
    await loadBootstrap();
  }, [loadBootstrap]);

  const loadModuleContext = async (moduleName: string) => {
    if (moduleContexts[moduleName]) return;
    const res = await httpClient.get(`/${moduleName}/context`);
    setModuleContexts((prev) => ({ ...prev, [moduleName]: res.data }));
  };

  const refreshBootstrap = async () => {
    const res = await httpClient.get('/me/bootstrap');
    setBootstrap(res.data);
    setBootstrapError(null);
  };

  const resetModuleContexts = () => setModuleContexts({});

  const enterCompany = async (companyId: string) => {
    await httpClient.post('/auth/company', { companyId });
    setModuleContexts({});
    await refreshBootstrap();
  };

  const exitCompany = async () => {
    await httpClient.post('/auth/company', { companyId: null });
    setModuleContexts({});
    await refreshBootstrap();
  };

  const logout = async () => {
    try {
      await httpClient.post('/auth/logout');
    } catch {
      // el cierre local de sesión no debe fallar aunque el servidor no responda
    }
    setBootstrap(null);
    setBootstrapError(null);
    setModuleContexts({});
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