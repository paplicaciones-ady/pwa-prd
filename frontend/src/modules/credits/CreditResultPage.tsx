import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppBar } from '../../shared/components/AppBar';
import { CreditStepper } from '../../shared/components/CreditStepper';
import { httpClient } from '../../shared/api/httpClient';
import { useTheme } from '../../shared/theme/ThemeContext';
import { resumePath, statusMeta } from './creditStatus';

interface CreditDetail {
  id: string;
  applicationNumber: string | null;
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

/** Cada cuánto se consulta al algoritmo mientras el crédito está en borrador. */
const POLL_EVERY_MS = 10_000;
/** Tras este tiempo sin veredicto, la validación sigue en segundo plano (CreditStudyPoller). */
const POLL_WINDOW_MS = 60_000;

const errorMessage = (err: any, fallback: string) => err?.response?.data?.message?.message || fallback;

export function CreditResultPage() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const navigate = useNavigate();
  const [credit, setCredit] = useState<CreditDetail | null>(null);
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const isDraft = credit?.status === 'draft';
  const polling = isDraft && !timedOut;

  // Carga el crédito y, si está en borrador, consulta al algoritmo al entrar y
  // cada 10 s hasta un minuto (7 consultas). Sirve igual al llegar desde el
  // paso 1 que al retomar un borrador desde la lista.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const check = async () => {
      try {
        const res = await httpClient.post(`/credits/${id}/study/check`);
        if (cancelled) return;
        setCredit(res.data);
        if (res.data.status !== 'draft') return;
      } catch {
        // Un fallo puntual de red no corta la espera: se reintenta en la próxima vuelta.
        if (cancelled) return;
      }
      if (Date.now() - startedAt + POLL_EVERY_MS > POLL_WINDOW_MS) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(check, POLL_EVERY_MS);
    };

    httpClient
      .get(`/credits/${id}`)
      .then((res) => {
        if (cancelled) return;
        setCredit(res.data);
        if (res.data.status === 'draft') void check();
      })
      .catch((err) => !cancelled && setError(errorMessage(err, 'No se pudo cargar el crédito')));

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  // Contador visible mientras se espera el veredicto.
  useEffect(() => {
    if (!polling) return;
    const startedAt = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [polling]);

  const shell = (subtitle: string | undefined, content: React.ReactNode) => (
    <div className="s2 crflow">
      <AppBar title="Resultado del estudio" subtitle={subtitle} logo={theme.logoUrl || undefined} />
      <div className="body" style={{ paddingBottom: 24 }}>
        <CreditStepper current={2} />
        {content}
      </div>
    </div>
  );

  if (error && !credit) {
    return shell(
      'Paso 2 de 4',
      <div className="card" style={{ borderColor: '#f6caca', background: '#fdecec', color: '#c62828', fontSize: 12, fontWeight: 600 }}>
        {error}
      </div>,
    );
  }
  if (!credit) {
    return shell('Paso 2 de 4', <div style={{ color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>);
  }

  const clientName = credit.client?.legalName || credit.client?.fullName;
  const approvedLimit = Number(credit.approvedLimit ?? 0);
  const decidedAt = credit.decisionAt ? new Date(credit.decisionAt).toLocaleString('es-CO') : null;
  // Las respuestas viven en columnas; studyAnswers solo cubre créditos antiguos.
  const legacy = credit.studyAnswers ?? {};
  const answers = {
    personType: credit.personType ?? legacy.personType,
    yearsExperience: credit.yearsExperience ?? legacy.yearsExperience,
    opportunityValue: credit.opportunityValue ?? legacy.opportunityValue,
    reliabilityScore: credit.reliabilityScore ?? legacy.reliabilityScore,
  };
  const next = resumePath(credit.id, credit.status);
  const backToList = () => navigate('/credits/list');

  let verdict: React.ReactNode;
  if (polling) {
    verdict = (
      <div className="card study-wait" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <div>
          <strong>Validando la solicitud…</strong>
          <p>El algoritmo está evaluando el estudio. Puede tardar hasta un minuto ({elapsed} s).</p>
        </div>
      </div>
    );
  } else if (isDraft) {
    verdict = (
      <div className="note" role="status">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <p>
          La validación está tardando más de lo habitual y continuará en segundo plano. Podrás retomar
          este estudio desde la lista de estudios de crédito cuando tenga respuesta.
        </p>
      </div>
    );
  } else if (credit.status === 'pre_approved') {
    verdict = (
      <div className="approve">
        <div className="badge">
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h3>¡Crédito pre-aprobado!</h3>
        <div className="amt">${approvedLimit.toLocaleString('es-CO')}</div>
        <div className="amtl">Cupo pre-aprobado</div>
      </div>
    );
  } else if (credit.status === 'rejected' || credit.status === 'cancelled') {
    const rejected = credit.status === 'rejected';
    verdict = (
      <div className="approve" style={{ background: '#fdecec', borderColor: '#f6caca' }}>
        <div className="badge" style={{ background: rejected ? '#E11225' : '#6b7280' }}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></svg>
        </div>
        <h3 style={{ color: '#b00020' }}>{rejected ? 'Solicitud no aprobada' : 'Solicitud cancelada'}</h3>
        <p>
          {rejected
            ? 'El algoritmo de crédito rechazó esta solicitud. Comunícate con el cliente para informarle la decisión.'
            : 'Esta solicitud fue cancelada y ya no se puede retomar.'}
        </p>
      </div>
    );
  } else {
    verdict = (
      <div className="note">
        <p>
          Estado actual: <strong>{statusMeta(credit.status).label}</strong>.
        </p>
      </div>
    );
  }

  return shell(
    clientName,
    <>
      {verdict}

      <div className="sectitle" style={{ marginTop: 4 }}>Detalle de la solicitud</div>
      <div className="card">
        <div className="stk"><div className="k">Estado</div><div className="v" style={{ color: statusMeta(credit.status).color }}>{statusMeta(credit.status).label}</div></div>
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
        {isDraft ? (
          <button className="btn btn-ghost" onClick={backToList}>
            Volver a la lista de estudios de crédito
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={() => navigate(`/credits/${id}/documents`)}>
            Ver expediente
          </button>
        )}
        {credit.status === 'pre_approved' && (
          <button className="btn btn-green" onClick={() => navigate(`/credits/sign/${id}`)}>
            Continuar a firma de documentos
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
        {(credit.status === 'pending_signatures' || credit.status === 'signed') && next && (
          <button className="btn btn-primary" onClick={() => navigate(next)}>
            Continuar
          </button>
        )}
      </div>
    </>,
  );
}
