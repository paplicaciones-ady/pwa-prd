import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppBar } from '../../shared/components/AppBar';
import { CreditStepper } from '../../shared/components/CreditStepper';
import { httpClient } from '../../shared/api/httpClient';
import { useTheme } from '../../shared/theme/ThemeContext';

interface CreditDetail {
  id: string;
  applicationNumber: string;
  requestedAmount: string;
  approvedLimit: string | null;
  status: string;
  nit: string | null;
  decisionAt: string | null;
  personType: 'natural' | 'juridica' | null;
  yearsExperience: number | null;
  opportunityValue: number | null;
  reliabilityScore: number | null;
  /** Solo créditos creados cuando las respuestas vivían en jsonb. */
  studyAnswers: Record<string, unknown> | null;
  client?: {
    id: string;
    fullName: string;
    documentNumber: string;
    legalName?: string;
    commercialName?: string;
    city?: string;
  };
}

export function CreditResultPage() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const navigate = useNavigate();
  const [credit, setCredit] = useState<CreditDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    httpClient
      .get(`/credits/${id}`)
      .then((res) => setCredit(res.data))
      .catch((err: any) => setError(err?.response?.data?.message?.message || 'No se pudo cargar el crédito'));
  }, [id]);

  if (error && !credit) {
    return (
      <div className="s2 crflow">
        <AppBar title="Resultado del crédito" subtitle="Paso 2 de 4" logo={theme.logoUrl || undefined} />
        <div className="body" style={{ paddingBottom: 24 }}>
          <div className="card" style={{ borderColor: '#f6caca', background: '#fdecec', color: '#c62828', fontSize: 12, fontWeight: 600 }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!credit) {
    return (
      <div className="s2 crflow">
        <AppBar title="Resultado del crédito" subtitle="Paso 2 de 4" logo={theme.logoUrl || undefined} />
        <div className="body" style={{ color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>
      </div>
    );
  }

  const clientName = credit.client?.legalName || credit.client?.fullName;
  // El veredicto ya quedó registrado en el paso 1: aquí solo se muestra.
  const isRejected = credit.status === 'rejected';
  const approvedLimit = Number(credit.approvedLimit ?? credit.requestedAmount);
  const decidedAt = credit.decisionAt ? new Date(credit.decisionAt).toLocaleString('es-CO') : null;
  // Las respuestas viven en columnas; studyAnswers solo cubre créditos antiguos
  // por si la migración no alcanzó a trasladarlas.
  const legacy = credit.studyAnswers ?? {};
  const answers = {
    personType: credit.personType ?? legacy.personType,
    yearsExperience: credit.yearsExperience ?? legacy.yearsExperience,
    opportunityValue: credit.opportunityValue ?? legacy.opportunityValue,
    reliabilityScore: credit.reliabilityScore ?? legacy.reliabilityScore,
  };

  return (
    <div className="s2 crflow">
      <AppBar title="Resultado del crédito" subtitle={clientName} logo={theme.logoUrl || undefined} />
      <div className="body" style={{ paddingBottom: 24 }}>
        <CreditStepper current={2} />

        {isRejected ? (
          <div className="approve" style={{ background: '#fdecec', borderColor: '#f6caca' }}>
            <div className="badge" style={{ background: '#E11225' }}>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l9 16H3L12 3Z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" /></svg>
            </div>
            <h3 style={{ color: '#b00020' }}>Solicitud no aprobada</h3>
            <p>El asesor de crédito rechazó esta solicitud. Comunícate con el cliente para informarle la decisión.</p>
          </div>
        ) : (
          <div className="approve">
            <div className="badge">
              <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h3>¡Crédito aprobado!</h3>
            <div className="amt">${approvedLimit.toLocaleString('es-CO')}</div>
            <div className="amtl">Cupo aprobado</div>
          </div>
        )}

        <div className="sectitle" style={{ marginTop: 4 }}>Detalle de la evaluación</div>
        <div className="card">
          <div className="stk"><div className="k">Radicado</div><div className="v">{credit.applicationNumber || '—'}</div></div>
          <div className="stk"><div className="k">Decidido</div><div className="v">{decidedAt || '—'}</div></div>
          <div className="stk"><div className="k">NIT</div><div className="v">{credit.nit || '—'}</div></div>
          <div className="stk"><div className="k">Tipo de persona</div><div className="v">{answers.personType === 'juridica' ? 'Jurídica' : answers.personType === 'natural' ? 'Natural' : '—'}</div></div>
          <div className="stk"><div className="k">Años de experiencia</div><div className="v">{String(answers.yearsExperience ?? '—')}</div></div>
          <div className="stk"><div className="k">Valor de la oportunidad</div><div className="v">${Number(answers.opportunityValue ?? 0).toLocaleString('es-CO')}</div></div>
          <div className="stk"><div className="k">Confiabilidad</div><div className="v">{answers.reliabilityScore ? `${answers.reliabilityScore} de 5` : '—'}</div></div>
        </div>

        {error && <p style={{ color: '#c62828', fontSize: 12, margin: '10px 2px' }}>{error}</p>}

        <div className="sp" />
        <div className="action-bar stacked">
          <button className="btn btn-ghost" onClick={() => navigate(`/credits/${id}/documents`)}>
            Ver expediente
          </button>
          {!isRejected && (
            <button className="btn btn-green" onClick={() => navigate(`/credits/sign/${id}`)}>
              Continuar a firma del pagaré
              <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
