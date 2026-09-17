import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { httpClient } from '../../shared/api/httpClient';
import { ModulesManagement } from './ModulesManagement';

interface FlagItem {
  id: string;
  key: string;
  enabled: boolean;
}

const TABS = [
  { id: 'company', label: 'Mi empresa' },
  { id: 'flags', label: 'Feature Flags' },
  { id: 'modules', label: 'Módulos' },
];

export function ConfigPage() {
  const { bootstrap, moduleContexts, loadModuleContext, refreshBootstrap } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('company');

  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0057B8');
  const [logoUrl, setLogoUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [newFlagKey, setNewFlagKey] = useState('');

  const ctx = moduleContexts['config'];
  const canUpdate = ctx?.permissions.includes('config.update');

  useEffect(() => {
    loadModuleContext('config');
    if (bootstrap?.company) {
      setName(bootstrap.company.name || '');
      setPrimaryColor(bootstrap.company.theme.primaryColor || '#0057B8');
      setLogoUrl(bootstrap.company.theme.logoUrl || '');
    }
  }, [bootstrap]);

  useEffect(() => {
    if (tab === 'flags') loadFlags();
  }, [tab]);

  const loadFlags = () => {
    httpClient.get('/feature-flags').then((res) => setFlags(res.data || [])).catch(() => setFlags([]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSaved(false); setBusy(true);
    try {
      await httpClient.patch('/config', { name, primaryColor });
      setSaved(true); await refreshBootstrap();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo guardar');
    } finally { setBusy(false); }
  };

  const uploadOwnLogo = async (file: File) => {
    setError('');
    const form = new FormData(); form.append('file', file);
    setBusy(true);
    try {
      const res = await httpClient.post('/config/logo', form);
      setLogoUrl(res.data?.logoUrl || ''); await refreshBootstrap(); setSaved(true);
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo subir el logo');
    } finally { setBusy(false); }
  };

  const toggleFlag = async (f: FlagItem) => {
    try {
      await httpClient.patch(`/feature-flags/${f.id}`, { enabled: !f.enabled });
      setFlags((prev) => prev.map((x) => (x.id === f.id ? { ...x, enabled: !x.enabled } : x)));
      await refreshBootstrap();
    } catch { /* ignore */ }
  };

  const createFlag = async () => {
    if (!newFlagKey.trim()) return;
    try {
      await httpClient.post('/feature-flags', { key: newFlagKey.trim(), enabled: true });
      setNewFlagKey(''); loadFlags(); await refreshBootstrap();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo crear');
    }
  };

  const deleteFlag = async (id: string) => {
    if (!window.confirm('¿Eliminar este feature flag?')) return;
    try { await httpClient.delete(`/feature-flags/${id}`); loadFlags(); await refreshBootstrap(); } catch { /* ignore */ }
  };

  if (!ctx) return <p style={{ padding: 40 }}>Cargando...</p>;

  return (
    <div className="s2">
      <div className="s2-head">
        <div className="s2-top">
          <div className="cback" onClick={() => navigate('/home')}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div className="org-chip"><span className="org-dot" />Configuración</div>
        </div>
        <h1 className="page-title">Configuración</h1>
      </div>

      <div className="s2-body">
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 12,
                border: 'none',
                background: tab === t.id ? 'var(--accent)' : '#fff',
                color: tab === t.id ? '#fff' : 'var(--ink)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: tab === t.id ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'company' && (
          <div className="info-card" style={{ padding: 20 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>Mi empresa</h2>
            {!canUpdate && <p style={{ color: '#b00020' }}>No tenés permisos para editar.</p>}
            <div className="field">
              <label>Nombre de la empresa</label>
              <input className="inp" value={name} onChange={(e) => setName(e.target.value)} disabled={!canUpdate} />
            </div>
            <div className="field">
              <label>Color principal</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} disabled={!canUpdate} style={{ width: 60, height: 44, padding: 0, borderRadius: 10, border: '1px solid var(--line)' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{primaryColor}</span>
              </div>
            </div>
            <div className="field">
              <label>Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {logoUrl ? <img src={logoUrl} alt="logo" height={48} style={{ objectFit: 'contain' }} /> : (
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: primaryColor, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{(name || 'P').charAt(0)}</div>
                )}
                {canUpdate && (
                  <label style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, background: '#fff' }}>
                    {busy ? 'Subiendo…' : 'Elegir imagen'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadOwnLogo(f); e.target.value = ''; }} />
                  </label>
                )}
              </div>
            </div>
            {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}
            {saved && <p style={{ color: 'green', fontSize: 12 }}>Guardado.</p>}
            {canUpdate && (
              <button className="btn btn-primary" onClick={handleSubmit} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
                Guardar
              </button>
            )}
          </div>
        )}

        {tab === 'flags' && (
          <div>
            <div className="info-card" style={{ padding: 20, marginBottom: 16 }}>
              <h3 className="section-title" style={{ marginTop: 0 }}>Nuevo flag</h3>
              <div className="row2">
                <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                  <input className="inp" value={newFlagKey} onChange={(e) => setNewFlagKey(e.target.value)} placeholder="Ej: module.portfolio" />
                </div>
                <button className="btn btn-primary" onClick={createFlag} style={{ width: 'auto', padding: '0 20px' }}>
                  Crear
                </button>
              </div>
              {error && <p style={{ color: 'red', fontSize: 12, marginTop: 8 }}>{error}</p>}
            </div>

            {flags.length === 0 && <p className="empty-state">No hay feature flags</p>}
            {flags.map((f) => (
              <div key={f.id} className="info-card" style={{ padding: '10px 16px', marginBottom: 10 }}>
                <div className="info-row" style={{ borderBottom: 0, padding: '8px 0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{f.key}</div>
                    <div style={{ fontSize: 11, color: 'var(--faint)' }}>{f.enabled ? 'Habilitado' : 'Deshabilitado'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => toggleFlag(f)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: f.enabled ? 'var(--green)' : 'var(--line)',
                        color: f.enabled ? '#fff' : 'var(--ink)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {f.enabled ? 'On' : 'Off'}
                    </button>
                    <button
                      onClick={() => deleteFlag(f.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'modules' && <ModulesManagement mode="company" />}
      </div>
    </div>
  );
}