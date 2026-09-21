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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [module, loadModuleContext]);

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
