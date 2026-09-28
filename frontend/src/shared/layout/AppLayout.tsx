import { useLocation } from 'react-router-dom';
import { useAuth } from '../../modules/auth/AuthContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Footer } from '../components/Footer';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { TopBarProvider } from './TopBarContext';
import type { ReactNode } from 'react';

const HOME_ROUTES = new Set(['/home', '/profile']);

/**
 * Layout fijo de la aplicación. Absorbe la responsabilidad de chrome que tenía
 * `ProtectedRoute`, para que la topbar esté presente en todas las vistas y no
 * solo en las que pasaban por ese guard (14 rutas con RequirePerm, /login y el
 * 404 quedaban sin barra).
 *
 * La geometría reproduce la que ya funcionaba, porque el punto de inserción
 * importa para el `position: sticky` de la topbar:
 *  - escritorio: `.app-main` (overflow-y: auto, height: 100vh) es el
 *    contenedor de scroll, así que la topbar se pega contra él.
 *  - móvil: no hay contenedor propio, scrollea el documento, y la topbar se
 *    pega contra el documento.
 * Por eso la topbar va dentro de la columna principal y no como hermana del
 * Sidebar: si colgara de `.app-shell` tendría que competir con un Sidebar de
 * altura completa.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { bootstrap } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { pathname } = useLocation();
  const showTabbar = HOME_ROUTES.has(pathname);

  const body = (
    <>
      <TopBar />
      {children}
    </>
  );

  return (
    <TopBarProvider>
      {isDesktop && bootstrap ? (
        <div className="app-shell">
          <Sidebar />
          <main className="app-main">{body}</main>
        </div>
      ) : (
        <>
          {body}
          {!isDesktop && bootstrap && showTabbar && <Footer />}
        </>
      )}
    </TopBarProvider>
  );
}
