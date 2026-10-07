import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../../modules/auth/AuthContext';
import { ForbiddenPage } from '../pages/ErrorPages';

interface RequirePermProps {
  module: string;
  perm: string;
  children: ReactNode;
}

export function RequirePerm({ module, perm, children }: RequirePermProps) {
  const { moduleContexts, loadModuleContext } = useAuth();
  const hasContext = !!moduleContexts[module];
  const [loading, setLoading] = useState(!hasContext);

  // Solo carga (y muestra "Cargando permisos…") si el contexto aún no está: así
  // un cambio en AuthProvider no desmonta la pantalla ni repite sus peticiones,
  // y no se pierde lo que el usuario tenga en memoria (p. ej. el estudio de crédito).
  useEffect(() => {
    if (hasContext) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    loadModuleContext(module)
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [module, hasContext, loadModuleContext]);

  if (loading) {
    return (
      <div className="s2">
        <div className="s2-body error-body">
          <p className="empty-state">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  const ctx = moduleContexts[module];
  if (!ctx || !ctx.permissions.includes(perm)) {
    return <ForbiddenPage moduleName={module} />;
  }

  return <>{children}</>;
}
