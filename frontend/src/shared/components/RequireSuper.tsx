import { ReactNode } from 'react';
import { useAuth } from '../../modules/auth/AuthContext';
import { ForbiddenPage } from '../pages/ErrorPages';

interface RequireSuperProps {
  children: ReactNode;
}

export function RequireSuper({ children }: RequireSuperProps) {
  const { bootstrap, isSuperAccount, isLoading } = useAuth();

  if (isLoading || !bootstrap) {
    return (
      <div className="s2">
        <div className="s2-body error-body">
          <p className="empty-state">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAccount || bootstrap.scope !== 'superadmin') {
    return <ForbiddenPage moduleName="Configuración global" />;
  }

  return <>{children}</>;
}
