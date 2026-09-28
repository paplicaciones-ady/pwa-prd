import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpClient } from '../../shared/api/httpClient';
import { useAuth, CompanySummary } from '../auth/AuthContext';
import { ModulesManagement } from '../config/ModulesManagement';
import { useBackTarget } from '../../shared/layout/TopBarContext';

interface ListCompany extends CompanySummary {
  isActive: boolean;
  authStrategy: string;
}

const TABS = [
  { id: 'companies', label: 'Empresas' },
  { id: 'modules', label: 'Módulos' },
];

export function SuperAdminGlobalConfigPage() {
  const { exitCompany } = useAuth();
  const navigate = useNavigate();
  useBackTarget('/home');
  const [tab, setTab] = useState('companies');

  const [companies, setCompanies] = useState<ListCompany[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { name: string; primaryColor: string; isActive: boolean }>>({});
  const [newCompany, setNewCompany] = useState({ name: '', primaryColor: '#0057B8' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCompanies = async () => {
    try {
      const res = await httpClient.get('/config/companies');
      const list: ListCompany[] = res.data || [];
      setCompanies(list);
      const draftsMap: Record<string, { name: string; primaryColor: string; isActive: boolean }> = {};
      for (const c of list) draftsMap[c.id] = { name: c.name, primaryColor: c.primaryColor, isActive: c.isActive };
      setDrafts(draftsMap);
    } catch {
      setError('No se pudieron cargar las empresas');
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const createCompany = async () => {
    if (!newCompany.name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await httpClient.post('/config/companies', { name: newCompany.name.trim(), primaryColor: newCompany.primaryColor });
      setNewCompany({ name: '', primaryColor: '#0057B8' });
      await loadCompanies();
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo crear la empresa');
    } finally {
      setBusy(false);
    }
  };

  const saveCompany = async (c: ListCompany) => {
    const draft = drafts[c.id];
    if (!draft) return;
    try {
      await httpClient.patch(`/config/companies/${c.id}`, draft);
      setCompanies((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: draft.name, primaryColor: draft.primaryColor, isActive: draft.isActive } : x)));
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo guardar');
    }
  };

  const uploadCompanyLogo = async (c: ListCompany, file: File) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await httpClient.post(`/config/companies/${c.id}/logo`, form);
      const newLogo = res.data?.logoUrl || '';
      setCompanies((prev) => prev.map((x) => (x.id === c.id ? { ...x, logoUrl: newLogo } : x)));
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo subir');
    }
  };

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Configuración global</h1>
        <p className="lead below">
          Creá empresas, configurá sus datos y administrá los módulos de la plataforma.
          <button
            onClick={async () => { await exitCompany(); navigate('/home'); }}
            style={{ marginLeft: 12, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            ← Volver al selector de empresas
          </button>
        </p>
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

        {error && <p style={{ color: 'red', fontSize: 12, marginBottom: 8 }}>{error}</p>}

        {tab === 'companies' && (
          <div>
            <div className="info-card" style={{ padding: 20, marginBottom: 16 }}>
              <h3 className="section-title" style={{ marginTop: 0 }}>Nueva empresa</h3>
              <div className="row2">
                <div className="field" style={{ flex: 1 }}>
                  <input className="inp" value={newCompany.name} onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })} placeholder="Nombre de la empresa" />
                </div>
                <input type="color" value={newCompany.primaryColor} onChange={(e) => setNewCompany({ ...newCompany, primaryColor: e.target.value })} style={{ width: 48, height: 44, padding: 0, borderRadius: 10, border: '1px solid var(--line)' }} />
                <button className="btn btn-primary" onClick={createCompany} disabled={busy} style={{ width: 'auto', padding: '0 20px', opacity: busy ? 0.6 : 1 }}>
                  Crear
                </button>
              </div>
            </div>

            {companies.length === 0 && <p className="empty-state">No hay empresas</p>}
            {companies.map((c) => (
              <div key={c.id} className="info-card" style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  {c.logoUrl ? <img src={c.logoUrl} alt={c.name} height={40} style={{ objectFit: 'contain' }} /> : (
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: c.primaryColor, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{c.name.charAt(0)}</div>
                  )}
                  <strong style={{ fontSize: 14, flex: 1 }}>
                    {c.name}
                    {c.isActive && <span style={{ marginLeft: 8, fontSize: 11, background: 'var(--green-soft)', color: 'var(--green-deep)', borderRadius: 99, padding: '2px 8px' }}>activa</span>}
                  </strong>
                  <label style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, background: '#fff' }}>
                    Subir logo
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCompanyLogo(c, f); e.target.value = ''; }} />
                  </label>
                </div>
                <div className="row2">
                  <input value={drafts[c.id]?.name ?? c.name} onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], name: e.target.value } }))} className="inp" style={{ flex: 1 }} />
                  <input type="color" value={drafts[c.id]?.primaryColor ?? c.primaryColor} onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], primaryColor: e.target.value } }))} style={{ width: 48, height: 44, padding: 0, borderRadius: 10, border: '1px solid var(--line)' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={drafts[c.id]?.isActive ?? c.isActive} onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: { ...prev[c.id], isActive: e.target.checked } }))} />
                    Activa
                  </label>
                  <button className="btn btn-primary" onClick={() => saveCompany(c)} style={{ width: 'auto', padding: '0 16px' }}>Guardar</button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 8 }}>
                  ID: {c.id} · Estrategia: {c.authStrategy}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === 'modules' && <ModulesManagement mode="global" />}
      </div>
    </div>
  );
}