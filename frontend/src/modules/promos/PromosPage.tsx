import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { httpClient } from '../../shared/api/httpClient';
import { useAuth } from '../auth/AuthContext';
import { useBackTarget } from '../../shared/layout/TopBarContext';

interface Promo {
  id: string;
  titulo: string;
  descuento: number;
}

export function PromosPage() {
  useBackTarget('/home');
  const { moduleContexts, loadModuleContext } = useAuth();
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [detail, setDetail] = useState<Promo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canVer = moduleContexts['promos']?.permissions.includes('promos.ver') ?? false;
  const canCrear = moduleContexts['promos']?.permissions.includes('promos.crear') ?? false;
  const canDetalle = moduleContexts['promos']?.permissions.includes('promos.detalle') ?? false;

  useEffect(() => {
    loadModuleContext('promos').catch(() => undefined);
  }, []);

  const handleVer = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await httpClient.get('/promos');
      setPromos(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudieron listar las promociones');
    } finally {
      setBusy(false);
    }
  };

  const handleDetalle = async (id: string) => {
    setError('');
    setBusy(true);
    try {
      const res = await httpClient.get(`/promos/${id}/detalle`);
      setDetail(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo ver el detalle');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Promociones</h1>
        <p className="lead below">Ruta extra protegida: <code>promos.crear</code> habilita "Nueva promo".</p>
      </div>
      <div className="s2-body">
        <div className="info-card" style={{ padding: 20 }}>
          {error && <p style={{ color: '#b00020', fontSize: 12, marginTop: 8 }}>{error}</p>}
          {canVer ? (
            <button type="button" onClick={handleVer} className="btn btn-primary" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
              Listar promociones
            </button>
          ) : (
            <p className="empty-state" style={{ textAlign: 'left', margin: 0 }}>
              No tenés permiso <code>promos.ver</code> para ver las promociones.
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {canCrear && (
              <Link to="/promos/nueva" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                Nueva promo
              </Link>
            )}
          </div>

          {promos && (
            <div style={{ marginTop: 16 }}>
              {promos.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ flex: 1 }}>{p.titulo} · <strong>{p.descuento}%</strong></span>
                  {canDetalle && (
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => handleDetalle(p.id)} style={{ padding: '6px 12px' }}>
                      Detalle
                    </button>
                  )}
                </div>
              ))}
              {detail && (
                <p style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
                  {detail.id} · {detail.titulo} · {detail.descuento}%
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}