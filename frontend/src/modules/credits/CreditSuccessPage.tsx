import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CreditStepper } from '../../shared/components/CreditStepper';
import { httpClient } from '../../shared/api/httpClient';
import { useTheme } from '../../shared/theme/ThemeContext';
import { statusMeta } from './creditStatus';

interface SuccessCredit {
  id: string;
  applicationNumber: string | null;
  approvedLimit: string | null;
  status: string;
  signatureDate: string | null;
}

const errorMessage = (err: any, fallback: string) => err?.response?.data?.message?.message || fallback;

/**
 * Paso 4: firmas de los documentos enviados en el paso 3.
 *   pending_signatures → esperando la confirmación del servicio de firma externo.
 *   signed             → firmado/validado.
 */
export function CreditSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const navigate = useNavigate();
  const [credit, setCredit] = useState<SuccessCredit | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setError('');
    httpClient
      .get(`/credits/${id}`)
      .then((res) => setCredit(res.data))
      .catch((err) => setError(errorMessage(err, 'No se pudo cargar el crédito')));
  }, [id]);

  useEffect(load, [load]);

  // Mientras no exista el webhook del servicio de firma, la confirmación se
  // registra a mano (POST /credits/:id/signatures/confirm).
  const confirmSignatures = async () => {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      const res = await httpClient.post(`/credits/${id}/signatures/confirm`);
      setCredit(res.data);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo registrar la confirmación de firmas'));
    } finally {
      setBusy(false);
    }
  };

  const signed = credit?.status === 'signed';
  const pending = credit?.status === 'pending_signatures';

  return (
    <div className="s2 crflow" style={{ background: 'var(--bg)' }}>
      <div className="okhero">
        <div className="hrow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 12 }}>{signed ? '¡Firmas validadas!' : 'Firma de documentos'}</span>
          {theme.logoUrl && (
            <img className="alogo" src={theme.logoUrl} alt="logo" style={{ height: 26, filter: 'brightness(0) invert(1)' }} />
          )}
        </div>
        <h3>{signed ? '¡Crédito firmado y validado!' : 'Pendiente de firmas'}</h3>
        <p>
          {signed
            ? 'El servicio de firma confirmó el pagaré y la carta de instrucciones.'
            : 'El pagaré y la carta de instrucciones se enviaron a la plataforma de firma electrónica. El crédito quedará validado cuando llegue la confirmación de las firmas.'}
        </p>
      </div>

      <div className="body" style={{ paddingTop: 18 }}>
        <CreditStepper current={4} />

        {credit && (
          <div className="card">
            <div className="kvline"><span className="k">Solicitud</span><span className="v">{credit.applicationNumber || '—'}</span></div>
            <div className="kvline"><span className="k">Cupo pre-aprobado</span><span className="v">${Number(credit.approvedLimit ?? 0).toLocaleString('es-CO')}</span></div>
            <div className="kvline">
              <span className="k">Estado</span>
              <span className="v" style={{ color: statusMeta(credit.status).color }}>{statusMeta(credit.status).label}</span>
            </div>
            {signed && credit.signatureDate && (
              <div className="kvline"><span className="k">Validado</span><span className="v">{new Date(credit.signatureDate).toLocaleString('es-CO')}</span></div>
            )}
          </div>
        )}

        {credit && !signed && !pending && (
          <div className="note">
            <p>Esta solicitud no tiene documentos en firma (estado: {statusMeta(credit.status).label}).</p>
          </div>
        )}

        {error && <p style={{ color: '#c62828', fontSize: 12, margin: '10px 2px' }}>{error}</p>}

        <div className="sp" />
        <div className="action-bar stacked">
          {pending && (
            <>
              <button type="button" className="btn btn-green" disabled={busy} onClick={confirmSignatures} style={{ opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Registrando…' : 'Registrar confirmación de firmas'}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={load}>
                Actualizar estado
              </button>
            </>
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
