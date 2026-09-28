import { useEffect, useState } from 'react';
import { httpClient } from '../../shared/api/httpClient';
import { useAuth } from '../auth/AuthContext';
import { useBackTarget } from '../../shared/layout/TopBarContext';

export function PromoCreatePage() {
  useBackTarget('/promos');
  const { moduleContexts, loadModuleContext } = useAuth();
  const [titulo, setTitulo] = useState('');
  const [descuento, setDescuento] = useState('');
  const [result, setResult] = useState<{ id: string; titulo: string; descuento: number } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadModuleContext('promos').catch(() => undefined);
  }, []);

  const canCrear = moduleContexts['promos']?.permissions.includes('promos.crear') ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const res = await httpClient.post('/promos/create', { titulo, descuento: Number(descuento) });
      setResult(res.data.promo);
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo crear la promo');
    } finally {
      setBusy(false);
    }
  };

  if (!canCrear) {
    return (
      <div className="s2">
        <div className="s2-head">
          <h1 className="page-title">Nueva promo</h1>
        </div>
        <div className="s2-body">
          <div className="info-card" style={{ padding: 20 }}>
            <p className="empty-state" style={{ textAlign: 'left', margin: 0 }}>
              No tenés permiso <code>promos.crear</code> para crear promociones.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Nueva promo</h1>
        <p className="lead below">Sub-ruta protegida por <code>promos.crear</code> (código también devuelve 403 sin el permiso).</p>
      </div>
      <div className="s2-body">
        <div className="info-card" style={{ padding: 20 }}>
          <form onSubmit={handleSubmit}>
            <div className="row2">
              <div className="field">
                <label>Título</label>
                <input className="inp" type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
              </div>
              <div className="field">
                <label>Descuento (%)</label>
                <input className="inp" type="number" min={0} max={100} value={descuento} onChange={(e) => setDescuento(e.target.value)} required />
              </div>
            </div>
            {error && <p style={{ color: '#b00020', fontSize: 12, marginTop: 8 }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ opacity: busy ? 0.6 : 1, marginTop: 12 }}>
              Crear
            </button>
          </form>
          {result && (
            <p style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'var(--green-soft)', color: 'var(--green-deep)', fontWeight: 700, textAlign: 'center' }}>
              {result.id} · {result.titulo} · {result.descuento}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}