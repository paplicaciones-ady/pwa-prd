import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Can } from '../../shared/components/Can';
import { httpClient } from '../../shared/api/httpClient';

interface Client {
  id: string;
  fullName: string;
  documentNumber: string;
  documentType?: string;
  status: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  nit: 'NIT',
  cc: 'C.C.',
  ce: 'C.E.',
  pp: 'Pasaporte',
};

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ClientsListPage() {
  const { loadModuleContext, moduleContexts } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState('');
  const [total, setTotal] = useState(0);
  const ctx = moduleContexts['clients'];

  const reload = () => {
    httpClient.get('/clients').then((res) => {
      const data = res.data;
      const list = Array.isArray(data) ? data[0] : data;
      setClients(Array.isArray(list) ? list : []);
      setTotal(typeof data?.[1] === 'number' ? data[1] : 0);
    });
  };

  const toggleStatus = async (c: Client) => {
    await httpClient.patch(`/clients/${c.id}/status`);
    reload();
  };

  const remove = async (c: Client) => {
    if (!window.confirm(`¿Eliminar el cliente "${c.fullName}"? Esta acción no se puede deshacer.`)) return;
    await httpClient.delete(`/clients/${c.id}`);
    reload();
  };

  useEffect(() => {
    loadModuleContext('clients').catch(() => undefined);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const label = DOC_TYPE_LABELS[c.documentType || ''] || (c.documentType || '').toUpperCase();
      return (
        c.fullName?.toLowerCase().includes(q) ||
        c.documentNumber?.toLowerCase().includes(q) ||
        label?.toLowerCase().includes(q)
      );
    });
  }, [clients, query]);

  if (!ctx) return <p style={{ padding: 40 }}>Cargando...</p>;

  return (
    <div className="s2">
      <div className="s2-head">
        <div className="s2-top">
          <div className="cback" onClick={() => navigate('/home')}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div className="org-chip"><span className="org-dot" />Clientes</div>
        </div>
        <h1 className="page-title">Clientes</h1>
        <p className="lead below">{total === 0 ? 'Gestioná los clientes de tu empresa.' : `${total} cliente${total === 1 ? '' : 's'} registrado${total === 1 ? '' : 's'}.`}</p>
      </div>

      <div className="s2-body">
        <div className="inp" style={{ marginBottom: 16 }}>
          <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, documento o tipo"
          />
        </div>

        {filtered.length === 0 && (
          <p className="empty-state">
            {query ? 'Sin resultados para esa búsqueda.' : 'No hay clientes.'}
          </p>
        )}

        {filtered.map((c) => (
          <div
            key={c.id}
            className="info-card"
            style={{ padding: '14px 16px', cursor: 'pointer' }}
            onClick={() => navigate(`/clients/${c.id}/edit`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: 14,
                  flex: 'none',
                }}
              >
                {initials(c.fullName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-word' }}>
                  {c.fullName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {DOC_TYPE_LABELS[c.documentType || ''] || ''}{c.documentNumber ? ` ${c.documentNumber}` : '· Sin documento'}
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 99,
                  background: c.status === 'active' ? 'var(--green-soft)' : '#fdecea',
                  color: c.status === 'active' ? 'var(--green-deep)' : '#b00020',
                  flex: 'none',
                }}
              >
                {c.status === 'active' ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
              <Can permission="clients.update" permissions={ctx.permissions}>
                <button
                  onClick={() => navigate(`/clients/${c.id}/edit`)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleStatus(c)}
                  style={{ background: 'none', border: 'none', color: 'var(--ink)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {c.status === 'active' ? 'Desactivar' : 'Activar'}
                </button>
              </Can>
              <Can permission="clients.delete" permissions={ctx.permissions}>
                <button
                  onClick={() => remove(c)}
                  style={{ background: 'none', border: 'none', color: '#b00020', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Eliminar
                </button>
              </Can>
            </div>
          </div>
        ))}
      </div>

      <Can permission="clients.create" permissions={ctx.permissions}>
        <button
          onClick={() => navigate('/clients/new')}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 54,
            height: 54,
            borderRadius: '50%',
            border: 0,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
            color: '#fff',
            fontSize: 28,
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '0 12px 22px -8px rgba(var(--accent-rgb), 0.6)',
            zIndex: 10,
          }}
          title="Nuevo cliente"
        >
          +
        </button>
      </Can>
    </div>
  );
}