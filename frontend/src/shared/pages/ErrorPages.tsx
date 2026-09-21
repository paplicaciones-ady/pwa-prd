import { Link } from 'react-router-dom';
import './ErrorPages.css';

export function NotFoundPage() {
  return (
    <div className="s2">
      <div className="s2-head">
        <div className="s2-top">
          <Link to="/home" className="cback" aria-label="Volver al inicio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="org-chip"><span className="org-dot" />Error</div>
        </div>
        <h1 className="page-title">Página no encontrada</h1>
      </div>

      <div className="s2-body error-body">
        <div className="error-hero">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M16.2 7.8l-9 9M7.8 7.8l9 9" />
          </svg>
          <h2>404</h2>
          <p>La página que buscas no existe o fue movida.</p>
        </div>
        <Link to="/home" className="btn btn-primary" style={{ marginTop: 'auto' }}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

interface ForbiddenPageProps {
  moduleName?: string;
}

export function ForbiddenPage({ moduleName }: ForbiddenPageProps) {
  return (
    <div className="s2">
      <div className="s2-head">
        <div className="s2-top">
          <Link to="/home" className="cback" aria-label="Volver al inicio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="org-chip"><span className="org-dot" />Acceso restringido</div>
        </div>
        <h1 className="page-title">Sin acceso</h1>
      </div>

      <div className="s2-body error-body">
        <div className="error-hero">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h2>Sin acceso a este módulo</h2>
          <p>
            No tienes permisos para ver {moduleName ? <b>{moduleName}</b> : 'esta sección'}.
            <br />
            Si crees que es un error, contacta al administrador.
          </p>
        </div>
        <Link to="/home" className="btn btn-primary" style={{ marginTop: 'auto' }}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
