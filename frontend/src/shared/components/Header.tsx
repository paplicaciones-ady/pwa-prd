import { useAuth } from '../../modules/auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { useNavigate } from 'react-router-dom';

export function Header() {
  const { bootstrap, logout } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const companyName = bootstrap?.company?.name || 'PWA App';

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <a className="brand company-brand" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
          {theme.logoUrl ? (
            <img src={theme.logoUrl} alt="logo" className="brand-logo" />
          ) : (
            <span style={{ fontSize: 18, fontWeight: 700 }}>{companyName.charAt(0)}</span>
          )}
          <span>{companyName}</span>
          <span className="status-dot online">En línea</span>
        </a>
        <div className="nav-links">
          <button className="ibtn" title="Vista de pruebas" onClick={() => navigate('/test')}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M9.5 3.5 3.5 9.5a2 2 0 0 0 0 2.8l8.4 8.4a2 2 0 0 0 2.8 0l8.4-8.4a2 2 0 0 0 0-2.8l-8.4-8.4a2 2 0 0 0-2.8 0Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /><path d="m5 9 5-5" stroke="currentColor" strokeWidth="1.9" /></svg>
          </button>
          <button className="ibtn" title="Notificaciones">
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /><path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
          </button>
          <button className="logout-btn" onClick={logout} title="Cerrar sesión">
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
    </nav>
  );
}