import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';

const ICONS: Record<string, React.ReactNode> = {
  cliente: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="2" /><path d="M5 20c0-3.4 3.1-6 7-6s7 2.6 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  encuestas: (
    <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  cartera: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16v12H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M4 10h18M16 15h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  crear: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="10" cy="8" r="3.4" stroke="currentColor" strokeWidth="2" /><path d="M4 19c0-3 2.7-5.2 6-5.2 1 0 2 .2 2.8.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M18 14v6M15 17h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
  ),
  descuentos: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M8 8h.01M16 16h.01M7 17L17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" /></svg>
  ),
  nuevos: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M4 8l8-4 8 4-8 4-8-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M4 8v8l8 4 8-4V8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
  ),
  rutero: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="2" /></svg>
  ),
  brain: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 9 18a3 3 0 0 0 3-1V5a3 3 0 0 0-3-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8A3 3 0 0 1 15 18a3 3 0 0 1-3-1" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
  ),
  quejas: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l9 16H3L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="17" r="1" fill="currentColor" /></svg>
  ),
  precios: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M4 8l6-4 10 6-6 10L4 14V8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="9" cy="10" r="1.4" fill="currentColor" /></svg>
  ),
  gastos: (
    <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="2" /><path d="M3 10h18" stroke="currentColor" strokeWidth="2" /><path d="M7 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  creditos: (
    <svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M2 10h20" stroke="currentColor" strokeWidth="2" /></svg>
  ),
  usuarios: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  config: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  perfiles: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
};

function genericIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" /></svg>
  );
}

const NAV_ICONS: Record<string, React.ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1v-8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="2" /><path d="M5 20c0-3.4 3.1-6 7-6s7 2.6 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M3 12h18M12 3a13 13 0 0 1 0 18a13 13 0 0 1 0-18Z" stroke="currentColor" strokeWidth="2" /></svg>
  ),
};

export function Sidebar() {
  const { bootstrap, moduleContexts, logout, isSuperAccount } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const companyName = bootstrap?.company?.name || 'PWA App';
  const placements = bootstrap?.modulePlacements || [];
  const flags = bootstrap?.featureFlags || {};

  const hasPerm = (perm: string) => {
    const [mod] = perm.split('.');
    const ctx = moduleContexts[mod];
    if (!ctx) return false;
    return ctx.permissions.includes(perm);
  };

  const modules = placements
    .filter((p) => p.enabled && hasPerm(p.perm) && (!p.flag || flags[p.flag]))
    .sort((a, b) => a.position - b.position);

  const moduleIcon = (p: { key: string; icon: string | null }) => {
    const url = p.icon && p.icon.startsWith('http') ? p.icon : null;
    if (url) {
      return <img className="side-module-logo" src={url} alt="" />;
    }
    return p.icon && ICONS[p.icon] ? ICONS[p.icon] : ICONS[p.key] || genericIcon();
  };

  const initials = bootstrap?.user.name
    ? bootstrap.user.name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <aside className="sidebar">
      <div className="side-brand" onClick={() => navigate('/home')}>
        {theme.logoUrl ? (
          <img src={theme.logoUrl} alt="logo" className="side-logo" />
        ) : (
          <span className="side-letter">{companyName.charAt(0)}</span>
        )}
        <span className="side-name">{companyName}</span>
        <span className="status-dot online">En línea</span>
      </div>

      <nav className="side-nav">
        <NavLink to="/home" end className={({ isActive }) => (isActive ? 'side-link on' : 'side-link')}>
          {NAV_ICONS.home} <span>Inicio</span>
        </NavLink>
        <NavLink to="/profile" end className={({ isActive }) => (isActive ? 'side-link on' : 'side-link')}>
          {NAV_ICONS.profile} <span>Perfil</span>
        </NavLink>
        {isSuperAccount && bootstrap?.scope === 'company' && (
          <NavLink to="/global-config" end className={({ isActive }) => (isActive ? 'side-link on' : 'side-link')}>
            {NAV_ICONS.globe} <span>Panel global</span>
          </NavLink>
        )}
      </nav>

      {modules.length > 0 && (
        <>
          <div className="side-sep">Módulos</div>
          <nav className="side-nav">
            {modules.map((p) => (
              <NavLink key={p.id} to={p.path} className={({ isActive }) => (isActive ? 'side-link on' : 'side-link')}>
                {moduleIcon(p)} <span>{p.label}</span>
              </NavLink>
            ))}
          </nav>
        </>
      )}

      <div className="side-foot">
        <div className="side-user">
          <span className="side-ava">{initials}</span>
          <div>
            <div className="side-uname">{bootstrap?.user.name}</div>
            <div className="side-uemail">{bootstrap?.user.email}</div>
          </div>
        </div>
        <button className="side-logout" onClick={logout} title="Cerrar sesión">
          <svg viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>Salir</span>
        </button>
      </div>
    </aside>
  );
}
