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
  /** Resumen del veredicto de Saman o el error que impidió obtenerlo. */
  algorithmResult: {
    score?: number;
    reason?: string;
    error?: { type: 'auth' | 'transient' | 'failed' | 'definitive'; message: string; at: string; streak?: number } | null;
  } | null;
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

/** Errores de red seguidos tras los que se deja de esperar (el sondeo sigue reintentando). */
const OFFLINE_STREAK = 3;

/**
 * Errores que cortan la espera: credencial (hay que cambiar el token), FAILED
 * de Saman, definitivo (decide el asesor) o sin conexión (varios errores de red
 * seguidos). Un error de red aislado se sigue esperando.
 */
const blockingError = (c: Pick<CreditDetail, 'algorithmResult'> | null) => {
  const error = c?.algorithmResult?.error;
  if (error?.type === 'transient') return (error.streak ?? 1) >= OFFLINE_STREAK ? 'offline' : null;
  return error?.type === 'auth' || error?.type === 'failed' || error?.type === 'definitive' ? error.type : null;
};

/** Mensajes que rotan junto al spinner mientras se espera el veredicto (uno cada 8 s). */
const WAIT_MESSAGES = [
  'Validando datos del cliente…',
  'Verificando la autorización de tratamiento de datos…',
  'Consultando bases de información…',
  'Consultando centrales de riesgo…',
  'Analizando el comportamiento crediticio…',
  'Calculando el cupo…',
  'Preparando el resultado…',
];
const WAIT_MESSAGE_EVERY_S = 8;

