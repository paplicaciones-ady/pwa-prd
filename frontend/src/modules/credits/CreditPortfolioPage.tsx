import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { statusMeta } from './creditStatus';
import { AppBar } from '../../shared/components/AppBar';
import { httpClient } from '../../shared/api/httpClient';
import { useTheme } from '../../shared/theme/ThemeContext';

interface PortfolioCredit {
  id: string;
  applicationNumber: string;
  requestedAmount: string;
  approvedLimit: string | null;
  status: string;
  client?: { fullName: string; legalName?: string; documentNumber: string };
}

export function CreditPortfolioPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [credits, setCredits] = useState<PortfolioCredit[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    httpClient
      .get('/credits', { params: { limit: 100 } })
      .then((res) => setCredits(res.data[0]))
      .catch((err: any) => setError(err?.response?.data?.message || 'No se pudieron cargar los créditos'));
  }, []);

  const primary = theme.primaryColor;

  return (
    <div className="s2">
      <AppBar title="Gestión de cartera" />
      <div className="body">
        <div className="note">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 10h18M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <p>Solicitudes de crédito de tu cartera. Avanza por el flujo: estudio → pre-aprobación → firma de documentos → validación.</p>
        </div>

        {error && <p style={{ color: '#c62828', fontSize: 12 }}>{error}</p>}

        {credits.length === 0 && !error && (
          <div className="empty-state" style={{ background: 'var(--white)', borderRadius: 16, marginTop: 8 }}>
            <span className="empty-icon">💳</span>
            <p>Aún no tienes solicitudes de crédito.</p>
          </div>
        )}

        {credits.map((c) => {
          const { label, color } = statusMeta(c.status);
          const st = { text: label, color };
          return (
            <Link
              key={c.id}
              to={`/credits/${c.id}/documents`}
              style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}
            >
              <div
                style={{
                  background: 'var(--white)',
                  border: '1.5px solid var(--line)',
                  borderRadius: 14,
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <strong style={{ color: 'var(--ink)', fontSize: 13.5 }}>
                      {c.client?.legalName || c.client?.fullName}
                    </strong>
                    <div style={{ color: 'var(--faint)', fontSize: 11, marginTop: 2 }}>
                      {c.applicationNumber || '—'} · NIT {c.client?.documentNumber}
                    </div>
                  </div>
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
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Solicitado</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                    ${Number(c.requestedAmount).toLocaleString()}
                  </span>
                </div>
                {c.approvedLimit && c.status !== 'rejected' && c.status !== 'cancelled' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cupo pre-aprobado</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-deep)' }}>
                      ${Number(c.approvedLimit).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <button
        onClick={() => navigate('/credits/study')}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 16,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: 0,
          background: primary,
          color: '#fff',
          fontSize: 30,
          lineHeight: 1,
          cursor: 'pointer',
          boxShadow: `0 12px 22px -8px rgba(0,0,0,0.35)`,
          zIndex: 10,
        }}
        title="Nueva solicitud"
      >
        +
      </button>
    </div>
  );
}