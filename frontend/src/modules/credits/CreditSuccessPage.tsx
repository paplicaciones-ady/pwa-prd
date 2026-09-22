import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CreditStepper } from '../../shared/components/CreditStepper';
import { httpClient } from '../../shared/api/httpClient';
import { useTheme } from '../../shared/theme/ThemeContext';

interface SuccessCredit {
  id: string;
  applicationNumber: string;
  approvedLimit: string;
  status: string;
}

export function CreditSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const navigate = useNavigate();
  const [credit, setCredit] = useState<SuccessCredit | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [disbursed, setDisbursed] = useState(false);

  useEffect(() => {
    if (!id) return;
    httpClient
      .get(`/credits/${id}`)
      .then((res) => {
        setCredit(res.data);
        setDisbursed(res.data.status === 'disbursed');
      })
      .catch((err: any) => setError(err?.response?.data?.message || 'No se pudo cargar el crédito'));
  }, [id]);

  const finalize = async () => {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      await httpClient.post(`/credits/${id}/finalize`);
      setDisbursed(true);
    } catch (err: any) {
      setError(err?.response?.data?.message?.message || 'No se pudo registrar el desembolso');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="s2 credit-shell" style={{ background: 'var(--bg)' }}>
      <div className="okhero">
        <div className="hrow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 12 }}>{disbursed ? '¡Desembolso exitoso!' : '¡Firma exitosa!'}</span>
          {theme.logoUrl && (
            <img className="alogo" src={theme.logoUrl} alt="logo" style={{ height: 26, filter: 'brightness(0) invert(1)' }} />
          )}
        </div>
        <div className="badge">
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h3>{disbursed ? '¡Crédito desembolsado!' : '¡Firma exitosa!'}</h3>
        <p>
          {disbursed
            ? 'El desembolso quedó registrado correctamente.'
            : 'El pagaré fue firmado correctamente y la solicitud quedó creada.'}
        </p>
      </div>

      <div className="body" style={{ paddingTop: 18 }}>
        <CreditStepper current={4} />

        <div className="card" style={{ borderColor: '#cfe8d9', background: '#f4fbf6', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 700, color: 'var(--green-deep)', fontSize: 15 }}>
            {credit?.applicationNumber ? `Solicitud #${credit.applicationNumber} creada` : 'Solicitud registrada'}
          </div>
        </div>

        {credit && (
          <div className="card">
            <div className="kvline"><span className="k">Cupo aprobado</span><span className="v">${Number(credit.approvedLimit).toLocaleString('es-CO')}</span></div>
            <div className="kvline" style={{ borderTop: '1px solid var(--line)', marginTop: 4, paddingTop: 8 }}><span className="k">Sin intereses hasta</span><span className="v">30 días</span></div>
            <div className="kvline"><span className="k">Estado</span><span className="v" style={{ color: 'var(--green-deep)' }}>{disbursed ? 'Desembolsado' : 'Firmado'}</span></div>
          </div>
        )}

        {!disbursed && (
          <>
            {error && <p style={{ color: '#c62828', fontSize: 12, margin: '10px 2px' }}>{error}</p>}
          </>
        )}

        {disbursed && (
          <div className="card" style={{ background: '#eef6ee', borderColor: '#d3e8d3', color: '#2a6b3a', textAlign: 'center', fontSize: 12.5, fontWeight: 600 }}>
            El crédito fue desembolsado correctamente. Ingresa a Documentos para consultar el expediente.
          </div>
        )}

        <div className="sp" />
        <div className="action-bar stacked">
          {!disbursed && (
            <button type="button" className="btn btn-green" disabled={busy} onClick={finalize} style={{ opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Procesando…' : 'Registrar desembolso'}
            </button>
          )}
          <div className="rowbtn">
            <button type="button" className="btn btn-ghost" onClick={() => navigate(`/credits/${id}/documents`)}>
              Ver documentos
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/credits/list')}>
              Ir a créditos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
