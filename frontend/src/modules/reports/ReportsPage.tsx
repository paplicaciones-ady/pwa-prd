import { useEffect, useState } from 'react';
import { httpClient } from '../../shared/api/httpClient';
import { useAuth } from '../auth/AuthContext';
import { useBackTarget } from '../../shared/layout/TopBarContext';

interface ReportSummary {
  creditos: number;
  clientes: number;
  enCobranza: number;
}

export function ReportsPage() {
  useBackTarget('/home');
  const { moduleContexts, loadModuleContext } = useAuth();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [generated, setGenerated] = useState<{ url: string; rows: number; formato: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canVer = moduleContexts['reports']?.permissions.includes('reports.ver') ?? false;
  const canGenerar = moduleContexts['reports']?.permissions.includes('reports.generar') ?? false;

  useEffect(() => {
    loadModuleContext('reports').catch(() => undefined);
  }, []);

  const handleDashboard = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await httpClient.get('/reports/dashboard');
      setSummary(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo consultar el reporte');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerar = async () => {
    setError('');
    setGenerated(null);
    setBusy(true);
    try {
      const res = await httpClient.post('/reports/generar', { formato: 'csv' });
      setGenerated(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo generar el reporte');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Reportes comerciales</h1>
        <p className="lead below">Permisos <code>reports.ver</code> / <code>reports.generar</code>.</p>
      </div>
      <div className="s2-body">
        <div className="info-card" style={{ padding: 20 }}>
          {error && <p style={{ color: '#b00020', fontSize: 12, marginTop: 8 }}>{error}</p>}
          {canVer ? (
            <button type="button" onClick={handleDashboard} className="btn btn-primary" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
              Ver dashboard
            </button>
          ) : (
            <p className="empty-state" style={{ textAlign: 'left', margin: 0 }}>
              No tenés permiso <code>reports.ver</code> para ver reportes.
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {canGenerar && (
              <button type="button" onClick={handleGenerar} className="btn btn-ghost" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
                Generar reporte
              </button>
            )}
          </div>

          {summary && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 12, background: 'var(--accent-soft)' }}>
                <strong>{summary.creditos}</strong><br /><span style={{ fontSize: 12, color: 'var(--muted)' }}>Créditos</span>
              </div>
              <div style={{ padding: 12, borderRadius: 12, background: 'var(--accent-soft)' }}>
                <strong>{summary.clientes}</strong><br /><span style={{ fontSize: 12, color: 'var(--muted)' }}>Clientes</span>
              </div>
              <div style={{ padding: 12, borderRadius: 12, background: 'var(--accent-soft)' }}>
                <strong>{summary.enCobranza}</strong><br /><span style={{ fontSize: 12, color: 'var(--muted)' }}>En cobranza</span>
              </div>
            </div>
          )}
          {generated && (
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
              Generado: <code>{generated.url}</code> · {generated.rows} filas · {generated.formato}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}