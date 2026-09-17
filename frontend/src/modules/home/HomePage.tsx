import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const ICONS: Record<string, React.ReactNode> = {
  cliente: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="2" /><path d="M5 20c0-3.4 3.1-6 7-6s7 2.6 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  encuestas: (
    <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  cartera: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16v12H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M4 10h16M16 15h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  crear: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="10" cy="8" r="3.4" stroke="currentColor" strokeWidth="2" /><path d="M4 19c0-3 2.7-5.2 6-5.2 1 0 2 .2 2.8.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M18 14v6M15 17h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
  ),
  descuentos: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M8 8h.01M16 16h.01M7 17L17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" /></svg>
  ),
  nuevos: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M4 8l8-4 8 4-8 4-8-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M4 8v8l8 4 8-4V8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M18 4v5M15.5 5.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
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
  calculadora: (
    <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M9 7h6M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  catalogo: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M3 5h18v16H3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M7 10h10M7 14h10M7 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  promos: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M7 12l4-4m2 8 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M9 9h.01M15 15h.01M6.2 21.5l-.3-5-4.5-2.4 3.9-3.4L4.6 6l5.3.9 2.6-4.5 2.7 4.5L20.5 6l-1.4 4.7 4 3.4-4.6 2.3-.2 5.1-5.5-1.1-4.6 1.6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
  ),
  reportes: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18H5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8 7h8M8 11h8M8 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  usuarios: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  config: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  perfiles: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
};

function genericIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" /></svg>
  );
}

const SUPER_ADMIN_PROFILE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

export function HomePage() {
  const { bootstrap, moduleContexts, loadModuleContext, enterCompany, exitCompany } = useAuth();
  const navigate = useNavigate();
  const placements = bootstrap?.modulePlacements || [];
  const flags = bootstrap?.featureFlags || {};

  const hasPerm = (perm: string) => {
    const [mod] = perm.split('.');
    const ctx = moduleContexts[mod];
    if (!ctx) return false;
    return ctx.permissions.includes(perm);
  };

  const visible = placements
    .filter((p) => {
      if (!p.enabled) return false;
      if (!hasPerm(p.perm)) return false;
      if (p.flag && !flags[p.flag]) return false;
      return true;
    })
    .sort((a, b) => a.position - b.position);

  const grid = visible.filter((p) => p.placement === 'grid');
  const fabs = visible.filter((p) => p.placement === 'fab');

  useEffect(() => {
    const mods = new Set(placements.map((p) => p.module));
    mods.forEach((m) => loadModuleContext(m).catch(() => undefined));
  }, [placements.length]);

  const icon = (p: { key: string; icon: string | null }) => {
    const url = p.icon && p.icon.startsWith('http') ? p.icon : null;
    if (url) {
      return <img className="tile-logo" src={url} alt="" />;
    }
    return p.icon && ICONS[p.icon] ? ICONS[p.icon] : ICONS[p.key] || genericIcon();
  };

  // --- Superadmin: selector global de empresas + configuración global ---
  if (bootstrap?.scope === 'superadmin') {
    const companies = bootstrap.companies || [];
    return (
      <div className="s2">
        <div className="s2-head">
          <div className="s2-top">
            <div className="org-chip">
              <span className="org-dot" />
              Panel superadmin
            </div>
          </div>
          <div className="greet">
            <div className="welcome">
              <div className="brand-ava">
                <svg viewBox="0 0 24 24" fill="none"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 12h.01M9 15h.01M15 9h.01M15 12h.01M15 15h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </div>
              <div>
                <h2>Selecciona una empresa</h2>
                <p className="brand-sub">Entra a la empresa o administra la plataforma.</p>
              </div>
            </div>
          </div>
          <h1 className="page-title">Empresas</h1>
          <p className="lead below">Toca una empresa para entrar como visitante o administra la plataforma.</p>
        </div>

        <div className="s2-body">
          <div className="hsec">Empresas</div>
          <div className="grid-3">
            {companies.map((c) => (
              <button
                key={c.id}
                className="tile"
                type="button"
                onClick={() => enterCompany(c.id).then(() => navigate('/home'))}
                style={{ cursor: 'pointer', border: 'none', font: 'inherit' }}
              >
                <div className="ic">
                  {c.logoUrl ? (
                    <img className="tile-logo" src={c.logoUrl} alt="" />
                  ) : (
                    <span style={{ color: 'var(--accent)' }}>{c.name.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <span>{c.name}</span>
              </button>
            ))}
          </div>

          <div className="hsec" style={{ marginTop: 24 }}>Administración</div>
          <div className="grid-3">
            <Link to="/global-config" className="tile" style={{ textDecoration: 'none' }}>
              <div className="ic">{ICONS.config}</div>
              <span>Configuración global</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- Scope empresa ---
  const name = bootstrap?.user.name?.split(' ')[0] || 'Usuario';
  const company = bootstrap?.company?.name || '';

  return (
    <div className="s2">
      <div className="s2-head">
        <div className="s2-top">
          <div className="org-chip">
            <span className="org-dot" />
            {company} · Gestión Comercial
          </div>
          {bootstrap?.user.profileId === SUPER_ADMIN_PROFILE_ID && (
            <button
              type="button"
              onClick={async () => {
                await exitCompany();
                navigate('/home');
              }}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.95)',
                border: 'none',
                borderRadius: 999,
                padding: '7px 12px',
                fontFamily: 'var(--display)',
                fontWeight: 700,
                fontSize: 12,
                color: 'var(--ink)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 6px 14px -8px rgba(0,0,0,0.4)',
              }}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" style={{ flex: 'none', color: 'var(--accent)' }}>
                <path d="M7 2.5 1.5 8 7 13.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Volver a empresas
            </button>
          )}
        </div>
        <div className="greet">
          <div className="welcome">
            <div className="brand-ava">
              <svg viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" /></svg>
            </div>
            <div>
              <h2>
                Hola, {name} <span className="wave">👋</span>
              </h2>
              <p className="brand-sub">¿Con qué área te ayudo?</p>
            </div>
          </div>
        </div>
        <h1 className="page-title">Módulos comerciales</h1>
        <p className="lead below">Selecciona el módulo que deseas consultar.</p>
      </div>

      <div className="s2-body">
        <div className="hsec">Módulos</div>
        {grid.length === 0 && <p className="empty-state">No hay módulos habilitados</p>}
        <div className="grid-3">
          {grid.map((p) => (
            <Link
              key={p.id}
              to={p.path}
              className="tile"
              style={{ textDecoration: 'none' }}
            >
              <div className="ic">{icon(p)}</div>
              <span>{p.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {fabs.length > 0 && (
        <div className="fab-stack">
          {fabs.map((p) => (
            <Link key={p.id} to={p.path} className="fab-wrap" style={{ textDecoration: 'none' }}>
              <button className="fab" title={p.label}>
                {icon(p)}
              </button>
              <span className="fab-label">{p.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}