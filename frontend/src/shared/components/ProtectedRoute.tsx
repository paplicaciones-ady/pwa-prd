import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/AuthContext';
import { isSessionInvalidating } from '../api/apiError';

/**
 * Solo guarda de sesión. El chrome (topbar, sidebar, tabbar) vive en
 * `AppLayout`, que envuelve todas las rutas; así una vista no tiene que estar
 * detrás de este componente para tener la barra, y las rutas que solo usan
 * `RequirePerm` —que antes no tenían chrome— lo heredan sin tocar su markup.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { bootstrap, bootstrapError, isLoading, retryBootstrap } = useAuth();

  if (isLoading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Cargando...</div>;
  }

  if (!bootstrap) {
    // No sabemos si la sesión sigue viva porque no se llegó a preguntarlo
    // (red, timeout, 500). Expulsar al login en ese caso cerraba el flujo en
    // curso por un hueco de señal, así que se ofrece reintentar.
    if (bootstrapError && !isSessionInvalidating(bootstrapError.kind)) {
      return (
        <div className="s2">
          <div className="body">
            <div className="auth-wait">
              <h2>No pudimos verificar tu sesión</h2>
              <p>
                {bootstrapError.kind === 'offline' || bootstrapError.kind === 'timeout'
                  ? 'No hay conexión con el servidor. Tu sesión sigue vigente: recuperá la señal y continuá.'
                  : 'El servidor no respondió correctamente. Podés reintentar sin volver a iniciar sesión.'}
              </p>
              {bootstrapError.correlationId && (
                <p style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'monospace' }}>
                  ref: {bootstrapError.correlationId}
                </p>
              )}
              <button type="button" className="btn btn-primary" onClick={() => void retryBootstrap()}>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