export function CreditResultPage() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const navigate = useNavigate();
  const [credit, setCredit] = useState<CreditDetail | null>(null);
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Cada reintento manual reinicia la espera de un minuto.
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);

  const isDraft = credit?.status === 'draft';
  const failure = isDraft ? blockingError(credit) : null;
  const polling = isDraft && !timedOut && !failure;

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
        if (res.data.status !== 'draft' || blockingError(res.data)) return;
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
        if (res.data.status === 'draft' && !blockingError(res.data)) void check();
      })
      .catch((err) => !cancelled && setError(errorMessage(err, 'No se pudo cargar el crédito')));

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, round]);

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
  const algorithm = credit.algorithmResult;

  const retry = async () => {
    setBusy(true);
    setError('');
    try {
      await httpClient.post(`/credits/${id}/study/retry`);
      setTimedOut(false);
      setRound((r) => r + 1);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo reintentar el estudio'));
    } finally {
      setBusy(false);
    }
  };

  // Cancela este borrador y abre el paso 1 con sus datos; la firma se pide de nuevo.
  const recreate = async () => {
    setBusy(true);
    setError('');
    try {
      await httpClient.patch(`/credits/${id}/cancel`);
      navigate(`/credits/study?desde=${id}`);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo cancelar la solicitud'));
      setBusy(false);
    }
  };

  let verdict: React.ReactNode;
  if (failure === 'auth') {
    verdict = (
      <div className="card" role="alert" style={{ borderColor: '#f3d27a', background: '#fff8e1' }}>
        <strong style={{ color: '#7a5b12', fontSize: 13.5 }}>Servicio de estudio no disponible</strong>
        <p style={{ fontSize: 12, color: '#7a5b12', margin: '6px 0 0', lineHeight: 1.45 }}>
          El servicio de estudio de crédito no aceptó la credencial: <em>{algorithm?.error?.message}</em>. Avisa al
          administrador para renovarla. La solicitud quedó guardada y se evaluará cuando el servicio esté disponible.
        </p>
      </div>
    );
  } else if (failure === 'definitive') {
    verdict = (
      <div className="card" role="alert" style={{ borderColor: '#f6caca', background: '#fdecec' }}>
        <strong style={{ color: '#b00020', fontSize: 13.5 }}>No se pudo evaluar la solicitud</strong>
        <p style={{ fontSize: 12, color: '#7a1d1d', margin: '6px 0 0', lineHeight: 1.45 }}>{algorithm?.error?.message}</p>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.45 }}>
          Reintenta si fue una falla del servicio, o corrige los datos y crea la solicitud de nuevo (el cliente
          deberá firmar otra vez la autorización).
        </p>
      </div>
    );
  } else if (failure === 'offline') {
    verdict = (
      <div className="card" role="alert" style={{ borderColor: '#f3d27a', background: '#fff8e1' }}>
        <strong style={{ color: '#7a5b12', fontSize: 13.5 }}>No pudimos conectar con el servicio de estudio</strong>
        <p style={{ fontSize: 12, color: '#7a5b12', margin: '6px 0 0', lineHeight: 1.45 }}>
          La solicitud quedó guardada y se reintentará en segundo plano. Consulta su estado en la lista de estudios de
          crédito y retómala desde ahí cuando tenga respuesta.
        </p>
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: '6px 0 0' }}>Detalle: {algorithm?.error?.message}</p>
      </div>
    );
  } else if (failure === 'failed') {
    verdict = (
      <div className="card" role="alert" style={{ borderColor: '#f3d27a', background: '#fff8e1' }}>
        <strong style={{ color: '#7a5b12', fontSize: 13.5 }}>⚠ Saman no pudo completar el estudio</strong>
        <p style={{ fontSize: 12, color: '#7a5b12', margin: '6px 0 0', lineHeight: 1.45 }}>{algorithm?.error?.message}</p>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.45 }}>
          Puedes reintentar el estudio o corregir los datos y crear la solicitud de nuevo (el cliente deberá firmar
          otra vez la autorización).
        </p>
      </div>
    );
  } else if (polling) {
    const message = WAIT_MESSAGES[Math.min(Math.floor(elapsed / WAIT_MESSAGE_EVERY_S), WAIT_MESSAGES.length - 1)];
    verdict = (
      <div className="card study-wait">
        <span className="spinner" aria-hidden="true" />
        <div>
          <strong>Procesando la solicitud</strong>
          {/* key: reinicia la animación de entrada con cada mensaje nuevo. */}
          <p key={message} className="wait-msg" role="status" aria-live="polite">{message}</p>
          <p style={{ fontSize: 10.5 }}>Puede tardar hasta un minuto.</p>
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
          <strong>La validación sigue en segundo plano.</strong> Puedes salir de esta pantalla. Consulta el estado
          en la lista de estudios de crédito: cuando tenga respuesta podrás retomarla desde ahí con el botón
          <strong> Retomar</strong>.
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
        {algorithm?.reason && <p style={{ marginTop: 8 }}>{algorithm.reason}</p>}
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
            ? algorithm?.reason
              ? `Motivo: ${algorithm.reason}. Comunícate con el cliente para informarle la decisión.`
              : 'El algoritmo de crédito rechazó esta solicitud. Comunícate con el cliente para informarle la decisión.'
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

      {credit.status === 'pre_approved' && (
        <>
          <div className="sectitle" style={{ marginTop: 4 }}>Condiciones de pago</div>
          <div className="cond">
            <div className="crow g">
              <span className="pill">0 – 30<br />días</span>
              <div className="cc">
                <div className="t">Sin intereses remuneratorios</div>
                <div className="d">Contados desde la entrega del bien. Si paga dentro de este plazo, no se cobran intereses.</div>
              </div>
            </div>
            <div className="crow y">
              <span className="pill">31 – 90<br />días</span>
              <div className="cc">
                <div className="t">Con intereses remuneratorios</div>
                <div className="d">Se causan intereses sobre el saldo.</div>
                <span className="tag">POR DEFINIR EN JUNTA</span>
              </div>
            </div>
            <div className="crow r">
              <span className="pill">+ de 90<br />días</span>
              <div className="cc">
                <div className="t">Intereses moratorios</div>
                <div className="d">Pasa a mora y se activa la escala de cartera (bloqueo de despachos).</div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="sectitle" style={{ marginTop: 4 }}>Detalle de la solicitud</div>
      <div className="card">
        <div className="stk"><div className="k">Estado</div><div className="v" style={{ color: statusMeta(credit.status).color }}>{statusMeta(credit.status).label}</div></div>
        <div className="stk"><div className="k">Radicado</div><div className="v">{credit.applicationNumber || '—'}</div></div>
        <div className="stk"><div className="k">Decidido</div><div className="v">{decidedAt || '—'}</div></div>
        <div className="stk"><div className="k">NIT</div><div className="v">{credit.nit || '—'}</div></div>
        <div className="stk"><div className="k">Tipo de persona</div><div className="v">{answers.personType === 'juridica' ? 'Jurídica' : answers.personType === 'natural' ? 'Natural' : '—'}</div></div>
        <div className="stk"><div className="k">Años de experiencia</div><div className="v">{String(answers.yearsExperience ?? '—')}</div></div>
        <div className="stk"><div className="k">Valor de la oportunidad</div><div className="v">${Number(answers.opportunityValue ?? 0).toLocaleString('es-CO')}</div></div>
        {!!algorithm?.score && (
          <div className="stk"><div className="k">Puntaje del algoritmo</div><div className="v">{algorithm.score}</div></div>
        )}
        {algorithm?.reason && (
          <div className="stk"><div className="k">Motivo</div><div className="v">{algorithm.reason}</div></div>
        )}
        <div className="stk"><div className="k">Confiabilidad</div><div className="v">{answers.reliabilityScore ? `${answers.reliabilityScore} de 5` : '—'}</div></div>
      </div>

      {error && <p style={{ color: '#c62828', fontSize: 12, margin: '10px 2px' }}>{error}</p>}

      <div className="sp" />
      <div className="action-bar stacked">
        {(failure === 'definitive' || failure === 'failed') && (
          <>
            <button className="btn btn-primary" disabled={busy} onClick={retry}>
              {busy ? 'Procesando…' : 'Reintentar'}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={recreate}>
              Corregir y crear de nuevo
            </button>
          </>
        )}
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
