import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/AuthContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useTopBar } from '../layout/TopBarContext';
import { ConnectivityBadge } from './ConnectivityBadge';

/**
 * Barra superior fija, presente en todas las vistas (incluido /login, donde antes
 * no había ningún indicador de conexión). Reutiliza las clases `.navbar` /
 * `.navbar-inner` que ya eran blancas, sticky y con z-index 100, de modo que la
 * relación con la barra de créditos (z-index 110) y con el banner de
 * conectividad se mantiene intacta.
 */
export function TopBar() {
  const { bootstrap, logout } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { backTo } = useTopBar();

  // Sin sesión no hay empresa, ni campana, ni salida: la barra degrada a
  // "app + estado de conexión" sin romper la pantalla de login.
  const hasSession = !!bootstrap;
  const companyName = bootstrap?.company?.name || 'PWA App';

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-left">
          {backTo && (
            <button className="ibtn" title="Volver" aria-label="Volver" onClick={() => navigate(backTo)}>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {hasSession ? (
            <button className="brand company-brand navbar-brand" onClick={() => navigate('/home')}>
              <span className="navbar-company">{companyName}</span>
              <ConnectivityBadge />
            </button>
          ) : (
            <div className="brand company-brand navbar-brand">
              <span className="navbar-company">{companyName}</span>
              <ConnectivityBadge />
            </div>
          )}
        </div>

        {hasSession && (
          <div className="nav-links">
            {/* La ruta /test solo se registra en desarrollo; acá se mirrora esa
                condición para no dejar un botón que cae en 404 en producción. */}
            {import.meta.env.DEV && (
              <button className="ibtn" title="Vista de pruebas" onClick={() => navigate('/test')}>
                <svg viewBox="0 0 24 24" fill="none"><path d="M9.5 3.5 3.5 9.5a2 2 0 0 0 0 2.8l8.4 8.4a2 2 0 0 0 2.8 0l8.4-8.4a2 2 0 0 0 0-2.8l-8.4-8.4a2 2 0 0 0-2.8 0Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /><path d="m5 9 5-5" stroke="currentColor" strokeWidth="1.9" /></svg>
              </button>
            )}
            <button className="ibtn" title="Notificaciones">
              <svg viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /><path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
            </button>
            {/* En escritorio la salida ya vive en el pie del Sidebar (side-logout);
                duplicarla acá dejaría dos botones de "Cerrar sesión" en pantalla. */}
            {!isDesktop && (
              <button className="logout-btn" onClick={logout} title="Cerrar sesión">
                <svg viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
