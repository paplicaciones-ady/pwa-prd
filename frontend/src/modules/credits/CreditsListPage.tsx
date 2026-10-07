import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { httpClient } from '../../shared/api/httpClient';
import { useBackTarget } from '../../shared/layout/TopBarContext';
import { canCancel, resumePath, statusMeta } from './creditStatus';

interface Credit {
  id: string;
  clientId: string;
  approvedLimit: string | null;
  status: string;
  client?: { fullName: string };
  algorithmResult?: { error?: { type: string; streak?: number } | null } | null;
}

/** Errores de Saman que el asesor debe ver en la lista (el transitorio se reintenta solo). */
const ALGORITHM_ERROR_LABEL: Record<string, { text: string; color: string }> = {
  definitive: { text: 'Error de validación', color: '#b00020' },
  failed: { text: 'Estudio fallido', color: '#8a6d00' },
  auth: { text: 'Servicio no disponible', color: '#8a6d00' },
  offline: { text: 'Sin conexión con Saman', color: '#8a6d00' },
};

/** Cupo de la tarjeta: el aprobado; en borrador aún se evalúa; rechazado/cancelado no tiene. */
function approvedLimitText(c: Credit): string {
  if (c.approvedLimit != null && !['rejected', 'cancelled'].includes(c.status)) {
    return `$${Number(c.approvedLimit).toLocaleString('es-CO')}`;
  }
  return c.status === 'draft' ? 'En evaluación' : '—';
}

/** Un error de red aislado se reintenta solo; desde 3 seguidos se avisa "sin conexión". */
const algorithmErrorKey = (error?: { type: string; streak?: number } | null) =>
  error?.type === 'transient' ? ((error.streak ?? 1) >= 3 ? 'offline' : '') : (error?.type ?? '');

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

  const cancel = async (c: Credit) => {
    const name = c.client?.fullName || 'este cliente';
    if (!window.confirm(`¿Cancelar la solicitud de crédito de ${name}? Ya no se podrá retomar.`)) return;
    try {
      await httpClient.patch(`/credits/${c.id}/cancel`);
    } catch (err: any) {
      window.alert(err?.response?.data?.message?.message || 'No se pudo cancelar la solicitud');
    }
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
          const { label, color } = statusMeta(c.status);
          const algorithmError =
            c.status === 'draft' ? ALGORITHM_ERROR_LABEL[algorithmErrorKey(c.algorithmResult?.error)] : undefined;
          const actions: ReactNode[] = [];
          // Se retoma en la pantalla que corresponde al estado; rechazados y
          // cancelados ya no se retoman (solo queda el expediente).
          const resume = resumePath(c.id, c.status);

          if (resume && has('credits.study')) {
            actions.push(
              <button key="resume" className="btn btn-primary" onClick={() => navigate(resume)}>
                {c.status === 'signed' ? 'Ver estado' : 'Retomar'}
              </button>
            );
          }
          // Un rechazado ya no se retoma, pero su resultado (paso 2) se puede consultar
          // para ver el motivo. Misma ruta y permiso que el resultado de los demás.
          if (c.status === 'rejected' && has('credits.study')) {
            actions.push(
              <button key="result" className="btn btn-ghost" onClick={() => navigate(`/credits/result/${c.id}`)}>
                Ver resultado
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
          if (canCancel(c.status) && has('credits.study')) {
            actions.push(
              <button key="cancel" className="btn btn-ghost" onClick={() => cancel(c)} style={{ color: '#b00020' }}>
                Cancelar
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
                  {algorithmError && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: algorithmError.color, marginTop: 3 }}>
                      ⚠ {algorithmError.text}
                    </div>
                  )}
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
                  {label}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cupo aprobado</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  {approvedLimitText(c)}
                </span>
              </div>
              {actions.length > 0 && (
                <div className="rowbtn" style={{ marginTop: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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