import { useEffect, useState } from 'react';
import { httpClient } from '../../shared/api/httpClient';
import { useAuth } from '../auth/AuthContext';

interface SumResponse {
  result: number;
  expression: string;
}

export function CalculatorPage() {
  const { moduleContexts, loadModuleContext } = useAuth();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [result, setResult] = useState<SumResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadModuleContext('calculator').catch(() => undefined);
  }, []);

  const ctx = moduleContexts['calculator'];
  const perms = ctx?.permissions ?? [];
  const canSum = perms.includes('calculator.sumar');
  const canRestar = perms.includes('calculator.restar');

  const handleSubmit = async (op: 'sum' | 'restar', e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const res = await httpClient.post(`/calculator/${op}`, { a: Number(a), b: Number(b) });
      setResult(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo calcular');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="s2">
      <div className="s2-head">
        <h1 className="page-title">Calculadora</h1>
        <p className="lead below">Suma de prueba· Front → Kong → Backend → RBAC.</p>
      </div>

      <div className="s2-body">
        <div className="info-card" style={{ padding: 20 }}>
          <form>
            <div className="row2">
              <div className="field">
                <label>A</label>
                <input
                  className="inp"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={a}
                  onChange={(e) => setA(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>B</label>
                <input
                  className="inp"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={b}
                  onChange={(e) => setB(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && <p style={{ color: '#b00020', fontSize: 12, marginTop: 8 }}>{error}</p>}

            {!ctx ? (
              <p className="empty-state">Cargando permisos…</p>
            ) : (
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                {canSum && (
                  <button type="button" onClick={(e) => handleSubmit('sum', e)} className="btn btn-primary" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
                    Sumar
                  </button>
                )}
                {canRestar && (
                  <button type="button" onClick={(e) => handleSubmit('restar', e)} className="btn btn-ghost" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
                    Restar
                  </button>
                )}
                {!canSum && !canRestar && (
                  <p className="empty-state" style={{ textAlign: 'left', margin: 0 }}>
                    No tenés operaciones habilitadas para este módulo. Pedí al admin que te otorgue
                    <code> calculator.sumar</code> / <code>calculator.restar</code> desde Perfiles → Permisos.
                  </p>
                )}
              </div>
            )}
          </form><span style={{ fontSize: 11, color: 'var(--faint)' }}>Se muestran solo las operaciones habilitadas para tu perfil.</span>

          {result && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 12,
                background: 'var(--green-soft)',
                color: 'var(--green-deep)',
                fontWeight: 700,
                textAlign: 'center',
                fontSize: 18,
              }}
            >
              {result.expression}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}