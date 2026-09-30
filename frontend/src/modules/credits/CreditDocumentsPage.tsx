import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppBar } from '../../shared/components/AppBar';
import { httpClient } from '../../shared/api/httpClient';
import { useTheme } from '../../shared/theme/ThemeContext';

interface DocDetail {
  id: string;
  code: string;
  name: string;
  status: string;
  signedAt: string | null;
}

const DOC_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: 'Pendiente', color: '#8a6d00' },
  signed: { text: 'Firmado', color: '#1f7a36' },
  issued: { text: 'Emitido', color: '#1356a0' },
};

/** Código con el que study() archiva la firma de autorización de datos. */
const CONSENT_CODE = 'autorizacion_datos';

export function CreditDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const navigate = useNavigate();
  const [applicationNumber, setApplicationNumber] = useState('');
  const [status, setStatus] = useState('');
  const [documents, setDocuments] = useState<DocDetail[]>([]);
  const [signature, setSignature] = useState<{ dataUrl: string; signedAt: string | null } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    httpClient
      .get(`/credits/${id}`)
      .then((res) => {
        setApplicationNumber(res.data.applicationNumber || '');
        setStatus(res.data.status);
      })
      .catch((err: any) => setError(err?.response?.data?.message || 'No se pudo cargar el crédito'));

    httpClient
      .get(`/credits/${id}/documents`)
      .then((res) => setDocuments(res.data))
      .catch(() => setError('No se pudieron cargar los documentos'));
  }, [id]);

  // El binario de la firma no viene en el listado (contentBase64 es select:false):
  // se pide solo cuando alguien lo abre.
  const showSignature = (documentId: string, signedAt: string | null) => {
    if (!id) return;
    setError('');
    httpClient
      .get(`/credits/${id}/documents/${documentId}/signature`)
      .then((res) => {
        const { contentBase64, contentMime } = res.data;
        if (!contentBase64) {
          setError('Este documento no tiene contenido almacenado');
          return;
        }
        setSignature({ dataUrl: `data:${contentMime || 'image/png'};base64,${contentBase64}`, signedAt });
      })
      .catch((err: any) => setError(err?.response?.data?.message?.message || 'No se pudo cargar la firma'));
  };

  const primary = theme.primaryColor;

  return (
    <div className="s2">
      <AppBar title="Documentos del crédito" />
      <div className="body">
        <div className="note">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M6 3h8l4 4v14H6V3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M14 3v4h4M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <p>
            {applicationNumber
              ? `Expediente de la solicitud ${applicationNumber}.`
              : 'Expediente de la solicitud.'}{' '}
            Estado actual: <strong>{status || '—'}</strong>
          </p>
        </div>

        {error && <p style={{ color: '#c62828', fontSize: 12 }}>{error}</p>}

        {signature && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.1em', color: 'var(--faint)', marginBottom: 9 }}>
              FIRMA DE AUTORIZACIÓN
            </div>
            <img
              src={signature.dataUrl}
              alt="Firma de autorización de datos"
              style={{ display: 'block', width: '100%', borderRadius: 10, border: '1.5px solid var(--line)' }}
            />
            {signature.signedAt && (
              <div style={{ color: 'var(--faint)', fontSize: 11, marginTop: 8 }}>
                Registrada el {new Date(signature.signedAt).toLocaleString('es-CO')}
              </div>
            )}
          </div>
        )}

        {documents.length === 0 && !error && (
          <div className="empty-state" style={{ background: 'var(--white)', borderRadius: 16 }}>
            <span className="empty-icon">📄</span>
            <p>Los documentos se generarán a medida que avance el flujo del crédito.</p>
          </div>
        )}

        {documents.map((d) => {
          const st = DOC_STATUS[d.status] || { text: d.status, color: 'var(--muted)' };
          return (
            <div
              key={d.id}
              style={{
                background: 'var(--white)',
                border: '1.5px solid var(--line)',
                borderRadius: 14,
                padding: '14px 16px',
                marginBottom: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong style={{ color: 'var(--ink)', fontSize: 13.5 }}>{d.name}</strong>
                <div style={{ color: 'var(--faint)', fontSize: 11, marginTop: 2 }}>
                  {d.status === 'signed' && d.signedAt
                    ? `Firmado el ${new Date(d.signedAt).toLocaleDateString()}`
                    : `Código: ${d.code}`}
                </div>
              </div>
              {d.code === CONSENT_CODE ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ flex: 'none', minWidth: 0, padding: '7px 12px', fontSize: 11.5 }}
                  onClick={() => showSignature(d.id, d.signedAt)}
                >
                  Ver firma
                </button>
              ) : (
                <span
                  style={{
                    flex: 'none',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: st.color,
                    background: `${st.color}14`,
                    padding: '4px 10px',
                    borderRadius: 999,
                  }}
                >
                  {st.text}
                </span>
              )}
            </div>
          );
        })}

        <div className="rowbtn">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/credits/list')}>
            Volver
          </button>
          {status === 'signed' && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: primary }}
              onClick={() => navigate(`/credits/success/${id}`)}
            >
              Registrar desembolso
            </button>
          )}
        </div>
      </div>
    </div>
  );
}