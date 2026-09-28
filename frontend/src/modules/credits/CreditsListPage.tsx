import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { httpClient } from '../../shared/api/httpClient';
import { useBackTarget } from '../../shared/layout/TopBarContext';

interface Credit {
  id: string;
  clientId: string;
  requestedAmount: string;
  status: string;
  client?: { fullName: string };
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  in_study: 'En estudio',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  signed: 'Firmado',
  disbursed: 'Desembolsado',
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#8a6d00',
  in_study: '#1356a0',
  approved: '#1f7a36',
  rejected: '#c62828',
  signed: '#2f7d4d',
  disbursed: '#2f7d4d',
};

export function CreditsListPage() {
  const { moduleContexts, loadModuleContext } = useAuth();
  const navigate = useNavigate();
  useBackTarget('/credits');
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(false);
  const ctx = moduleContexts['credits'];

  const reload = () => {
    setLoading(true);
    httpClient
      .get('/credits')
      .then((res) => setCredits(res.data[0]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadModuleContext('credits').then(reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ctx) return <p style={{ padding: 40 }}>Cargando...</p>;

  const has = (perm: string) => ctx.permissions.includes(perm);

  const goTo = (action: string, id: string) => navigate(`/credits/${action}/${id}`);

  const patch = async (path: string) => {
    await httpClient.patch(path);
    reload();
  };

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Créditos</h1>
        <p className="lead below">Consulta el estado y el historial de las solicitudes de crédito.</p>
      </div>

      <div className="s2-body">
        {credits.length === 0 && (
          <p className="empty-state">{loading ? 'Cargando…' : 'No hay solicitudes de crédito.'}</p>
        )}

        {credits.map((c) => {
          const color = STATUS_COLOR[c.status] || 'var(--muted)';
          const actions: ReactNode[] = [];

          if (c.status === 'pending' && has('credits.study')) {
            actions.push(
              <button key="study" className="btn btn-primary" onClick={() => patch(`/credits/${c.id}/study`)}>
                Enviar a estudio
              </button>
            );
          }
          if (c.status === 'in_study' && has('credits.study')) {
            actions.push(
              <button key="result" className="btn btn-primary" onClick={() => goTo('result', c.id)}>
                Decidir
              </button>
            );
          }
          if (c.status === 'approved' && has('credits.study')) {
            actions.push(
              <button key="sign" className="btn btn-primary" onClick={() => goTo('sign', c.id)}>
                Firmar
              </button>
            );
          }
          if (c.status === 'signed' && has('credits.study')) {
            actions.push(
              <button key="success" className="btn btn-primary" onClick={() => goTo('success', c.id)}>
                Desembolsar
              </button>
            );
          }
          if (has('credits.read')) {
            actions.push(
              <button key="docs" className="btn btn-ghost" onClick={() => navigate(`/credits/${c.id}/documents`)}>
                Documentos
              </button>
            );
          }

          return (
            <div key={c.id} className="info-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-word' }}>
                    {c.client?.fullName || c.clientId}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>Solicitud {c.id.slice(0, 8)}</div>
                </div>
                <span
                  style={{
                    flex: 'none',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color,
                    background: `${color}14`,
                    padding: '4px 10px',
                    borderRadius: 999,
                  }}
                >
                  {STATUS_LABEL[c.status] || c.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Monto solicitado</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  ${Number(c.requestedAmount).toLocaleString()}
                </span>
              </div>
              {actions.length > 0 && (
                <div className="rowbtn" style={{ marginTop: 12 }}>
                  {actions}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {has('credits.study') && (
        <button
          onClick={() => navigate('/credits/study')}
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
          title="Nueva solicitud"
        >
          +
        </button>
      )}
    </div>
  );
}